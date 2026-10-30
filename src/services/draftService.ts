/**
 * Folio Engine - Draft Isolation & Cloud DB-Draft Service
 * Location: src/services/draftService.ts
 * Specification: docs/tasks/task11_2g_db_draft_and_blob_storage_pipeline.md
 * Aligned with: docs/00_WORKFLOW.md, docs/03_ARCHITECTURE.md, docs/07_CODING_STANDARDS.md
 *
 * Implements:
 * 1. Zero-localStorage in-memory draft sandbox for 60 FPS editing.
 * 2. Active draft lifecycle & dirty change tracking (hasUnpublishedChanges).
 * 3. Cloud-backed draft synchronization with Supabase engine_drafts table.
 * 4. 1500ms debounced auto-sync with status events (saved, saving, error, offline).
 * 5. Safe draft discard and multi-device continuation.
 */

import {
  getLiveNodeCanvas,
  NODE_IDS,
} from './canvasLayoutService';
import type { NodeCanvasDocument } from '../types/canvas';
import type {
  CloudDraftData,
  CloudDraftSyncStatus,
  DraftSyncStatusEventDetail,
} from '../types/draft';
import {
  invalidateContentCache,
  getAllContentOverrides,
  setAllContentOverrides,
  EVENT_DRAFT_CONTENT_CHANGE,
} from '../utils/contentDb';
import { getSessionUnlockTime, isSessionValid } from '../utils/devSecurity';
import { getStorage } from '../utils/storage';
import { getActivePublishedId } from './historyService';
import { getSupabaseConfig, isTableAvailable, markTableMissing } from '../utils/supabase-config';

export const DRAFT_CANVAS_PREFIX = 'masid_draft_canvas_';
export const DRAFT_CONTENT_KEY = 'masid_draft_content_overrides';
export const DRAFT_ACTIVE_KEY = 'masid_draft_active';
export const DRAFT_DIRTY_KEY = 'masid_draft_dirty';
export const EVENT_DRAFT_STATUS_CHANGE = 'engine-draft-status-change';
export const EVENT_CLOUD_DRAFT_SYNC_STATUS = 'engine-cloud-draft-sync-status';
export const AUTOSYNC_DEBOUNCE_MS = 1500;

export interface DraftActiveMetadata {
  baseId: string | null;
  startedAt?: string;
}

export interface DraftStalenessCheck {
  isStale: boolean;
  baseId: string | null;
  currentActiveId: string;
}

// In-memory draft sandbox state
let inMemoryDraftActive = false;
let inMemoryDraftDirty = false;
let inMemoryDraftBaseId: string | null = null;
const inMemoryDraftCanvases: Record<string, NodeCanvasDocument> = {};

let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let currentSyncStatus: CloudDraftSyncStatus = 'saved';

/**
 * Returns the legacy draft canvas storage key for a specific node.
 */
export function getDraftCanvasKey(nodeId: string): string {
  return `${DRAFT_CANVAS_PREFIX}${nodeId}`;
}

/**
 * Retrieves in-memory draft canvas for a node.
 */
export function getInMemoryDraftCanvas(nodeId: string): NodeCanvasDocument | null {
  const doc = inMemoryDraftCanvases[nodeId];
  return doc ? JSON.parse(JSON.stringify(doc)) : null;
}

/**
 * Sets in-memory draft canvas for a node.
 */
export function setInMemoryDraftCanvas(nodeId: string, doc: NodeCanvasDocument): void {
  inMemoryDraftCanvases[nodeId] = JSON.parse(JSON.stringify(doc));
}

/**
 * Whether Developer Mode draft sandbox is currently active.
 */
