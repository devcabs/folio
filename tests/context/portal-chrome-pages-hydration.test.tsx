import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  PortalChromeProvider,
  usePortalChrome,
  type PortalChromeContextValue,
} from '../../src/context/PortalChromeContext';
import {
  saveDraftWorkspace,
  EVENT_DRAFT_UPDATED_AT_SYNC,
} from '../../src/services/draftService';
import { publishNewSnapshot } from '../../src/services/historyService';
import type { PageRegistry } from '../../src/types/page';
import type { PublicPortalManifestPayload, DraftWorkspacePayload } from '../../src/types/edge';

function setupDomEnv() {
  const originalElement = (globalThis as any).Element;
  const originalHTMLElement = (globalThis as any).HTMLElement;
  const originalHTMLIFrameElement = (globalThis as any).HTMLIFrameElement;
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalFetch = global.fetch;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  class MockElement {
    nodeType = 1;
    tagName = 'DIV';
    style: Record<string, any> = {};
    childNodes: any[] = [];
    attributes: Record<string, string> = {};
    textContent = '';
    ownerDocument: any;
    appendChild = (c: any) => {
      this.childNodes.push(c);
      return c;
    };
    removeChild = (c: any) => {
      this.childNodes = this.childNodes.filter((x) => x !== c);
      return c;
    };
    setAttribute = (k: string, v: string) => {
      this.attributes[k] = String(v);
    };
    getAttribute = (k: string) => this.attributes[k] ?? null;
    removeAttribute = (k: string) => {
      delete this.attributes[k];
    };
    addEventListener = () => {};
    removeEventListener = () => {};
  }

  class MockHTMLElement extends MockElement {}

  const listeners = new Map<string, Set<(e: Event) => void>>();

  const mockBody = new MockHTMLElement();
  mockBody.tagName = 'BODY';

  const mockDoc: any = {
    nodeType: 9,
    activeElement: null,
    body: mockBody,
    documentElement: { style: {} },
    createElement(tag: string) {
      const el = new MockHTMLElement();
      el.tagName = tag.toUpperCase();
      el.ownerDocument = mockDoc;
      return el;
    },
    createElementNS(_ns: string, tag: string) {
      const el = new MockHTMLElement();
      el.tagName = tag.toUpperCase();
      el.ownerDocument = mockDoc;
      return el;
    },
    createTextNode(text: string) {
      return { nodeType: 3, textContent: text, ownerDocument: mockDoc };
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  mockBody.ownerDocument = mockDoc;

  const mockWindow: any = {
    Element: MockElement,
    HTMLElement: MockHTMLElement,
    HTMLIFrameElement: MockHTMLElement,
    document: mockDoc,
    location: { href: 'http://localhost/', origin: 'http://localhost', search: '', hash: '', pathname: '/' },
    addEventListener: (type: string, cb: (e: Event) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type: string, cb: (e: Event) => void) => {
      listeners.get(type)?.delete(cb);
    },
    dispatchEvent: (e: Event) => {
      const set = listeners.get(e.type);
      if (set) {
        for (const cb of set) cb(e);
      }
      return true;
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };

  mockDoc.defaultView = mockWindow;
  (globalThis as any).Element = MockElement;
  (globalThis as any).HTMLElement = MockHTMLElement;
  (globalThis as any).HTMLIFrameElement = MockHTMLElement;
  (globalThis as any).window = mockWindow;
  (globalThis as any).document = mockDoc;

  return {
    mockDoc,
    mockWindow,
    restore() {
      (globalThis as any).Element = originalElement;
      (globalThis as any).HTMLElement = originalHTMLElement;
      (globalThis as any).HTMLIFrameElement = originalHTMLIFrameElement;
      (globalThis as any).window = originalWindow;
      (globalThis as any).document = originalDocument;
      global.fetch = originalFetch;
      delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    },
  };
}

const samplePages: PageRegistry = {
  'page-1': {
    id: 'page-1',
    parentId: 'access',
    slug: 'regional-hubs',
    title: 'Regional Hubs',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

describe('Subtask 13.6: PortalChromeContext Pages Hydration & Persistence', () => {
  let env: ReturnType<typeof setupDomEnv>;
  let roots: Root[] = [];

  beforeEach(() => {
    env = setupDomEnv();
    roots = [];
  });

  afterEach(() => {
    for (const r of roots) {
      try {
        React.act(() => r.unmount());
      } catch {
        // ignore
      }
    }
    env.restore();
    vi.restoreAllMocks();
  });

  it('boots synchronously at 0ms in Public Mode when window.__FOLIO_MANIFEST__ is present without fetching /api/public/manifest', () => {
    const manifest: PublicPortalManifestPayload = {
      activeSnapshotId: 'pub-123',
      publishedAt: '2026-01-01T00:00:00.000Z',
      nodeIds: ['access'],
      schemaVersion: 1,
      contentOverrides: { 'hero.title': 'Injected Title' },
      pages: samplePages,
    };
    env.mockWindow.__FOLIO_MANIFEST__ = manifest;

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const snapshots: Array<{
      hasHydrated: boolean;
      isHydrating: boolean;
      pages: PageRegistry;
      publishedPages: PageRegistry;
      contentOverrides: Record<string, string>;
    }> = [];

    const Probe: React.FC = () => {
      const ctx = usePortalChrome();
      if (ctx) {
        snapshots.push({
          hasHydrated: ctx.hasHydrated,
          isHydrating: ctx.isHydrating,
          pages: ctx.pages,
          publishedPages: ctx.publishedPages,
          contentOverrides: ctx.contentOverrides,
        });
      }
      return null;
    };

    const container = env.mockDoc.createElement('div');
    const root = createRoot(container);
    roots.push(root);

    React.act(() => {
      root.render(
        React.createElement(
          PortalChromeProvider,
          { isDevModeOverride: false },
          React.createElement(Probe)
        )
      );
    });

    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    const firstRender = snapshots[0];
    expect(firstRender.hasHydrated).toBe(true);
    expect(firstRender.isHydrating).toBe(false);
    expect(firstRender.pages).toEqual(samplePages);
    expect(firstRender.publishedPages).toEqual(samplePages);
    expect(firstRender.contentOverrides).toEqual({ 'hero.title': 'Injected Title' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to GET /api/public/manifest when window.__FOLIO_MANIFEST__ is absent', async () => {
    delete env.mockWindow.__FOLIO_MANIFEST__;

    const manifest: PublicPortalManifestPayload = {
      activeSnapshotId: 'pub-456',
      publishedAt: '2026-01-02T00:00:00.000Z',
      nodeIds: ['access'],
      schemaVersion: 1,
      contentOverrides: { 'hero.title': 'Fetched Title' },
      pages: samplePages,
    };

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    global.fetch = fetchSpy;

    let latestCtx: PortalChromeContextValue | null = null;
    const Probe: React.FC = () => {
      latestCtx = usePortalChrome();
      return null;
    };

    const container = env.mockDoc.createElement('div');
    const root = createRoot(container);
    roots.push(root);

    await React.act(async () => {
      root.render(
        React.createElement(
          PortalChromeProvider,
          { isDevModeOverride: false },
          React.createElement(Probe)
        )
      );
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/public/manifest');
    expect(latestCtx!.hasHydrated).toBe(true);
    expect(latestCtx!.isHydrating).toBe(false);
    expect(latestCtx!.pages).toEqual(samplePages);
    expect(latestCtx!.publishedPages).toEqual(samplePages);
    expect(latestCtx!.contentOverrides).toEqual({ 'hero.title': 'Fetched Title' });
  });

  it('hydrates draft pages in Dev Mode and updates pages reactively via commitWorkspaceMutation', async () => {
    const draftPayload: DraftWorkspacePayload = {
      baseSnapshotId: 'pub-123',
      dirty: true,
      revision: 1,
      updatedAt: '2026-01-03T00:00:00.000Z',
      authorSessionId: 'sess-1',
      canvases: {},
      contentOverrides: { 'hero.title': 'Draft Title' },
      pages: samplePages,
    };

    const updatedPages: PageRegistry = {
      'page-2': {
        id: 'page-2',
        parentId: 'access',
        slug: 'new-hub',
        title: 'New Hub',
        order: 0,
        createdAt: '2026-01-04T00:00:00.000Z',
        updatedAt: '2026-01-04T00:00:00.000Z',
      },
    };

    const updatedDraft: DraftWorkspacePayload = {
      ...draftPayload,
      revision: 2,
      updatedAt: '2026-01-04T00:00:00.000Z',
      pages: updatedPages,
    };

    const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/draft' && (!init || init.method === 'GET')) {
        return new Response(JSON.stringify(draftPayload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url === '/api/draft' && init?.method === 'PUT') {
        return new Response(JSON.stringify(updatedDraft), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });
    global.fetch = fetchSpy as any;

    let latestCtx: PortalChromeContextValue | null = null;
    const Probe: React.FC = () => {
      latestCtx = usePortalChrome();
      return null;
    };

    const container = env.mockDoc.createElement('div');
    const root = createRoot(container);
    roots.push(root);

    await React.act(async () => {
      root.render(
        React.createElement(
          PortalChromeProvider,
          { isDevModeOverride: true, lockTokenOverride: 'tok-abc' },
          React.createElement(Probe)
        )
      );
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/draft',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }),
      })
    );
    expect(latestCtx!.pages).toEqual(samplePages);

    await React.act(async () => {
      await latestCtx!.commitWorkspaceMutation({
        pages: updatedPages,
        deletedPageIds: ['page-1'],
      });
    });

    const putCall = fetchSpy.mock.calls.find(
      ([url, init]) => url === '/api/draft' && init?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const putBody = JSON.parse(putCall![1]!.body as string);
    expect(putBody.pages).toEqual(updatedPages);
    expect(putBody.deletedPageIds).toEqual(['page-1']);
    expect(putBody.expectedUpdatedAt).toBe('2026-01-03T00:00:00.000Z');
    expect(latestCtx!.pages).toEqual(updatedPages);
    expect(latestCtx!.draftUpdatedAt).toBe('2026-01-04T00:00:00.000Z');
  });

  it('bundles draftWorkspace.pages and computes totalSubpages and totalPageLinkElements in publishNewSnapshot', async () => {
    const draftWorkspace: DraftWorkspacePayload = {
      baseSnapshotId: 'pub-1',
      dirty: true,
      revision: 3,
      updatedAt: '2026-01-05T00:00:00.000Z',
      authorSessionId: 'sess-1',
      canvases: {
        access: {
          nodeId: 'access',
          version: 3,
          updatedAt: '2026-01-05T00:00:00.000Z',
          elements: [
            {
              id: 'sec-1',
              type: 'section',
              number: '01',
              title: 'Overview',
            },
            {
              id: 'link-1',
              type: 'page-link',
              pageId: 'page-1',
            } as any,
          ],
        },
      },
      contentOverrides: {},
      pages: samplePages,
    };

    let publishedBody: any = null;
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/draft') {
        return new Response(JSON.stringify(draftWorkspace), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/api/publish') && init?.method === 'POST') {
        publishedBody = JSON.parse(init.body as string);
        return new Response(
          JSON.stringify({ success: true, edgeDeployed: true }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    }) as any;

    const result = await publishNewSnapshot('Added regional hubs subpage', 'Release 2', 'sess-1', {
      lockToken: 'tok-xyz',
    });

    expect(result.success).toBe(true);
    expect(publishedBody?.snapshot?.pages).toEqual(samplePages);
    expect(publishedBody?.snapshot?.summary?.totalSubpages).toBe(1);
    expect(publishedBody?.snapshot?.summary?.totalPageLinkElements).toBe(1);
  });

  it('saveDraftWorkspace forwards pages and deletedPageIds and broadcasts EVENT_DRAFT_UPDATED_AT_SYNC', async () => {
    const syncSpy = vi.fn();
    env.mockWindow.addEventListener(EVENT_DRAFT_UPDATED_AT_SYNC, (e: Event) => {
      syncSpy((e as CustomEvent).detail);
    });

    const updated: DraftWorkspacePayload = {
      baseSnapshotId: 'pub-1',
      dirty: true,
      revision: 4,
      updatedAt: '2026-01-06T00:00:00.000Z',
      authorSessionId: 'sess-1',
      canvases: {},
      contentOverrides: {},
      pages: samplePages,
    };

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    global.fetch = fetchSpy as any;

    await saveDraftWorkspace(
      { pages: samplePages, deletedPageIds: ['page-old'] },
      'tok-123',
      3,
      '2026-01-05T00:00:00.000Z'
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.pages).toEqual(samplePages);
    expect(body.deletedPageIds).toEqual(['page-old']);
    expect(syncSpy).toHaveBeenCalledWith({ updatedAt: '2026-01-06T00:00:00.000Z' });
  });
});
