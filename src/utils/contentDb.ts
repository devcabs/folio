/**
 * Content Database & Direct Cloudflare KV Content Overrides
 * Folio Engine
 *
 * Epic 7 Subtask 7.2:
 * - Zero module-level shadow stores or tombstones.
 * - Zero browser storage reads or writes.
 * - Direct Cloudflare KV reads (GET /api/public/manifest, GET /api/draft) and
 *   fail-stop mutations (PUT /api/draft with Authorization: Bearer <lockToken> & expectedUpdatedAt).
 */

import { getStorageNamespace } from '../config/engine.config';
import type { PublicPortalManifestPayload } from '../types/edge';

export const getLiveContentStorageKey = (ns?: string) => (ns || getStorageNamespace()) + '_live_content_overrides';
export const STORAGE_KEY_LIVE_CONTENT = getLiveContentStorageKey();
export const getDraftContentStorageKey = (ns?: string) => (ns || getStorageNamespace()) + '_draft_content_overrides';
export const STORAGE_KEY_DRAFT_CONTENT = getDraftContentStorageKey();
export const STORAGE_KEY_CONTENT_OVERRIDES = STORAGE_KEY_LIVE_CONTENT;

export const EVENT_LIVE_CONTENT_CHANGE = 'engine-live-content-change';
export const EVENT_DRAFT_CONTENT_CHANGE = 'engine-draft-content-change';

export interface DraftContentMutationOptions {
  lockToken?: string | null;
  expectedUpdatedAt?: string | null;
}

export interface DraftContentMutationResult {
  contentOverrides: Record<string, string>;
  updatedAt: string | null;
}

export interface DraftWorkspaceResponse {
  contentOverrides?: Record<string, string>;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Pure helper: resolves a text value from an overrides map, falling back to defaultValue.
 */
export function resolveContent(
  overrides: Record<string, string>,
  key: string,
  defaultValue: string
): string {
  if (Object.prototype.hasOwnProperty.call(overrides, key) && typeof overrides[key] === 'string') {
    return overrides[key];
  }
  return defaultValue;
}

/**
 * Pure helper: checks whether a key is overridden in an overrides map.
 */
export function hasContentOverrideInMap(overrides: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(overrides, key) && typeof overrides[key] === 'string';
}

/**
 * Pure helper: resolves structured JSON content from an overrides map, falling back to defaultValue.
 */
export function resolveContentObject<T>(
  overrides: Record<string, string>,
  key: string,
  defaultValue: T
): T {
  const raw = resolveContent(overrides, key, '');
  if (!raw) return defaultValue;
  try {
    const parsed = JSON.parse(raw);
    if (
      defaultValue &&
      typeof defaultValue === 'object' &&
      'src' in (defaultValue as Record<string, unknown>)
    ) {
      if (typeof parsed === 'string') {
        return { ...(defaultValue as Record<string, unknown>), src: parsed } as unknown as T;
      }
      if (parsed && typeof parsed === 'object') {
        return { ...(defaultValue as Record<string, unknown>), ...parsed } as unknown as T;
      }
    }
    return parsed as T;
  } catch {
    if (
      defaultValue &&
      typeof defaultValue === 'object' &&
      'src' in (defaultValue as Record<string, unknown>) &&
      typeof raw === 'string' &&
      raw.trim().length > 0
    ) {
      return { ...(defaultValue as Record<string, unknown>), src: raw.trim() } as unknown as T;
    }
    if (typeof defaultValue === 'string') {
      return raw as unknown as T;
    }
    return defaultValue;
  }
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      return parsed.error || parsed.message || `HTTP ${res.status}`;
    } catch {
      return `${text} (HTTP ${res.status})`;
    }
  } catch {
    return `HTTP ${res.status}`;
  }
}

/**
 * Fetches Public Mode contentOverrides directly from Cloudflare KV portal:manifest.
 * Fails stop (throws) on non-2xx HTTP status or network error.
 */
