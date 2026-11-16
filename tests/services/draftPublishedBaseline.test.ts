import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initDraftSession,
  clearDraftStorage,
  getInMemoryDraftCanvas,
  syncDraftWithPublished,
  getDraftCanvasKey,
} from '../../src/services/draftService';
import {
  getLiveNodeCanvas,
} from '../../src/services/canvasLayoutService';
import {
  getActivePublishedId,
  setActivePublishedId,
  publishNewSnapshot,
} from '../../src/services/historyService';
import { resetEngineConfig } from '../../src/config/engine.config';
import type { NodeCanvasDocument } from '../../src/types/canvas';

describe('Draft Published Baseline & Stale Invalidation Pipeline', () => {
  const originalFetch = global.fetch;
  let storageMap: Map<string, string>;

  beforeEach(() => {
    resetEngineConfig();
    clearDraftStorage();
    storageMap = new Map<string, string>();

    const mockStorage = {
      getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
      setItem: vi.fn((key: string, val: string) => {
        storageMap.set(key, String(val));
      }),
      removeItem: vi.fn((key: string) => {
        storageMap.delete(key);
      }),
      clear: vi.fn(() => {
        storageMap.clear();
      }),
      get length() {
        return storageMap.size;
      },
      key: vi.fn((i: number) => Array.from(storageMap.keys())[i] ?? null),
    };

    (global as any).window = (global as any).window || {};
    (global as any).window.localStorage = mockStorage;
    (global as any).window.dispatchEvent = vi.fn();

    process.env.VITE_SUPABASE_URL = 'https://test-sandbox.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key-12345';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    clearDraftStorage();
    vi.restoreAllMocks();
  });

  it('hydrates draft directly from /api/public/node/:nodeId when edge endpoint returns currently published canvas', async () => {
    const publishedCanvas: NodeCanvasDocument = {
      nodeId: 'access',
      version: 2,
      sections: [
        {
          id: 'sec-published',
          type: 'section',
          title: 'Currently Published Section',
          number: '01',
          elements: [],
        },
      ],
      updatedAt: '2026-11-16T08:00:00.000Z',
    };

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/public/manifest')) {
        return new Response(
          JSON.stringify({
            activeSnapshotId: 'pub-active-snapshot-123',
            publishedAt: '2026-11-16T08:00:00.000Z',
            nodeIds: ['access'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('/api/public/node/access')) {
        return new Response(
          JSON.stringify({
            nodeId: 'access',
            snapshotId: 'pub-active-snapshot-123',
            version: 2,
            updatedAt: '2026-11-16T08:00:00.000Z',
            canvas: publishedCanvas,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('engine_drafts')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    await initDraftSession(true);

    const draftAccess = getInMemoryDraftCanvas('access');
    expect(draftAccess).toBeDefined();
    expect(draftAccess?.sections.length).toBe(1);
    expect(draftAccess?.sections[0].title).toBe('Currently Published Section');
    expect(getActivePublishedId()).toBe('pub-active-snapshot-123');

    // Also verify that local live storage was updated to mirror the published baseline
    const liveDoc = getLiveNodeCanvas('access');
    expect(liveDoc.sections.length).toBe(1);
    expect(liveDoc.sections[0].title).toBe('Currently Published Section');
  });

  it('ignores stale cloud draft when baseSnapshotId does not match current active published snapshot', async () => {
    setActivePublishedId('pub-current-active-999');

    const staleCloudDraft = {
      id: 'active_draft',
      base_snapshot_id: 'pub-obsolete-stale-111',
      canvases: {
        access: {
          nodeId: 'access',
          version: 2,
          sections: [
            {
              id: 'sec-stale',
              type: 'section',
              title: 'Obsolete Draft Changes',
              number: '01',
              elements: [],
            },
          ],
          updatedAt: '2026-11-15T00:00:00.000Z',
        },
      },
      content_overrides: {},
      updated_at: '2026-11-15T00:00:00.000Z',
    };

    const publishedCanvas: NodeCanvasDocument = {
      nodeId: 'access',
      version: 2,
      sections: [
        {
          id: 'sec-live',
          type: 'section',
          title: 'True Active Live Section',
          number: '01',
          elements: [],
        },
      ],
      updatedAt: '2026-11-16T00:00:00.000Z',
    };

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('engine_drafts')) {
        return new Response(JSON.stringify([staleCloudDraft]), { status: 200 });
      }
      if (urlStr.includes('/api/public/manifest')) {
        return new Response(
          JSON.stringify({
            activeSnapshotId: 'pub-current-active-999',
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/api/public/node/access')) {
        return new Response(
          JSON.stringify({
            nodeId: 'access',
            snapshotId: 'pub-current-active-999',
            canvas: publishedCanvas,
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 200 });
    });

    await initDraftSession(false);

    // Draft must NOT load the stale draft from the obsolete base snapshot
    const draftAccess = getInMemoryDraftCanvas('access');
    expect(draftAccess).toBeDefined();
    expect(draftAccess?.sections[0].title).toBe('True Active Live Section');
  });

  it('removes local draft keys in localStorage when syncDraftWithPublished is called', () => {
    storageMap.set(getDraftCanvasKey('access'), JSON.stringify({ nodeId: 'access', sections: [] }));
    expect(storageMap.has(getDraftCanvasKey('access'))).toBe(true);

    syncDraftWithPublished({
      access: {
        nodeId: 'access',
        version: 2,
        sections: [{ id: 'sec-1', type: 'section', title: 'Published', number: '01', elements: [] }],
        updatedAt: '2026-11-16T00:00:00.000Z',
      },
    } as any);

    // Old draft keys must be purged upon publishing
    expect(storageMap.has(getDraftCanvasKey('access'))).toBe(false);
  });

  it('deletes active cloud draft in Supabase when publishing a new snapshot', async () => {
    let deletedCloudDraft = false;

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const method = init?.method || 'GET';

      if (urlStr.includes('/api/publish')) {
        return new Response(
          JSON.stringify({
            success: true,
            snapshotId: 'pub-new-snap',
            cloudSynced: true,
            edgeDeployed: true,
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('engine_drafts') && method === 'DELETE') {
        deletedCloudDraft = true;
        return new Response('', { status: 204 });
      }
      return new Response('{}', { status: 200 });
    });

    const result = await publishNewSnapshot('Release notes for cleanup test');
    expect(result.success).toBe(true);
    expect(deletedCloudDraft).toBe(true);
  });
});