export function isDraftModeActive(): boolean {
  if (inMemoryDraftActive) return true;
  const storage = getStorage();
  if (!storage) return false;
  try {
    const raw = storage.getItem(DRAFT_ACTIVE_KEY);
    if (!raw) return false;
    if (raw === 'true') return true;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Retrieves the base snapshot ID that the current draft was cloned from.
 */
export function getDraftBaseId(): string | null {
  if (inMemoryDraftBaseId) return inMemoryDraftBaseId;
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(DRAFT_ACTIVE_KEY);
    if (!raw) return null;
    if (raw === 'true') return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'baseId' in parsed) {
      return (parsed as DraftActiveMetadata).baseId || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks whether the current draft is stale compared to the live active published snapshot.
 */
export function checkDraftStaleness(): DraftStalenessCheck {
  const currentActiveId = getActivePublishedId();
  const baseId = getDraftBaseId();
  const isStale = Boolean(baseId && baseId !== currentActiveId);
  return { isStale, baseId, currentActiveId };
}

/**
 * Boolean convenience helper to check if draft is stale.
 */
export function isDraftStale(): boolean {
  return checkDraftStaleness().isStale;
}

/**
 * Activates or deactivates the draft sandbox mode.
 */
export function setDraftModeActive(active: boolean, baseId?: string | null): void {
  inMemoryDraftActive = active;
  if (!active) {
    inMemoryDraftBaseId = null;
  } else if (baseId !== undefined) {
    inMemoryDraftBaseId = baseId;
  }

  const storage = getStorage();
  if (storage) {
    try {
      if (active) {
        const resolvedBaseId = baseId !== undefined ? baseId : getDraftBaseId();
        const payload: DraftActiveMetadata = {
          baseId: resolvedBaseId,
          startedAt: new Date().toISOString(),
        };
        storage.setItem(DRAFT_ACTIVE_KEY, JSON.stringify(payload));
      } else {
        storage.removeItem(DRAFT_ACTIVE_KEY);
      }
    } catch {
      // Storage restricted
    }
  }
  dispatchDraftChange();
}

/**
 * Checks whether the current draft has uncommitted changes.
 */
export function isDraftDirty(): boolean {
  if (inMemoryDraftDirty) return true;
  const storage = getStorage();
  if (!storage) return false;
  try {
    return storage.getItem(DRAFT_DIRTY_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Sets the draft dirty flag and dispatches draft change event.
 */
export function setDraftDirty(dirty: boolean): void {
  inMemoryDraftDirty = dirty;
  const storage = getStorage();
  if (storage) {
    try {
      if (dirty) {
        storage.setItem(DRAFT_DIRTY_KEY, 'true');
      } else {
        storage.removeItem(DRAFT_DIRTY_KEY);
      }
    } catch {
      // Storage restricted
    }
  }
  dispatchDraftChange();
}

/**
 * Emits global CustomEvent to notify all components of draft sandbox mutations.
 */
export function dispatchDraftChange(): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;

  window.dispatchEvent(
    new CustomEvent(EVENT_DRAFT_STATUS_CHANGE, {
      detail: {
        isActive: isDraftModeActive(),
        isDirty: isDraftDirty(),
        timestamp: new Date().toISOString(),
      },
    })
  );

  window.dispatchEvent(
    new CustomEvent(EVENT_DRAFT_CONTENT_CHANGE, {
      detail: {
        channel: 'draft',
        timestamp: Date.now(),
        key: '*',
        value: null,
      },
    })
  );
}

/**
 * Subscribes to changes in draft mode status and dirty flag.
 */
export function subscribeToDraftStatus(
  callback: (status: { isActive: boolean; isDirty: boolean }) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    callback({
      isActive: isDraftModeActive(),
      isDirty: isDraftDirty(),
    });
  };

  window.addEventListener(EVENT_DRAFT_STATUS_CHANGE, handler);
  return () => window.removeEventListener(EVENT_DRAFT_STATUS_CHANGE, handler);
}

/**
 * Returns current cloud draft sync status.
 */
export function getCloudDraftSyncStatus(): CloudDraftSyncStatus {
  return currentSyncStatus;
}

/**
 * Subscribes to cloud draft sync status events.
 */
export function subscribeToCloudDraftSync(
  callback: (detail: DraftSyncStatusEventDetail) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<DraftSyncStatusEventDetail>).detail;
    callback(detail);
  };
  window.addEventListener(EVENT_CLOUD_DRAFT_SYNC_STATUS, handler);
  return () => window.removeEventListener(EVENT_CLOUD_DRAFT_SYNC_STATUS, handler);
}

function notifySyncStatus(status: CloudDraftSyncStatus, error?: string): void {
  currentSyncStatus = status;
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    const detail: DraftSyncStatusEventDetail = {
      status,
      lastSavedAt: status === 'saved' ? new Date().toISOString() : undefined,
      error,
    };
    window.dispatchEvent(new CustomEvent(EVENT_CLOUD_DRAFT_SYNC_STATUS, { detail }));
  }
}

/**
 * Clears all in-memory draft canvas documents, flags, and any lingering storage keys.
 */
export function clearDraftStorage(): void {
  inMemoryDraftActive = false;
  inMemoryDraftDirty = false;
  inMemoryDraftBaseId = null;
  for (const node of NODE_IDS) {
    delete inMemoryDraftCanvases[node];
  }

  const storage = getStorage();
  if (storage) {
    try {
      for (const node of NODE_IDS) {
        storage.removeItem(getDraftCanvasKey(node));
      }
      storage.removeItem(DRAFT_CONTENT_KEY);
      storage.removeItem(DRAFT_ACTIVE_KEY);
      storage.removeItem(DRAFT_DIRTY_KEY);
    } catch {
      // Ignore
    }
  }
  dispatchDraftChange();
}

/**
 * Checks whether any draft data currently exists in memory or persistent storage.
 */
export function hasDraftKeys(): boolean {
  if (Object.keys(inMemoryDraftCanvases).length > 0) return true;
  const storage = getStorage();
  if (!storage) return false;
  try {
    return storage.getItem(DRAFT_ACTIVE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Queries active draft from Supabase engine_drafts table.
 */
export async function fetchActiveCloudDraft(): Promise<CloudDraftData | null> {
  const config = getSupabaseConfig();
  if (!config || !isTableAvailable('engine_drafts')) return null;

  try {
    const res = await fetch(`${config.url}/rest/v1/engine_drafts?id=eq.active_draft&select=*`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
    });

    if (res.status === 404) {
      markTableMissing('engine_drafts');
      return null;
    }

    if (!res.ok) return null;

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      baseSnapshotId: row.base_snapshot_id,
      canvases: row.canvases || {},
      contentOverrides: row.content_overrides || {},
      updatedAt: row.updated_at,
      updatedBySession: row.updated_by_session,
      lockedBySession: row.locked_by_session,
    };
  } catch (err) {
    console.warn('[draftService] Fetch active cloud draft failed:', err);
    return null;
  }
}

function isValidCanvasDocument(data: unknown, nodeId: string): data is NodeCanvasDocument {
  if (typeof data !== 'object' || data === null) return false;
  const doc = data as Record<string, unknown>;
  return (
    doc.nodeId === nodeId &&
    typeof doc.version === 'number' &&
    Array.isArray(doc.sections)
  );
}

/**
 * Syncs the current in-memory draft state to Supabase engine_drafts.
 */
export async function syncDraftToCloud(): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config || !isTableAvailable('engine_drafts')) {
    notifySyncStatus('offline');
    return false;
  }

  notifySyncStatus('saving');

  try {
    const baseSnapshotId = getDraftBaseId() || getActivePublishedId();
    const payload = {
      id: 'active_draft',
      base_snapshot_id: baseSnapshotId,
      canvases: inMemoryDraftCanvases,
      content_overrides: getAllContentOverrides(true),
      updated_at: new Date().toISOString(),
      updated_by_session: getSessionUnlockTime()?.toString() || 'unknown',
    };

    const res = await fetch(`${config.url}/rest/v1/engine_drafts`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 404) {
      markTableMissing('engine_drafts');
      notifySyncStatus('offline');
      return false;
    }

    if (!res.ok) {
      throw new Error(`Cloud draft sync failed (${res.status})`);
    }

    notifySyncStatus('saved');
    return true;
  } catch (err: unknown) {
    console.warn('[draftService] Cloud draft sync error:', err);
    notifySyncStatus('error', err instanceof Error ? err.message : 'Sync failed');
    return false;
  }
}

