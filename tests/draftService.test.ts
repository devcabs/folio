import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initDraftSession,
  clearDraftStorage,
  isDraftModeActive,
} from '../src/services/draftService';
import { resetEngineConfig } from '../src/config/engine.config';

describe('Subtask 2.9: Draft Init Concurrency Sentinel', () => {
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

  it('returns the exact same in-flight promise when initDraftSession is called concurrently', async () => {
    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('engine_drafts')) {
        await fetchPromise;
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    // Launch two concurrent initDraftSession calls
    const p1 = initDraftSession();
    const p2 = initDraftSession();

    // Verify both calls returned the identical promise reference
    expect(p1).toBe(p2);

    resolveFetch!(null);
    await Promise.all([p1, p2]);
  });

  it('makes only a single network request to engine_drafts during parallel initDraftSession calls', async () => {
    let networkCallCount = 0;
    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('engine_drafts')) {
        networkCallCount += 1;
        await fetchPromise;
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    // Launch three concurrent initDraftSession calls
    const [r1, r2, r3] = [initDraftSession(), initDraftSession(), initDraftSession()];
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);

    resolveFetch!(null);
    await Promise.all([r1, r2, r3]);

    expect(networkCallCount).toBe(1);
    expect(isDraftModeActive()).toBe(true);
  });

  it('resets the sentinel after completion allowing subsequent sequential calls to run', async () => {
    global.fetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const p1 = initDraftSession();
    await p1;

    const p2 = initDraftSession();
    expect(p2).not.toBe(p1);
    await p2;
  });

  it('bypasses in-flight promise if forceFresh is true', async () => {
    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('engine_drafts')) {
        await fetchPromise;
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const p1 = initDraftSession();
    const pFresh = initDraftSession(true);

    // With forceFresh = true, pFresh should be a distinct new promise
    expect(pFresh).not.toBe(p1);

    resolveFetch!(null);
    await Promise.all([p1, pFresh]);
  });
});

