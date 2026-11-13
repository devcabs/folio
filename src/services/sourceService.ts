/**
 * BaaS Data Access Layer & Live Evidence Persistence Service
 * Folio Engine
 * Subtask 5.1: Database Schema & BaaS Persistence Engine
 *
 * Implements a resilient client service layer with:
 * 1. PostgREST / Supabase cloud persistence for live coordinator updates.
 * 2. Multi-tier caching (In-Memory -> LocalStorage snapshot -> Baseline JSON fallback).
 * 3. Zero-downtime offline and network disconnection resilience.
 */

import baselineSourcesRaw from '../data/source-sources.json';
import type {
  SourceSourceRegistry,
  LiveSourceSource,
  LiveSourceRegistry,
  UpsertSourcePayload,
  SyncedSourceItem,
} from '../types/source';
import { normalizePointId } from '../utils/source';
import { getStorage } from '../utils/storage';
import { getSupabaseConfig } from '../utils/supabase-config';
import { getStorageNamespace } from '../config/engine.config';

export const getSourceCacheStorageKey = (ns?: string) => (ns || getStorageNamespace()) + '_evidence_cache_v2';
export const STORAGE_KEY_SOURCE_CACHE = getSourceCacheStorageKey();
export const EVENT_SOURCE_SOURCE_CHANGE = 'engine-evidence-source-change';
export const EVENT_SOURCE_SYNC_STATUS = 'engine-source-sync-status';
export const EVENT_EVIDENCE_SYNC_STATUS = 'engine-evidence-sync-status';

export interface SourceSyncStatusDetail {
  pointId: string;
  cloudSynced: boolean;
  error?: string;
  isBackground?: boolean;
  timestamp: string;
}

export interface UpsertSourceOptions {
  isBackground?: boolean;
}

/**
 * Dispatches sync status events for cloud persistence observability.
 */
export function notifySyncStatus(
  pointId: string,
  cloudSynced: boolean,
  error?: string,
  isBackground: boolean = false
): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    const detail: SourceSyncStatusDetail = {
      pointId,
      cloudSynced,
      error,
      isBackground,
      timestamp: new Date().toISOString(),
    };
    window.dispatchEvent(new CustomEvent(EVENT_SOURCE_SYNC_STATUS, { detail }));
    window.dispatchEvent(new CustomEvent(EVENT_EVIDENCE_SYNC_STATUS, { detail }));
  } catch {
    // Non-browser or restricted context
  }
}

/**
 * Subscribes to source cloud sync status events.
 */
export function subscribeToSourceSyncStatus(
  callback: (detail: SourceSyncStatusDetail) => void
): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<SourceSyncStatusDetail>).detail;
    callback(detail);
  };
  window.addEventListener(EVENT_SOURCE_SYNC_STATUS, handler);
  return () => window.removeEventListener(EVENT_SOURCE_SYNC_STATUS, handler);
}

const baselineRegistry = baselineSourcesRaw as SourceSourceRegistry;

// Runtime in-memory registry cache
let inMemoryRegistry: LiveSourceRegistry | null = null;
let activeFetchPromise: Promise<LiveSourceRegistry> | null = null;

/**
 * Converts the static Phase 4 baseline JSON into the typed LiveSourceRegistry format.
 */
function getBaselineSnapshot(): LiveSourceRegistry {
  const result: LiveSourceRegistry = {};
  for (const [key, source] of Object.entries(baselineRegistry)) {
    result[key] = {
      pointId: source.pointId,
      folderUrl: source.folderUrl,
      folderTitle: source.folderTitle,
      description: source.description,
      updatedBy: 'Coordinator',
      lastVerified: source.lastVerified ?? new Date().toISOString().split('T')[0],
      createdAt: '2025-10-01T00:00:00Z',
    };
  }
  return result;
}

/**
 * Sanitizes a LiveSourceSource ensuring any ephemeral /drive-storage/ links
 * are permanently replaced with stable, non-expiring Google Drive endpoints.
 */