/**
 * Triggers debounced background auto-sync to Supabase engine_drafts.
 */
export function triggerDebouncedCloudDraftSync(): void {
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
  }
  notifySyncStatus('saving');
  autoSyncTimer = setTimeout(() => {
    syncDraftToCloud().catch(() => {});
  }, AUTOSYNC_DEBOUNCE_MS);
}

/**
 * Initializes a Developer Mode draft editing sandbox.
 * Populates in-memory draft state from Supabase engine_drafts or live published baseline.
 * Zero writes of canvas documents to localStorage.
 */
export async function initDraftSession(forceFresh: boolean = false): Promise<void> {
  const unlockTime = getSessionUnlockTime();
  const sessionActive = isSessionValid(unlockTime);
  const draftExists = hasDraftKeys();

  // If not forced fresh and session or draft active: retain existing in-memory draft
  if (!forceFresh && (sessionActive || isDraftModeActive()) && draftExists && Object.keys(inMemoryDraftCanvases).length > 0) {
    setDraftModeActive(true);
    return;
  }

  const activePublishedId = getActivePublishedId();

  // 1. Check for cloud draft in Supabase engine_drafts
  if (!forceFresh) {
    try {
      const cloudDraft = await fetchActiveCloudDraft();
      if (cloudDraft && Object.keys(cloudDraft.canvases).length > 0) {
        let loadedValidCanvases = false;
        for (const [nodeId, doc] of Object.entries(cloudDraft.canvases)) {
          if (isValidCanvasDocument(doc, nodeId)) {
            inMemoryDraftCanvases[nodeId] = doc;
            loadedValidCanvases = true;
          }
        }
        if (loadedValidCanvases) {
          if (cloudDraft.contentOverrides && Object.keys(cloudDraft.contentOverrides).length > 0) {
            setAllContentOverrides(cloudDraft.contentOverrides, true);
          }
          const resolvedBaseId = cloudDraft.baseSnapshotId || activePublishedId;
          setDraftModeActive(true, resolvedBaseId);
          dispatchDraftChange();
          invalidateContentCache();
          return;
        }
      }
    } catch {
      // Ignore network errors, fall through to local clone
    }

    // 1b. Check local persistent storage fallback if available
    const storage = getStorage();
    if (storage) {
      try {
        let hasSavedDraftInStorage = false;
        for (const nodeId of NODE_IDS) {
          const raw = storage.getItem(getDraftCanvasKey(nodeId));
          if (raw) {
            const parsed = JSON.parse(raw);
            if (isValidCanvasDocument(parsed, nodeId)) {
              inMemoryDraftCanvases[nodeId] = parsed;
              hasSavedDraftInStorage = true;
            }
          }
        }
        if (hasSavedDraftInStorage) {
          setDraftModeActive(true, getDraftBaseId() || activePublishedId);
          dispatchDraftChange();
          invalidateContentCache();
          return;
        }
      } catch {
        // Fall through to live clone
      }
    }
  }

  // 2. Clone active published baseline into in-memory draft store
  for (const nodeId of NODE_IDS) {
    const liveDoc = getLiveNodeCanvas(nodeId);
    inMemoryDraftCanvases[nodeId] = JSON.parse(JSON.stringify(liveDoc));
  }

  setDraftModeActive(true, activePublishedId);
  setDraftDirty(false);
  dispatchDraftChange();
  invalidateContentCache();
}

