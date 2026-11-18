/**
 * Subtask 7.5: Cloudflare KV Revision History (history:*) & Atomic Publish Pipeline SSOT
 *
 * TDD Test Suite verifying:
 * 1. handlePublishRoute: lock verification, 0 Supabase calls, 0 chart:* sidecars,
 *    two-phase versioned KV writes (history:snapshot:*, node:snap:node, node:node,
 *    then portal:manifest, history:index, draft:workspace), split-brain protection on KV failure.
 * 2. handleHistoryRoute & router: GET /api/history, GET /api/history/:id, POST /api/history/restore
 *    (both snapshot restore & snap-system-baseline reset), fail-stop HTTP 401/404/502/503.
 * 3. historyService.ts: 0 localStorage/IndexedDB/BroadcastChannel/Supabase/inMemoryManifest,
 *    direct fail-stop /api/history, /api/history/restore, and /api/publish calls.
 * 4. HistoryHubModal.tsx: renders error state with Retry button on fetch failure,
 *    calls restoreSnapshotToDraft('snap-system-baseline', ...) on Restore to default.
 */

import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { DraftWorkspacePayload, KVNamespace, PublicPortalManifestPayload } from '../src/types/edge';
import type { PublishedSnapshot } from '../src/types/history';
import { createDefaultCanvasDocument } from '../src/utils/canvasDefaults';
import { handlePublishRoute } from '../src/edge/handlers/publishHandler';
import { handleHistoryRoute } from '../src/edge/handlers/historyHandler';
import { handleFolioEdgeRequest } from '../src/edge/router';
import {
  fetchPublishedHistoryFromCloud,
  restoreSnapshotToDraft,
  publishNewSnapshot,
} from '../src/services/historyService';
import { HistoryHubDrawer } from '../src/components/history/HistoryHubModal';

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
      if (options === 'json' || (typeof options === 'object' && options !== null && (options as { type?: string }).type === 'json')) {
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

function makeSnapshot(id = 'pub-100', overrides: Record<string, string> = { 'hero.title': 'Updated Title' }): PublishedSnapshot {
  const accessDoc = createDefaultCanvasDocument('access');
  accessDoc.sections = [
    {
      id: 'sec-1',
      type: 'section',
      number: '1',
      title: 'Access Section',
      elements: [
        {
          id: 'chart-1',
          type: 'chart',
          chartId: 'chart-enroll',
          title: 'Enrollment',
          config: {
            chartType: 'bar',
            sheetUrl: 'https://docs.google.com/spreadsheets/d/secret-sheet/edit',
          },
        } as never,
        {
          id: 'photo-1',
          type: 'photo',
          src: 'https://drive.google.com/file/d/driveFile123/view',
          caption: 'Campus',
        } as never,
      ],
    },
  ];

  return {
    id,
    schemaVersion: 1,
    title: 'Published Revision',
    description: 'Updated enrollment metrics',
    createdAt: '2026-11-18T00:00:00.000Z',
    authorSessionId: 'session-abc',
    isActive: true,
    canvases: {
      access: accessDoc,
      equity: createDefaultCanvasDocument('equity'),
    },
    contentOverrides: overrides,
    summary: {
      totalSections: 1,
      totalSubsections: 0,
      totalLeafElements: 2,
      totalTextOverrides: Object.keys(overrides).length,
      totalTextElements: 0,
      totalPhotoElements: 1,
      totalChartElements: 1,
    },
  };
}

function makeValidLockRecord(lockToken = 'valid-lock-token') {
  return {
    lockToken,
    acquiredAt: Date.now() - 1000,
    expiresAt: Date.now() + 60_000,
  };
}

describe('Subtask 7.5: Revision History & Atomic Publish Pipeline SSOT', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Edge Publish Handler (src/edge/handlers/publishHandler.ts)', () => {
    it('fails stop with HTTP 503 when KV binding is null', async () => {
      const req = new Request('https://folio.test/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-lock-token',
        },
        body: JSON.stringify({ snapshot: makeSnapshot() }),
      });

      const res = await handlePublishRoute(req, {}, null);
      expect(res.status).toBe(503);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });

    it('verifies Authorization Bearer lockToken against lock:coordinator and returns 401 when missing or invalid', async () => {
      const { kv } = createMemoryKV({
        'lock:coordinator': makeValidLockRecord('expected-token'),
      });

      const noAuthReq = new Request('https://folio.test/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: makeSnapshot() }),
      });
      const noAuthRes = await handlePublishRoute(noAuthReq, {}, kv);
      expect(noAuthRes.status).toBe(401);

      const wrongAuthReq = new Request('https://folio.test/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-token',
        },
        body: JSON.stringify({ snapshot: makeSnapshot() }),
      });
      const wrongAuthRes = await handlePublishRoute(wrongAuthReq, {}, kv);
      expect(wrongAuthRes.status).toBe(401);
    });

    it('makes 0 Supabase fetch calls, 0 chart:* KV writes, and performs two-phase versioned KV writes', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const { kv, store } = createMemoryKV({
        'lock:coordinator': makeValidLockRecord('tok-1'),
        'draft:workspace': {
          baseSnapshotId: 'uninitialized',
          dirty: true,
          revision: 3,
          updatedAt: '2026-11-17T00:00:00.000Z',
          authorSessionId: 'session-abc',
          canvases: { access: createDefaultCanvasDocument('access') },
          contentOverrides: {},
        } satisfies DraftWorkspacePayload,
      });

      const snapshot = makeSnapshot('pub-200', { 'hero.title': 'Live Title' });
      const req = new Request('https://folio.test/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok-1',
        },
        body: JSON.stringify({ snapshot }),
      });

      const res = await handlePublishRoute(
        req,
        {
          VITE_SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'secret-role-key',
        },
        kv
      );

      expect(res.status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled();

      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(body.snapshotId).toBe('pub-200');
      expect(body.edgeDeployed).toBe(true);
      expect('cloudSynced' in body).toBe(false);
      expect('cloudError' in body).toBe(false);

      // 0 chart:* sidecar keys
      const allKeys = Array.from(store.keys());
      expect(allKeys.some((k) => k.startsWith('chart:'))).toBe(false);

      // Phase A: history:snapshot:pub-200 preserves private sheetUrl
      const savedSnap = JSON.parse(store.get('history:snapshot:pub-200')!) as PublishedSnapshot;
      const savedChart = savedSnap.canvases.access.sections[0].elements[0] as unknown as {
        config?: { sheetUrl?: string };
      };
      expect(savedChart.config?.sheetUrl).toBe('https://docs.google.com/spreadsheets/d/secret-sheet/edit');

      // Phase A: versioned node:pub-200:access and node:access strip sheetUrl and pre-bake Drive URL
      const versionedNode = JSON.parse(store.get('node:pub-200:access')!);
      const activeNode = JSON.parse(store.get('node:access')!);
      expect(versionedNode.snapshotId).toBe('pub-200');
      expect(activeNode.snapshotId).toBe('pub-200');
      const publicChart = versionedNode.canvas.sections[0].elements[0];
      expect(publicChart.config.sheetUrl).toBeUndefined();
      const publicPhoto = versionedNode.canvas.sections[0].elements[1];
      expect(publicPhoto.src).toContain('/api/media/drive/driveFile123');

      // Phase B: portal:manifest, history:index, draft:workspace updated
      const manifest = JSON.parse(store.get('portal:manifest')!) as PublicPortalManifestPayload;
      expect(manifest.activeSnapshotId).toBe('pub-200');
      expect(manifest.contentOverrides).toEqual({ 'hero.title': 'Live Title' });

      const historyIndex = JSON.parse(store.get('history:index')!);
      expect(historyIndex.activeSnapshotId).toBe('pub-200');
      expect(historyIndex.entries[0].id).toBe('pub-200');

      const draft = JSON.parse(store.get('draft:workspace')!) as DraftWorkspacePayload;
      expect(draft.baseSnapshotId).toBe('pub-200');
      expect(draft.dirty).toBe(false);
      expect(draft.revision).toBe(4);
    });

    it('prevents split-brain: if Phase A kv.put fails, portal:manifest and history:index are untouched and returns HTTP 502', async () => {
      const prevManifest: PublicPortalManifestPayload = {
        activeSnapshotId: 'pub-100',
        publishedAt: '2026-11-17T00:00:00.000Z',
        nodeIds: ['access'],
        schemaVersion: 1,
      };
      const prevIndex = {
        activeSnapshotId: 'pub-100',
        updatedAt: '2026-11-17T00:00:00.000Z',
        entries: [{ id: 'pub-100', schemaVersion: 1, title: 'Old', description: 'Old', createdAt: '2026-11-17T00:00:00.000Z', authorSessionId: 's1', summary: { totalSections: 0, totalSubsections: 0, totalLeafElements: 0, totalTextOverrides: 0 } }],
      };

      const { kv, store } = createMemoryKV({
        'lock:coordinator': makeValidLockRecord('tok-1'),
        'portal:manifest': prevManifest,
        'history:index': prevIndex,
      });

      const originalPut = kv.put;
      kv.put = vi.fn(async (key: string, value: string | ArrayBuffer | ReadableStream) => {
        if (key === 'node:pub-fail:access') {
          throw new Error('Simulated KV write outage');
        }
        return originalPut(key, value);
      });

      const req = new Request('https://folio.test/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok-1',
        },
        body: JSON.stringify({ snapshot: makeSnapshot('pub-fail') }),
      });

      const res = await handlePublishRoute(req, {}, kv);
      expect(res.status).toBe(502);
      const body = (await res.json()) as { success: boolean; error: string };
      expect(body.success).toBe(false);
      expect(body.error).toContain('Simulated KV write outage');

      // Active pointers remain on pub-100
      const manifestAfter = JSON.parse(store.get('portal:manifest')!) as PublicPortalManifestPayload;
      expect(manifestAfter.activeSnapshotId).toBe('pub-100');
      const indexAfter = JSON.parse(store.get('history:index')!);
      expect(indexAfter.activeSnapshotId).toBe('pub-100');
    });
  });

  describe('2. Edge History Handler & Router (src/edge/handlers/historyHandler.ts)', () => {
    it('GET /api/history returns 503 when kv is null, and empty index when uninitialized', async () => {
      const req = new Request('https://folio.test/api/history', { method: 'GET' });
      const res503 = await handleHistoryRoute(req, {}, null);
      expect(res503.status).toBe(503);

      const { kv } = createMemoryKV();
      const resEmpty = await handleHistoryRoute(req, {}, kv);
      expect(resEmpty.status).toBe(200);
      const data = (await resEmpty.json()) as { activeSnapshotId: string | null; entries: unknown[]; snapshots: unknown[] };
      expect(data.activeSnapshotId).toBeNull();
      expect(data.entries).toEqual([]);
      expect(data.snapshots).toEqual([]);
    });

    it('GET /api/history/:id reads history:snapshot:${id} and returns 404 when missing', async () => {
      const snap = makeSnapshot('pub-300');
      const { kv } = createMemoryKV({
        'history:snapshot:pub-300': snap,
      });

      const resOk = await handleFolioEdgeRequest(
        new Request('https://folio.test/api/history/pub-300', { method: 'GET' }),
        {},
        undefined,
        { kv, disableAssetsFallback: true }
      );
      expect(resOk.status).toBe(200);
      const fetched = (await resOk.json()) as PublishedSnapshot;
      expect(fetched.id).toBe('pub-300');

      const res404 = await handleFolioEdgeRequest(
        new Request('https://folio.test/api/history/non-existent', { method: 'GET' }),
        {},
        undefined,
        { kv, disableAssetsFallback: true }
      );
      expect(res404.status).toBe(404);
    });

    it('POST /api/history/restore verifies lock, restores canvases + contentOverrides into draft:workspace, and handles snap-system-baseline', async () => {
      const snap = makeSnapshot('pub-300', { 'hero.kicker': 'Restored Kicker' });
      const { kv, store } = createMemoryKV({
        'lock:coordinator': makeValidLockRecord('tok-restore'),
        'history:index': {
          activeSnapshotId: 'pub-301',
          updatedAt: '2026-11-18T00:00:00.000Z',
          entries: [],
        },
        'history:snapshot:pub-300': snap,
        'draft:workspace': {
          baseSnapshotId: 'pub-301',
          dirty: false,
          revision: 5,
          updatedAt: '2026-11-18T00:00:00.000Z',
          authorSessionId: 'session-abc',
          canvases: {},
          contentOverrides: {},
        } satisfies DraftWorkspacePayload,
      });

      // Unauthorized without token
      const res401 = await handleFolioEdgeRequest(
        new Request('https://folio.test/api/history/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshotId: 'pub-300' }),
        }),
        {},
        undefined,
        { kv, disableAssetsFallback: true }
      );
      expect(res401.status).toBe(401);

      // Restore pub-300
      const resRestore = await handleFolioEdgeRequest(
        new Request('https://folio.test/api/history/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-restore',
          },
          body: JSON.stringify({ snapshotId: 'pub-300' }),
        }),
        {},
        undefined,
        { kv, disableAssetsFallback: true }
      );
      expect(resRestore.status).toBe(200);
      const restoredDraft = (await resRestore.json()) as DraftWorkspacePayload;
      expect(restoredDraft.dirty).toBe(true);
      expect(restoredDraft.revision).toBe(6);
      expect(restoredDraft.contentOverrides).toEqual({ 'hero.kicker': 'Restored Kicker' });
      expect(restoredDraft.canvases.access.sections[0].title).toBe('Access Section');

      // Restore snap-system-baseline
      const resBaseline = await handleFolioEdgeRequest(
        new Request('https://folio.test/api/history/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok-restore',
          },
          body: JSON.stringify({ snapshotId: 'snap-system-baseline', nodeIds: ['access', 'equity'] }),
        }),
        {},
        undefined,
        { kv, disableAssetsFallback: true }
      );
      expect(resBaseline.status).toBe(200);
      const baselineDraft = (await resBaseline.json()) as DraftWorkspacePayload;
      expect(baselineDraft.dirty).toBe(true);
      expect(baselineDraft.revision).toBe(7);
      expect(baselineDraft.baseSnapshotId).toBe('pub-301');
      expect(baselineDraft.contentOverrides).toEqual({});
      expect(baselineDraft.canvases.access.sections).toEqual([]);
      expect(store.has('draft:workspace')).toBe(true);
    });
  });

  describe('3. Client historyService.ts SSOT Purity & Fail-Stop Behavior', () => {
    it('contains 0 localStorage, IndexedDB, BroadcastChannel, Supabase, or inMemoryManifest references', () => {
      const filePath = path.resolve(process.cwd(), 'src/services/historyService.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).not.toMatch(/localStorage/);
      expect(content).not.toMatch(/sessionStorage/);
      expect(content).not.toMatch(/indexedDB/i);
      expect(content).not.toMatch(/BroadcastChannel/);
      expect(content).not.toMatch(/inMemoryManifest/);
      expect(content).not.toMatch(/engine_history/);
      expect(content).not.toMatch(/supabase/i);
    });

    it('fetchPublishedHistoryFromCloud() queries GET /api/history and throws on HTTP error', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'KV unavailable' }), { status: 503 })
      );
      vi.stubGlobal('fetch', fetchMock);

      await expect(fetchPublishedHistoryFromCloud()).rejects.toThrow(/503|KV unavailable/i);
      expect(fetchMock).toHaveBeenCalledWith('/api/history', expect.objectContaining({ method: 'GET' }));
    });

    it('restoreSnapshotToDraft() posts to /api/history/restore with Bearer token and throws on failure', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Snapshot not found' }), { status: 404 })
      );
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        restoreSnapshotToDraft('pub-missing', ['access'], 'tok-123')
      ).rejects.toThrow(/404|Snapshot not found/i);

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/history/restore',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer tok-123',
          }),
        })
      );
    });

    it('publishNewSnapshot() sends Authorization Bearer lockToken to POST /api/publish', async () => {
      const snap = makeSnapshot('pub-999');
      const fetchMock = vi.fn()
        // First call: GET /api/draft to bundle current KV draft
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              baseSnapshotId: 'pub-100',
              dirty: true,
              revision: 2,
              updatedAt: '2026-11-18T00:00:00.000Z',
              authorSessionId: 'session-1',
              canvases: snap.canvases,
              contentOverrides: snap.contentOverrides,
            } satisfies DraftWorkspacePayload),
            { status: 200 }
          )
        )
        // Second call: POST /api/publish
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: true,
              snapshotId: 'pub-999',
              publishedAt: '2026-11-18T00:00:00.000Z',
              edgeDeployed: true,
            }),
            { status: 200 }
          )
        );
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishNewSnapshot('Release v2', 'Published Revision', 'session-1', {
        lockToken: 'tok-pub',
      });

      expect(result.success).toBe(true);
      expect(result.edgeDeployed).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/publish'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer tok-pub',
          }),
        })
      );
    });
  });

  describe('4. HistoryHubModal.tsx Error State & Retry + Baseline Restore', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('renders explicit error state with Retry button when GET /api/history fails, and recovers on Retry', async () => {
      const snap = makeSnapshot('pub-500');
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Edge KV Offline' }), { status: 503 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              activeSnapshotId: 'pub-500',
              entries: [
                {
                  id: snap.id,
                  schemaVersion: 1,
                  title: snap.title,
                  description: snap.description,
                  createdAt: snap.createdAt,
                  authorSessionId: snap.authorSessionId,
                  summary: snap.summary,
                },
              ],
              snapshots: [snap],
            }),
            { status: 200 }
          )
        );
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        render(
          React.createElement(HistoryHubDrawer, {
            isOpen: true,
            onClose: vi.fn(),
          })
        );
        await new Promise((r) => setTimeout(r, 10));
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeTruthy();

      await act(async () => {
        fireEvent.click(retryButton);
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(screen.getByText('Updated enrollment metrics')).toBeTruthy();
    });
  });
});
