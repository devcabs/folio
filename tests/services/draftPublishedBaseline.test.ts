import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initDraftSession,
  clearDraftStorage,
  getInMemoryDraftCanvas,
  setInMemoryDraftCanvas,
  syncDraftWithPublished,
  getDraftCanvasKey,
  setDraftModeActive,
  setDraftDirty,
  isDraftDirty,
  getDraftBaseId,
  checkDraftStaleness,
  isDraftStale,
  discardDraftSession,
} from '../../src/services/draftService';
import {
  getNodeCanvas,
  EVENT_DRAFT_CANVAS_CHANGE,
} from '../../src/services/canvasLayoutService';
import {
  getAllContentOverrides,
} from '../../src/utils/contentDb';
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

    const listeners: Record<string, ((e: any) => void)[]> = {};
    (global as any).window = (global as any).window || {};
    (global as any).window.localStorage = mockStorage;
    (global as any).window.addEventListener = vi.fn((type: string, fn: any) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    });
    (global as any).window.removeEventListener = vi.fn((type: string, fn: any) => {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((f) => f !== fn);
      }
    });
    (global as any).window.dispatchEvent = vi.fn((evt: any) => {
      const list = listeners[evt?.type] || [];
      for (const fn of [...list]) {
        fn(evt);
      }
      return true;
    });

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

    // Zero-LocalStorage document policy: initDraftSession strictly updates in-memory draft and never writes live documents to localStorage
    expect(storageMap.has('folio_live_canvas_access')).toBe(false);
    expect(storageMap.has(getDraftCanvasKey('access'))).toBe(false);
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

  it('dispatches EVENT_DRAFT_CANVAS_CHANGE on initDraftSession completion', async () => {
    const dispatchedEvents: any[] = [];
    (global as any).window.dispatchEvent = vi.fn().mockImplementation((evt: any) => {
      dispatchedEvents.push(evt);
      return true;
    });

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/public/manifest')) {
        return new Response(
          JSON.stringify({ activeSnapshotId: 'snap-1', publishedAt: '2026-11-16T08:00:00.000Z', nodeIds: ['access'] }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    });

    await initDraftSession(true);

    const canvasChangeEvents = dispatchedEvents.filter(
      (e) => e.type === EVENT_DRAFT_CANVAS_CHANGE
    );
    expect(canvasChangeEvents.length).toBeGreaterThan(0);
    expect(canvasChangeEvents[0].detail).toEqual({ nodeId: '*' });
  });

  it('syncDraftWithPublished synchronizes draft content overrides and dispatches EVENT_DRAFT_CANVAS_CHANGE', () => {
    const dispatchedEvents: any[] = [];
    (global as any).window.dispatchEvent = vi.fn().mockImplementation((evt: any) => {
      dispatchedEvents.push(evt);
      return true;
    });

    const mockCanvases = {
      access: {
        nodeId: 'access',
        version: 2,
        sections: [{ id: 'sec-sync', type: 'section', title: 'Synced Baseline', number: '01', elements: [] }],
        updatedAt: '2026-11-16T12:00:00.000Z',
      },
    } as any;

    const mockOverrides = {
      'portal.title': 'Newly Published Portal Title',
    };

    syncDraftWithPublished(mockCanvases, mockOverrides, 'snap-synced-123');

    // Verify content overrides synchronized to draft channel
    const draftOverrides = getAllContentOverrides(true);
    expect(draftOverrides['portal.title']).toBe('Newly Published Portal Title');

    // Verify EVENT_DRAFT_CANVAS_CHANGE was dispatched
    const canvasChangeEvents = dispatchedEvents.filter(
      (e) => e.type === EVENT_DRAFT_CANVAS_CHANGE
    );
    expect(canvasChangeEvents.length).toBeGreaterThan(0);
    expect(canvasChangeEvents[0].detail).toEqual({ nodeId: '*' });
  });

  it('guards against cold-miss empty payload clobbering existing populated in-memory draft', async () => {
    // Seed in-memory draft with a populated document
    setInMemoryDraftCanvas('access', {
      nodeId: 'access',
      version: 2,
      sections: [
        {
          id: 'sec-populated',
          type: 'section',
          title: 'Populated Draft Section',
          number: '01',
          elements: [],
        },
      ],
      updatedAt: '2026-11-16T10:00:00.000Z',
    });

    // Mock Edge KV returning a cold-miss synthetic empty canvas ({ sections: [] })
    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/public/manifest')) {
        return new Response(JSON.stringify({ activeSnapshotId: 'snap-1' }), { status: 200 });
      }
      if (urlStr.includes('/api/public/node/access')) {
        return new Response(
          JSON.stringify({
            nodeId: 'access',
            snapshotId: 'snap-1',
            version: 2,
            canvas: {
              nodeId: 'access',
              version: 2,
              sections: [],
              updatedAt: '2026-11-16T10:05:00.000Z',
            },
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('engine_drafts')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    await initDraftSession(true);

    // Existing populated draft document must NOT be clobbered by cold-miss empty sections
    const accessDraft = getInMemoryDraftCanvas('access');
    expect(accessDraft).toBeDefined();
    expect(accessDraft?.sections.length).toBe(1);
    expect(accessDraft?.sections[0].title).toBe('Populated Draft Section');
  });

  it('accepts cold-miss empty edge payload when in-memory draft is empty', async () => {
    clearDraftStorage();

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/public/manifest')) {
        return new Response(JSON.stringify({ activeSnapshotId: 'snap-1' }), { status: 200 });
      }
      if (urlStr.includes('/api/public/node/access')) {
        return new Response(
          JSON.stringify({
            nodeId: 'access',
            snapshotId: 'snap-1',
            version: 2,
            canvas: {
              nodeId: 'access',
              version: 2,
              sections: [],
              updatedAt: '2026-11-16T10:05:00.000Z',
            },
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('engine_drafts')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    await initDraftSession(true);

    const accessDraft = getInMemoryDraftCanvas('access');
    expect(accessDraft).toBeDefined();
    expect(accessDraft?.sections).toEqual([]);
  });

  it('never reads legacy localStorage draft keys during initDraftSession', async () => {
    // Seed localStorage with a ghost/legacy draft
    storageMap.set(
      getDraftCanvasKey('access'),
      JSON.stringify({
        nodeId: 'access',
        version: 2,
        sections: [{ id: 'sec-ghost', type: 'section', title: 'Ghost LocalStorage Draft', elements: [] }],
      })
    );

    const publishedCanvas: NodeCanvasDocument = {
      nodeId: 'access',
      version: 2,
      sections: [{ id: 'sec-edge', type: 'section', title: 'Authoritative Edge KV Section', elements: [] }],
      updatedAt: '2026-11-16T12:00:00.000Z',
    };

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/public/manifest')) {
        return new Response(JSON.stringify({ activeSnapshotId: 'snap-authoritative' }), { status: 200 });
      }
      if (urlStr.includes('/api/public/node/access')) {
        return new Response(
          JSON.stringify({
            nodeId: 'access',
            snapshotId: 'snap-authoritative',
            version: 2,
            canvas: publishedCanvas,
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('engine_drafts')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    await initDraftSession(false);

    // Edge KV is sole baseline source; ghost draft from localStorage must NOT be loaded
    const accessDraft = getInMemoryDraftCanvas('access');
    expect(accessDraft).toBeDefined();
    expect(accessDraft?.sections[0].title).toBe('Authoritative Edge KV Section');
  });

  it('getNodeCanvas in dev mode reads in-memory draft exclusively and ignores localStorage', () => {
    // Seed localStorage with legacy draft and live keys
    storageMap.set(
      getDraftCanvasKey('access'),
      JSON.stringify({
        nodeId: 'access',
        version: 2,
        sections: [{ id: 'sec-legacy-draft', type: 'section', title: 'Legacy Draft', elements: [] }],
      })
    );
    storageMap.set(
      'folio_live_canvas_access',
      JSON.stringify({
        nodeId: 'access',
        version: 2,
        sections: [{ id: 'sec-legacy-live', type: 'section', title: 'Legacy Live', elements: [] }],
      })
    );

    // Set in-memory draft
    setInMemoryDraftCanvas('access', {
      nodeId: 'access',
      version: 2,
      sections: [{ id: 'sec-inmem', type: 'section', title: 'In-Memory Only Section', elements: [] }],
      updatedAt: '2026-11-16T12:00:00.000Z',
    });

    const doc = getNodeCanvas('access', true);
    expect(doc.sections.length).toBe(1);
    expect(doc.sections[0].title).toBe('In-Memory Only Section');

    // When in-memory is cleared, returns default shell without querying localStorage
    clearDraftStorage();
    const emptyDoc = getNodeCanvas('access', true);
    expect(emptyDoc.sections.length).toBe(0);
    expect(emptyDoc.nodeId).toBe('access');
  });

  describe('Subtask 5.3: Draft Staleness & Base Snapshot Invalidation', () => {
    it('invalidates and reloads clean draft from Edge KV when active published snapshot advances', async () => {
      // 1. Setup in-memory clean draft anchored to snap-old
      setInMemoryDraftCanvas('access', {
        nodeId: 'access',
        version: 2,
        sections: [
          {
            id: 'sec-old',
            type: 'section',
            title: 'Old Stale Snapshot Content',
            number: '01',
            elements: [],
          },
        ],
        updatedAt: '2026-11-15T00:00:00.000Z',
      });
      setDraftModeActive(true, 'snap-old');
      setDraftDirty(false);

      expect(isDraftDirty()).toBe(false);
      expect(getDraftBaseId()).toBe('snap-old');

      // 2. Published baseline has advanced to snap-new
      const newPublishedCanvas: NodeCanvasDocument = {
        nodeId: 'access',
        version: 2,
        sections: [
          {
            id: 'sec-new',
            type: 'section',
            title: 'New Authoritative Baseline Content',
            number: '01',
            elements: [],
          },
        ],
        updatedAt: '2026-11-16T12:00:00.000Z',
      };

      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/public/manifest')) {
          return new Response(
            JSON.stringify({
              activeSnapshotId: 'snap-new',
              publishedAt: '2026-11-16T12:00:00.000Z',
              nodeIds: ['access'],
            }),
            { status: 200 }
          );
        }
        if (urlStr.includes('/api/public/node/access')) {
          return new Response(
            JSON.stringify({
              nodeId: 'access',
              snapshotId: 'snap-new',
              canvas: newPublishedCanvas,
            }),
            { status: 200 }
          );
        }
        if (urlStr.includes('engine_drafts')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      });

      // 3. Re-initialize draft session without forceFresh
      await initDraftSession(false);

      // 4. Assert: Clean draft must advance to new baseline
      const accessDraft = getInMemoryDraftCanvas('access');
      expect(accessDraft).toBeDefined();
      expect(accessDraft?.sections[0].title).toBe('New Authoritative Baseline Content');
      expect(getDraftBaseId()).toBe('snap-new');
      expect(isDraftDirty()).toBe(false);
    });

    it('preserves dirty drafts with uncommitted changes even when published baseline advances', async () => {
      // 1. Setup in-memory dirty draft anchored to snap-old
      setInMemoryDraftCanvas('access', {
        nodeId: 'access',
        version: 2,
        sections: [
          {
            id: 'sec-wip',
            type: 'section',
            title: "Author's Uncommitted Work In Progress",
            number: '01',
            elements: [],
          },
        ],
        updatedAt: '2026-11-16T10:00:00.000Z',
      });
      setDraftModeActive(true, 'snap-old');
      setDraftDirty(true);

      expect(isDraftDirty()).toBe(true);

      // 2. Published baseline has advanced to snap-new
      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/public/manifest')) {
          return new Response(
            JSON.stringify({ activeSnapshotId: 'snap-new' }),
            { status: 200 }
          );
        }
        if (urlStr.includes('/api/public/node/access')) {
          return new Response(
            JSON.stringify({
              nodeId: 'access',
              snapshotId: 'snap-new',
              canvas: {
                nodeId: 'access',
                version: 2,
                sections: [{ id: 'sec-edge', type: 'section', title: 'Edge Canvas', elements: [] }],
              },
            }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 200 });
      });

      // 3. Re-initialize draft session without forceFresh
      await initDraftSession(false);

      // 4. Assert: Dirty draft must NOT be overwritten
      const accessDraft = getInMemoryDraftCanvas('access');
      expect(accessDraft).toBeDefined();
      expect(accessDraft?.sections[0].title).toBe("Author's Uncommitted Work In Progress");
      expect(getDraftBaseId()).toBe('snap-old');
      expect(isDraftDirty()).toBe(true);

      // 5. Assert: Staleness check flags draft as stale
      const staleness = checkDraftStaleness();
      expect(staleness.isStale).toBe(true);
      expect(staleness.baseId).toBe('snap-old');
      expect(staleness.currentActiveId).toBe('snap-new');
    });

    it('hardens stale checks against cloud draft with missing or null baseSnapshotId', async () => {
      setActivePublishedId('snap-published-current');

      const unanchoredCloudDraft = {
        id: 'active_draft',
        base_snapshot_id: null, // missing base snapshot ID!
        canvases: {
          access: {
            nodeId: 'access',
            version: 2,
            sections: [
              {
                id: 'sec-unanchored',
                type: 'section',
                title: 'Unanchored Cloud Draft',
                number: '01',
                elements: [],
              },
            ],
            updatedAt: '2026-11-16T00:00:00.000Z',
          },
        },
        content_overrides: {},
      };

      const authoritativeLiveCanvas: NodeCanvasDocument = {
        nodeId: 'access',
        version: 2,
        sections: [
          {
            id: 'sec-live',
            type: 'section',
            title: 'Authoritative Live Baseline',
            number: '01',
            elements: [],
          },
        ],
        updatedAt: '2026-11-16T12:00:00.000Z',
      };

      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('engine_drafts')) {
          return new Response(JSON.stringify([unanchoredCloudDraft]), { status: 200 });
        }
        if (urlStr.includes('/api/public/manifest')) {
          return new Response(
            JSON.stringify({ activeSnapshotId: 'snap-published-current' }),
            { status: 200 }
          );
        }
        if (urlStr.includes('/api/public/node/access')) {
          return new Response(
            JSON.stringify({
              nodeId: 'access',
              snapshotId: 'snap-published-current',
              canvas: authoritativeLiveCanvas,
            }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 200 });
      });

      await initDraftSession(false);

      // Unanchored cloud draft must be treated as stale and rejected
      const accessDraft = getInMemoryDraftCanvas('access');
      expect(accessDraft).toBeDefined();
      expect(accessDraft?.sections[0].title).toBe('Authoritative Live Baseline');
      expect(getDraftBaseId()).toBe('snap-published-current');
    });

    it('hardens checkDraftStaleness against active drafts with missing baseId', () => {
      setActivePublishedId('snap-established');

      // 1. When draft mode is active but baseId is null/missing
      setDraftModeActive(true, null);
      expect(getDraftBaseId()).toBeNull();

      const staleness = checkDraftStaleness();
      expect(staleness.isStale).toBe(true);
      expect(staleness.currentActiveId).toBe('snap-established');
      expect(isDraftStale()).toBe(true);

      // 2. When draft mode is active and baseId matches established published ID
      setDraftModeActive(true, 'snap-established');
      expect(checkDraftStaleness().isStale).toBe(false);
      expect(isDraftStale()).toBe(false);

      // 3. When draft mode is active and baseId differs
      setDraftModeActive(true, 'snap-obsolete');
      expect(checkDraftStaleness().isStale).toBe(true);
      expect(isDraftStale()).toBe(true);
    });

    it('discardDraftSession() clears storage, calls Supabase DELETE, and re-clones live baseline into inMemoryDraftCanvases', async () => {
      // 1. Seed dirty draft
      setInMemoryDraftCanvas('access', {
        nodeId: 'access',
        version: 2,
        sections: [
          {
            id: 'sec-dirty',
            type: 'section',
            title: 'Dirty WIP To Discard',
            number: '01',
            elements: [],
          },
        ],
        updatedAt: '2026-11-16T10:00:00.000Z',
      });
      setDraftModeActive(true, 'snap-old');
      setDraftDirty(true);

      let supabaseDeleteCalled = false;
      const dispatchedEvents: any[] = [];
      (global as any).window.dispatchEvent = vi.fn().mockImplementation((evt: any) => {
        dispatchedEvents.push(evt);
        return true;
      });

      const publishedBaselineCanvas: NodeCanvasDocument = {
        nodeId: 'access',
        version: 2,
        sections: [
          {
            id: 'sec-restored',
            type: 'section',
            title: 'Live Restored Baseline Content',
            number: '01',
            elements: [],
          },
        ],
        updatedAt: '2026-11-16T12:00:00.000Z',
      };

      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString();
        const method = init?.method || 'GET';

        if (urlStr.includes('engine_drafts') && method === 'DELETE') {
          supabaseDeleteCalled = true;
          return new Response(null, { status: 204 });
        }
        if (urlStr.includes('/api/public/manifest')) {
          return new Response(
            JSON.stringify({ activeSnapshotId: 'snap-live-authoritative' }),
            { status: 200 }
          );
        }
        if (urlStr.includes('/api/public/node/access')) {
          return new Response(
            JSON.stringify({
              nodeId: 'access',
              snapshotId: 'snap-live-authoritative',
              canvas: publishedBaselineCanvas,
            }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 200 });
      });

      // 2. Discard draft session
      await discardDraftSession();

      // 3. Verify Supabase draft deletion occurred
      expect(supabaseDeleteCalled).toBe(true);

      // 4. Verify in-memory draft is immediately re-cloned from authoritative published baseline
      const restoredDraft = getInMemoryDraftCanvas('access');
      expect(restoredDraft).toBeDefined();
      expect(restoredDraft?.sections[0].title).toBe('Live Restored Baseline Content');
      expect(getDraftBaseId()).toBe('snap-live-authoritative');
      expect(isDraftDirty()).toBe(false);

      // 5. Verify EVENT_DRAFT_CANVAS_CHANGE aggregate broadcast was emitted
      const canvasChangeEvents = dispatchedEvents.filter(
        (e) => e.type === EVENT_DRAFT_CANVAS_CHANGE
      );
      expect(canvasChangeEvents.length).toBeGreaterThan(0);
      expect(canvasChangeEvents.some((e) => e.detail?.nodeId === '*')).toBe(true);
    });
  });

  describe('Subtask 5.4: Test Suite Realignment & Hydration Verification', () => {
    it('initDraftSession dispatches EVENT_DRAFT_CANVAS_CHANGE on completion', async () => {
      let draftCanvasEventFired = false;
      const onDraftCanvasChange = (e: any) => {
        if (e.detail?.nodeId === '*') {
          draftCanvasEventFired = true;
        }
      };
      window.addEventListener(EVENT_DRAFT_CANVAS_CHANGE, onDraftCanvasChange);

      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/public/manifest')) {
          return new Response(JSON.stringify({ activeSnapshotId: 'snap-1' }), { status: 200 });
        }
        if (urlStr.includes('/api/public/node/access')) {
          return new Response(
            JSON.stringify({
              nodeId: 'access',
              canvas: {
                nodeId: 'access',
                version: 2,
                sections: [{ id: 's1', type: 'section', title: 'Live', elements: [] }],
              },
            }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 200 });
      });

      await initDraftSession(true);
      expect(draftCanvasEventFired).toBe(true);
      window.removeEventListener(EVENT_DRAFT_CANVAS_CHANGE, onDraftCanvasChange);
    });

    it('preserves existing populated canvas when Edge KV returns empty canvas sections', async () => {
      // Pre-seed populated draft
      const initialDoc = {
        nodeId: 'access',
        version: 2,
        sections: [{ id: 'sec-existing', type: 'section', title: 'Existing Populated', elements: [] }],
        updatedAt: '2026-11-17T00:00:00Z',
      };

      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/public/manifest')) {
          return new Response(JSON.stringify({ activeSnapshotId: 'snap-kv-empty' }), { status: 200 });
        }
        if (urlStr.includes('/api/public/node/access')) {
          // Cold miss empty canvas
          return new Response(
            JSON.stringify({
              nodeId: 'access',
              canvas: { nodeId: 'access', version: 1, sections: [] },
            }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 200 });
      });

      setInMemoryDraftCanvas('access', initialDoc as any);
      await initDraftSession(false);
      const draft = getInMemoryDraftCanvas('access');
      expect(draft?.sections[0].title).toBe('Existing Populated');
    });

    it('advances clean draft when active published snapshot changes', async () => {
      // 1. Setup in-memory clean draft anchored to snap-base-1
      setInMemoryDraftCanvas('access', {
        nodeId: 'access',
        version: 2,
        sections: [{ id: 'sec-old', type: 'section', title: 'Prior Snapshot Content', elements: [] }],
        updatedAt: '2026-11-16T00:00:00Z',
      });
      setDraftModeActive(true, 'snap-base-1');
      setDraftDirty(false);

      // 2. Active published snapshot advances to snap-base-2
      const updatedPublishedCanvas: NodeCanvasDocument = {
        nodeId: 'access',
        version: 2,
        sections: [{ id: 'sec-advanced', type: 'section', title: 'Advanced Snapshot Content', elements: [] }],
        updatedAt: '2026-11-17T00:00:00Z',
      };

      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/public/manifest')) {
          return new Response(JSON.stringify({ activeSnapshotId: 'snap-base-2' }), { status: 200 });
        }
        if (urlStr.includes('/api/public/node/access')) {
          return new Response(
            JSON.stringify({
              nodeId: 'access',
              snapshotId: 'snap-base-2',
              canvas: updatedPublishedCanvas,
            }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 200 });
      });

      await initDraftSession(false);
      const draft = getInMemoryDraftCanvas('access');
      expect(draft?.sections[0].title).toBe('Advanced Snapshot Content');
      expect(getDraftBaseId()).toBe('snap-base-2');
      expect(isDraftDirty()).toBe(false);
    });
  });
});