export function sanitizeLiveSourceSource(source: LiveSourceSource): LiveSourceSource {
  if (!Array.isArray(source.syncedPhotos) || source.syncedPhotos.length === 0) {
    return source;
  }
  let hasEphemeral = false;
  const sanitizedPhotos = source.syncedPhotos.map((photo) => {
    const isEphemeral =
      (photo.fullImageUrl && photo.fullImageUrl.includes('/drive-storage/')) ||
      (photo.thumbnailUrl && photo.thumbnailUrl.includes('/drive-storage/')) ||
      (photo.imageSrc && photo.imageSrc.includes('/drive-storage/')) ||
      (photo.photo?.src && photo.photo.src.includes('/drive-storage/'));

    if (!isEphemeral) return photo;
    hasEphemeral = true;

    const fileId =
      photo.driveFileId ||
      (photo.id?.startsWith('drive-') ? photo.id.replace(/^drive-/, '') : '');

    if (!fileId) return photo;

    const permHighRes = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`;
    const permThumb = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w320`;

    return {
      ...photo,
      thumbnailUrl: photo.thumbnailUrl?.includes('/drive-storage/') ? permThumb : photo.thumbnailUrl,
      fullImageUrl: photo.fullImageUrl?.includes('/drive-storage/') ? permHighRes : photo.fullImageUrl,
      imageSrc: photo.imageSrc?.includes('/drive-storage/') ? permHighRes : photo.imageSrc,
      photo: {
        src: photo.photo?.src?.includes('/drive-storage/') ? permHighRes : (photo.photo?.src || permHighRes),
        alt: photo.photo?.alt || '',
        caption: photo.photo?.caption,
        showCaption: photo.photo?.showCaption,
      },
    };
  });

  if (!hasEphemeral) return source;
  return { ...source, syncedPhotos: sanitizedPhotos };
}

/**
 * Loads cached source sources from localStorage snapshot.
 */
function loadFromStorage(): LiveSourceRegistry | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(getSourceCacheStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveSourceRegistry;
    const sanitized: LiveSourceRegistry = {};
    for (const [k, v] of Object.entries(parsed)) {
      sanitized[k] = sanitizeLiveSourceSource(v);
    }
    return sanitized;
  } catch {
    return null;
  }
}

/**
 * Persists the current source registry into the localStorage snapshot.
 */
function saveToStorage(registry: LiveSourceRegistry): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(getSourceCacheStorageKey(), JSON.stringify(registry));
  } catch {
    // Quota safety: If storing syncedPhotos exceeds quota, strip heavy payloads
    // and persist core folder metadata so coordinator attachments never fail
    try {
      const strippedRegistry: LiveSourceRegistry = {};
      for (const [k, v] of Object.entries(registry)) {
        strippedRegistry[k] = { ...v, syncedPhotos: undefined };
      }
      storage.setItem(getSourceCacheStorageKey(), JSON.stringify(strippedRegistry));
    } catch {
      // Storage fully blocked or quota completely exhausted
    }
  }
}

/**
 * Helper to dispatch window events for live reactivity across components.
 */
function notifyChange(pointId: string, record: LiveSourceSource): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_SOURCE_SOURCE_CHANGE, {
        detail: { pointId, record },
      })
    );
  } catch {
    // Non-browser or restricted context
  }
}

/**
 * Maps PostgreSQL database record row to typed client model.
 */
function mapDbRowToLiveSource(row: {
  point_id: string;
  folder_url: string;
  folder_title: string;
  description?: string | null;
  updated_by?: string | null;
  last_verified?: string | null;
  created_at?: string | null;
  synced_photos?: SyncedSourceItem[] | null;
}): LiveSourceSource {
  const baseSource: LiveSourceSource = {
    pointId: row.point_id,
    folderUrl: row.folder_url,
    folderTitle: row.folder_title,
    description: row.description ?? undefined,
    updatedBy: row.updated_by ?? 'Coordinator',
    lastVerified: row.last_verified ?? new Date().toISOString(),
    createdAt: row.created_at ?? new Date().toISOString(),
    syncedPhotos: Array.isArray(row.synced_photos) ? row.synced_photos : undefined,
  };
  return sanitizeLiveSourceSource(baseSource);
}

/**
 * Asynchronously fetches live source sources from the database.
 * Falls back transparently to localStorage snapshots or baseline JSON.
 */
export async function fetchLiveSourceSources(options?: {
  forceRefresh?: boolean;
}): Promise<LiveSourceRegistry> {
  // 1. If memory cache exists and no refresh requested, return immediately
  if (inMemoryRegistry !== null && !options?.forceRefresh) {
    return inMemoryRegistry;
  }

  // 2. Prevent duplicate concurrent fetches
  if (activeFetchPromise && !options?.forceRefresh) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    // Start with baseline seed
    const registry: LiveSourceRegistry = getBaselineSnapshot();

    // Layer cached local storage snapshot
    const stored = loadFromStorage();
    if (stored) {
      Object.assign(registry, stored);
    }

    // Attempt remote BaaS fetch if configured
    const config = getSupabaseConfig();
    if (config) {
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

        const response = await fetch(`${config.url}/rest/v1/engine_sources?select=*`, {
          method: 'GET',
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller?.signal,
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (response.ok) {
          const rows = (await response.json()) as Array<{
            point_id: string;
            folder_url: string;
            folder_title: string;
            description?: string | null;
            updated_by?: string | null;
            last_verified?: string | null;
            created_at?: string | null;
          }>;

          if (Array.isArray(rows)) {
            for (const row of rows) {
              const liveSource = mapDbRowToLiveSource(row);
              registry[liveSource.pointId] = liveSource;
            }
            saveToStorage(registry);
          }
        }
      } catch {
        // Network offline or endpoint unreachable: fail-safe to cached/baseline data
      }
    }

    inMemoryRegistry = registry;
    return inMemoryRegistry;
  })();

  try {
    return await activeFetchPromise;
  } finally {
    activeFetchPromise = null;
  }
}

