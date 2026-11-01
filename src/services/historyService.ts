/**
 * Folio Engine - Unified History Hub Service
 * Location: src/services/historyService.ts
 * Specification: docs/tasks/task9_3_unified_school_history_hub.md
 * Aligned with: docs/00_WORKFLOW.md, docs/03_ARCHITECTURE.md, docs/07_CODING_STANDARDS.md
 *
 * Implements:
 * 1. Full Snapshot Bundling (all 5 nodes + Content DB overrides).
 * 2. Dual-Tier Timeline (Named Milestones, Rolling Auto-Saves, Safety Backups).
 * 3. 20-Checkpoint Auto-Save Rotation with Inactivity Debouncing.
 * 4. Safe Pre-Restore Safety Checkpoint Guarantee.
 * 5. Full JSON Backup Export & Verified Import.
 */

import type {
  UnifiedPortalSnapshot,
  HistoryManifest,
  SnapshotType,
  PublishedSnapshot,
} from '../types/history';
import type { NodeCanvasDocument, SubsectionElement } from '../types/canvas';
import { createDefaultCanvasDocument } from '../utils/canvasDefaults';
import { saveToIndexedDB, loadFromIndexedDB } from './historyStorage';
import {
  getNodeCanvas,
  saveNodeCanvas,
  saveLiveNodeCanvas,
  renumberSections,
  dispatchAggregateCanvasChange,
  migrateCanvasOverridesIntoAst,
  EVENT_DRAFT_CANVAS_CHANGE,
  NODE_IDS,
  type CanvasChangeEventDetail,
  type NodeId,
} from './canvasLayoutService';
import { getStorage } from '../utils/storage';
import { getEngineConfig, getStorageNamespace } from '../config/engine.config';
import { getSupabaseConfig, isTableAvailable, markTableMissing, markTableAvailable } from '../utils/supabase-config';
export { NODE_IDS, type NodeId };
export function getActiveNodeIds(): string[] {
  const config = getEngineConfig();
  if (config.nodes && config.nodes.length > 0) {
    return config.nodes.map((n) => n.id);
  }
  return [...NODE_IDS];
}
export { getSupabaseConfig, isTableAvailable, markTableMissing, markTableAvailable };
import {
  getAllContentOverrides,
  setAllContentOverrides,
  setLiveContentOverrides,
} from '../utils/contentDb';
import { getSessionId } from './devLockService';
import {
  setDraftModeActive,
  setDraftDirty,
  getDraftCanvasKey,
  syncDraftWithPublished,
  checkDraftStaleness,
  setInMemoryDraftCanvas,
  triggerDebouncedCloudDraftSync,
  type DraftStalenessCheck,
} from './draftService';
import { getSessionUnlockTime, isSessionValid } from '../utils/devSecurity';
import { compileAndDeployToEdgeKV } from './edgePreBakeService';

export interface EngineSyncBroadcastMessage {
  type: 'MASID_PUBLISH_BROADCAST';
  snapshotId: string;
  timestamp: string;
  canvases: Record<string, NodeCanvasDocument>;
  contentOverrides: Record<string, string>;
  activePublishedId: string;
}

export interface HydrationState {
  isHydrating: boolean;
  hasConfirmedData: boolean;
  source: 'cache' | 'cloud' | 'baseline';
  activePublishedId: string | null;
}

export const getBroadcastChannelName = (ns?: string) => (ns || getStorageNamespace()) + '_portal_sync';
export const BROADCAST_CHANNEL_NAME = getBroadcastChannelName();
export const getHistoryManifestKey = (ns?: string) => (ns || getStorageNamespace()) + '_history_manifest';
export const STORAGE_KEY_HISTORY_MANIFEST = getHistoryManifestKey();
export const getLiveActivePublishedIdKey = (ns?: string) => (ns || getStorageNamespace()) + '_live_active_published_id';
export const STORAGE_KEY_LIVE_ACTIVE_PUBLISHED_ID = getLiveActivePublishedIdKey();
export const LEGACY_STORAGE_KEY_ACTIVE_PUBLISHED_ID = getStorageNamespace() + '_active_published_id';
export const STORAGE_KEY_ACTIVE_PUBLISHED_ID = LEGACY_STORAGE_KEY_ACTIVE_PUBLISHED_ID;
export const EVENT_HISTORY_CHANGE = 'engine-history-change';
export const HISTORY_SCHEMA_VERSION = 1;
export const MAX_AUTOSAVES = 20;
export const AUTOSAVE_DEBOUNCE_MS = 60_000;

// Runtime in-memory manifest cache for zero-data-loss session resilience
let inMemoryManifest: HistoryManifest | null = null;
let lastAutoSaveTimestamp = 0;

/**
 * Computes scannable metrics summary across all 5 node canvas trees and Content DB.
 */
export function computeMetricsSummary(
  canvases: Record<string, NodeCanvasDocument>,
  contentOverrides: Record<string, string>
): UnifiedPortalSnapshot['summary'] {
  let totalSections = 0;
  let totalSubsections = 0;
  let totalLeafElements = 0;

  for (const doc of Object.values(canvases)) {
    if (!doc || !Array.isArray(doc.sections)) continue;
    totalSections += doc.sections.length;
    for (const sec of doc.sections) {
      if (!sec || !Array.isArray(sec.elements)) continue;
      for (const el of sec.elements) {
        if (el.type === 'subsection') {
          totalSubsections += 1;
          const sub = el as SubsectionElement;
          if (Array.isArray(sub.elements)) {
            totalLeafElements += sub.elements.length;
          }
        } else {
          totalLeafElements += 1;
        }
      }
    }
  }

  const totalTextOverrides = Object.keys(contentOverrides || {}).length;

  return {
    totalSections,
    totalSubsections,
    totalLeafElements,
    totalTextOverrides,
  };
}

