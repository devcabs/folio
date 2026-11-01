/**
 * CLI target resolver (Task 11.98.D1).
 * Scripts default to DEV; PROD needs --target=prod AND --confirm-prod=<ref>.
 * Secrets are read ONLY from .env.scripts (never VITE_*), never fall back to anon keys.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const PROD_REF = 'mjuwqlxdxhujqiqpkcaj';

export interface ScriptTarget {
  target: 'dev' | 'prod';
  url: string;
  serviceKey: string;
  ref: string;
}

function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function fail(msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

export function loadScriptEnv(cwd = process.cwd()): Record<string, string> {
  const file = path.resolve(cwd, '.env.scripts');
  if (!fs.existsSync(file)) fail('Missing .env.scripts. Copy .env.scripts.example and fill in your secrets.');
  const merged = { ...parseEnvFile(file) };
  for (const k of Object.keys(merged)) if (process.env[k]) merged[k] = process.env[k] as string;
  // Public Drive key (not a secret) may come from the dev env file for convenience.
  if (!process.env.VITE_GOOGLE_DRIVE_API_KEY) {
    const drive = parseEnvFile(path.resolve(cwd, '.env.development')).VITE_GOOGLE_DRIVE_API_KEY;
    if (drive) process.env.VITE_GOOGLE_DRIVE_API_KEY = drive;
  }
  return merged;
}

export function resolveTarget(argv: string[] = process.argv.slice(2), cwd = process.cwd()): ScriptTarget {
  const env = loadScriptEnv(cwd);
  const wantsProd = argv.includes('--target=prod');
  if (wantsProd) {
    if (!argv.includes(`--confirm-prod=${PROD_REF}`)) {
      fail(`Refusing: pass --target=prod --confirm-prod=${PROD_REF} to touch PRODUCTION.`);
    }
    const url = env.SUPABASE_PROD_URL || '';
    const serviceKey = env.SUPABASE_PROD_SERVICE_ROLE_KEY || '';
    if (!url.includes(PROD_REF)) fail('SUPABASE_PROD_URL must be the production project.');
    if (!serviceKey) fail('SUPABASE_PROD_SERVICE_ROLE_KEY missing in .env.scripts.');
    return { target: 'prod', url: url.replace(/\/+$/, ''), serviceKey, ref: PROD_REF };
  }
  const url = env.SUPABASE_DEV_URL || '';
  const serviceKey = env.SUPABASE_DEV_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) fail('SUPABASE_DEV_URL / SUPABASE_DEV_SERVICE_ROLE_KEY missing in .env.scripts.');
  if (url.includes(PROD_REF)) fail('SUPABASE_DEV_URL points at PRODUCTION. Fix .env.scripts.');
  return { target: 'dev', url: url.replace(/\/+$/, ''), serviceKey, ref: new URL(url).hostname.split('.')[0] };
}

export async function printBanner(t: ScriptTarget): Promise<void> {
  if (t.target === 'dev') {
    console.log(`🟢 TARGET=DEV ${t.url}`);
    return;
  }
  console.log(`🔴 TARGET=PROD ${t.url} (LIVE DATA) — Ctrl-C within 5s to abort`);
  await new Promise((r) => setTimeout(r, 5000));
}

export function scriptHeaders(t: ScriptTarget): Record<string, string> {
  return { apikey: t.serviceKey, Authorization: `Bearer ${t.serviceKey}`, 'Content-Type': 'application/json' };
}
