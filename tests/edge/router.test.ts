import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleFolioEdgeRequest,
  resolveKVNamespace,
  handleCorsPreflight,
} from '../../src/edge/router';
import type { PublishedSnapshot } from '../../src/types/history';

describe('Universal Cloudflare Edge Router (src/edge/router.ts)', () => {
  let kvStore: Map<string, string>;
  let mockKv: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    kvStore = new Map();
    mockKv = {
      get: vi.fn(async (key: string) => kvStore.get(key) || null),
      put: vi.fn(async (key: string, val: string) => {
        kvStore.set(key, val);
      }),
      delete: vi.fn(async (key: string) => {
        kvStore.delete(key);
      }),
      list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('resolveKVNamespace', () => {
    it('prioritizes options.kv directly', () => {
      const explicitKv = { ...mockKv };
      const resolved = resolveKVNamespace({}, { kv: explicitKv });
      expect(resolved).toBe(explicitKv);
    });

    it('resolves options.kvBinding when present on env', () => {
      const customKv = { ...mockKv };
      const env = { CUSTOM_KV_BINDING: customKv };
      const resolved = resolveKVNamespace(env, { kvBinding: 'CUSTOM_KV_BINDING' });
      expect(resolved).toBe(customKv);
    });

    it('resolves env.KV_ENGINE_PUBLIC by default', () => {
      const env = { KV_ENGINE_PUBLIC: mockKv };
      const resolved = resolveKVNamespace(env);
      expect(resolved).toBe(mockKv);
    });

    it('falls back to env.KV_MASID_PUBLIC for legacy consumer compatibility', () => {
      const legacyKv = { ...mockKv };
      const env = { KV_MASID_PUBLIC: legacyKv };
      const resolved = resolveKVNamespace(env);
      expect(resolved).toBe(legacyKv);
    });

    it('returns null if no KV binding is found', () => {
      expect(resolveKVNamespace({})).toBeNull();
      expect(resolveKVNamespace(null)).toBeNull();
    });
  });

  describe('CORS Preflight (OPTIONS /api/*)', () => {
    it('returns 204 with standard CORS headers for OPTIONS requests', async () => {
      const req = new Request('https://domain.com/api/public/node/access', {
        method: 'OPTIONS',
      });
      const res = await handleFolioEdgeRequest(req, {});
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET, POST, OPTIONS');
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });

    it('honors allowedOrigins option', () => {
      const res = handleCorsPreflight({ allowedOrigins: 'https://masid.org' });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://masid.org');
    });
  });

  describe('POST /api/publish', () => {
    it('returns 405 when called with GET or PUT', async () => {
      const req = new Request('https://domain.com/api/publish', { method: 'GET' });
      const res = await handleFolioEdgeRequest(req, {});
      expect(res.status).toBe(405);
      const json = await res.json();
      expect(json.error).toBe('Method Not Allowed');
    });

    it('returns 400 when body is not valid JSON', async () => {
      const req = new Request('https://domain.com/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{',
      });
      const res = await handleFolioEdgeRequest(req, {});
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid JSON');
    });

    it('returns 400 when snapshot is missing or malformed', async () => {
      const req = new Request('https://domain.com/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: { id: '' } }),
      });
      const res = await handleFolioEdgeRequest(req, {});
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Malformed snapshot payload');
    });

    it('returns 401 when authorSessionId is missing', async () => {
      const req = new Request('https://domain.com/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot: {
            id: 'snap-1',
            canvases: { access: { nodeId: 'access', version: 2, sections: [] } },
          },
        }),
      });
      const res = await handleFolioEdgeRequest(req, {});
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Missing author session ID');
    });

    it('successfully processes publish, pre-bakes into KV, and calls Supabase', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/rest/v1/engine_history')) {
          return new Response(JSON.stringify([{ id: 'mock-row' }]), { status: 201 });
        }
        return new Response('Not found', { status: 404 });
      });
      global.fetch = mockFetch;

      const validSnapshot: PublishedSnapshot = {
        id: 'snapshot-publish-123',
        schemaVersion: 1,
        title: 'Universal Edge Router Test',
        description: 'Publish via universal edge router',
        createdAt: '2026-11-15T12:00:00.000Z',
        authorSessionId: 'author-session-xyz',
        isActive: true,
        canvases: {
          access: {
            nodeId: 'access',
            version: 2,
            sections: [],
            updatedAt: '2026-11-15T12:00:00.000Z',
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

      const req = new Request('https://domain.com/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: validSnapshot }),
      });

      const env = {
        KV_ENGINE_PUBLIC: mockKv,
        VITE_SUPABASE_URL: 'https://mock.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'mock-key',
      };

      const res = await handleFolioEdgeRequest(req, env);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.cloudSynced).toBe(true);
      expect(json.edgeDeployed).toBe(true);
      expect(json.snapshotId).toBe('snapshot-publish-123');

      // Check KV writes
      expect(mockKv.put).toHaveBeenCalledWith('node:access', expect.any(String));
      expect(mockKv.put).toHaveBeenCalledWith('portal:manifest', expect.any(String));
    });

    it('returns 500 when KV namespace binding is missing', async () => {
      const validSnapshot: PublishedSnapshot = {
        id: 'snapshot-publish-no-kv',
        schemaVersion: 1,
        title: 'No KV test',
        description: 'Publish without KV',
        createdAt: '2026-11-15T12:00:00.000Z',
        authorSessionId: 'author-session-xyz',
        isActive: true,
        canvases: {
          access: {
            nodeId: 'access',
            version: 2,
            sections: [],
            updatedAt: '2026-11-15T12:00:00.000Z',
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

      const req = new Request('https://domain.com/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: validSnapshot }),
      });

      // No KV binding in env
      const res = await handleFolioEdgeRequest(req, {});
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('KV namespace binding not configured');
    });

    it('returns 502 when Cloudflare KV put throws', async () => {
      const failingKv = {
        ...mockKv,
        put: vi.fn().mockRejectedValue(new Error('Cloudflare KV 500 internal')),
      };

      const validSnapshot: PublishedSnapshot = {
        id: 'snapshot-publish-fail-kv',
        schemaVersion: 1,
        title: 'KV Failure Test',
        description: 'Publish with failing KV',
        createdAt: '2026-11-15T12:00:00.000Z',
        authorSessionId: 'author-session-xyz',
        isActive: true,
        canvases: {
          access: {
            nodeId: 'access',
            version: 2,
            sections: [],
            updatedAt: '2026-11-15T12:00:00.000Z',
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

      const req = new Request('https://domain.com/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: validSnapshot }),
      });

      const res = await handleFolioEdgeRequest(req, { KV_ENGINE_PUBLIC: failingKv });
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Cloudflare KV deployment failed');
    });
  });

  describe('GET /api/public/node/:nodeId and /api/public/pillar/:pillarId', () => {
    it('returns 400 for invalid node ID', async () => {
      const req = new Request('https://domain.com/api/public/node/invalid_node');
      const res = await handleFolioEdgeRequest(req, { KV_ENGINE_PUBLIC: mockKv });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid node ID');
    });

    it('returns cached KV payload with ETag on KV hit', async () => {
      const nodePayload = JSON.stringify({
        nodeId: 'access',
        snapshotId: 'snap-1',
        version: 2,
        canvas: { sections: [] },
      });
      kvStore.set('node:access', nodePayload);

      const req = new Request('https://domain.com/api/public/node/access');
      const res = await handleFolioEdgeRequest(req, { KV_ENGINE_PUBLIC: mockKv });
      expect(res.status).toBe(200);
      expect(res.headers.get('X-Engine-Edge-Source')).toBe('KV');
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=30, s-maxage=60, stale-while-revalidate=300');
      expect(res.headers.get('ETag')).toBeDefined();
      const json = await res.json();
      expect(json.nodeId).toBe('access');
    });

    it('returns 304 Not Modified when If-None-Match matches ETag', async () => {
      const nodePayload = JSON.stringify({
        nodeId: 'quality',
        snapshotId: 'snap-2',
      });
      kvStore.set('node:quality', nodePayload);

      // First fetch to get ETag
      const firstReq = new Request('https://domain.com/api/public/node/quality');
      const firstRes = await handleFolioEdgeRequest(firstReq, { KV_ENGINE_PUBLIC: mockKv });
      const etag = firstRes.headers.get('ETag');
      expect(etag).toBeTruthy();

      // Conditional GET with If-None-Match
      const secondReq = new Request('https://domain.com/api/public/node/quality', {
        headers: { 'If-None-Match': etag! },
      });
      const secondRes = await handleFolioEdgeRequest(secondReq, { KV_ENGINE_PUBLIC: mockKv });
      expect(secondRes.status).toBe(304);
      expect(secondRes.headers.get('ETag')).toBe(etag);
    });

    it('serves fallback payload on KV cold miss without mutating KV', async () => {
      const ctx = { waitUntil: vi.fn() };
      const req = new Request('https://domain.com/api/public/node/resiliency');
      const res = await handleFolioEdgeRequest(req, { KV_ENGINE_PUBLIC: mockKv }, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get('X-Engine-Edge-Source')).toBe('SUPABASE_FALLBACK');
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
      const json = await res.json();
      expect(json.nodeId).toBe('resiliency');
      expect(ctx.waitUntil).not.toHaveBeenCalled();
      expect(mockKv.put).not.toHaveBeenCalled();
    });

    it('supports legacy /api/public/pillar/:pillarId route', async () => {
      const nodePayload = JSON.stringify({
        nodeId: 'governance',
        snapshotId: 'legacy-snap',
      });
      kvStore.set('node:governance', nodePayload);

      const req = new Request('https://domain.com/api/public/pillar/governance');
      const res = await handleFolioEdgeRequest(req, { KV_ENGINE_PUBLIC: mockKv });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.nodeId).toBe('governance');
    });
  });

  describe('GET /api/public/manifest', () => {
    it('returns cached manifest from KV', async () => {
      const manifest = JSON.stringify({
        activeSnapshotId: 'snap-manifest-1',
        publishedAt: '2026-11-15T12:00:00.000Z',
        nodeIds: ['access', 'equity'],
      });
      kvStore.set('portal:manifest', manifest);

      const req = new Request('https://domain.com/api/public/manifest');
      const res = await handleFolioEdgeRequest(req, { KV_ENGINE_PUBLIC: mockKv });
      expect(res.status).toBe(200);
      expect(res.headers.get('X-Engine-Edge-Source')).toBe('KV');
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
      const json = await res.json();
      expect(json.activeSnapshotId).toBe('snap-manifest-1');
    });

    it('returns fallback manifest on cold miss', async () => {
      const req = new Request('https://domain.com/api/public/manifest');
      const res = await handleFolioEdgeRequest(req, { KV_ENGINE_PUBLIC: mockKv });
      expect(res.status).toBe(200);
      expect(res.headers.get('X-Engine-Edge-Source')).toBe('SUPABASE_FALLBACK');
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
      const json = await res.json();
      expect(json.activeSnapshotId).toBe('snapshot-latest');
      expect(json.nodeIds).toHaveLength(5);
    });
  });

  describe('GET /api/public/chart/:chartId', () => {
    it('returns 200 with chart payload on KV hit', async () => {
      const chartData = JSON.stringify({
        chartId: 'chart-enrollment',
        title: 'Enrollment Trend',
      });
      kvStore.set('chart:chart-enrollment', chartData);

      const req = new Request('https://domain.com/api/public/chart/chart-enrollment');
      const res = await handleFolioEdgeRequest(req, { KV_ENGINE_PUBLIC: mockKv });
      expect(res.status).toBe(200);
      expect(res.headers.get('X-Engine-Edge-Source')).toBe('KV');
      const json = await res.json();
      expect(json.chartId).toBe('chart-enrollment');
    });

    it('returns 404 when chart is not in KV and not in baked charts', async () => {
      const req = new Request('https://domain.com/api/public/chart/nonexistent-chart-xyz');
      const res = await handleFolioEdgeRequest(req, { KV_ENGINE_PUBLIC: mockKv });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Chart not found');
    });
  });

  describe('GET /api/media/drive/:fileId', () => {
    it('returns 400 for invalid Drive file ID', async () => {
      const req = new Request('https://domain.com/api/media/drive/bad_id!');
      const res = await handleFolioEdgeRequest(req, {});
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain('Invalid Drive file ID');
    });

    it('proxies upstream Google Drive image successfully', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('drive.google.com/thumbnail')) {
          return new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { 'Content-Type': 'image/jpeg' },
          });
        }
        return new Response('Error', { status: 500 });
      });
      global.fetch = mockFetch;

      const req = new Request('https://domain.com/api/media/drive/1A2B3C4D5E6F7G8H9I0J?w=800');
      const res = await handleFolioEdgeRequest(req, {});
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/jpeg');
      expect(res.headers.get('X-Engine-Media-Source')).toBe('UPSTREAM_DRIVE');
      expect(res.headers.get('Cache-Control')).toContain('immutable');
    });

    it('returns SVG placeholder when upstream returns 404 or 403', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response('Not found', { status: 404 });
      });
      global.fetch = mockFetch;

      const req = new Request('https://domain.com/api/media/drive/1A2B3C4D5E6F7G8H9I0J');
      const res = await handleFolioEdgeRequest(req, {});
      expect(res.status).toBe(404);
      expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
      expect(res.headers.get('X-Engine-Media-Source')).toBe('UPSTREAM_FALLBACK_SVG');
      const svgText = await res.text();
      expect(svgText).toContain('<svg');
      expect(svgText).toContain('Photo Not Found (404)');
    });
  });

  describe('Static Asset & SPA Fallthrough', () => {
    it('delegates non-API requests to env.ASSETS.fetch when available', async () => {
      const mockAssets = {
        fetch: vi.fn(async (_request: Request) => {
          return new Response('<!DOCTYPE html><html><body>SPA Root</body></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          });
        }),
      };

      const req = new Request('https://domain.com/access');
      const res = await handleFolioEdgeRequest(req, { ASSETS: mockAssets });
      expect(res.status).toBe(200);
      expect(mockAssets.fetch).toHaveBeenCalledWith(req);
      const html = await res.text();
      expect(html).toContain('SPA Root');
    });

    it('returns 404 when env.ASSETS is undefined', async () => {
      const req = new Request('https://domain.com/some/unknown/page');
      const res = await handleFolioEdgeRequest(req, {});
      expect(res.status).toBe(404);
      const text = await res.text();
      expect(text).toBe('Not Found');
    });

    it('returns 404 for unknown /api/* endpoint', async () => {
      const req = new Request('https://domain.com/api/unknown-endpoint');
      const res = await handleFolioEdgeRequest(req, {});
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Endpoint not found');
    });
  });
});