/**
 * Retrieves the currently active published snapshot ID.
 * Reads solely from the canonical key, running a one-time migration from legacy pointers if absent.
 */
export function getActivePublishedId(): string {
  const storage = getStorage();
  if (!storage) return 'snap-system-baseline';

  // 1. Direct read from canonical pointer
  const canonicalId = storage.getItem(getLiveActivePublishedIdKey());
  if (canonicalId) return canonicalId;

  // 2. One-time migration fallback from legacy keys
  const legacyId = storage.getItem(LEGACY_STORAGE_KEY_ACTIVE_PUBLISHED_ID);
  let manifestLegacyId: string | undefined;
  try {
    const rawManifest = storage.getItem(getHistoryManifestKey());
    if (rawManifest) {
      const parsed = JSON.parse(rawManifest);
      manifestLegacyId = parsed?.activePublishedId || parsed?.activeMilestoneId;
    }
  } catch {
    // ignore parse error
  }

  const migratedId = legacyId || manifestLegacyId || 'snap-system-baseline';

  // Persist to canonical key and cleanup legacy key
  try {
    storage.setItem(getLiveActivePublishedIdKey(), migratedId);
    storage.removeItem(LEGACY_STORAGE_KEY_ACTIVE_PUBLISHED_ID);
  } catch {
    // Storage quota or access restriction safety
  }

  return migratedId;
}

/**
 * Sets the active published snapshot ID to the canonical key exclusively.
 */
export function setActivePublishedId(id: string): void {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(getLiveActivePublishedIdKey(), id);
      storage.removeItem(LEGACY_STORAGE_KEY_ACTIVE_PUBLISHED_ID);
    } catch {
      // Storage quota safety
    }
  }
}

/**
 * Generates the canonical system factory baseline snapshot.
 * Serves as the indestructible anchor for the host application.
 */
export function getDefaultSystemBaselineSnapshot(isActive = true): PublishedSnapshot {
  const canvases: Record<string, NodeCanvasDocument> = {};
  for (const nodeId of getActiveNodeIds()) {
    canvases[nodeId] = createDefaultCanvasDocument(nodeId);
  }
  const contentOverrides: Record<string, string> = {};
  const summary = computeMetricsSummary(canvases, contentOverrides);

  return {
    id: 'snap-system-baseline',
    schemaVersion: HISTORY_SCHEMA_VERSION,
    title: 'System Baseline (Default)',
    description: 'Original the host application 6-Year Baseline.',
    createdAt: '2024-01-01T00:00:00.000Z',
    authorSessionId: 'system',
    isActive,
    canvases,
    contentOverrides,
    summary,
  };
}

/**
 * Lightweight snapshot metadata for localStorage manifest (< 50KB).
 * Excludes heavy canvas document ASTs and Content DB dictionaries.
 */
export interface HistorySnapshotMetadata {
  id: string;
  title: string;
  label?: string;
  createdAt: string;
  type: SnapshotType | string;
  notes?: string;
  authorSessionId?: string;
  author?: string;
  summary?: UnifiedPortalSnapshot['summary'];
  metricsSummary?: unknown;
}

export interface LightweightHistoryManifest {
  version: number;
  lastUpdated: string;
  updatedAt?: string;
  snapshots: HistorySnapshotMetadata[]; // No canvases or contentOverrides!
}

/**
 * Hydrates history manifest from persistent IndexedDB store (eliminates localStorage quota wipes).
 */
export async function hydrateHistoryFromIndexedDB(): Promise<HistoryManifest> {
  try {
    const fromIdb = await loadFromIndexedDB<HistoryManifest>(STORAGE_KEY_HISTORY_MANIFEST);
    if (fromIdb && Array.isArray(fromIdb.snapshots) && fromIdb.snapshots.length > 0) {
      inMemoryManifest = fromIdb;
      // Defensive: keep localStorage lightweight only, never write full IDB payload to localStorage
      saveHistoryManifest(fromIdb);
      return fromIdb;
    }
  } catch {
    // fallback to standard manifest
  }
  return getHistoryManifest();
}

/**
 * Retrieves the whole-History manifest from storage.
 */
export function getHistoryManifest(): HistoryManifest {
  const defaultManifest: HistoryManifest = {
    snapshots: [],
    updatedAt: new Date().toISOString(),
  };

  const storage = getStorage();
  if (!storage) return inMemoryManifest || defaultManifest;

  try {
    const raw = storage.getItem(getHistoryManifestKey());
    if (!raw) return inMemoryManifest || defaultManifest;

    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.snapshots)) {
      const result: HistoryManifest = {
        lastRestoredId: parsed.lastRestoredId,
        snapshots: parsed.snapshots,
        updatedAt: parsed.updatedAt || parsed.lastUpdated || new Date().toISOString(),
      };
      inMemoryManifest = inMemoryManifest || result;
      return inMemoryManifest;
    }
  } catch {
    // Graceful fallback on corrupt storage
  }

  return inMemoryManifest || defaultManifest;
}

