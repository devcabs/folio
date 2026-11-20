import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import type {
  DraftWorkspacePayload,
  KVNamespace,
  PublicPortalManifestPayload,
} from '../../src/types/edge';
import type { PublishedSnapshot } from '../../src/types/history';
import type { PageNode, PageRegistry } from '../../src/types/page';
import type { NodeCanvasDocument, PageLinkElement } from '../../src/types/canvas';
import { createDefaultCanvasDocument } from '../../src/utils/canvasDefaults';
import { handleFolioEdgeRequest } from '../../src/edge/router';
import {
  buildTwoLevelNavTree,
  findSimilarPages,
  resolvePathToPage,
} from '../../src/services/pageTreeService';
import { createWorkspaceUndoAction, undoRedoService } from '../../src/services/undoRedoService';
import { clearLastKnownDraftUpdatedAt } from '../../src/services/draftService';
import { setEngineConfig, resetEngineConfig } from '../../src/config/engine.config';
import { Breadcrumb } from '../../src/components/ui/Breadcrumb';
import { EditorialSidebar } from '../../src/components/layout/EditorialSidebar';
import { AppHeader } from '../../src/components/layout/AppHeader';
import { CanvasPageLink } from '../../src/components/canvas/CanvasPageLink';
import { CanvasDeleteConfirmModal } from '../../src/components/canvas/CanvasDeleteConfirmModal';
import { PageNotFound } from '../../src/components/feedback/PageNotFound';
import { PortalChromeProvider } from '../../src/context/PortalChromeContext';
import { App } from '../../src/App';

const LOCK_TOKEN = 'e2e-lock-token';

function createMemoryKV(): { kv: KVNamespace; store: Map<string, string> } {
  const store = new Map<string, string>();
  const kv: KVNamespace = {
    get: vi.fn(async (key: string, options?: unknown) => {
      const raw = store.get(key) ?? null;
      if (raw === null) return null;
      if (
        options === 'json' ||
        (typeof options === 'object' &&
          options !== null &&
          (options as { type?: string }).type === 'json')
      ) {
        return JSON.parse(raw);
      }
      return raw;
    }) as KVNamespace['get'],
    put: vi.fn(async (key: string, value: string | ArrayBuffer | ReadableStream) => {
      store.set(key, typeof value === 'string' ? value : String(value));
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (options?: { prefix?: string }) => {
      const prefix = options?.prefix ?? '';
      const keys = Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true };
    }),
  };
  return { kv, store };
}

function makePageNode(
  id: string,
  parentId: string,
  slug: string,
  title: string,
  order: number
): PageNode {
  return {
    id,
    parentId,
    slug,
    title,
    order,
    createdAt: '2026-11-19T00:00:00.000Z',
    updatedAt: '2026-11-19T00:00:00.000Z',
  };
}

function makePageLinkCard(id: string, targetPageId: string): PageLinkElement {
  return {
    id,
    type: 'page-link',
    targetPageId,
  };
}

function makeCanvasWithCards(nodeId: string, cards: PageLinkElement[]): NodeCanvasDocument {
  const base = createDefaultCanvasDocument(nodeId);
  return {
    ...base,
    elements: [
      {
        id: `sec-${nodeId}`,
        type: 'section',
        number: '1',
        title: `${nodeId} Overview`,
      },
      ...cards,
      {
        id: `text-${nodeId}`,
        type: 'text',
        pointId: `text-${nodeId}`,
        content: `Body copy for ${nodeId}`,
      },
    ],
  };
}

function makeSnapshot(
  id: string,
  title: string,
  draft: DraftWorkspacePayload
): PublishedSnapshot {
  return {
    id,
    schemaVersion: 1,
    title,
    description: title,
    createdAt: '2026-11-19T00:00:00.000Z',
    isActive: true,
    authorSessionId: 'coord-1',
    canvases: draft.canvases,
    pages: draft.pages ?? {},
    contentOverrides: draft.contentOverrides ?? {},
    summary: {
      totalSections: Object.keys(draft.canvases).length,
      totalSubsections: 0,
      totalLeafElements: 0,
      totalTextOverrides: 0,
      totalTextElements: 0,
      totalPhotoElements: 0,
      totalChartElements: 0,
    },
  };
}

const SAMPLE_HTML_SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Folio Portal</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

