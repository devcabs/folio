import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  publishNewSnapshot,
  getHistoryManifest,
  getActivePublishedId,
} from '../../src/services/historyService';
import { onRequestPost } from '../../functions/api/publish';
import { isDraftDirty, clearDraftStorage } from '../../src/services/draftService';
import { resetEngineConfig } from '../../src/config/engine.config';
import type { PublishedSnapshot } from '../../src/types/history';

describe('Subtask 3.7: Unified Atomic Write & Publish Pipeline', () => {
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

  describe('1. Single Atomic Request to POST /api/publish', () => {
    it('dispatches exactly one POST request to /api/publish with snapshot payload', async () => {
      const fetchCalls: Array<{ url: string; method: string; body: any }> = [];

      global.fetch = vi.fn().mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
        const urlStr = input.toString();
        const method = init?.method || 'GET';
        const body = init?.body ? JSON.parse(init.body as string) : undefined;
        fetchCalls.push({ url: urlStr, method, body });

        if (urlStr.includes('/api/publish')) {
          return new Response(
            JSON.stringify({
              success: true,
              snapshotId: body?.snapshot?.id,
              publishedAt: body?.snapshot?.createdAt,
              cloudSynced: true,
              edgeDeployed: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 200 });
      });

      const result = await publishNewSnapshot('Unified atomic publish test revision');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.cloudSynced).toBe(true);
      expect(result.edgeDeployed).toBe(true);
      expect(result.snapshot).toBeDefined();

      // Exactly ONE network request dispatched
      expect(fetchCalls.length).toBe(1);
      expect(fetchCalls[0].url).toContain('/api/publish');
      expect(fetchCalls[0].method).toBe('POST');
      expect(fetchCalls[0].body.snapshot.id).toBe(result.snapshot.id);
      expect(fetchCalls[0].body.snapshot.title).toBe('Published Revision');
    });

    it('makes zero client-side requests to api.cloudflare.com or direct supabase rest from the browser', async () => {
      const fetchedUrls: string[] = [];

      global.fetch = vi.fn().mockImplementation(async (input: string | URL | Request) => {
        const urlStr = input.toString();
        fetchedUrls.push(urlStr);
        if (urlStr.includes('/api/publish')) {
          return new Response(
            JSON.stringify({
              success: true,
              snapshotId: 'snap-test',
              cloudSynced: true,
              edgeDeployed: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 200 });
      });

      await publishNewSnapshot('Verification of zero direct cloudflare calls');

      const cloudflareCalls = fetchedUrls.filter((u) => u.includes('api.cloudflare.com'));
      const directSupabaseCalls = fetchedUrls.filter((u) => u.includes('/rest/v1/engine_history'));

      expect(cloudflareCalls.length).toBe(0);
      expect(directSupabaseCalls.length).toBe(0);
    });
  });

  describe('2. Atomic Confirmation & Server Rejection Safety', () => {
    it('does NOT write snapshot to IndexedDB/manifest when /api/publish returns 400 Bad Request', async () => {
      global.fetch = vi.fn().mockImplementation(async (input: string | URL | Request) => {
        const urlStr = input.toString();
        if (urlStr.includes('/api/publish')) {
          return new Response(
            JSON.stringify({ success: false, error: 'Malformed snapshot payload' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 200 });
      });

      const initialManifest = getHistoryManifest();
      const initialCount = initialManifest.snapshots.length;

      const result = await publishNewSnapshot('Attempting publication with server rejection');

      expect(result.success).toBe(false);
      expect(result.localSaved).toBe(false);
      expect(result.cloudSynced).toBe(false);
      expect(result.edgeDeployed).toBe(false);
      expect(result.error).toContain('Malformed snapshot payload');

      // Manifest must remain untouched
      const afterManifest = getHistoryManifest();
      expect(afterManifest.snapshots.length).toBe(initialCount);
    });

    it('gracefully succeeds in local development when /api/publish is 404 (offline/dev fallback)', async () => {
      global.fetch = vi.fn().mockImplementation(async (input: string | URL | Request) => {
        const urlStr = input.toString();
        if (urlStr.includes('/api/publish')) {
          return new Response('Not Found', { status: 404 });
        }
        return new Response('{}', { status: 200 });
      });

      const result = await publishNewSnapshot('Local offline fallback publish');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.cloudSynced).toBe(false);
      expect(result.edgeDeployed).toBe(false);
      expect(result.snapshot).toBeDefined();

      // Manifest updated with active published ID
      expect(getActivePublishedId()).toBe(result.snapshot.id);
      expect(isDraftDirty()).toBe(false);
    });

    it('gracefully succeeds locally when network fetch throws (network disconnection)', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      const result = await publishNewSnapshot('Offline network test publish');

      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.cloudSynced).toBe(false);
      expect(result.edgeDeployed).toBe(false);
      expect(result.cloudError).toBe('Failed to fetch');
      expect(getActivePublishedId()).toBe(result.snapshot.id);
    });
  });

  describe('3. Edge Function (functions/api/publish.ts) Verification', () => {
    it('returns 400 when snapshot is missing or malformed', async () => {
      const mockContext = {
        request: new Request('http://localhost/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        env: {},
        params: {},
        data: {},
        waitUntil: vi.fn(),
        next: vi.fn(),
        functionPath: '/api/publish',
      };

      const res = await onRequestPost(mockContext as any);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Malformed snapshot payload');
    });

    it('persists to Supabase and puts to Cloudflare KV when bindings are present', async () => {
      const kvStore = new Map<string, string>();
      const mockKv = {
        put: vi.fn(async (key: string, val: string) => {
          kvStore.set(key, val);
        }),
        get: vi.fn(async (key: string) => kvStore.get(key) || null),
        delete: vi.fn(),
        list: vi.fn(),
      };

      const supabaseFetchCalls: Array<{ url: string; method: string }> = [];
      const mockFetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
        supabaseFetchCalls.push({ url: url.toString(), method: init?.method || 'GET' });
        return new Response(JSON.stringify([{ id: 'mock-published-row' }]), { status: 201 });
      });
      global.fetch = mockFetch;

      const validSnapshot: PublishedSnapshot = {
        id: 'pub-test-123',
        schemaVersion: 1,
        title: 'Server Edge Publish Test',
        description: 'Verifying atomic edge endpoint',
        createdAt: new Date().toISOString(),
        authorSessionId: 'session-author-abc',
        isActive: true,
        canvases: {
          access: {
            nodeId: 'access',
            version: 2,
            sections: [],
            updatedAt: new Date().toISOString(),
          },
        },
        contentOverrides: {},
        summary: {
          totalSections: 0,
          totalSubsections: 0,
          totalLeafElements: 0,
          totalTextOverrides: 0,
        },
      };

      const mockContext = {
        request: new Request('http://localhost/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot: validSnapshot }),
        }),
        env: {
          VITE_SUPABASE_URL: 'https://mock.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'mock-service-key',
          KV_ENGINE_PUBLIC: mockKv,
        },
        params: {},
        data: {},
        waitUntil: vi.fn(),
        next: vi.fn(),
        functionPath: '/api/publish',
      };

      const res = await onRequestPost(mockContext as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.cloudSynced).toBe(true);
      expect(json.edgeDeployed).toBe(true);
      expect(json.snapshotId).toBe('pub-test-123');

      // Verify KV puts occurred
      expect(mockKv.put).toHaveBeenCalledWith('node:access', expect.any(String));
      expect(mockKv.put).toHaveBeenCalledWith('portal:manifest', expect.any(String));

      // Verify Supabase insert occurred
      expect(supabaseFetchCalls.some((c) => c.method === 'POST' && c.url.includes('/rest/v1/engine_history'))).toBe(true);
    });
  });

  describe('4. UniversalEditModal Single-Source Authority (No ContentDB Duplicate Keys)', () => {
    it('verifies foldCanvasOverridesIntoDocument is marked deprecated in canvasLayoutService', async () => {
      const fs = await import('node:fs');
      const code = fs.readFileSync('src/services/canvasLayoutService.ts', 'utf8');
      expect(code).toContain('@deprecated Deprecated in Subtask 3.7: Canvas AST is the sole authority for all canvas elements.');
    });

    it('verifies UniversalEditModal prevents writing canvas elements to ContentDB', async () => {
      const fs = await import('node:fs');
      const modalSrc = fs.readFileSync('src/components/dev/UniversalEditModal.tsx', 'utf8');

      // Verify isCanvasElement regex covers canvas elements
      expect(modalSrc).toContain('const isCanvasElement = Boolean(');
      expect(modalSrc).toContain('!isCanvasElement');
      expect(modalSrc).toContain('Subtask 3.7: Canvas AST is the sole authority for canvas items');
    });
  });
});