export async function fetchPublicManifestOverrides(): Promise<Record<string, string>> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable to read portal:manifest.');
  }
  const res = await fetch('/api/public/manifest', { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Manifest KV read failed (HTTP ${res.status})`);
  }
  const manifest = (await res.json()) as PublicPortalManifestPayload;
  return manifest.contentOverrides ? { ...manifest.contentOverrides } : {};
}

/**
 * Fetches Dev Mode contentOverrides directly from Cloudflare KV draft:workspace.
 * Fails stop (throws) on non-2xx HTTP status or network error.
 */
export async function fetchDraftWorkspaceOverrides(
  lockToken?: string | null
): Promise<DraftContentMutationResult> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable to read draft:workspace.');
  }
  const headers: Record<string, string> = {};
  if (lockToken) {
    headers['Authorization'] = `Bearer ${lockToken}`;
  }
  const res = await fetch('/api/draft', { method: 'GET', cache: 'no-store', headers });
  if (!res.ok) {
    const detail = await parseErrorDetail(res);
    throw new Error(`Draft workspace KV read failed: ${detail} (HTTP ${res.status})`);
  }
  const draft = (await res.json()) as DraftWorkspaceResponse;
  return {
    contentOverrides: draft.contentOverrides ? { ...draft.contentOverrides } : {},
    updatedAt: typeof draft.updatedAt === 'string' ? draft.updatedAt : null,
  };
}

/**
 * Persists the full contentOverrides map to Cloudflare KV draft:workspace via PUT /api/draft.
 * Fails stop (throws) on HTTP error, concurrency conflict (409), auth failure (401), or network error.
 */
export async function putDraftContentOverrides(
  contentOverrides: Record<string, string>,
  options: DraftContentMutationOptions = {}
): Promise<DraftContentMutationResult> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable to write draft:workspace.');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.lockToken) {
    headers['Authorization'] = `Bearer ${options.lockToken}`;
  }

  const body: Record<string, unknown> = { contentOverrides };
  if (options.expectedUpdatedAt) {
    body.expectedUpdatedAt = options.expectedUpdatedAt;
  }

  const res = await fetch('/api/draft', {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await parseErrorDetail(res);
    throw new Error(`Draft content KV write failed: ${detail} (HTTP ${res.status})`);
  }

  let updatedAt: string | null = null;
  let returnedOverrides = { ...contentOverrides };
  try {
    const data = (await res.json()) as DraftWorkspaceResponse;
    if (typeof data.updatedAt === 'string') {
      updatedAt = data.updatedAt;
    }
    if (data.contentOverrides && typeof data.contentOverrides === 'object') {
      returnedOverrides = { ...data.contentOverrides };
    }
  } catch {
    // Response had empty body on 200/204
  }

  return {
    contentOverrides: returnedOverrides,
    updatedAt,
  };
}

/**
 * Updates a single content override key in Cloudflare KV draft:workspace via PUT /api/draft.
 */
export async function updateDraftContentOverride(
  key: string,
  value: string,
  currentOverrides: Record<string, string>,
  options: DraftContentMutationOptions = {}
): Promise<DraftContentMutationResult> {
  const nextOverrides = {
    ...currentOverrides,
    [key]: value,
  };
  return putDraftContentOverrides(nextOverrides, options);
}

/**
 * Removes a single content override key from Cloudflare KV draft:workspace via PUT /api/draft.
 */
export async function removeDraftContentOverride(
  key: string,
  currentOverrides: Record<string, string>,
  options: DraftContentMutationOptions = {}
): Promise<DraftContentMutationResult> {
  const nextOverrides = { ...currentOverrides };
  delete nextOverrides[key];
  return putDraftContentOverrides(nextOverrides, options);
}

/**
 * Direct KV mutation for a single key in Dev Mode (reads latest draft or writes directly to PUT /api/draft).
 * Fails stop (throws) if called in Public Mode or if the KV write fails.
 */
export async function setContent(
  key: string,
  value: string,
  isDevMode = false,
  options: DraftContentMutationOptions = {}
): Promise<void> {
  if (!isDevMode) {
    throw new Error('Cannot mutate content overrides in Public Mode.');
  }
  await updateDraftContentOverride(key, value, { [key]: value }, options);
}

/**
 * Direct KV reset for a single key in Dev Mode via PUT /api/draft.
 * Fails stop (throws) if called in Public Mode or if the KV write fails.
 */
export async function resetContent(
  key: string,
  isDevMode = false,
  options: DraftContentMutationOptions = {}
): Promise<void> {
  if (!isDevMode) {
    throw new Error('Cannot reset content overrides in Public Mode.');
  }
  await removeDraftContentOverride(key, {}, options);
}

/**
 * Synchronous fallback helper for legacy non-React callers; prefer useContent() / PortalChromeContext.
 */
export function getContent(_key: string, defaultValue: string, _isDevMode = false): string {
  return defaultValue;
}

/**
 * Synchronous fallback helper for legacy non-React callers; prefer useContentObject() / PortalChromeContext.
 */
export function getContentObject<T>(_key: string, defaultValue: T, _isDevMode = false): T {
  return defaultValue;
}

/**
 * Synchronous fallback helper for legacy non-React callers; prefer useContent() / PortalChromeContext.
 */
export function hasContentOverride(_key: string, _isDevMode = false): boolean {
  return false;
}

/**
 * Synchronous fallback helper for legacy non-React callers; prefer useContentObject().
 */
export async function setContentObject<T>(
  key: string,
  value: T,
  isDevMode = false,
  options: DraftContentMutationOptions = {}
): Promise<void> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  await setContent(key, serialized, isDevMode, options);
}

/**
 * @deprecated Removed in Epic 7.2; returns empty map without module-level cache.
 */
export function getAllContentOverrides(_isDevMode = false): Record<string, string> {
  return {};
}

/**
 * @deprecated Removed in Epic 7.2; no-op without module-level tombstones.
 */
export function clearDraftTombstones(): void {}

/**
 * @deprecated Removed in Epic 7.2; no-op without module-level shadow stores.
 */
export function resetAllContentOverrides(_isDevMode = false): void {}

/**
 * @deprecated Removed in Epic 7.2; no-op without module-level shadow stores.
 */
export function setAllContentOverrides(_overrides: Record<string, string>, _isDevMode = false): void {}

/**
 * @deprecated Removed in Epic 7.2; no-op without module-level shadow stores.
 */
export function invalidateContentCache(): void {}

/**
 * @deprecated Removed in Epic 7.2; returns empty map without module-level cache.
 */
export function getLiveContentOverrides(): Record<string, string> {
  return {};
}

export interface SetContentOverridesOptions {
  memoryOnly?: boolean;
}

/**
 * @deprecated Removed in Epic 7.2; no-op without module-level shadow stores.
 */
export function setLiveContentOverrides(
  _overrides: Record<string, string>,
  _options?: SetContentOverridesOptions
): void {}

/**
 * @deprecated Removed in Epic 7.2; PortalChromeContext drives React updates directly.
 */
export function subscribeToContentChange(
  _callback: (detail: { key: string; value: string | null }) => void,
  _isDevMode = false
): () => void {
  return () => {};
}