/**
 * Persists history manifest to storage and notifies subscribers.
 * Offloads heavy canvas and Content DB payloads exclusively to IndexedDB.
 * localStorage receives only lightweight metadata (< 50KB for 20+ snapshots).
 */
export function saveHistoryManifest(manifest: HistoryManifest): void {
  const updated: HistoryManifest = {
    ...manifest,
    updatedAt: manifest.updatedAt || new Date().toISOString(),
  };

  // 1. Authoritative in-memory update
  inMemoryManifest = updated;

  // 2. High-capacity IndexedDB persistent update (persists full payload with zero quota drop)
  saveToIndexedDB(STORAGE_KEY_HISTORY_MANIFEST, updated).catch(() => {});

  // 3. Strip heavy payloads to create lightweight metadata manifest for localStorage
  const storage = getStorage();
  if (storage) {
    const lightweight: LightweightHistoryManifest = {
      version: HISTORY_SCHEMA_VERSION,
      lastUpdated: updated.updatedAt,
      updatedAt: updated.updatedAt,
      snapshots: updated.snapshots.map((s) => ({
        id: s.id,
        title: s.title || (s as unknown as Record<string, string>).label || 'Snapshot',
        label: (s as unknown as Record<string, string>).label || s.title,
        createdAt: s.createdAt,
        type: s.type,
        notes: s.notes,
        authorSessionId: s.authorSessionId || (s as unknown as Record<string, string>).author,
        author: (s as unknown as Record<string, string>).author || s.authorSessionId,
        summary: s.summary,
        metricsSummary: (s as unknown as Record<string, unknown>).metricsSummary || s.summary,
      })),
    };

    try {
      storage.setItem(getHistoryManifestKey(), JSON.stringify(lightweight));
    } catch {
      // If storage quota or restriction hit, prune autosaves from lightweight metadata
      try {
        const pruned: LightweightHistoryManifest = {
          ...lightweight,
          snapshots: lightweight.snapshots.filter((s) => s.type !== 'autosave'),
        };
        storage.setItem(getHistoryManifestKey(), JSON.stringify(pruned));
      } catch {
        // Maintained in-memory
      }
    }
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(EVENT_HISTORY_CHANGE, {
          detail: { manifest: updated },
        })
      );
    } catch {
      // ignore in test or non-browser env
    }
  }
}

/**
 * Subscribes to real-time changes in the history manifest.
 */
export function subscribeToHistoryChange(
  callback: (manifest: HistoryManifest) => void
): () => void {
  if (typeof window === 'undefined') return () => { };

  const handler = (e: Event) => {
    const custom = e as CustomEvent<{ manifest: HistoryManifest }>;
    if (custom?.detail?.manifest) {
      callback(custom.detail.manifest);
    } else {
      callback(getHistoryManifest());
    }
  };

  window.addEventListener(EVENT_HISTORY_CHANGE, handler);
  return () => window.removeEventListener(EVENT_HISTORY_CHANGE, handler);
}

/**
 * Aggregates a complete full snapshot bundle across all 5 nodes and Content DB.
 */
export function captureCurrentSnapshot(
  title: string,
  notes: string = '',
  type: SnapshotType = 'milestone',
  sessionId?: string
): UnifiedPortalSnapshot {
  const canvases: Record<string, NodeCanvasDocument> = {};
  for (const nodeId of getActiveNodeIds()) {
    canvases[nodeId] = getNodeCanvas(nodeId);
  }

  const contentOverrides = getAllContentOverrides();
  const summary = computeMetricsSummary(canvases, contentOverrides);
  const resolvedSession = sessionId || getSessionId();

  const id = `snap-${Date.now()}-${type}-${Math.random().toString(36).substring(2, 7)}`;

  return {
    id,
    schemaVersion: HISTORY_SCHEMA_VERSION,
    type,
    title: title.trim(),
    notes: notes.trim(),
    createdAt: new Date().toISOString(),
    authorSessionId: resolvedSession,
    canvases,
    contentOverrides,
    summary,
  };
}

/**
 * Creates and persists a named full milestone.
 */
export function saveMilestone(
  title: string,
  notes: string = '',
  sessionId?: string
): UnifiedPortalSnapshot {
  const snapshot = captureCurrentSnapshot(title, notes, 'milestone', sessionId);
  const manifest = getHistoryManifest();

  manifest.snapshots = [snapshot, ...manifest.snapshots];

  saveHistoryManifest(manifest);
  return snapshot;
}

/**
 * Prunes auto-saves in a list to keep at most MAX_AUTOSAVES (20), preserving all milestones & safety backups.
 */
export function pruneAutoSaves(snapshots: UnifiedPortalSnapshot[]): UnifiedPortalSnapshot[] {
  let autoSaveCount = 0;
  return snapshots.filter((snap) => {
    if (snap.type !== 'autosave') {
      return true;
    }
    autoSaveCount += 1;
    return autoSaveCount <= MAX_AUTOSAVES;
  });
}

/**
 * Triggers an automated snapshot checkpoint.
 * Debounced to at most once per AUTOSAVE_DEBOUNCE_MS unless forced.
 */
