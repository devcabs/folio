import { describe, it, expect, vi } from 'vitest';
import type {
  DraftWorkspacePayload,
  KVNamespace,
  PublicNodePayload,
  PublicPortalManifestPayload,
} from '../../src/types/edge';
import type { PublishedSnapshot } from '../../src/types/history';
import type { PageNode } from '../../src/types/page';
import type { NodeCanvasDocument, PageLinkElement } from '../../src/types/canvas';
import { createDefaultCanvasDocument } from '../../src/utils/canvasDefaults';
import {
  compilePortalManifest,
  compilePublicNodePayload,
  transformCanvasAst,
} from '../../src/services/edgePreBakeService';
import { handleDraftRoute } from '../../src/edge/handlers/draftHandler';
import { handlePublishRoute } from '../../src/edge/handlers/publishHandler';
import {
  handleHistoryRoute,
  SYSTEM_BASELINE_SNAPSHOT_ID,
} from '../../src/edge/handlers/historyHandler';
import { handlePublicNodeRoute } from '../../src/edge/handlers/publicHandler';

function createMemoryKV(initial: Record<string, unknown> = {}): {
  kv: KVNamespace;
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  for (const [k, v] of Object.entries(initial)) {
    store.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }

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

function makeLockRecord(lockToken = 'valid-lock-token') {
  return {
    lockToken,
    acquiredAt: Date.now() - 1000,
    expiresAt: Date.now() + 60_000,
  };
}

const DEFAULT_SUMMARY = {
  totalSections: 1,
  totalSubsections: 0,
  totalLeafElements: 1,
  totalTextOverrides: 0,
  totalTextElements: 0,
  totalPhotoElements: 0,
  totalChartElements: 1,
};

function makePageNode(overrides: Partial<PageNode> & { id: string }): PageNode {
  return {
    parentId: 'access',
    slug: overrides.id,
    title: `Title ${overrides.id}`,
    order: 0,
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
    ...overrides,
  };
}

function makePageLinkElement(id: string, targetPageId: string): PageLinkElement {
  return {
    id,
    type: 'page-link',
    targetPageId,
  };
}

function makeCanvasWithPageLinkAndChart(
  nodeId: string,
  targetPageId?: string
): NodeCanvasDocument {
  const doc = createDefaultCanvasDocument(nodeId);
  const elements: any[] = [
    {
      id: `chart-${nodeId}`,
      type: 'chart',
      chartId: `chart-${nodeId}`,
      title: 'Metric',
      config: {
        chartType: 'bar',
        sheetUrl: 'https://docs.google.com/spreadsheets/d/secret-sheet/edit',
      },
    },
  ];
  if (targetPageId) {
    elements.push(makePageLinkElement(`plink-${targetPageId}`, targetPageId));
  }
  doc.elements = [
    {
      id: `sec-${nodeId}`,
      type: 'section',
      number: '1',
      title: `Section ${nodeId}`,
    },
    ...elements,
  ];
  return doc;
}

describe('Subtask 13.4: Edge Pre-Bake & Cloudflare KV Draft / Publish / History Pipeline', () => {
  describe('1. POST /api/draft/init hydration & cold boot', () => {
    it('initializes pages: {} on cold boot when portal:manifest and history:index are null', async () => {
      const { kv } = createMemoryKV({
        'lock:coordinator': makeLockRecord('tok-1'),
      });

      const req = new Request('https://folio.test/api/draft/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok-1',
        },
        body: JSON.stringify({ nodeIds: ['access'], authorSessionId: 'coord-1' }),
      });

      const res = await handleDraftRoute(req, {}, kv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as DraftWorkspacePayload;
      expect(body.baseSnapshotId).toBe('uninitialized');
      expect(body.pages).toEqual({});
      expect(body.canvases.access).toBeDefined();
    });

    it('hydrates pages and all dynamic page-* canvases from portal:manifest + history:snapshot:*', async () => {
      const pageA = makePageNode({ id: 'page-a', parentId: 'access', slug: 'page-a' });
      const pageB = makePageNode({ id: 'page-b', parentId: 'page-a', slug: 'page-b' });

      const snap: PublishedSnapshot = {
        id: 'snap-1',
        schemaVersion: 1,
        title: 'Snap 1',
        description: 'Initial',
        createdAt: '2026-11-18T00:00:00.000Z',
        authorSessionId: 'coord-1',
        isActive: true,
        canvases: {
          access: makeCanvasWithPageLinkAndChart('access', 'page-a'),
          'page-a': makeCanvasWithPageLinkAndChart('page-a', 'page-b'),
          'page-b': makeCanvasWithPageLinkAndChart('page-b'),
        },
        contentOverrides: { 'hero.title': 'Hello' },
        pages: {
          'page-a': pageA,
          'page-b': pageB,
        },
        summary: DEFAULT_SUMMARY,
      };

      const manifest: PublicPortalManifestPayload = {
        activeSnapshotId: 'snap-1',
        publishedAt: '2026-11-18T00:00:00.000Z',
        nodeIds: ['access', 'page-a', 'page-b'],
        schemaVersion: 1,
        contentOverrides: { 'hero.title': 'Hello' },
        pages: {
          'page-a': pageA,
          'page-b': pageB,
        },
      };

      const { kv } = createMemoryKV({
        'lock:coordinator': makeLockRecord('tok-1'),
        'portal:manifest': manifest,
        'history:snapshot:snap-1': snap,
        'node:snap-1:access': compilePublicNodePayload('access', snap),
        'node:snap-1:page-a': compilePublicNodePayload('page-a', snap),
        'node:snap-1:page-b': compilePublicNodePayload('page-b', snap),
      });

      const req = new Request('https://folio.test/api/draft/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok-1',
        },
        body: JSON.stringify({ nodeIds: ['access'], authorSessionId: 'coord-1' }),
      });

      const res = await handleDraftRoute(req, {}, kv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as DraftWorkspacePayload;
      expect(body.baseSnapshotId).toBe('snap-1');
      expect(body.pages).toEqual({
        'page-a': pageA,
        'page-b': pageB,
      });
      expect(Object.keys(body.canvases)).toEqual(
        expect.arrayContaining(['access', 'page-a', 'page-b'])
      );
    });
  });

  describe('2. PUT /api/draft validation, optimistic concurrency & atomic deletedPageIds purge', () => {
    it('persists pages, rejects malformed pages or deletedPageIds with HTTP 400, and enforces 409 conflict', async () => {
      const initialDraft: DraftWorkspacePayload = {
        baseSnapshotId: 'uninitialized',
        dirty: false,
        revision: 1,
        updatedAt: '2026-11-18T00:00:00.000Z',
        authorSessionId: 'coord-1',
        canvases: { access: createDefaultCanvasDocument('access') },
        contentOverrides: {},
        pages: {},
      };

      const { kv } = createMemoryKV({
        'lock:coordinator': makeLockRecord('tok-1'),
        'draft:workspace': initialDraft,
      });

      // Malformed pages -> 400
      const badPagesRes = await handleDraftRoute(
        new Request('https://folio.test/api/draft', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-1',
          },
          body: JSON.stringify({
            expectedRevision: 1,
            pages: { 'page-bad': { id: 'INVALID ID!', slug: 'BAD SLUG' } },
          }),
        }),
        {},
        kv
      );
      expect(badPagesRes.status).toBe(400);

      // Malformed deletedPageIds -> 400
      const badDeletedRes = await handleDraftRoute(
        new Request('https://folio.test/api/draft', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-1',
          },
          body: JSON.stringify({
            expectedRevision: 1,
            deletedPageIds: ['valid-id', ''],
          }),
        }),
        {},
        kv
      );
      expect(badDeletedRes.status).toBe(400);

      // Stale expectedRevision -> 409
      const conflictRes = await handleDraftRoute(
        new Request('https://folio.test/api/draft', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-1',
          },
          body: JSON.stringify({
            expectedRevision: 99,
            pages: { 'page-a': makePageNode({ id: 'page-a' }) },
          }),
        }),
        {},
        kv
      );
      expect(conflictRes.status).toBe(409);

      // Valid PUT -> 200
      const pageA = makePageNode({ id: 'page-a' });
      const okRes = await handleDraftRoute(
        new Request('https://folio.test/api/draft', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-1',
          },
          body: JSON.stringify({
            expectedRevision: 1,
            canvases: { 'page-a': createDefaultCanvasDocument('page-a') },
            pages: { 'page-a': pageA },
          }),
        }),
        {},
        kv
      );
      expect(okRes.status).toBe(200);
      const updated = (await okRes.json()) as DraftWorkspacePayload;
      expect(updated.revision).toBe(2);
      expect(updated.pages).toEqual({ 'page-a': pageA });
      expect(updated.canvases['page-a']).toBeDefined();
    });

    it('atomically purges deletedPageIds from BOTH draft.canvases and draft.pages while preserving siblings', async () => {
      const pageA = makePageNode({ id: 'page-a' });
      const pageB = makePageNode({ id: 'page-b', parentId: 'page-a' });
      const pageKeep = makePageNode({ id: 'page-keep' });

      const initialDraft: DraftWorkspacePayload = {
        baseSnapshotId: 'snap-1',
        dirty: false,
        revision: 3,
        updatedAt: '2026-11-18T00:00:00.000Z',
        authorSessionId: 'coord-1',
        canvases: {
          access: createDefaultCanvasDocument('access'),
          'page-a': createDefaultCanvasDocument('page-a'),
          'page-b': createDefaultCanvasDocument('page-b'),
          'page-keep': createDefaultCanvasDocument('page-keep'),
        },
        contentOverrides: {},
        pages: {
          'page-a': pageA,
          'page-b': pageB,
          'page-keep': pageKeep,
        },
      };

      const { kv, store } = createMemoryKV({
        'lock:coordinator': makeLockRecord('tok-1'),
        'draft:workspace': initialDraft,
      });

      const res = await handleDraftRoute(
        new Request('https://folio.test/api/draft', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-1',
          },
          body: JSON.stringify({
            expectedRevision: 3,
            pages: { 'page-keep': pageKeep },
            deletedPageIds: ['page-a', 'page-b'],
          }),
        }),
        {},
        kv
      );

      expect(res.status).toBe(200);
      const updated = (await res.json()) as DraftWorkspacePayload;
      expect(updated.canvases['page-a']).toBeUndefined();
      expect(updated.canvases['page-b']).toBeUndefined();
      expect(updated.canvases['page-keep']).toBeDefined();
      expect(updated.canvases.access).toBeDefined();
      expect(updated.pages).toEqual({ 'page-keep': pageKeep });

      const persisted = JSON.parse(store.get('draft:workspace')!) as DraftWorkspacePayload;
      expect(persisted.canvases['page-a']).toBeUndefined();
      expect(persisted.canvases['page-b']).toBeUndefined();
      expect(persisted.pages).toEqual({ 'page-keep': pageKeep });
    });
  });

  describe('3. Pre-bake & POST /api/publish two-phase staging with dynamic subpages', () => {
    it('preserves PageLinkElement through transformCanvasAst, strips sheetUrl on subpages, stages node:${snapId}:page-a, flips portal:manifest with pages, and resets draft', async () => {
      const pageA = makePageNode({ id: 'page-a', parentId: 'access', slug: 'page-a' });
      const accessCanvas = makeCanvasWithPageLinkAndChart('access', 'page-a');
      const pageACanvas = makeCanvasWithPageLinkAndChart('page-a');

      const transformed = transformCanvasAst(accessCanvas);
      const linkEl = transformed.elements.find(
        (el) => el.type === 'page-link'
      ) as PageLinkElement | undefined;
      expect(linkEl).toBeDefined();
      expect(linkEl?.targetPageId).toBe('page-a');

      const snapshot: PublishedSnapshot = {
        id: 'snap-2',
        schemaVersion: 1,
        title: 'Publish with Subpage',
        description: 'Adds page-a',
        createdAt: '2026-11-19T00:00:00.000Z',
        authorSessionId: 'coord-1',
        isActive: true,
        canvases: {
          access: accessCanvas,
          'page-a': pageACanvas,
        },
        contentOverrides: {},
        pages: {
          'page-a': pageA,
        },
        summary: DEFAULT_SUMMARY,
      };

      const manifest = compilePortalManifest(snapshot);
      expect(manifest.pages).toEqual({ 'page-a': pageA });
      expect(manifest.nodeIds).toEqual(expect.arrayContaining(['access', 'page-a']));

      const { kv, store } = createMemoryKV({
        'lock:coordinator': makeLockRecord('tok-1'),
      });

      const res = await handlePublishRoute(
        new Request('https://folio.test/api/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-1',
          },
          body: JSON.stringify({ snapshot }),
        }),
        {},
        kv
      );

      expect(res.status).toBe(200);

      // Verify staged versioned and unversioned node keys for page-a
      const stagedPageA = JSON.parse(store.get('node:snap-2:page-a')!) as PublicNodePayload;
      expect(stagedPageA.nodeId).toBe('page-a');
      expect(stagedPageA.snapshotId).toBe('snap-2');
      // Zero-leak: sheetUrl stripped on subpage chart
      const chartEl = stagedPageA.canvas.elements.find((e) => e.type === 'chart') as any;
      expect(chartEl.config.sheetUrl).toBeUndefined();

      expect(store.get('node:page-a')).toBeDefined();

      // Verify history:snapshot:snap-2 and portal:manifest include pages
      const storedSnap = JSON.parse(store.get('history:snapshot:snap-2')!) as PublishedSnapshot;
      expect(storedSnap.pages).toEqual({ 'page-a': pageA });

      const storedManifest = JSON.parse(
        store.get('portal:manifest')!
      ) as PublicPortalManifestPayload;
      expect(storedManifest.pages).toEqual({ 'page-a': pageA });
      expect(storedManifest.nodeIds).toEqual(expect.arrayContaining(['access', 'page-a']));

      // Verify draft:workspace reset with dirty: false and pages
      const resetDraft = JSON.parse(store.get('draft:workspace')!) as DraftWorkspacePayload;
      expect(resetDraft.dirty).toBe(false);
      expect(resetDraft.baseSnapshotId).toBe('snap-2');
      expect(resetDraft.pages).toEqual({ 'page-a': pageA });
    });

    it('returns HTTP 400 if snapshot.pages is malformed', async () => {
      const { kv } = createMemoryKV({
        'lock:coordinator': makeLockRecord('tok-1'),
      });

      const res = await handlePublishRoute(
        new Request('https://folio.test/api/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-1',
          },
          body: JSON.stringify({
            snapshot: {
              id: 'snap-bad',
              schemaVersion: 1,
              title: 'Bad',
              description: '',
              createdAt: '2026-11-19T00:00:00.000Z',
              authorSessionId: 'coord-1',
              isActive: true,
              canvases: { access: createDefaultCanvasDocument('access') },
              contentOverrides: {},
              pages: { 'page-bad': { id: 'INVALID!' } },
            },
          }),
        }),
        {},
        kv
      );

      expect(res.status).toBe(400);
    });
  });

  describe('4. GET /api/public/node/:pageId snapshot isolation', () => {
    it('serves active subpage with 200 + ETag and returns 404 after a subsequent publish removes it', async () => {
      const pageA = makePageNode({ id: 'page-a' });
      const snap1: PublishedSnapshot = {
        id: 'snap-1',
        schemaVersion: 1,
        title: 'Snap 1',
        description: '',
        createdAt: '2026-11-18T00:00:00.000Z',
        authorSessionId: 'coord-1',
        isActive: true,
        canvases: {
          access: makeCanvasWithPageLinkAndChart('access', 'page-a'),
          'page-a': makeCanvasWithPageLinkAndChart('page-a'),
        },
        contentOverrides: {},
        pages: { 'page-a': pageA },
        summary: DEFAULT_SUMMARY,
      };

      const { kv } = createMemoryKV({
        'lock:coordinator': makeLockRecord('tok-1'),
      });

      // Publish snap-1 with page-a
      const pub1 = await handlePublishRoute(
        new Request('https://folio.test/api/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-1',
          },
          body: JSON.stringify({ snapshot: snap1 }),
        }),
        {},
        kv
      );
      expect(pub1.status).toBe(200);

      // GET /api/public/node/page-a -> 200 with ETag
      const get1 = await handlePublicNodeRoute(
        new Request('https://folio.test/api/public/node/page-a'),
        'page-a',
        kv
      );
      expect(get1.status).toBe(200);
      expect(get1.headers.get('ETag')).toBeTruthy();

      // Publish snap-2 without page-a (even though legacy node:page-a still exists from snap-1)
      const snap2: PublishedSnapshot = {
        id: 'snap-2',
        schemaVersion: 1,
        title: 'Snap 2',
        description: 'Removed page-a',
        createdAt: '2026-11-19T00:00:00.000Z',
        authorSessionId: 'coord-1',
        isActive: true,
        canvases: {
          access: createDefaultCanvasDocument('access'),
        },
        contentOverrides: {},
        pages: {},
        summary: DEFAULT_SUMMARY,
      };

      const pub2 = await handlePublishRoute(
        new Request('https://folio.test/api/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-1',
          },
          body: JSON.stringify({ snapshot: snap2 }),
        }),
        {},
        kv
      );
      expect(pub2.status).toBe(200);

      // GET /api/public/node/page-a -> 404 (snapshot isolation!)
      const get2 = await handlePublicNodeRoute(
        new Request('https://folio.test/api/public/node/page-a'),
        'page-a',
        kv
      );
      expect(get2.status).toBe(404);
    });
  });

  describe('5. POST /api/history/restore snapshot & baseline reset', () => {
    it('restores older snapshot pages and page-* canvases, and SYSTEM_BASELINE_SNAPSHOT_ID resets pages to {} and drops page-* canvases', async () => {
      const pageA = makePageNode({ id: 'page-a' });
      const oldSnapshot: PublishedSnapshot = {
        id: 'snap-old',
        schemaVersion: 1,
        title: 'Old Snap',
        description: 'Had page-a',
        createdAt: '2026-11-18T00:00:00.000Z',
        authorSessionId: 'coord-1',
        isActive: false,
        canvases: {
          access: makeCanvasWithPageLinkAndChart('access', 'page-a'),
          'page-a': makeCanvasWithPageLinkAndChart('page-a'),
        },
        contentOverrides: { 'hero.title': 'Old' },
        pages: { 'page-a': pageA },
        summary: DEFAULT_SUMMARY,
      };

      const { kv } = createMemoryKV({
        'lock:coordinator': makeLockRecord('tok-1'),
        'history:snapshot:snap-old': oldSnapshot,
        'draft:workspace': {
          baseSnapshotId: 'snap-current',
          dirty: false,
          revision: 4,
          updatedAt: '2026-11-19T00:00:00.000Z',
          authorSessionId: 'coord-1',
          canvases: { access: createDefaultCanvasDocument('access') },
          contentOverrides: {},
          pages: {},
        },
      });

      // Restore snap-old
      const restoreOldRes = await handleHistoryRoute(
        new Request('https://folio.test/api/history/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-1',
          },
          body: JSON.stringify({ snapshotId: 'snap-old' }),
        }),
        {},
        kv
      );
      expect(restoreOldRes.status).toBe(200);
      const restoredOld = (await restoreOldRes.json()) as DraftWorkspacePayload;
      expect(restoredOld.pages).toEqual({ 'page-a': pageA });
      expect(restoredOld.canvases['page-a']).toBeDefined();

      // Restore SYSTEM_BASELINE_SNAPSHOT_ID -> pages: {}, drops page-* canvases
      const restoreBaselineRes = await handleHistoryRoute(
        new Request('https://folio.test/api/history/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-1',
          },
          body: JSON.stringify({ snapshotId: SYSTEM_BASELINE_SNAPSHOT_ID }),
        }),
        {},
        kv
      );
      expect(restoreBaselineRes.status).toBe(200);
      const restoredBaseline = (await restoreBaselineRes.json()) as DraftWorkspacePayload;
      expect(restoredBaseline.pages).toEqual({});
      expect(restoredBaseline.canvases['page-a']).toBeUndefined();
      expect(restoredBaseline.canvases.access).toBeDefined();
    });
  });
});
