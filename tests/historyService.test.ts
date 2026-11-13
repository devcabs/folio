import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  publishNewSnapshot,
  getHistoryManifest,
  getActivePublishedId,
  restoreUnifiedSnapshot,
  saveMilestone,
  getActiveNodeIds,
} from '../src/services/historyService';
import { EVENT_LIVE_CANVAS_CHANGE } from '../src/services/canvasLayoutService';
import { resetEngineConfig } from '../src/config/engine.config';
import { isDraftDirty, clearDraftStorage } from '../src/services/draftService';

describe('Subtask 2.6: Publish Pipeline Edge KV Await & 3-Tier Status', () => {
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

    clearDraftStorage();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Validation & Stale Draft Gates', () => {
    it('returns 3-tier failure when changelog description is shorter than 4 characters', async () => {
      const result = await publishNewSnapshot('abc');
      expect(result.success).toBe(false);
      expect(result.localSaved).toBe(false);
      expect(result.cloudSynced).toBe(false);
      expect(result.edgeDeployed).toBe(false);
      expect(result.error).toContain('Changelog description must be at least 4 characters long');
    });
  });

  describe('Subtask 3.7: Atomic Server Edge Publish & 3-Tier Multi-Channel Reporting', () => {
    it('awaits POST /api/publish and reports edgeDeployed: true on successful deployment', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/publish')) {
          return new Response(
            JSON.stringify({
              success: true,
              snapshotId: 'test-snap',
              cloudSynced: true,
              edgeDeployed: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 200 });
      });

      const result = await publishNewSnapshot('Release v1.0.0 valid publication note');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.edgeDeployed).toBe(true);
      expect(result.cloudSynced).toBe(true);
      expect(result.edgeError).toBeUndefined();
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.title).toBe('Published Revision');
    });

    it('returns edgeDeployed: false with edgeError when server reports edge failure', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/publish')) {
          return new Response(
            JSON.stringify({
              success: true,
              snapshotId: 'test-snap',
              cloudSynced: true,
              edgeDeployed: false,
              edgeError: 'KV quota exceeded: 429 Too Many Requests',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 200 });
      });

      const result = await publishNewSnapshot('Release v1.0.1 with edge failure');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.edgeDeployed).toBe(false);
      expect(result.edgeError).toBe('KV quota exceeded: 429 Too Many Requests');
      expect(result.error).toBe('KV quota exceeded: 429 Too Many Requests');

      // Local snapshot must NOT be reverted or destroyed
      const manifest = getHistoryManifest();
      expect(manifest.activePublishedId).toBe(result.snapshot.id);
      expect(getActivePublishedId()).toBe(result.snapshot.id);
      expect(isDraftDirty()).toBe(false);
    });

    it('catches thrown network exceptions during /api/publish and reports localSaved with error', async () => {
      global.fetch = vi.fn().mockRejectedValue(
        new Error('Network timeout contacting Cloudflare KV API')
      );

      const result = await publishNewSnapshot('Release v1.0.2 with edge timeout exception');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.cloudSynced).toBe(false);
      expect(result.edgeDeployed).toBe(false);
      expect(result.cloudError).toBe('Network timeout contacting Cloudflare KV API');
      expect(result.error).toBe('Network timeout contacting Cloudflare KV API');

      // Draft must remain clean and local snapshot intact
      expect(getActivePublishedId()).toBe(result.snapshot.id);
    });

    it('awaits /api/publish returning cloudSynced: true and edgeDeployed: true', async () => {
      const fetchCalls: Array<{ url: string; method: string; body?: any }> = [];

      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString();
        const method = init?.method || 'GET';
        fetchCalls.push({
          url: urlStr,
          method,
          body: init?.body ? JSON.parse(init.body as string) : undefined,
        });

        if (urlStr.includes('/api/publish')) {
          return new Response(
            JSON.stringify({
              success: true,
              snapshotId: 'pub-test-full',
              cloudSynced: true,
              edgeDeployed: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 200 });
      });

      const result = await publishNewSnapshot('Full 3-tier publication test');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.cloudSynced).toBe(true);
      expect(result.edgeDeployed).toBe(true);
      expect(result.cloudError).toBeUndefined();
      expect(result.edgeError).toBeUndefined();
      expect(result.error).toBeUndefined();

      // Exactly 1 atomic network call to /api/publish
      expect(fetchCalls.length).toBe(1);
      expect(fetchCalls[0].url).toContain('/api/publish');
      expect(fetchCalls[0].body.snapshot.id).toBe(result.snapshot.id);
    });

    it('surfaces cloudError when cloud sync fails, while edge deployment succeeds and localSaved is true', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/publish')) {
          return new Response(
            JSON.stringify({
              success: true,
              snapshotId: 'test-snap',
              cloudSynced: false,
              edgeDeployed: true,
              cloudError: 'Cloud sync failed with HTTP 500',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 200 });
      });

      const result = await publishNewSnapshot('Partial failure: Cloud 500 but Edge OK');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.cloudSynced).toBe(false);
      expect(result.cloudError).toBe('Cloud sync failed with HTTP 500');
      expect(result.edgeDeployed).toBe(true);
      expect(result.edgeError).toBeUndefined();
      expect(result.error).toBe('Cloud sync failed with HTTP 500');
    });

    it('surfaces both cloudError and edgeError when both remote tiers fail', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/publish')) {
          return new Response(
            JSON.stringify({
              success: true,
              snapshotId: 'test-snap',
              cloudSynced: false,
              edgeDeployed: false,
              cloudError: 'Supabase network unreachable',
              edgeError: 'Cloudflare KV unauthorized: Invalid token',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 200 });
      });

      const result = await publishNewSnapshot('Dual tier failure test');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.cloudSynced).toBe(false);
      expect(result.cloudError).toBe('Supabase network unreachable');
      expect(result.edgeDeployed).toBe(false);
      expect(result.edgeError).toBe('Cloudflare KV unauthorized: Invalid token');
      expect(result.error).toBeDefined();
    });
  });

  describe('Subtask 2.9: Snapshot Restore Reactive Canvas Events', () => {
    it('dispatches EVENT_LIVE_CANVAS_CHANGE for each active node and aggregate canvas change on restoreUnifiedSnapshot', async () => {
      const snap = saveMilestone('Test Restore Snapshot', 'Testing restore event dispatch');
      expect(snap.id).toBeDefined();

      const dispatchedEvents: Array<{ type: string; detail: any }> = [];
      const dispatchSpy = vi.fn().mockImplementation((event: CustomEvent) => {
        dispatchedEvents.push({ type: event.type, detail: event.detail });
        return true;
      });
      (global as any).window.dispatchEvent = dispatchSpy;

      const result = await restoreUnifiedSnapshot(snap.id);

      expect(result.success).toBe(true);
      expect(result.safetySnapshotId).toBeDefined();

      const liveEvents = dispatchedEvents.filter((e) => e.type === EVENT_LIVE_CANVAS_CHANGE);
      const activeNodes = getActiveNodeIds();
      expect(activeNodes.length).toBeGreaterThan(0);

      for (const nodeId of activeNodes) {
        const nodeEvent = liveEvents.find((e) => e.detail?.nodeId === nodeId);
        expect(nodeEvent).toBeDefined();
        expect(nodeEvent?.detail?.document).toBeDefined();
        expect(nodeEvent?.detail?.document.nodeId).toBe(nodeId);
      }

      const aggregateEvent = liveEvents.find((e) => e.detail?.nodeId === '*');
      expect(aggregateEvent).toBeDefined();
    });
  });
});