export function triggerAutoSave(
  sessionId?: string,
  force: boolean = false
): UnifiedPortalSnapshot | null {
  const now = Date.now();
  if (!force && now - lastAutoSaveTimestamp < AUTOSAVE_DEBOUNCE_MS) {
    return null;
  }

  lastAutoSaveTimestamp = now;
  const snapshot = captureCurrentSnapshot('Auto-Save Checkpoint', '', 'autosave', sessionId);
  const manifest = getHistoryManifest();

  const nextSnapshots = pruneAutoSaves([snapshot, ...manifest.snapshots]);
  manifest.snapshots = nextSnapshots;

  saveHistoryManifest(manifest);
  return snapshot;
}

/**
 * Restores a historical snapshot across all 5 nodes and Content DB.
 * Automatically takes an immediate safety_backup before applying changes.
 */
export async function restoreUnifiedSnapshot(
  snapshotId: string
): Promise<{ success: boolean; safetySnapshotId?: string; error?: string }> {
  const manifest = getHistoryManifest();
  const target = manifest.snapshots.find((s) => s.id === snapshotId);

  if (!target) {
    return { success: false, error: `Snapshot ${snapshotId} not found` };
  }

  // 1. Mandatory Pre-Restore Safety Checkpoint
  const safetyBackup = captureCurrentSnapshot(
    'Pre-Restore Safety Backup',
    `Automatic safety backup before restoring "${target.title || target.id}"`,
    'safety_backup'
  );

  // 2. Restore all 5 node canvases
  for (const nodeId of getActiveNodeIds()) {
    const canvasDoc = target.canvases[nodeId];
    if (canvasDoc) {
      saveNodeCanvas(canvasDoc);
    }
  }

  // 3. Restore Content DB Text Overrides
  setAllContentOverrides(target.contentOverrides || {});

  // 4. Fold in legacy canvas overrides if any exist in the restored snapshot
  migrateCanvasOverridesIntoAst('live');

  // 5. Update manifest with safety backup and active marker
  manifest.snapshots = [safetyBackup, ...manifest.snapshots];
  setActivePublishedId(target.id);
  saveHistoryManifest(manifest);

  return {
    success: true,
    safetySnapshotId: safetyBackup.id,
  };
}

/**
 * Removes a specific snapshot from the manifest.
 */
export function deleteSnapshot(snapshotId: string): boolean {
  const manifest = getHistoryManifest();
  const initialCount = manifest.snapshots.length;
  manifest.snapshots = manifest.snapshots.filter((s) => s.id !== snapshotId);

  if (manifest.snapshots.length !== initialCount) {
    saveHistoryManifest(manifest);
    return true;
  }
  return false;
}

/**
 * Clears all history checkpoints from the manifest.
 */
export function clearAllHistory(): void {
  inMemoryManifest = {
    snapshots: [],
    updatedAt: new Date().toISOString(),
  };
  saveHistoryManifest(inMemoryManifest);
}

export interface HistoryBackupExport {
  engineBackupVersion: number;
  exportedAt: string;
  tenant: string;
  manifest: HistoryManifest;
  activeState: {
    canvases: Record<string, NodeCanvasDocument>;
    contentOverrides: Record<string, string>;
  };
}

/**
 * Generates a full formatted JSON backup string for download.
 */
