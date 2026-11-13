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
import * as edgePreBakeService from '../src/services/edgePreBakeService';
import { resetEngineConfig } from '../src/config/engine.config';
import { isDraftDirty, clearDraftStorage } from '../src/services/draftService';
import type { PreBakeResult } from '../src/services/edgePreBakeService';

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

  describe('Deterministic Await on Edge KV Deployment', () => {
    it('awaits compileAndDeployToEdgeKV and reports edgeDeployed: true on successful deployment', async () => {
      const edgeSpy = vi.spyOn(edgePreBakeService, 'compileAndDeployToEdgeKV').mockResolvedValue({
        success: true,
        snapshotId: 'test-snap',
        transformedNodes: ['overview'],
        totalKvKeys: 5,
        deployResult: {
          success: true,
          deployedCount: 5,
        },
      } as PreBakeResult);

      const result = await publishNewSnapshot('Release v1.0.0 valid publication note');

      expect(edgeSpy).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.edgeDeployed).toBe(true);
      expect(result.edgeError).toBeUndefined();
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.title).toBe('Published Revision');
    });

    it('returns edgeDeployed: false with edgeError when compileAndDeployToEdgeKV returns failure', async () => {
      vi.spyOn(edgePreBakeService, 'compileAndDeployToEdgeKV').mockResolvedValue({
        success: false,
        snapshotId: 'test-snap',
        transformedNodes: [],
        totalKvKeys: 5,
        deployResult: {
          success: false,
          deployedCount: 0,
          error: 'KV quota exceeded: 429 Too Many Requests',
        },
      } as PreBakeResult);

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

    it('catches thrown exceptions during compileAndDeployToEdgeKV and reports edgeDeployed: false with edgeError', async () => {
      vi.spyOn(edgePreBakeService, 'compileAndDeployToEdgeKV').mockRejectedValue(
        new Error('Network timeout contacting Cloudflare KV API')
      );

      const result = await publishNewSnapshot('Release v1.0.2 with edge timeout exception');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.edgeDeployed).toBe(false);
      expect(result.edgeError).toBe('Network timeout contacting Cloudflare KV API');
      expect(result.error).toBe('Network timeout contacting Cloudflare KV API');

      // Draft must remain clean and local snapshot intact
      expect(getActivePublishedId()).toBe(result.snapshot.id);
    });
  });

  describe('Supabase Demotion PATCH & 3-Tier Multi-Channel Reporting', () => {
    it('awaits Supabase insert and demotion PATCH, returning cloudSynced: true and edgeDeployed: true', async () => {
      process.env.VITE_SUPABASE_URL = 'https://test-sandbox.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key-12345';

      const fetchCalls: Array<{ url: string; method: string; body?: any }> = [];

      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString();
        const method = init?.method || 'GET';
        fetchCalls.push({
          url: urlStr,
          method,
          body: init?.body ? JSON.parse(init.body as string) : undefined,
        });

        if (urlStr.includes('/rest/v1/engine_history')) {
          if (method === 'POST') {
            return new Response(JSON.stringify([{ id: 'mock-id' }]), { status: 201 });
          }
          if (method === 'PATCH') {
            return new Response(JSON.stringify([]), { status: 200 });
          }
        }
        return new Response('{}', { status: 200 });
      });

      vi.spyOn(edgePreBakeService, 'compileAndDeployToEdgeKV').mockResolvedValue({
        success: true,
        snapshotId: 'test-snap',
        transformedNodes: ['overview'],
        totalKvKeys: 5,
        deployResult: { success: true, deployedCount: 5 },
      } as PreBakeResult);

      const result = await publishNewSnapshot('Full 3-tier publication test');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.cloudSynced).toBe(true);
      expect(result.edgeDeployed).toBe(true);
      expect(result.cloudError).toBeUndefined();
      expect(result.edgeError).toBeUndefined();
      expect(result.error).toBeUndefined();

      // Verify Supabase insert occurred first, then PATCH for demotion
      const postCall = fetchCalls.find(c => c.method === 'POST' && c.url.includes('/rest/v1/engine_history'));
      const patchCall = fetchCalls.find(c => c.method === 'PATCH' && c.url.includes('/rest/v1/engine_history'));

      expect(postCall).toBeDefined();
      expect(patchCall).toBeDefined();
      expect(patchCall?.url).toContain(`id=neq.${result.snapshot.id}`);
      expect(patchCall?.body).toEqual({ is_active: false });

      delete process.env.VITE_SUPABASE_URL;
      delete process.env.VITE_SUPABASE_ANON_KEY;
    });

    it('surfaces cloudError when Supabase insert fails, while edge deployment continues and localSaved is true', async () => {
      process.env.VITE_SUPABASE_URL = 'https://test-sandbox.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key-12345';

      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/rest/v1/engine_history')) {
          return new Response('Database internal error', { status: 500 });
        }
        return new Response('{}', { status: 200 });
      });

      vi.spyOn(edgePreBakeService, 'compileAndDeployToEdgeKV').mockResolvedValue({
        success: true,
        snapshotId: 'test-snap',
        transformedNodes: ['overview'],
        totalKvKeys: 5,
        deployResult: { success: true, deployedCount: 5 },
      } as PreBakeResult);

      const result = await publishNewSnapshot('Partial failure: Cloud 500 but Edge OK');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.cloudSynced).toBe(false);
      expect(result.cloudError).toBe('Cloud sync failed with HTTP 500');
      expect(result.edgeDeployed).toBe(true);
      expect(result.edgeError).toBeUndefined();
      expect(result.error).toBe('Cloud sync failed with HTTP 500');

      delete process.env.VITE_SUPABASE_URL;
      delete process.env.VITE_SUPABASE_ANON_KEY;
    });

    it('surfaces both cloudError and edgeError when both remote tiers fail', async () => {
      process.env.VITE_SUPABASE_URL = 'https://test-sandbox.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key-12345';

      global.fetch = vi.fn().mockRejectedValue(new Error('Supabase network unreachable'));

      vi.spyOn(edgePreBakeService, 'compileAndDeployToEdgeKV').mockResolvedValue({
        success: false,
        snapshotId: 'test-snap',
        transformedNodes: [],
        totalKvKeys: 5,
        deployResult: {
          success: false,
          deployedCount: 0,
          error: 'Cloudflare KV unauthorized: Invalid token',
        },
      } as PreBakeResult);

      const result = await publishNewSnapshot('Dual tier failure test');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.cloudSynced).toBe(false);
      expect(result.cloudError).toBe('Supabase network unreachable');
      expect(result.edgeDeployed).toBe(false);
      expect(result.edgeError).toBe('Cloudflare KV unauthorized: Invalid token');
      expect(result.error).toBeDefined();

      delete process.env.VITE_SUPABASE_URL;
      delete process.env.VITE_SUPABASE_ANON_KEY;
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
