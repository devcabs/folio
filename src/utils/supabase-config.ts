import { getStorageNamespace } from '../config/engine.config';
import { evaluateSupabaseTarget, isProductionBuild } from './runtime-env';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let warnedTargetCode: string | null = null;

/**
 * Canonical Supabase endpoint configuration parser.
 * Validates against placeholder defaults and trailing slashes.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    '';
  const anonKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
    '';

  if (url && anonKey && !url.includes('your-project.supabase.co')) {
    const cleanUrl = url.replace(/\/+$/, '');
    const verdict = evaluateSupabaseTarget(cleanUrl, isProductionBuild());
    if (!verdict.ok) {
      if (warnedTargetCode !== verdict.code) {
        warnedTargetCode = verdict.code;
        console.error(`[env-guard] ${verdict.code}: ${verdict.message}`);
      }
      return null;
    }
    return { url: cleanUrl, anonKey };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Supabase Table Availability Memoizer (Task 11.2.E2)
// Suppresses repeated 404 network cascades for unprovisioned optional tables.
// ---------------------------------------------------------------------------
const missingTables = new Set<string>();
export const getMissingTablesStorageKey = (ns?: string) => (ns || getStorageNamespace()) + '_missing_supabase_tables';
export const STORAGE_KEY_MISSING_TABLES = getMissingTablesStorageKey();

function getSessionStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage;
    }
  } catch {
    // Tolerant in restricted sandboxes
  }
  return null;
}

// Rehydrate missing table knowledge from sessionStorage on module load
try {
  const storage = getSessionStorage();
  if (storage) {
    const raw = storage.getItem(STORAGE_KEY_MISSING_TABLES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed
          .filter((t) => t !== 'dev_mode_session')
          .forEach((t) => typeof t === 'string' && missingTables.add(t));
      }
    }
  }
} catch {
  // Ignore rehydration failures
}

/**
 * Checks whether a Supabase table is known to be available.
 * Returns false if the table previously returned 404 in this browser session.
 * dev_mode_session is always queried to enforce institutional exclusivity.
 */
export function isTableAvailable(tableName: string): boolean {
  if (tableName === 'dev_mode_session') return true;
  return !missingTables.has(tableName);
}

/**
 * Marks a Supabase table as missing (404) for the remainder of this session.
 */
export function markTableMissing(tableName: string): void {
  if (tableName === 'dev_mode_session') return;
  missingTables.add(tableName);
  try {
    const storage = getSessionStorage();
    if (storage) {
      storage.setItem(
        STORAGE_KEY_MISSING_TABLES,
        JSON.stringify(Array.from(missingTables))
      );
    }
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Marks a Supabase table as available, removing any previously memoized 404 block.
 */
export function markTableAvailable(tableName: string): void {
  missingTables.delete(tableName);
  try {
    const storage = getSessionStorage();
    if (storage) {
      storage.setItem(
        STORAGE_KEY_MISSING_TABLES,
        JSON.stringify(Array.from(missingTables))
      );
    }
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Resets memoized missing tables (used in automated tests and session resets).
 */
export function resetMissingTablesForTesting(): void {
  missingTables.clear();
  try {
    const storage = getSessionStorage();
    if (storage) {
      storage.removeItem(STORAGE_KEY_MISSING_TABLES);
    }
  } catch {
    // Ignore storage remove errors
  }
}