export function exportHistoryBackupJson(): string {
  const manifest = getHistoryManifest();
  const currentCanvases: Record<string, NodeCanvasDocument> = {};
  for (const nodeId of getActiveNodeIds()) {
    currentCanvases[nodeId] = getNodeCanvas(nodeId);
  }

  const exportData: HistoryBackupExport = {
    engineBackupVersion: HISTORY_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tenant: 'the host application',
    manifest,
    activeState: {
      canvases: currentCanvases,
      contentOverrides: getAllContentOverrides(),
    },
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Validates and imports a JSON history backup, merging valid snapshots.
 */
export function importHistoryBackupJson(
  jsonString: string
): { success: boolean; importedCount: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);

    let incomingSnapshots: UnifiedPortalSnapshot[] = [];

    if (parsed && Array.isArray(parsed.snapshots)) {
      incomingSnapshots = parsed.snapshots;
    } else if (
      parsed &&
      parsed.manifest &&
      Array.isArray(parsed.manifest.snapshots)
    ) {
      incomingSnapshots = parsed.manifest.snapshots;
    } else {
      return {
        success: false,
        importedCount: 0,
        error: 'Invalid backup structure: missing snapshots array',
      };
    }

    // Validate incoming snapshots
    const validSnapshots: UnifiedPortalSnapshot[] = incomingSnapshots.filter(
      (snap) =>
        snap &&
        typeof snap.id === 'string' &&
        typeof snap.title === 'string' &&
        typeof snap.type === 'string' &&
        snap.canvases &&
        typeof snap.canvases === 'object'
    );

    if (validSnapshots.length === 0) {
      return {
        success: false,
        importedCount: 0,
        error: 'No valid snapshots found in backup file',
      };
    }

    const currentManifest = getHistoryManifest();
    const existingIds = new Set(currentManifest.snapshots.map((s) => s.id));

    let addedCount = 0;
    const newSnapshots: UnifiedPortalSnapshot[] = [];

    for (const snap of validSnapshots) {
      if (!existingIds.has(snap.id)) {
        newSnapshots.push(snap);
        existingIds.add(snap.id);
        addedCount += 1;
      }
    }

    currentManifest.snapshots = pruneAutoSaves([...newSnapshots, ...currentManifest.snapshots]);
    saveHistoryManifest(currentManifest);

    return {
      success: true,
      importedCount: addedCount,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Invalid JSON file';
    return {
      success: false,
      importedCount: 0,
      error: `JSON parse error: ${errorMsg}`,
    };
  }
}

export {
  initDraftSession,
  discardDraftSession,
} from './draftService';

/**
 * Restores a historical snapshot into Developer Mode's draft storage for visual preview before publishing.
 * Does NOT mutate canonical live storage.
 */
export function restoreSnapshotToDraft(
  snapshot: PublishedSnapshot | UnifiedPortalSnapshot
): boolean {
  try {
    setDraftModeActive(true, snapshot.id);

    const nowIso = new Date().toISOString();

    for (const nodeId of getActiveNodeIds()) {
      const baseDoc = snapshot.canvases?.[nodeId] || createDefaultCanvasDocument(nodeId);
      const doc: NodeCanvasDocument = {
        ...JSON.parse(JSON.stringify(baseDoc)),
        nodeId,
        sections: renumberSections(baseDoc.sections || []),
        updatedAt: nowIso,
      };

      // 1. Authoritative In-Memory Draft Sandbox update (Task 11.2.G zero-localStorage draft)
      setInMemoryDraftCanvas(nodeId, doc);

      // 2. Storage fallback if available
      const storage = getStorage();
      if (storage) {
        try {
          storage.setItem(getDraftCanvasKey(nodeId), JSON.stringify(doc));
        } catch {
          // tolerant of storage quota
        }
      }
    }

    setAllContentOverrides(snapshot.contentOverrides || {}, true);

    // Fold in legacy canvas overrides if any exist in the restored snapshot
    migrateCanvasOverridesIntoAst('draft');

    if (typeof window !== 'undefined') {
      for (const nodeId of getActiveNodeIds()) {
        const doc = getNodeCanvas(nodeId, true);
        const detail: CanvasChangeEventDetail = {
          nodeId,
          document: doc,
        };
        window.dispatchEvent(new CustomEvent(EVENT_DRAFT_CANVAS_CHANGE, { detail }));
      }
      dispatchAggregateCanvasChange(true);
    }

    setDraftDirty(true);
    triggerDebouncedCloudDraftSync();
    return true;
  } catch (err) {
    console.warn('[historyService] Failed to restore snapshot to draft:', err);
    return false;
  }
}

export function getLocalFallbackSnapshots(): PublishedSnapshot[] {
  const manifest = getHistoryManifest();
  const activePublishedId = getActivePublishedId();

  const list: PublishedSnapshot[] = manifest.snapshots.map((s) => {
    const rawAny = s as unknown as Record<string, unknown>;
    const desc = typeof rawAny.description === 'string' ? rawAny.description : s.notes || '';
    const isActive = s.id === activePublishedId;

    return {
      id: s.id,
      schemaVersion: s.schemaVersion || 1,
      title: s.title,
      description: desc,
      createdAt: s.createdAt,
      authorSessionId: s.authorSessionId,
      isActive,
      canvases: s.canvases,
      contentOverrides: s.contentOverrides,
      summary: s.summary,
    };
  });

  if (!list.some((s) => s.id === 'snap-system-baseline')) {
    const hasActive = list.some((s) => s.isActive);
    list.push(getDefaultSystemBaselineSnapshot(!hasActive));
  }

  // Guarantee: if no snapshot is active and list is non-empty, mark baseline or first as active
  if (!list.some((s) => s.isActive) && list.length > 0) {
    const baseline = list.find((s) => s.id === 'snap-system-baseline');
    if (baseline) {
      baseline.isActive = true;
    } else {
      list[0].isActive = true;
    }
  }

  return list;
}

/**
 * Fetches the complete timeline of published snapshots from Supabase cloud (with offline fallback).
 */
export async function fetchPublishedHistoryFromCloud(): Promise<PublishedSnapshot[]> {
  const config = getSupabaseConfig();
  if (!config || !isTableAvailable('engine_history')) {
    return getLocalFallbackSnapshots();
  }

  try {
    const res = await fetch(
      `${config.url}/rest/v1/engine_history?order=created_at.desc&select=*`,
      {
        method: 'GET',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (res.status === 404) {
      markTableMissing('engine_history');
      return getLocalFallbackSnapshots();
    }

    if (!res.ok) {
      console.warn(`[historyService] Supabase cloud fetch returned HTTP ${res.status}. Falling back to persistent local storage.`);
      return getLocalFallbackSnapshots();
    }

    const rows = (await res.json()) as Array<{
      id: string;
      schema_version?: number;
      title?: string;
      description?: string;
      created_at?: string;
      author_session_id?: string;
      is_active?: boolean;
      snapshot_data?: {
        canvases?: Record<string, NodeCanvasDocument>;
        contentOverrides?: Record<string, string>;
      };
      summary?: {
        totalSections: number;
        totalSubsections: number;
        totalLeafElements: number;
        totalTextOverrides: number;
      };
    }>;

    if (!Array.isArray(rows) || rows.length === 0) {
      return getLocalFallbackSnapshots();
    }

    const cloudMapped: PublishedSnapshot[] = rows.map((row) => ({
      id: row.id,
      schemaVersion: row.schema_version ?? 1,
      title: row.title || 'Published Version',
      description: row.description || '',
      createdAt: row.created_at || new Date().toISOString(),
      authorSessionId: row.author_session_id || 'unknown',
      isActive: Boolean(row.is_active),
      canvases: row.snapshot_data?.canvases || {},
      contentOverrides: row.snapshot_data?.contentOverrides || {},
      summary: row.summary || {
        totalSections: 0,
        totalSubsections: 0,
        totalLeafElements: 0,
        totalTextOverrides: 0,
      },
    }));

    if (!cloudMapped.some((s) => s.id === 'snap-system-baseline')) {
      const hasActive = cloudMapped.some((s) => s.isActive);
      cloudMapped.push(getDefaultSystemBaselineSnapshot(!hasActive));
    }

    // Keep activePublishedId synced if cloud returned an active version
    const activeFromCloud = cloudMapped.find((s) => s.isActive);
    if (activeFromCloud) {
      setActivePublishedId(activeFromCloud.id);
    }

    return cloudMapped;
  } catch (err) {
    console.warn('[historyService] Cloud fetch error:', err);
    return getLocalFallbackSnapshots();
  }
}

/**
 * Fetches the current active published version from Supabase cloud.
 */
export async function fetchActivePublishedVersionFromCloud(): Promise<PublishedSnapshot | null> {
  const config = getSupabaseConfig();
  if (!config || !isTableAvailable('engine_history')) return null;

  try {
    const res = await fetch(
      `${config.url}/rest/v1/engine_history?is_active=eq.true&order=created_at.desc&limit=1&select=*`,
      {
        method: 'GET',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (res.status === 404) {
      markTableMissing('engine_history');
      return null;
    }

    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      id: string;
      schema_version?: number;
      title?: string;
      description?: string;
      created_at?: string;
      author_session_id?: string;
      is_active?: boolean;
      snapshot_data?: {
        canvases?: Record<string, NodeCanvasDocument>;
        contentOverrides?: Record<string, string>;
      };
      summary?: {
        totalSections: number;
        totalSubsections: number;
        totalLeafElements: number;
        totalTextOverrides: number;
      };
    }>;

    if (!Array.isArray(rows) || rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      schemaVersion: row.schema_version ?? 1,
      title: row.title || 'Published Version',
      description: row.description || '',
      createdAt: row.created_at || new Date().toISOString(),
      authorSessionId: row.author_session_id || 'unknown',
      isActive: Boolean(row.is_active),
      canvases: row.snapshot_data?.canvases || {},
      contentOverrides: row.snapshot_data?.contentOverrides || {},
      summary: row.summary || {
        totalSections: 0,
        totalSubsections: 0,
        totalLeafElements: 0,
        totalTextOverrides: 0,
      },
    };
  } catch (err) {
    console.warn('[historyService] Fetch active version error:', err);
    return null;
  }
}

export interface CanPublishDraftResult {
  canPublish: boolean;
  reason?: 'NOT_DIRTY' | 'DRAFT_STALE';
  staleness?: DraftStalenessCheck;
}

/**
 * Checks whether the current draft can be safely published.
 * Blocks publication if another coordinator has published since draft creation.
 */
export function canPublishDraft(forcePublish: boolean = false): CanPublishDraftResult {
  const staleness = checkDraftStaleness();
  if (staleness.isStale && !forcePublish) {
    return {
      canPublish: false,
      reason: 'DRAFT_STALE',
      staleness,
    };
  }
  return {
    canPublish: true,
    staleness,
  };
}

/**
 * Commits the current draft state, sets it as the active live version, and syncs to Supabase.
 */
export async function publishNewSnapshot(
  description: string,
  title = 'Published Revision',
  sessionId?: string,
  options?: { forcePublish?: boolean } | boolean
): Promise<{
  success: boolean;
  snapshot: PublishedSnapshot;
  cloudSynced: boolean;
  error?: string;
}> {
  const isForce = typeof options === 'boolean' ? options : Boolean(options?.forcePublish);
  const staleness = checkDraftStaleness();
  if (staleness.isStale && !isForce) {
    return {
      success: false,
      snapshot: null as unknown as PublishedSnapshot,
      cloudSynced: false,
      error: `Draft is stale. Active published snapshot is ${staleness.currentActiveId}, but draft was created from ${staleness.baseId || 'baseline'}. Force publish required.`,
    };
  }

  const cleanDesc = description ? description.trim() : '';

  // Step 1: Validation
  if (cleanDesc.length < 4) {
    return {
      success: false,
      snapshot: null as unknown as PublishedSnapshot,
      cloudSynced: false,
      error: 'Changelog description must be at least 4 characters long.',
    };
  }

  const unlockTime = getSessionUnlockTime();
  if (unlockTime !== null && !isSessionValid(unlockTime)) {
    return {
      success: false,
      snapshot: null as unknown as PublishedSnapshot,
      cloudSynced: false,
      error: 'Session expired. Please unlock Developer Mode again.',
    };
  }

  const resolvedSession = sessionId || getSessionId();

  // Step 2: Snapshot Bundling
  const canvases: Record<string, NodeCanvasDocument> = {};
  for (const nodeId of getActiveNodeIds()) {
    canvases[nodeId] = getNodeCanvas(nodeId, true);
  }
  const contentOverrides = getAllContentOverrides(true);
  const summary = computeMetricsSummary(canvases, contentOverrides);

  const id = `pub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanTitle = title.trim() || 'Published Revision';
  const createdAt = new Date().toISOString();

  const snapshot: PublishedSnapshot = {
    id,
    schemaVersion: HISTORY_SCHEMA_VERSION,
    title: cleanTitle,
    description: cleanDesc,
    createdAt,
    authorSessionId: resolvedSession,
    isActive: true,
    canvases,
    contentOverrides,
    summary,
  };

  // Atomically save all 5 canvases to folio_live_canvas_[nodeId] silently
  for (const nodeId of getActiveNodeIds()) {
    saveLiveNodeCanvas(canvases[nodeId], { silent: true });
  }
  // Fire single aggregate canvas change notification
  dispatchAggregateCanvasChange(false);
  // Atomically save content overrides to folio_live_content_overrides
  setLiveContentOverrides(contentOverrides);

  // Append snapshot to local history manifest & IndexedDB ledger
  const manifest = getHistoryManifest();
  const unifiedSnapshot: UnifiedPortalSnapshot = {
    id: snapshot.id,
    schemaVersion: snapshot.schemaVersion,
    type: 'milestone',
    title: snapshot.title,
    notes: snapshot.description,
    createdAt: snapshot.createdAt,
    authorSessionId: snapshot.authorSessionId,
    canvases: snapshot.canvases,
    contentOverrides: snapshot.contentOverrides,
    summary: snapshot.summary,
  };
  manifest.snapshots = [unifiedSnapshot, ...manifest.snapshots];
  manifest.activeMilestoneId = snapshot.id;
  manifest.activePublishedId = snapshot.id;
  setActivePublishedId(snapshot.id);
  saveHistoryManifest(manifest);

  // Step 4: Post-Publish Draft Synchronization
  // Synchronize draft storage to match newly published live state and set dirty = false
  syncDraftWithPublished(canvases, contentOverrides);

  // Step 4b: Cross-Tab Broadcast Synchronization
  broadcastLiveSync({
    type: 'MASID_PUBLISH_BROADCAST',
    snapshotId: snapshot.id,
    timestamp: snapshot.createdAt,
    canvases: snapshot.canvases,
    contentOverrides: snapshot.contentOverrides,
    activePublishedId: snapshot.id,
  });

  // Step 5: Cloud Persistence Bridge (Supabase)
  let cloudSynced = false;
  let cloudError: string | undefined;

  const config = getSupabaseConfig();
  if (config) {
    try {
      // Step A: Insert the new active snapshot FIRST (Zero-Downtime Guarantee)
      const payload = {
        id: snapshot.id,
        schema_version: snapshot.schemaVersion,
        title: snapshot.title,
        description: snapshot.description,
        snapshot_data: {
          canvases: snapshot.canvases,
          contentOverrides: snapshot.contentOverrides,
        },
        summary: snapshot.summary,
        is_active: true,
        author_session_id: snapshot.authorSessionId,
        created_at: snapshot.createdAt,
      };

      const insertRes = await fetch(`${config.url}/rest/v1/engine_history`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      });

      if (insertRes.status === 404) {
        markTableMissing('engine_history');
      }

      if (insertRes.ok) {
        cloudSynced = true;
        markTableAvailable('engine_history');
        // Step B: Now that new active snapshot is safely persisted, demote previous active snapshots
        try {
          await fetch(
            `${config.url}/rest/v1/engine_history?is_active=eq.true&id=neq.${snapshot.id}`,
            {
              method: 'PATCH',
              headers: {
                apikey: config.anonKey,
                Authorization: `Bearer ${config.anonKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({ is_active: false }),
            }
          );
        } catch (patchErr) {
          console.warn('[historyService] Failed to demote previous active snapshots in Supabase:', patchErr);
        }
      } else {
        cloudError = `Cloud sync failed with HTTP ${insertRes.status}`;
      }
    } catch (err: unknown) {
      cloudError = err instanceof Error ? err.message : 'Network error during cloud publish';
    }
  }

  // Step 6: Trigger Edge Pre-Bake & KV Synchronization (Task 15.3, non-blocking)
  try {
    compileAndDeployToEdgeKV(snapshot).catch((edgeErr) => {
      console.warn('[historyService] Non-blocking Edge KV pre-bake warning:', edgeErr);
    });
  } catch (edgeDispatchErr) {
    console.warn('[historyService] Edge KV pre-bake dispatch error:', edgeDispatchErr);
  }

  return {
    success: true,
    snapshot,
    cloudSynced,
    error: cloudError,
  };
}