/**
 * Retrieves a single live source source by pointId with slug normalization.
 */
export async function getLiveSourceSource(pointId: string): Promise<LiveSourceSource | null> {
  const normalizedKey = normalizePointId(pointId);
  if (!normalizedKey) return null;

  const registry = await fetchLiveSourceSources();
  return registry[normalizedKey] ?? null;
}

/**
 * Synchronous accessor for fast UI rendering loops without layout shift.
 * Reads from memory cache, localStorage snapshot, or fallback baseline synchronously.
 */
export function getSourceSourceSync(pointId: string): LiveSourceSource | null {
  const normalizedKey = normalizePointId(pointId);
  if (!normalizedKey) return null;

  if (inMemoryRegistry && inMemoryRegistry[normalizedKey]) {
    return inMemoryRegistry[normalizedKey];
  }

  const stored = loadFromStorage();
  if (stored && stored[normalizedKey]) {
    if (!inMemoryRegistry) inMemoryRegistry = { ...getBaselineSnapshot(), ...stored };
    return stored[normalizedKey];
  }

  const baseline = getBaselineSnapshot();
  return baseline[normalizedKey] ?? null;
}

/**
 * Inserts or updates an source source in the BaaS database and local caches.
 */
export async function upsertLiveSourceSource(
  payload: UpsertSourcePayload,
  token?: string,
  options?: UpsertSourceOptions
): Promise<LiveSourceSource> {
  const normalizedKey = normalizePointId(payload.pointId);
  if (!normalizedKey) {
    throw new Error('Invalid pointId: cannot be empty');
  }

  const nowIso = new Date().toISOString();
  const existing = await getLiveSourceSource(normalizedKey);

  const updatedSource: LiveSourceSource = sanitizeLiveSourceSource({
    pointId: normalizedKey,
    folderUrl: payload.folderUrl,
    folderTitle: payload.folderTitle,
    description: payload.description ?? existing?.description,
    updatedBy: payload.updatedBy ?? 'Coordinator',
    lastVerified: nowIso,
    createdAt: existing?.createdAt ?? nowIso,
    syncedPhotos: payload.syncedPhotos ?? existing?.syncedPhotos,
  });

  // 1. Optimistically update local cache and storage
  const registry = inMemoryRegistry ?? (await fetchLiveSourceSources());
  registry[normalizedKey] = updatedSource;
  inMemoryRegistry = registry;
  saveToStorage(registry);
  notifyChange(normalizedKey, updatedSource);

  const isBackground = Boolean(options?.isBackground);
  let cloudSynced: boolean | undefined = undefined;
  let cloudError: string | undefined = undefined;

  // 2. Persist to Supabase if configured
  const config = getSupabaseConfig();
  if (config) {
    try {
      const authToken = token || config.anonKey;
      const dbRow: Record<string, unknown> = {
        point_id: updatedSource.pointId,
        folder_url: updatedSource.folderUrl,
        folder_title: updatedSource.folderTitle,
        description: updatedSource.description ?? null,
        updated_by: updatedSource.updatedBy,
        last_verified: updatedSource.lastVerified,
        created_at: updatedSource.createdAt,
      };

      if (updatedSource.syncedPhotos !== undefined) {
        dbRow.synced_photos = updatedSource.syncedPhotos;
      }

      const response = await fetch(`${config.url}/rest/v1/engine_sources`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(dbRow),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown cloud error');
        console.warn(`[sourceService] Supabase write failed (HTTP ${response.status}):`, errorText);
        cloudSynced = false;
        cloudError = `HTTP ${response.status}: ${errorText}`;
        notifySyncStatus(normalizedKey, false, cloudError, isBackground);
      } else {
        cloudSynced = true;
        notifySyncStatus(normalizedKey, true, undefined, isBackground);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network failure';
      console.warn('[sourceService] Supabase network error during source upsert:', msg);
      cloudSynced = false;
      cloudError = msg;
      notifySyncStatus(normalizedKey, false, msg, isBackground);
    }
  }

  if (cloudSynced !== undefined) {
    updatedSource.cloudSynced = cloudSynced;
  }
  if (cloudError !== undefined) {
    updatedSource.cloudError = cloudError;
  }

  return updatedSource;
}

/**
 * Resets the in-memory cache and localStorage snapshot back to system defaults.
 */
export function resetSourceCache(): void {
  inMemoryRegistry = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(STORAGE_KEY_SOURCE_CACHE);
    } catch {
      // ignore
    }
  }
}