/**
 * Discards all uncommitted draft changes and reverts the workspace to the active live published state.
 */
export async function discardDraftSession(): Promise<void> {
  clearDraftStorage();

  const config = getSupabaseConfig();
  if (config && isTableAvailable('engine_drafts')) {
    try {
      await fetch(`${config.url}/rest/v1/engine_drafts?id=eq.active_draft`, {
        method: 'DELETE',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
      });
    } catch (err) {
      console.warn('[draftService] Discard cloud draft failed:', err);
    }
  }

  dispatchDraftChange();
  invalidateContentCache();
}

/**
 * Synchronizes draft storage to mirror the newly published live baseline.
 * Resets the draft dirty state to clean (hasUnpublishedChanges = false).
 */
export function syncDraftWithPublished(
  canvases: Record<string, NodeCanvasDocument>,
  _contentOverrides?: Record<string, string>,
  newBaseId?: string
): void {
  const baseId = newBaseId || getActivePublishedId();
  for (const nodeId of NODE_IDS) {
    if (canvases[nodeId]) {
      inMemoryDraftCanvases[nodeId] = JSON.parse(JSON.stringify(canvases[nodeId]));
    }
  }
  inMemoryDraftBaseId = baseId;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(
        DRAFT_ACTIVE_KEY,
        JSON.stringify({ baseId, startedAt: new Date().toISOString() })
      );
      storage.removeItem(DRAFT_DIRTY_KEY);
    } catch {
      // Storage limits
    }
  }

  setDraftDirty(false);
  invalidateContentCache();
}
