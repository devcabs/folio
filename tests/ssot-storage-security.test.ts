import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { setEngineConfig, resetEngineConfig } from '../src/config/engine.config';
import { hashPin, verifyPin, MAX_ATTEMPTS } from '../src/utils/devSecurity';
import { handleLockRoute } from '../src/edge/handlers/lockHandler';
import type { KVNamespace } from '../src/types/edge';

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const FUNCTIONS_DIR = path.join(ROOT_DIR, 'functions');

function collectTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function stripCommentsAndStringsForStorageScan(code: string): string {
  // Strip single-line and block comments so historical doc comments don't trigger false positives
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
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
    async list(): Promise<{ keys: { name: string }[]; list_complete: boolean }> {
      return {
        keys: Array.from(store.keys()).map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
}

describe('Subtask 7.1: Zero Browser Storage, Supabase Removal & KV Security SSOT', () => {
  beforeEach(() => {
    resetEngineConfig();
  });

  it('deleted legacy browser-storage and Supabase files do not exist', () => {
    const forbiddenFiles = [
      'src/services/historyStorage.ts',
      'src/services/mediaService.ts',
      'src/utils/storageAdapter.ts',
      'src/utils/supabase-config.ts',
      'src/utils/supabase-write-guard.ts',
      'src/utils/runtime-env.ts',
    ];

    for (const relPath of forbiddenFiles) {
      expect(fs.existsSync(path.join(ROOT_DIR, relPath)), `${relPath} should be deleted`).toBe(false);
    }
  });

  it('src/index.ts does not re-export deleted browser-storage or Supabase modules', () => {
    const indexContent = fs.readFileSync(path.join(SRC_DIR, 'index.ts'), 'utf8');
    expect(indexContent).not.toContain('historyStorage');
    expect(indexContent).not.toContain('mediaService');
    expect(indexContent).not.toContain('storageAdapter');
    expect(indexContent).not.toContain('supabase-config');
    expect(indexContent).not.toContain('./utils/storage"');
    expect(indexContent).not.toContain("./utils/storage'");
  });

  it('zero files in src/ access window.localStorage, window.sessionStorage, or window.indexedDB', () => {
    const srcFiles = collectTsFiles(SRC_DIR).filter(
      (f) => !f.endsWith(path.join('migrations', 'ledger.ts'))
    );
    const violations: string[] = [];

    for (const file of srcFiles) {
      const raw = fs.readFileSync(file, 'utf8');
      const code = stripCommentsAndStringsForStorageScan(raw);
      if (
        /\b(window\.)?(localStorage|sessionStorage|indexedDB)\b/.test(code)
      ) {
        violations.push(path.relative(ROOT_DIR, file));
      }
    }

    expect(violations).toEqual([]);
  });

  it('zero files in src/ or functions/ import deleted supabase-config or historyStorage', () => {
    const files = [...collectTsFiles(SRC_DIR), ...collectTsFiles(FUNCTIONS_DIR)];
    const violations: string[] = [];

    for (const file of files) {
      const raw = fs.readFileSync(file, 'utf8');
      if (
        raw.includes('supabase-config') ||
        raw.includes('supabase-write-guard') ||
        raw.includes('historyStorage') ||
        raw.includes('storageAdapter') ||
        raw.includes('mediaService')
      ) {
        violations.push(path.relative(ROOT_DIR, file));
      }
    }

    expect(violations).toEqual([]);
  });

  it('verifyPin throws an explicit configuration error when EngineConfig lacks securitySalt or expectedPinHash', async () => {
    await expect(verifyPin('1234')).rejects.toThrow(/securitySalt|expectedPinHash|configured/i);

    setEngineConfig({ securitySalt: 'only_salt' });
    await expect(verifyPin('1234')).rejects.toThrow(/securitySalt|expectedPinHash|configured/i);
  });

  it('verifyPin validates PIN deterministically when explicit credentials or EngineConfig are provided', async () => {
    const salt = 'test_edge_salt_ssot';
    const expectedHash = await hashPin('4321', salt);

    setEngineConfig({ securitySalt: salt, expectedPinHash: expectedHash });
    expect(await verifyPin('4321')).toBe(true);
    expect(await verifyPin('0000')).toBe(false);
    expect(await verifyPin('123')).toBe(false);
    expect(await verifyPin('')).toBe(false);
  });

  it('Edge lockHandler fails stop with HTTP 503 when DEV_PIN_HASH or DEV_SECURITY_SALT is unconfigured', async () => {
    const kv = createMockKV();
    const req = new Request('https://example.com/api/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' }),
    });

    const res = await handleLockRoute(req, {}, kv);
    expect(res.status).toBe(503);
  });

  it('Edge lockHandler verifies PIN, enforces KV rate-limiting, issues opaque lockToken, and supports supersede/heartbeat/release', async () => {
    const kv = createMockKV();
    const salt = 'edge_test_salt';
    const pinHash = await hashPin('2468', salt);
    const env = { DEV_SECURITY_SALT: salt, DEV_PIN_HASH: pinHash };

    // 1. Wrong PIN returns 401 and increments lock:pin_ratelimit
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      const badReq = new Request('https://example.com/api/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '0000' }),
      });
      const badRes = await handleLockRoute(badReq, env, kv);
      expect(badRes.status).toBe(401);
    }

    // 2. MAX_ATTEMPTS wrong PIN triggers HTTP 429 lockout
    const lockoutReq = new Request('https://example.com/api/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '0000' }),
    });
    const lockoutRes = await handleLockRoute(lockoutReq, env, kv);
    expect(lockoutRes.status).toBe(429);

    // 3. Even correct PIN is blocked while locked out
    const blockedReq = new Request('https://example.com/api/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '2468' }),
    });
    const blockedRes = await handleLockRoute(blockedReq, env, kv);
    expect(blockedRes.status).toBe(429);

    // Clear rate limit in KV to test valid PIN acquisition
    await kv.delete('lock:pin_ratelimit');

    // 4. Valid PIN issues opaque lockToken
    const okReq = new Request('https://example.com/api/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '2468' }),
    });
    const okRes = await handleLockRoute(okReq, env, kv);
    expect(okRes.status).toBe(200);
    const okData = await okRes.json();
    expect(okData.ok).toBe(true);
    expect(typeof okData.lockToken).toBe('string');
    expect(okData.lockToken.length).toBeGreaterThan(16);

    // 5. GET /api/lock never leaks lockToken or holderSessionId
    const getRes = await handleLockRoute(new Request('https://example.com/api/lock', { method: 'GET' }), env, kv);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.locked).toBe(true);
    expect(getData.lockToken).toBeUndefined();
    expect(getData.holderSessionId).toBeUndefined();

    // 6. Re-authenticating with valid PIN supersedes stale lock
    const supersedeReq = new Request('https://example.com/api/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '2468' }),
    });
    const supersedeRes = await handleLockRoute(supersedeReq, env, kv);
    expect(supersedeRes.status).toBe(200);
    const supersedeData = await supersedeRes.json();
    expect(supersedeData.lockToken).not.toBe(okData.lockToken);

    // 7. Old token cannot PATCH or DELETE
    const stalePatch = await handleLockRoute(
      new Request('https://example.com/api/lock', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${okData.lockToken}` },
      }),
      env,
      kv
    );
    expect(stalePatch.status).toBe(401);

    // 8. New token can PATCH and DELETE
    const validPatch = await handleLockRoute(
      new Request('https://example.com/api/lock', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${supersedeData.lockToken}` },
      }),
      env,
      kv
    );
    expect(validPatch.status).toBe(200);

    const validDelete = await handleLockRoute(
      new Request('https://example.com/api/lock', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${supersedeData.lockToken}` },
      }),
      env,
      kv
    );
    expect(validDelete.status).toBe(200);

    const afterDelete = await handleLockRoute(new Request('https://example.com/api/lock', { method: 'GET' }), env, kv);
    const afterData = await afterDelete.json();
    expect(afterData.locked).toBe(false);
  });
});
