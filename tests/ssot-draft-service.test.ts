import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { KVNamespace, DraftWorkspacePayload, PublicPortalManifestPayload, PublicNodePayload } from '../src/types/edge';
import { createDefaultCanvasDocument } from '../src/utils/canvasDefaults';
import { handleDraftRoute } from '../src/edge/handlers/draftHandler';
import { handleFolioEdgeRequest } from '../src/edge/router';
import {
  initDraftSession,
  getDraftWorkspace,
  saveDraftWorkspace,
  saveDraftNodeCanvas,
  discardDraftWorkspace,
} from '../src/services/draftService';

const ROOT_DIR = path.resolve(__dirname, '..');
const DRAFT_SERVICE_PATH = path.join(ROOT_DIR, 'src/services/draftService.ts');

function createMockKV(initial: Record<string, unknown> = {}): KVNamespace & { store: Map<string, string> } {
  const store = new Map<string, string>();
  for (const [k, v] of Object.entries(initial)) {
    store.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  return {
    store,
    async get(key: string, options?: any): Promise<any> {
      const val = store.get(key) ?? null;
      if (val === null) return null;
      if (options === 'json' || options?.type === 'json') {
        return JSON.parse(val);
      }
      return val;
    },
    async put(key: string, value: string | ArrayBuffer | ReadableStream): Promise<void> {
      store.set(key, typeof value === 'string' ? value : String(value));
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async list(options?: { prefix?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean }> {
      const prefix = options?.prefix || '';
      return {
        keys: Array.from(store.keys())
          .filter((k) => k.startsWith(prefix))
          .map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
}

function seedLock(kv: KVNamespace & { store: Map<string, string> }, lockToken = 'valid-lock-token-123456') {
  kv.store.set(
    'lock:coordinator',
    JSON.stringify({
      lockToken,
      acquiredAt: Date.now() - 1000,
      expiresAt: Date.now() + 600_000,
    })
  );
  return lockToken;
}

describe('Subtask 7.4: Live Cloudflare KV Draft Workspace (draft:workspace) SSOT', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Static SSOT Purity Audit (draftService.ts)', () => {
    it('contains zero module-level inMemoryDraft* variables, zero localStorage calls, and zero Supabase calls', () => {
      const raw = fs.readFileSync(DRAFT_SERVICE_PATH, 'utf8');
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      expect(code).not.toMatch(/\binMemoryDraftCanvases\b/);
      expect(code).not.toMatch(/\binMemoryDraftActive\b/);
      expect(code).not.toMatch(/\binMemoryDraftBaseId\b/);
      expect(code).not.toMatch(/\binMemoryDraftDirty\b/);
      expect(code).not.toMatch(/\b(localStorage|sessionStorage|indexedDB)\b/);
      expect(code).not.toMatch(/engine_drafts|rest\/v1\/|supabase/i);
    });
  });

  describe('Edge Draft Handler (/api/draft & /api/draft/init)', () => {
    it('returns HTTP 503 when KV namespace is unbound', async () => {
      const req = new Request('https://example.com/api/draft', {
        method: 'GET',
        headers: { Authorization: 'Bearer tok' },
      });
      const res = await handleDraftRoute(req, {}, null);
      expect(res.status).toBe(503);
    });

    it('returns HTTP 401 when Authorization Bearer lockToken is missing or invalid', async () => {
      const kv = createMockKV();
      seedLock(kv, 'real-token');

      const missingAuthRes = await handleDraftRoute(
        new Request('https://example.com/api/draft', { method: 'GET' }),
        {},
        kv
      );
      expect(missingAuthRes.status).toBe(401);

      const wrongAuthRes = await handleDraftRoute(
        new Request('https://example.com/api/draft', {
          method: 'GET',
          headers: { Authorization: 'Bearer wrong-token' },
        }),
        {},
        kv
      );
      expect(wrongAuthRes.status).toBe(401);
    });

    it('POST /api/draft/init bootstraps cold boot when portal:manifest === null && history:index === null', async () => {
      const kv = createMockKV();
      const token = seedLock(kv);

      const res = await handleFolioEdgeRequest(
        new Request('https://example.com/api/draft/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nodeIds: ['access', 'equity'], authorSessionId: 'coord-1' }),
        }),
        { KV_ENGINE_PUBLIC: kv }
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as DraftWorkspacePayload;
      expect(data.baseSnapshotId).toBe('uninitialized');
      expect(data.dirty).toBe(true);
      expect(data.revision).toBe(1);
      expect(data.authorSessionId).toBe('coord-1');
      expect(Object.keys(data.canvases)).toEqual(['access', 'equity']);
      expect(data.canvases.access.nodeId).toBe('access');
      expect(data.contentOverrides).toEqual({});

      const stored = await kv.get<DraftWorkspacePayload>('draft:workspace', 'json');
      expect(stored).not.toBeNull();
      expect(stored?.baseSnapshotId).toBe('uninitialized');
    });

    it('POST /api/draft/init clones published baseline from portal:manifest and versioned node keys', async () => {
      const accessCanvas = createDefaultCanvasDocument('access');
      accessCanvas.sections = [{ id: 'sec-1', type: 'section', title: 'Published Section', elements: [] }];

      const manifest: PublicPortalManifestPayload = {
        activeSnapshotId: 'snap-100',
        publishedAt: '2026-11-18T00:00:00Z',
        nodeIds: ['access'],
        schemaVersion: 1,
        contentOverrides: { 'hero.title': 'Live Portal Title' },
      };

      const nodePayload: PublicNodePayload = {
        nodeId: 'access',
        snapshotId: 'snap-100',
        version: 1,
        updatedAt: '2026-11-18T00:00:00Z',
        canvas: accessCanvas,
      };

      const kv = createMockKV({
        'portal:manifest': manifest,
        'node:snap-100:access': nodePayload,
      });
      const token = seedLock(kv);

      const res = await handleDraftRoute(
        new Request('https://example.com/api/draft/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nodeIds: ['access'] }),
        }),
        {},
        kv
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as DraftWorkspacePayload;
      expect(data.baseSnapshotId).toBe('snap-100');
      expect(data.dirty).toBe(false);
      expect(data.revision).toBe(1);
      expect(data.canvases.access.sections[0].title).toBe('Published Section');
      expect(data.contentOverrides).toEqual({ 'hero.title': 'Live Portal Title' });
    });

    it('POST /api/draft/init fails stop with HTTP 502 when portal:manifest exists but an expected node:* key is missing', async () => {
      const manifest: PublicPortalManifestPayload = {
        activeSnapshotId: 'snap-100',
        publishedAt: '2026-11-18T00:00:00Z',
        nodeIds: ['access', 'equity'],
        schemaVersion: 1,
      };

      const kv = createMockKV({
        'portal:manifest': manifest,
        'node:snap-100:access': {
          nodeId: 'access',
          snapshotId: 'snap-100',
          version: 1,
          updatedAt: '2026-11-18T00:00:00Z',
          canvas: createDefaultCanvasDocument('access'),
        },
        // equity is missing!
      });
      const token = seedLock(kv);

      const res = await handleDraftRoute(
        new Request('https://example.com/api/draft/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nodeIds: ['access', 'equity'] }),
        }),
        {},
        kv
      );

      expect(res.status).toBe(502);
      expect(await kv.get('draft:workspace')).toBeNull();
    });

    it('POST /api/draft/init returns existing active dirty draft without overwriting', async () => {
      const existingDraft: DraftWorkspacePayload = {
        baseSnapshotId: 'snap-99',
        dirty: true,
        revision: 4,
        updatedAt: '2026-11-18T00:10:00Z',
        authorSessionId: 'coord-1',
        canvases: { access: createDefaultCanvasDocument('access') },
        contentOverrides: { 'hero.title': 'Unsaved Edit' },
      };

      const kv = createMockKV({
        'portal:manifest': {
          activeSnapshotId: 'snap-100',
          publishedAt: '2026-11-18T00:15:00Z',
          nodeIds: ['access'],
          schemaVersion: 1,
        },
        'draft:workspace': existingDraft,
      });
      const token = seedLock(kv);

      const res = await handleDraftRoute(
        new Request('https://example.com/api/draft/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nodeIds: ['access'] }),
        }),
        {},
        kv
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as DraftWorkspacePayload;
      expect(data.revision).toBe(4);
      expect(data.contentOverrides['hero.title']).toBe('Unsaved Edit');
    });

    it('GET /api/draft returns HTTP 404 when no draft:workspace exists and HTTP 200 with no-store when present', async () => {
      const kv = createMockKV();
      const token = seedLock(kv);

      const res404 = await handleFolioEdgeRequest(
        new Request('https://example.com/api/draft', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }),
        { KV_ENGINE_PUBLIC: kv }
      );
      expect(res404.status).toBe(404);

      const draft: DraftWorkspacePayload = {
        baseSnapshotId: 'snap-1',
        dirty: false,
        revision: 1,
        updatedAt: '2026-11-18T00:00:00Z',
        authorSessionId: 'coord-1',
        canvases: {},
        contentOverrides: {},
      };
      await kv.put('draft:workspace', JSON.stringify(draft));

      const res200 = await handleFolioEdgeRequest(
        new Request('https://example.com/api/draft', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }),
        { KV_ENGINE_PUBLIC: kv }
      );
      expect(res200.status).toBe(200);
      expect(res200.headers.get('Cache-Control')).toBe('no-store');
      expect(((await res200.json()) as DraftWorkspacePayload).baseSnapshotId).toBe('snap-1');
    });

    it('PUT /api/draft enforces optimistic concurrency (expectedRevision & expectedUpdatedAt) returning 409 on conflict', async () => {
      const initialDraft: DraftWorkspacePayload = {
        baseSnapshotId: 'snap-1',
        dirty: false,
        revision: 2,
        updatedAt: '2026-11-18T00:00:00.000Z',
        authorSessionId: 'coord-1',
        canvases: { access: createDefaultCanvasDocument('access') },
        contentOverrides: { k1: 'v1' },
      };
      const kv = createMockKV({ 'draft:workspace': initialDraft });
      const token = seedLock(kv);

      // Stale revision -> 409
      const conflictRevRes = await handleDraftRoute(
        new Request('https://example.com/api/draft', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            expectedRevision: 1,
            contentOverrides: { k1: 'v2' },
          }),
        }),
        {},
        kv
      );
      expect(conflictRevRes.status).toBe(409);
      const conflictBody = (await conflictRevRes.json()) as { error: string; latestWorkspace: DraftWorkspacePayload };
      expect(conflictBody.latestWorkspace.revision).toBe(2);

      // Stale updatedAt -> 409
      const conflictTimeRes = await handleDraftRoute(
        new Request('https://example.com/api/draft', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            expectedUpdatedAt: '2026-11-17T23:59:59.000Z',
            contentOverrides: { k1: 'v2' },
          }),
        }),
        {},
        kv
      );
      expect(conflictTimeRes.status).toBe(409);

      // Matching revision & updatedAt -> 200, revision incremented, dirty = true
      const okRes = await handleDraftRoute(
        new Request('https://example.com/api/draft', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            expectedRevision: 2,
            expectedUpdatedAt: '2026-11-18T00:00:00.000Z',
            contentOverrides: { k1: 'v2' },
          }),
        }),
        {},
        kv
      );
      expect(okRes.status).toBe(200);
      const updated = (await okRes.json()) as DraftWorkspacePayload;
      expect(updated.revision).toBe(3);
      expect(updated.dirty).toBe(true);
      expect(updated.contentOverrides.k1).toBe('v2');
      expect(updated.canvases.access).toBeDefined();
    });

    it('DELETE /api/draft discards draft:workspace and re-clones from live portal:manifest', async () => {
      const liveAccess = createDefaultCanvasDocument('access');
      liveAccess.sections = [{ id: 's-live', type: 'section', title: 'Live Baseline', elements: [] }];

      const dirtyAccess = createDefaultCanvasDocument('access');
      dirtyAccess.sections = [{ id: 's-dirty', type: 'section', title: 'Dirty Draft', elements: [] }];

      const kv = createMockKV({
        'portal:manifest': {
          activeSnapshotId: 'snap-5',
          publishedAt: '2026-11-18T00:00:00Z',
          nodeIds: ['access'],
          schemaVersion: 1,
          contentOverrides: { 'hero.title': 'Live' },
        },
        'node:snap-5:access': {
          nodeId: 'access',
          snapshotId: 'snap-5',
          version: 1,
          updatedAt: '2026-11-18T00:00:00Z',
          canvas: liveAccess,
        },
        'draft:workspace': {
          baseSnapshotId: 'snap-5',
          dirty: true,
          revision: 9,
          updatedAt: '2026-11-18T00:05:00Z',
          authorSessionId: 'coord-1',
          canvases: { access: dirtyAccess },
          contentOverrides: { 'hero.title': 'Dirty' },
        },
      });
      const token = seedLock(kv);

      const res = await handleDraftRoute(
        new Request('https://example.com/api/draft', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
        {},
        kv
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as DraftWorkspacePayload;
      expect(data.dirty).toBe(false);
      expect(data.revision).toBe(1);
      expect(data.canvases.access.sections[0].title).toBe('Live Baseline');
      expect(data.contentOverrides).toEqual({ 'hero.title': 'Live' });
    });
  });

  describe('Client draftService.ts Fail-Stop KV Operations', () => {
    it('initDraftSession and saveDraftWorkspace throw immediately when /api/draft returns non-2xx or network error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'KV unavailable' }), { status: 503 })
      ) as unknown as typeof fetch;

      await expect(initDraftSession(['access'], 'tok-1')).rejects.toThrow(/503|KV unavailable/i);
      await expect(getDraftWorkspace('tok-1')).rejects.toThrow(/503|KV unavailable/i);
      await expect(saveDraftWorkspace({ dirty: true }, 'tok-1', 1)).rejects.toThrow(/503|KV unavailable/i);
      await expect(
        saveDraftNodeCanvas('access', createDefaultCanvasDocument('access'), 'tok-1', 1)
      ).rejects.toThrow(/503|KV unavailable/i);
      await expect(discardDraftWorkspace(['access'], 'tok-1')).rejects.toThrow(/503|KV unavailable/i);

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network down')) as unknown as typeof fetch;
      await expect(initDraftSession(['access'], 'tok-1')).rejects.toThrow(/Network down/i);
      await expect(saveDraftWorkspace({ dirty: true }, 'tok-1', 1)).rejects.toThrow(/Network down/i);
    });

    it('initDraftSession, saveDraftNodeCanvas, and discardDraftWorkspace send Bearer lockToken and expectedRevision', async () => {
      const mockWorkspace: DraftWorkspacePayload = {
        baseSnapshotId: 'snap-1',
        dirty: false,
        revision: 1,
        updatedAt: '2026-11-18T00:00:00Z',
        authorSessionId: 'coord',
        canvases: { access: createDefaultCanvasDocument('access') },
        contentOverrides: {},
      };

      const fetchSpy = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify(mockWorkspace), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const initialized = await initDraftSession(['access'], 'tok-abc');
      expect(initialized.baseSnapshotId).toBe('snap-1');
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/draft/init',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }),
        })
      );

      await saveDraftNodeCanvas('access', createDefaultCanvasDocument('access'), 'tok-abc', 1);
      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/draft',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }),
        })
      );
      const putBody = JSON.parse((fetchSpy.mock.calls[1][1] as RequestInit).body as string);
      expect(putBody.expectedRevision).toBe(1);
      expect(putBody.canvases.access.nodeId).toBe('access');

      await discardDraftWorkspace(['access'], 'tok-abc');
      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/draft',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }),
        })
      );
    });
  });
});