// ---------------------------------------------------------------------------
// Cross-Tab Broadcast Channel Pipeline
// ---------------------------------------------------------------------------
let syncBroadcastChannel: BroadcastChannel | null = null;

export function getSyncBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!syncBroadcastChannel) {
    try {
      syncBroadcastChannel = new BroadcastChannel(getBroadcastChannelName());
      syncBroadcastChannel.onmessage = (event: MessageEvent<EngineSyncBroadcastMessage>) => {
        handleIncomingSyncBroadcast(event.data);
      };
    } catch (err) {
      console.warn('[historyService] Failed to initialize BroadcastChannel:', err);
      syncBroadcastChannel = null;
    }
  }
  return syncBroadcastChannel;
}

export function closeSyncBroadcastChannel(): void {
  if (syncBroadcastChannel) {
    try {
      syncBroadcastChannel.close();
    } catch {
      // ignore
    }
    syncBroadcastChannel = null;
  }
}

export function broadcastLiveSync(message: EngineSyncBroadcastMessage): void {
  const channel = getSyncBroadcastChannel();
  if (channel) {
    try {
      channel.postMessage(message);
    } catch (err) {
      console.warn('[historyService] Failed to postMessage on sync BroadcastChannel:', err);
    }
  }
}

export function handleIncomingSyncBroadcast(message: EngineSyncBroadcastMessage): void {
  if (!message || message.type !== 'MASID_PUBLISH_BROADCAST') return;

  // Unconditionally update live channel regardless of whether local draft is dirty:
  // Live channel keys (folio_live_*) are strictly isolated from draft channel keys (folio_draft_*)!
  if (message.canvases) {
    for (const nodeId of getActiveNodeIds()) {
      if (message.canvases[nodeId]) {
        saveLiveNodeCanvas(message.canvases[nodeId], { silent: true });
      }
    }
    dispatchAggregateCanvasChange(false);
  }

  // Atomically update folio_live_content_overrides
  if (message.contentOverrides) {
    setLiveContentOverrides(message.contentOverrides);
  }

  // Update active published ID in local manifest & storage
  if (message.activePublishedId) {
    setActivePublishedId(message.activePublishedId);
  }
}

