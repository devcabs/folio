import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { handleDriveMediaRoute } from '../src/edge/handlers/mediaHandler';
import { handleLockRoute, KV_LOCK_COORDINATOR_KEY } from '../src/edge/handlers/lockHandler';
import { handleFolioEdgeRequest } from '../src/edge/router';
import { hashPin } from '../src/utils/devSecurity';
import { useImageLoader } from '../src/hooks/useImageLoader';
import {
  checkDevLockStatus,
  acquireDevLock,
  renewDevLockHeartbeat,
  releaseDevLock,
} from '../src/services/devLockService';
import type { KVNamespace } from '../src/types/edge';

function createMockKV(): KVNamespace & { store: Map<string, { value: string; ttl?: number }> } {
  const store = new Map<string, { value: string; ttl?: number }>();
  return {
    store,
    get: (async (key: string, type?: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (type === 'json') {
        return JSON.parse(entry.value);
      }
      return entry.value;
    }) as KVNamespace['get'],
    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      store.set(key, { value: String(value), ttl: options?.expirationTtl });
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async list(): Promise<{ keys: Array<{ name: string }>; list_complete: boolean }> {
      return {
        keys: Array.from(store.keys()).map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
}

describe('Subtask 7.9: Media Proxy, Image Loader & Coordinator Lock SSOT', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('1. Fail-Stop Edge Media Proxy (mediaHandler.ts)', () => {
    it('returns explicit JSON error (never SVG placeholder) when upstream Google Drive returns 404 or 403', async () => {
      for (const status of [403, 404]) {
        global.fetch = vi.fn().mockResolvedValue(
          new Response('Upstream error', { status, statusText: status === 403 ? 'Forbidden' : 'Not Found' })
        );

        const req = new Request('https://example.com/api/media/drive/1A2B3C4D5E6F7G8H9I0J?w=800');
        const res = await handleDriveMediaRoute(req, '1A2B3C4D5E6F7G8H9I0J');

        expect(res.status).toBe(status);
        expect(res.headers.get('Content-Type')).toContain('application/json');
        expect(res.headers.get('Content-Type')).not.toContain('image/svg+xml');
        expect(res.headers.get('X-Engine-Media-Source')).not.toBe('UPSTREAM_FALLBACK_SVG');
        const body = await res.json();
        expect(body.error).toBeDefined();
        expect(body.status).toBe(status);
      }
    });

    it('uses bounded Cache-Control (max-age=300, s-maxage=3600) without 1-year immutable poisoning', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      );

      const req = new Request('https://example.com/api/media/drive/1A2B3C4D5E6F7G8H9I0J?w=800');
      const res = await handleDriveMediaRoute(req, '1A2B3C4D5E6F7G8H9I0J');

      expect(res.status).toBe(200);
      const cc = res.headers.get('Cache-Control') || '';
      expect(cc).toBe('public, max-age=300, s-maxage=3600');
      expect(cc).not.toContain('immutable');
      expect(cc).not.toContain('31536000');
    });
  });

  describe('2. Client Image Loader & Component SSOT (no direct Drive thumbnail fallback)', () => {
    it('useImageLoader transitions directly to status === "error" on image error without switching to a fallbackSrc', () => {
      const createdImages: Array<{ src: string; onerror: (() => void) | null; onload: (() => void) | null }> = [];
      const OriginalImage = global.Image;
      global.Image = class MockImage {
        referrerPolicy = '';
        complete = false;
        naturalWidth = 0;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        private _src = '';
        get src() {
          return this._src;
        }
        set src(val: string) {
          this._src = val;
          createdImages.push(this as any);
        }
      } as any;

      try {
        const { result } = renderHook(() =>
          (useImageLoader as (src?: string, fallback?: string) => ReturnType<typeof useImageLoader>)(
            '/api/media/drive/1A2B3C4D5E6F7G8H9I0J?w=800',
            'https://drive.google.com/thumbnail?id=1A2B3C4D5E6F7G8H9I0J&sz=w1600'
          )
        );

        expect(result.current.status).toBe('loading');
        expect(createdImages).toHaveLength(1);
        expect(createdImages[0].src).toBe('/api/media/drive/1A2B3C4D5E6F7G8H9I0J?w=800');

        act(() => {
          createdImages[0].onerror?.();
        });

        expect(result.current.status).toBe('error');
        expect(result.current.isError).toBe(true);
        expect(result.current.resolvedSrc).toBe('/api/media/drive/1A2B3C4D5E6F7G8H9I0J?w=800');
        expect(createdImages).toHaveLength(1);
      } finally {
        global.Image = OriginalImage;
      }
    });

    it('SourceCard, SourceLightbox, LightboxPhotoStrip, and SourceImage contain no drive.google.com/thumbnail fallbacks', () => {
      const files = [
        'src/components/source/SourceCard.tsx',
        'src/components/source/SourceLightbox.tsx',
        'src/components/source/LightboxPhotoStrip.tsx',
        'src/components/source/SourceImage.tsx',
        'src/hooks/useImageLoader.ts',
      ];
      for (const relPath of files) {
        const content = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
        expect(content).not.toContain('drive.google.com/thumbnail');
        expect(content).not.toContain('permanentFallbackSrc');
        expect(content).not.toContain('retriedIndices');
      }
    });
  });

  describe('3. Edge Lock Handler (/api/lock on Cloudflare KV)', () => {
    it('fails stop with HTTP 503 when kv is null', async () => {
      const res = await handleLockRoute(
        new Request('https://example.com/api/lock', { method: 'GET' }),
        {},
        null
      );
      expect(res.status).toBe(503);
    });

    it('rejects competing sessionId with HTTP 409 unless forceReacquireWithPin is true, uses 60s TTL, and never leaks holderSessionId or lockToken on GET', async () => {
      const kv = createMockKV();
      const salt = 'test-salt-79';
      const pinHash = await hashPin('1357', salt);
      const env = { DEV_SECURITY_SALT: salt, DEV_PIN_HASH: pinHash };

      // Acquire lock as session-A
      const acqRes = await handleLockRoute(
        new Request('https://example.com/api/lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: '1357', sessionId: 'session-A', coordinatorLabel: 'Coord A' }),
        }),
        env,
        kv
      );
      expect(acqRes.status).toBe(200);
      const acqData = await acqRes.json();
      expect(acqData.success).toBe(true);
      expect(acqData.sessionId).toBe('session-A');
      expect(typeof acqData.lockToken).toBe('string');
      expect(typeof acqData.expiresAt).toBe('number');

      // Verify KV TTL is 60s
      expect(kv.store.get(KV_LOCK_COORDINATOR_KEY)?.ttl).toBe(60);

      // GET /api/lock without token: isLocked=true, canAcquire=false, isSelfSession=false, NO holderSessionId/lockToken
      const getAnon = await handleLockRoute(
        new Request('https://example.com/api/lock', { method: 'GET' }),
        env,
        kv
      );
      expect(getAnon.status).toBe(200);
      const anonData = await getAnon.json();
      expect(anonData.isLocked).toBe(true);
      expect(anonData.canAcquire).toBe(false);
      expect(anonData.isSelfSession).toBe(false);
      expect(anonData.coordinatorLabel).toBe('Coord A');
      expect(anonData.holderSessionId).toBeUndefined();
      expect(anonData.sessionId).toBeUndefined();
      expect(anonData.lockToken).toBeUndefined();

      // GET /api/lock with Bearer lockToken: isSelfSession=true, canAcquire=true
      const getSelf = await handleLockRoute(
        new Request('https://example.com/api/lock', {
          method: 'GET',
          headers: { Authorization: `Bearer ${acqData.lockToken}` },
        }),
        env,
        kv
      );
      const selfData = await getSelf.json();
      expect(selfData.isLocked).toBe(true);
      expect(selfData.canAcquire).toBe(true);
      expect(selfData.isSelfSession).toBe(true);
      expect(selfData.lockToken).toBeUndefined();

      // Competing session-B without forceReacquireWithPin gets HTTP 409
      const competeRes = await handleLockRoute(
        new Request('https://example.com/api/lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: '1357', sessionId: 'session-B', coordinatorLabel: 'Coord B' }),
        }),
        env,
        kv
      );
      expect(competeRes.status).toBe(409);

      // With forceReacquireWithPin: true, session-B supersedes
      const forceRes = await handleLockRoute(
        new Request('https://example.com/api/lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin: '1357',
            sessionId: 'session-B',
            coordinatorLabel: 'Coord B',
            forceReacquireWithPin: true,
          }),
        }),
        env,
        kv
      );
      expect(forceRes.status).toBe(200);
      const forceData = await forceRes.json();
      expect(forceData.lockToken).not.toBe(acqData.lockToken);

      // PATCH renews 60s TTL
      const patchRes = await handleLockRoute(
        new Request('https://example.com/api/lock', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${forceData.lockToken}` },
        }),
        env,
        kv
      );
      expect(patchRes.status).toBe(200);
      expect(kv.store.get(KV_LOCK_COORDINATOR_KEY)?.ttl).toBe(60);

      // DELETE removes lock:coordinator
      const delRes = await handleLockRoute(
        new Request('https://example.com/api/lock', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${forceData.lockToken}` },
        }),
        env,
        kv
      );
      expect(delRes.status).toBe(200);
      expect(kv.store.has(KV_LOCK_COORDINATOR_KEY)).toBe(false);
    });

    it('CORS preflight allows PATCH and DELETE', async () => {
      const res = await handleFolioEdgeRequest(
        new Request('https://example.com/api/lock', { method: 'OPTIONS' }),
        {}
      );
      expect(res.status).toBe(204);
      const methods = res.headers.get('Access-Control-Allow-Methods') || '';
      expect(methods).toContain('PATCH');
      expect(methods).toContain('DELETE');
    });
  });

  describe('4. devLockService.ts Fail-Stop & Zero Browser Storage SSOT', () => {
    it('contains zero Supabase, localStorage, sessionStorage, BroadcastChannel, or inMemorySessionId references', () => {
      const content = fs.readFileSync(path.resolve(process.cwd(), 'src/services/devLockService.ts'), 'utf8');
      expect(content).not.toContain('dev_mode_session');
      expect(content).not.toContain('localStorage');
      expect(content).not.toContain('sessionStorage');
      expect(content).not.toContain('inMemorySessionId');
      expect(content).not.toContain('BroadcastChannel');
      expect(content).not.toContain('getLocalLock');
      expect(content).not.toContain('setLocalLock');
    });

    it('fails stop on network error or non-2xx from /api/lock (never grants offline fallback lock)', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network down'));

      const status = await checkDevLockStatus();
      expect(status.canAcquire).toBe(false);
      expect(status.isSelfSession).toBe(false);

      const acq = await acquireDevLock({ pin: '1234' });
      expect(acq.success).toBe(false);

      const renewed = await renewDevLockHeartbeat('some-token');
      expect(renewed).toBe(false);

      const released = await releaseDevLock('some-token');
      expect(released).toBe(false);
    });

    it('fails stop when /api/lock returns HTTP 503', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'KV unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const status = await checkDevLockStatus();
      expect(status.canAcquire).toBe(false);

      const acq = await acquireDevLock({ pin: '1234' });
      expect(acq.success).toBe(false);

      const renewed = await renewDevLockHeartbeat('some-token');
      expect(renewed).toBe(false);
    });
  });
});