describe('Epic 13 E2E: Dynamic Nested Subpages Full Lifecycle', () => {
  let kv: KVNamespace;
  let store: Map<string, string>;
  let fetchCalls: string[];

  async function edgeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const fullUrl = urlStr.startsWith('http') ? urlStr : `https://folio.test${urlStr.startsWith('/') ? '' : '/'}${urlStr}`;
    fetchCalls.push(new URL(fullUrl).pathname);

    const request = new Request(fullUrl, init);
    const env = {
      KV_ENGINE_PUBLIC: kv,
      ASSETS: {
        fetch: async () =>
          new Response(SAMPLE_HTML_SHELL, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
      },
    };
    return handleFolioEdgeRequest(request, env);
  }

  async function apiJson<T>(path: string, method = 'GET', body?: unknown): Promise<{ status: number; data: T }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LOCK_TOKEN}`,
    };
    const res = await edgeFetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json()) as T;
    return { status: res.status, data };
  }

  let latestUpdatedAt: string | null = null;
  const getDraft = () => apiJson<DraftWorkspacePayload>('/api/draft', 'GET');
  const putDraft = async (patch: Record<string, unknown>) => {
    const res = await apiJson<DraftWorkspacePayload>('/api/draft', 'PUT', {
      authorSessionId: 'coord-1',
      ...patch,
    });
    if (res.data?.updatedAt) {
      latestUpdatedAt = res.data.updatedAt;
    }
    return res;
  };

  beforeEach(async () => {
    resetEngineConfig();
    setEngineConfig({
      branding: { appName: 'Folio E2E', logoText: 'F' },
      nodes: [
        { id: 'access', index: 1, title: 'Access', subtitle: 'Access Node', accentColor: 'var(--color-node-1)' },
        { id: 'equity', index: 2, title: 'Equity', subtitle: 'Equity Node', accentColor: 'var(--color-node-2)' },
      ],
    });
    undoRedoService.clear();
    clearLastKnownDraftUpdatedAt();
    fetchCalls = [];

    const mem = createMemoryKV();
    kv = mem.kv;
    store = mem.store;

    // Seed active coordinator lock
    store.set(
      'lock:coordinator',
      JSON.stringify({
        lockToken: LOCK_TOKEN,
        acquiredAt: Date.now() - 1000,
        expiresAt: Date.now() + 60_000,
      })
    );

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => edgeFetch(input, init)));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    undoRedoService.clear();
    resetEngineConfig();
    if (typeof window !== 'undefined') {
      delete (window as any).__FOLIO_MANIFEST__;
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState({}, '', '/');
      }
    }
  });

  it('executes the complete authoring -> reorder -> single-authority edit -> cross-page undo -> guarded delete -> publish -> Edge HTML inject -> 0ms boot -> Smart 404 -> rollback lifecycle', async () => {
    // -----------------------------------------------------------------------
    // 1. Draft Init & Multi-Level Subpage Creation (Level 2 -> 3 -> 4)
    // -----------------------------------------------------------------------
    const initRes = await apiJson<DraftWorkspacePayload>('/api/draft/init', 'POST', {
      nodeIds: ['access', 'equity'],
      authorSessionId: 'coord-1',
    });
    expect(initRes.status).toBe(200);
    expect(initRes.data.pages).toEqual({});

    const pageResearch = makePageNode('page-research', 'access', 'research', 'Research', 0);
    const pageInterviews = makePageNode('page-interviews', 'page-research', 'interviews', 'Interviews', 0);
    const pageNotes = makePageNode('page-2026-notes', 'page-interviews', '2026-notes', '2026 Notes', 0);

    const pagesLevel4: PageRegistry = {
      [pageResearch.id]: pageResearch,
      [pageInterviews.id]: pageInterviews,
      [pageNotes.id]: pageNotes,
    };

    const canvasesLevel4: Record<string, NodeCanvasDocument> = {
      access: makeCanvasWithCards('access', [makePageLinkCard('card-research', 'page-research')]),
      equity: makeCanvasWithCards('equity', []),
      'page-research': makeCanvasWithCards('page-research', [makePageLinkCard('card-interviews', 'page-interviews')]),
      'page-interviews': makeCanvasWithCards('page-interviews', [makePageLinkCard('card-notes', 'page-2026-notes')]),
      'page-2026-notes': makeCanvasWithCards('page-2026-notes', []),
    };

    const update1 = await putDraft({
      pages: pagesLevel4,
      canvases: canvasesLevel4,
    });
    expect(update1.status).toBe(200);
    expect(Object.keys(update1.data.pages ?? {})).toHaveLength(3);

    // Verify path resolution & Breadcrumb collapsing (Overview / Access / … / Interviews / 2026 Notes)
    const rootNodes = [
      { id: 'access', index: 1, title: 'Access', subtitle: 'Access Node', accentColor: 'var(--color-node-1)' },
      { id: 'equity', index: 2, title: 'Equity', subtitle: 'Equity Node', accentColor: 'var(--color-node-2)' },
    ];
    const resolved = resolvePathToPage(['access', 'research', 'interviews', '2026-notes'], rootNodes, pagesLevel4);
    expect(resolved.matched).toBe(true);
    if (resolved.matched) {
      expect(resolved.pageId).toBe('page-2026-notes');
      expect(resolved.ancestors.map((a) => a.id)).toEqual([
        'access',
        'page-research',
        'page-interviews',
        'page-2026-notes',
      ]);
    }

    const { container: shellContainer } = render(
      <div>
        <Breadcrumb
          items={[
            { id: 'overview', label: 'Overview', onClick: vi.fn() },
            { id: 'access', label: 'Access', onClick: vi.fn() },
            { id: 'page-research', label: 'Research', onClick: vi.fn() },
            { id: 'page-interviews', label: 'Interviews', onClick: vi.fn() },
            { id: 'page-2026-notes', label: '2026 Notes', isCurrent: true },
          ]}
        />
        <EditorialSidebar
          items={[{ id: 'sec-page-2026-notes', label: '2026 Notes Overview', href: '#sec-page-2026-notes' }]}
          activeId="sec-page-2026-notes"
          onBack={vi.fn()}
          backLabel="Interviews"
        />
      </div>
    );

    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Access')).toBeTruthy();
    expect(shellContainer.textContent).toContain('Interviews');
    expect(screen.getByText('2026 Notes')).toBeTruthy();
    expect(screen.queryByText('Research')).toBeNull();
    const ellipsisEl = (Array.from(shellContainer.querySelectorAll('span')) as HTMLElement[]).find(
      (el) => el.textContent === '…'
    );
    expect(ellipsisEl).toBeTruthy();
    expect(ellipsisEl?.getAttribute('aria-hidden')).toBe('true');
    cleanup();

    // -----------------------------------------------------------------------
    // 2. Card Reorder -> AppHeader Level 2 Dropdown Sync
    // -----------------------------------------------------------------------
    const pageBudget = makePageNode('page-budget', 'access', 'budget', 'Budget', 1);
    const pagesWithBudget: PageRegistry = {
      ...pagesLevel4,
      [pageBudget.id]: pageBudget,
    };

    // Reorder: Budget (order 0) above Research (order 1)
    const pagesReordered: PageRegistry = {
      ...pagesWithBudget,
      'page-budget': { ...pageBudget, order: 0 },
      'page-research': { ...pageResearch, order: 1 },
    };
    const accessCanvasReordered = makeCanvasWithCards('access', [
      makePageLinkCard('card-budget', 'page-budget'),
      makePageLinkCard('card-research', 'page-research'),
    ]);

    await putDraft({
      pages: pagesReordered,
      canvases: {
        ...canvasesLevel4,
        access: accessCanvasReordered,
        'page-budget': makeCanvasWithCards('page-budget', []),
      },
    });

    const navItems = buildTwoLevelNavTree(
      rootNodes,
      pagesReordered,
      'access'
    );
    const accessNav = navItems.find((n) => n.pageId === 'access');
    expect(accessNav?.children?.map((c) => c.label)).toEqual(['Budget', 'Research']);

    const { container: headerContainer } = render(
      <AppHeader
        brandTitle="Folio E2E"
        navItems={navItems}
      />
    );
    const hamburger = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(hamburger);
    expect(headerContainer.textContent).toContain('Budget');
    expect(headerContainer.textContent).toContain('Research');
    cleanup();

    // -----------------------------------------------------------------------
    // 3. Single Title Authority (PageNode.title -> Card + Breadcrumb + AppHeader)
    // -----------------------------------------------------------------------
    const pagesTitleEdited: PageRegistry = {
      ...pagesReordered,
      'page-research': { ...pagesReordered['page-research'], title: 'Field Research' },
    };
    await putDraft({ pages: pagesTitleEdited });

    const navAfterRename = buildTwoLevelNavTree(
      [rootNodes[0]],
      pagesTitleEdited,
      'page-research'
    );
    expect(navAfterRename[0].children?.map((c) => c.label)).toEqual(['Budget', 'Field Research']);

    (window as any).__FOLIO_MANIFEST__ = {
      activeSnapshotId: 'snap-preview',
      publishedAt: '2026-11-19T00:00:00.000Z',
      nodeIds: ['access'],
      schemaVersion: 1,
      pages: pagesTitleEdited,
    };
    const { container: authorityContainer } = render(
      <PortalChromeProvider>
        <CanvasPageLink
          element={makePageLinkCard('card-research', 'page-research')}
          nodeId="access"
          onNavigate={vi.fn()}
        />
        <Breadcrumb
          items={[
            { id: 'overview', label: 'Overview', onClick: vi.fn() },
            { id: 'access', label: 'Access', onClick: vi.fn() },
            { id: 'page-research', label: 'Field Research', isCurrent: true },
          ]}
        />
      </PortalChromeProvider>
    );
    const matches = (authorityContainer.textContent ?? '').match(/Field Research/g) ?? [];
    expect(matches.length).toBe(2);
    cleanup();
    delete (window as any).__FOLIO_MANIFEST__;

    // -----------------------------------------------------------------------
    // 4. Cross-Page Undo/Redo + Route Reconciliation
    // -----------------------------------------------------------------------
    let currentPagesState = { ...pagesTitleEdited };
    let currentCanvasesState: Record<string, NodeCanvasDocument> = {
      ...canvasesLevel4,
      access: accessCanvasReordered,
      'page-budget': makeCanvasWithCards('page-budget', []),
    };

    const commitMutation = async (patch: {
      pages?: PageRegistry;
      canvases?: Record<string, NodeCanvasDocument>;
      deletedPageIds?: string[];
    }) => {
      if (patch.pages) currentPagesState = patch.pages;
      if (patch.canvases) currentCanvasesState = { ...currentCanvasesState, ...patch.canvases };
      if (patch.deletedPageIds) {
        for (const id of patch.deletedPageIds) {
          delete currentPagesState[id];
          delete currentCanvasesState[id];
        }
      }
      await putDraft(patch);
    };

    // Record cross-page title edit undo action while user is on 'page-budget'
    const titleUndoAction = createWorkspaceUndoAction({
      type: 'page_update_metadata',
      description: 'Rename Research to Field Research',
      scope: 'page-research',
      before: { pages: pagesReordered },
      after: { pages: pagesTitleEdited },
      getLockToken: () => LOCK_TOKEN,
      getExpectedUpdatedAt: () => latestUpdatedAt,
    });
    undoRedoService.push(titleUndoAction);

    // Undo from budget -> reverts research title on KV without research mounted
    await undoRedoService.popUndoAsync();
    const afterUndoFetch = await getDraft();
    latestUpdatedAt = afterUndoFetch.data.updatedAt ?? latestUpdatedAt;
    expect(afterUndoFetch.data.pages?.['page-research']?.title).toBe('Research');

    // Route reconciliation when undoing page creation while inside temp page
    let currentRoutePath = '/node/access/temp-page/';
    const navigateSpy = vi.fn((path: string) => {
      currentRoutePath = path;
    });

    const pageTemp = makePageNode('page-temp', 'access', 'temp-page', 'Temp Page', 2);
    const pagesWithTemp: PageRegistry = { ...currentPagesState, 'page-temp': pageTemp };
    await commitMutation({
      pages: pagesWithTemp,
      canvases: { 'page-temp': makeCanvasWithCards('page-temp', []) },
    });

    const createTempAction = createWorkspaceUndoAction({
      type: 'page_create',
      description: 'Create Temp Page',
      scope: 'page-temp',
      before: {
        pages: currentPagesState,
        deletedPageIds: ['page-temp'],
      },
      after: {
        pages: pagesWithTemp,
        canvases: { 'page-temp': makeCanvasWithCards('page-temp', []) },
      },
      getLockToken: () => LOCK_TOKEN,
      getExpectedUpdatedAt: () => latestUpdatedAt,
      onWorkspaceReconcile: () => {
        if (currentRoutePath.includes('temp-page')) {
          navigateSpy('/node/access/');
        }
      },
    });
    currentPagesState = pagesWithTemp;
    undoRedoService.push(createTempAction);

    await undoRedoService.popUndoAsync();
    expect(navigateSpy).toHaveBeenCalledWith('/node/access/');
    const afterTempUndo = await getDraft();
    latestUpdatedAt = afterTempUndo.data.updatedAt ?? latestUpdatedAt;
    expect(afterTempUndo.data.pages?.['page-temp']).toBeUndefined();
    expect(afterTempUndo.data.canvases?.['page-temp']).toBeUndefined();

    // -----------------------------------------------------------------------
    // 5. Guarded Branch Deletion (deletedPageIds Purge + Cmd+Z Restore)
    // -----------------------------------------------------------------------
    const onConfirmDelete = vi.fn();
    render(
      <CanvasDeleteConfirmModal
        isOpen={true}
        itemType="page-link"
        targetPageTitle="Research"
        descendantPageCount={2}
        onClose={vi.fn()}
        onConfirm={onConfirmDelete}
      />
    );
    expect(screen.getByText(/DELETE ALL SUBPAGES/i)).toBeTruthy();
    expect(screen.getByText(/2/)).toBeTruthy();

    const confirmBtn = screen.getByRole('button', { name: /delete/i }) as HTMLButtonElement;
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    const guardInput = Array.from(document.body.querySelectorAll('input'))[0] as any;
    expect(guardInput).toBeTruthy();
    const propKey = Object.keys(guardInput).find((k) => k.startsWith('__reactProps$'));
    if (propKey && guardInput[propKey]?.onChange) {
      await act(async () => {
        guardInput[propKey].onChange({ target: { value: 'DELETE ALL SUBPAGES' } });
      });
    } else {
      fireEvent.change(guardInput, { target: { value: 'DELETE ALL SUBPAGES' } });
    }
    expect(confirmBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(confirmBtn);
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
    cleanup();

    const preDeletePages = { ...afterTempUndo.data.pages };
    const preDeleteCanvases = { ...afterTempUndo.data.canvases };
    const postDeletePages = { ...preDeletePages };
    delete postDeletePages['page-research'];
    delete postDeletePages['page-interviews'];
    delete postDeletePages['page-2026-notes'];

    const deleteBranchAction = createWorkspaceUndoAction({
      type: 'page_delete_subtree',
      description: 'Delete Research branch',
      scope: 'access',
      before: {
        pages: preDeletePages,
        canvases: {
          'page-research': preDeleteCanvases['page-research'],
          'page-interviews': preDeleteCanvases['page-interviews'],
          'page-2026-notes': preDeleteCanvases['page-2026-notes'],
        },
      },
      after: {
        pages: postDeletePages,
        deletedPageIds: ['page-research', 'page-interviews', 'page-2026-notes'],
      },
      getLockToken: () => LOCK_TOKEN,
      getExpectedUpdatedAt: () => latestUpdatedAt,
    });

    await commitMutation({
      pages: postDeletePages,
      deletedPageIds: ['page-research', 'page-interviews', 'page-2026-notes'],
    });
    undoRedoService.push(deleteBranchAction);

    const afterBranchDelete = await getDraft();
    latestUpdatedAt = afterBranchDelete.data.updatedAt ?? latestUpdatedAt;
    expect(afterBranchDelete.data.pages?.['page-research']).toBeUndefined();
    expect(afterBranchDelete.data.pages?.['page-interviews']).toBeUndefined();
    expect(afterBranchDelete.data.pages?.['page-2026-notes']).toBeUndefined();
    expect(afterBranchDelete.data.canvases?.['page-research']).toBeUndefined();
    expect(afterBranchDelete.data.canvases?.['page-interviews']).toBeUndefined();
    expect(afterBranchDelete.data.canvases?.['page-2026-notes']).toBeUndefined();

    // Undo restores full subtree + canvases
    await undoRedoService.popUndoAsync();
    const afterBranchUndo = await getDraft();
    latestUpdatedAt = afterBranchUndo.data.updatedAt ?? latestUpdatedAt;
    expect(afterBranchUndo.data.pages?.['page-research']).toBeDefined();
    expect(afterBranchUndo.data.pages?.['page-interviews']).toBeDefined();
    expect(afterBranchUndo.data.pages?.['page-2026-notes']).toBeDefined();
    expect(afterBranchUndo.data.canvases?.['page-2026-notes']).toBeDefined();

    // -----------------------------------------------------------------------
    // 6. Two-Phase Publish + Edge HTML Injection + Zero-Wait Deep-Link Boot
    // -----------------------------------------------------------------------
    const snap1Id = 'snap-e2e-1';
    const pub1 = await apiJson<{ success?: boolean; snapshotId: string }>('/api/publish', 'POST', {
      snapshot: makeSnapshot(snap1Id, 'Snapshot 1 (Full Tree)', afterBranchUndo.data),
    });
    expect(pub1.status).toBe(200);
    expect(pub1.data.snapshotId).toBe(snap1Id);

    const htmlRes = await edgeFetch('/node/access/research/interviews/2026-notes/', {
      headers: { Accept: 'text/html' },
    });
    expect(htmlRes.status).toBe(200);
    const injectedHtml = await htmlRes.text();
    const match = injectedHtml.match(/window\.__FOLIO_MANIFEST__\s*=\s*(\{.*?\});/);
    expect(match).toBeTruthy();

    const parsedInjectedManifest = JSON.parse(match![1]) as PublicPortalManifestPayload;
    expect(parsedInjectedManifest.pages?.['page-2026-notes']?.slug).toBe('2026-notes');

    // Hydrate window.__FOLIO_MANIFEST__ & mount App at deep link in Public Mode
    (window as any).__FOLIO_MANIFEST__ = parsedInjectedManifest;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        pathname: '/node/access/research/interviews/2026-notes/',
        hash: '',
        search: '',
        href: 'http://localhost/node/access/research/interviews/2026-notes/',
      },
    });
    Object.defineProperty(window, 'history', {
      configurable: true,
      writable: true,
      value: {
        replaceState: vi.fn(),
        pushState: vi.fn(),
      },
    });
    (window as any).getComputedStyle = () => ({ getPropertyValue: () => '' });
    (window as any).scrollTo = vi.fn();
    (window as any).matchMedia =
      (window as any).matchMedia ||
      (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));

    fetchCalls = [];

    await act(async () => {
      render(<App />);
    });

    // Zero /api/public/manifest refetch on boot!
    expect(fetchCalls).not.toContain('/api/public/manifest');
    // Deep link resolved cleanly with zero 404 flash!
    expect(screen.queryByText(/Page Not Found/i)).toBeNull();
    cleanup();

    // -----------------------------------------------------------------------
    // 7. Smart 404 Fuzzy Recovery
    // -----------------------------------------------------------------------
    const fuzzy = findSimilarPages(
      ['access', 'research', '2026-notess'],
      rootNodes,
      parsedInjectedManifest.pages ?? {}
    );
    expect(fuzzy.length).toBeGreaterThan(0);
    expect(fuzzy[0].title).toBe('2026 Notes');

    const onSelectSuggestion = vi.fn();
    const onReturnParent = vi.fn();
    const { container: notFoundContainer } = render(
      <PageNotFound
        suggestions={fuzzy}
        nearestParent={{ id: 'page-research', title: 'Research', path: '/#/node/access/research' }}
        onSelectSuggestion={onSelectSuggestion}
        onReturnToParent={onReturnParent}
      />
    );
    expect(screen.getByRole('button', { name: /Return to Research/i })).toBeTruthy();
    const suggestionBtn = (Array.from(notFoundContainer.querySelectorAll('a')) as HTMLElement[]).find((a) =>
      a.textContent?.includes('2026 Notes')
    );
    expect(suggestionBtn).toBeTruthy();
    fireEvent.click(suggestionBtn!);
    expect(onSelectSuggestion).toHaveBeenCalledWith(fuzzy[0].id);
    cleanup();

    // -----------------------------------------------------------------------
    // 8. History Rollback (Delete budget -> Publish Snapshot 2 -> Restore Snapshot 1)
    // -----------------------------------------------------------------------
    const pagesNoBudget = { ...afterBranchUndo.data.pages };
    delete pagesNoBudget['page-budget'];
    const afterBudgetDelete = await putDraft({
      pages: pagesNoBudget,
      deletedPageIds: ['page-budget'],
    });

    const pub2 = await apiJson<{ ok: boolean; snapshotId: string }>('/api/publish', 'POST', {
      snapshot: makeSnapshot('snap-e2e-2', 'Snapshot 2 (Budget Deleted)', afterBudgetDelete.data),
    });
    expect(pub2.status).toBe(200);

    const budgetPublicRes = await edgeFetch('/api/public/node/page-budget');
    expect(budgetPublicRes.status).toBe(404);

    const restoreRes = await apiJson<{ success?: boolean }>('/api/history/restore', 'POST', {
      snapshotId: snap1Id,
      authorSessionId: 'coord-1',
    });
    expect(restoreRes.status).toBe(200);

    const restoredDraft = await getDraft();
    expect(restoredDraft.data.pages?.['page-budget']).toBeDefined();
    expect(restoredDraft.data.canvases?.['page-budget']).toBeDefined();
  });
});