// Auto-attach in browser environments on boot
if (typeof window !== 'undefined') {
  try {
    getSyncBroadcastChannel();
  } catch {
    // Tolerant in restricted environments
  }
}

// ---------------------------------------------------------------------------
// Hydration State Machine Pipeline
// ---------------------------------------------------------------------------
let isHydratingActive = false;
let isHydrationComplete = false;
const hydrationListeners = new Set<(isHydrating: boolean) => void>();

/**
 * @deprecated Task 11.2.E: Artificial loading gates eliminated.
 * Baseline documents render immediately on frame 1 with 0 skeleton pop-in.
 */
export function isInitialHydrationPending(): boolean {
  return false;
}

export function isCloudHydrating(): boolean {
  return isHydratingActive;
}

export function subscribeToHydration(callback: (isHydrating: boolean) => void): () => void {
  hydrationListeners.add(callback);
  return () => {
    hydrationListeners.delete(callback);
  };
}

function notifyHydrationChange(hydrating: boolean): void {
  isHydratingActive = hydrating;
  hydrationListeners.forEach((cb) => {
    try {
      cb(hydrating);
    } catch (e) {
      console.warn('[historyService] Hydration listener error:', e);
    }
  });
}

export function getHydrationState(): HydrationState {
  const storage = getStorage();
  const storedId = storage
    ? storage.getItem(getLiveActivePublishedIdKey()) ||
      storage.getItem(LEGACY_STORAGE_KEY_ACTIVE_PUBLISHED_ID)
    : null;

  return {
    isHydrating: isHydratingActive,
    hasConfirmedData: Boolean(storedId) || isHydrationComplete,
    source: storedId ? 'cache' : (isHydrationComplete ? 'cloud' : 'baseline'),
    activePublishedId: storedId,
  };
}

export function resetHydrationStateForTesting(): void {
  isHydratingActive = false;
  isHydrationComplete = false;
}

let activeHydrationPromise: Promise<boolean> | null = null;

/**
 * Hydrates local canonical storage from the cloud's active published version on startup.
 * Memoizes in-flight promise to prevent duplicate concurrent network fetches.
 */
export function hydrateActiveVersionFromCloud(): Promise<boolean> {
  if (activeHydrationPromise) {
    return activeHydrationPromise;
  }

  activeHydrationPromise = (async () => {
    const pending = isInitialHydrationPending();
    if (pending) {
      notifyHydrationChange(true);
    }

    try {
      const activeVersion = await fetchActivePublishedVersionFromCloud();
      if (!activeVersion) {
        isHydrationComplete = true;
        if (pending || isHydratingActive) {
          notifyHydrationChange(false);
        }
        return false;
      }

      setActivePublishedId(activeVersion.id);

      // Unconditionally update live channel storage:
      // Live channel keys (folio_live_*) are strictly isolated from draft keys (folio_draft_*)!
      for (const nodeId of getActiveNodeIds()) {
        if (activeVersion.canvases[nodeId]) {
          saveLiveNodeCanvas(activeVersion.canvases[nodeId], { silent: true });
        }
      }
      dispatchAggregateCanvasChange(false);
      if (activeVersion.contentOverrides) {
        setLiveContentOverrides(activeVersion.contentOverrides);
      }
      migrateCanvasOverridesIntoAst('live');

      isHydrationComplete = true;
      if (pending || isHydratingActive) {
        notifyHydrationChange(false);
      }
      return true;
    } catch (err) {
      console.warn('[historyService] Hydrate active version error:', err);
      isHydrationComplete = true;
      if (pending || isHydratingActive) {
        notifyHydrationChange(false);
      }
      return false;
    } finally {
      activeHydrationPromise = null;
    }
  })();

  return activeHydrationPromise;
}

