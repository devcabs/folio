/**
 * Folio Engine - Revision History & Atomic Publish Service (Cloudflare KV SSOT)
 * Location: src/services/historyService.ts
 * Specification: docs/task/7.5-revision-history-and-publish-pipeline-ssot.md
 *
 * Epic 7 Subtask 7.5:
 * - Pure Cloudflare KV SSOT — zero browser storage, zero module caches, zero legacy cloud DB.
 * - Direct fail-stop HTTP calls to /api/history, /api/history/restore, and /api/publish.
 */

import type {
  UnifiedPortalSnapshot,
  PublishedSnapshot,
  PublishSnapshotResult,
  HistoryIndexEntry,
} from '../types/history';
import type { NodeCanvasDocument, SubsectionElement } from '../types/canvas';
import type { DraftWorkspacePayload } from '../types/edge';
import {
  dispatchAggregateCanvasChange,
  type NodeId,
} from './canvasLayoutService';
import { getActiveNodeIds } from '../config/engine.config';
import { getSessionId } from './devLockService';
import { dispatchDraftChange, getDraftWorkspace } from './draftService';

export { type NodeId, getActiveNodeIds };
export { initDraftSession, discardDraftSession } from './draftService';

export const EVENT_HISTORY_CHANGE = 'engine-history-change';
export const HISTORY_SCHEMA_VERSION = 1;

/**
 * Computes scannable metrics summary strictly against the Canvas AST hierarchy.
 */
export function computeMetricsSummary(
  canvases: Record<string, NodeCanvasDocument>,
  _legacyContentOverrides?: Record<string, string>
): UnifiedPortalSnapshot['summary'] {
  let totalSections = 0;
  let totalSubsections = 0;
  let totalLeafElements = 0;
  let totalTextElements = 0;
  let totalPhotoElements = 0;
  let totalChartElements = 0;
  let totalPdfElements = 0;
  let totalDocumentElements = 0;

  for (const nodeId of Object.keys(canvases || {})) {
    const doc = canvases[nodeId];
    if (!doc || !Array.isArray(doc.sections)) continue;

    totalSections += doc.sections.length;

    for (const sec of doc.sections) {
      if (!Array.isArray(sec.elements)) continue;

      for (const el of sec.elements) {
        if (el.type === 'subsection') {
          totalSubsections += 1;
          const sub = el as SubsectionElement;
          if (Array.isArray(sub.elements)) {
            totalLeafElements += sub.elements.length;
            for (const leaf of sub.elements) {
              if (leaf.type === 'text') totalTextElements += 1;
              else if (leaf.type === 'photo') totalPhotoElements += 1;
              else if (leaf.type === 'chart') totalChartElements += 1;
              else if (leaf.type === 'pdf') totalPdfElements += 1;
              else if (leaf.type === 'documents') totalDocumentElements += 1;
            }
          }
        } else {
          totalLeafElements += 1;
          if (el.type === 'text') totalTextElements += 1;
          else if (el.type === 'photo') totalPhotoElements += 1;
          else if (el.type === 'chart') totalChartElements += 1;
          else if (el.type === 'pdf') totalPdfElements += 1;
          else if (el.type === 'documents') totalDocumentElements += 1;
        }
      }
    }
  }

  return {
    totalSections,
    totalSubsections,
    totalLeafElements,
    totalTextOverrides: 0,
    totalTextElements,
    totalPhotoElements,
    totalChartElements,
    totalPdfElements,
    totalDocumentElements,
  };
}

function dispatchHistoryChange(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(EVENT_HISTORY_CHANGE));
  }
}

export function subscribeToHistoryChange(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => { };
  const handler = () => callback();
  window.addEventListener(EVENT_HISTORY_CHANGE, handler);
  return () => window.removeEventListener(EVENT_HISTORY_CHANGE, handler);
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

function buildAuthHeaders(lockToken?: string | null, includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (lockToken) {
    headers['Authorization'] = `Bearer ${lockToken}`;
  }
  return headers;
}

/**
 * Fetches revision history from Cloudflare KV via GET /api/history.
 * Fails stop (throws) on HTTP or network error.
 */
export async function fetchPublishedHistoryFromCloud(): Promise<PublishedSnapshot[]> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable to read revision history.');
  }

  const res = await fetch('/api/history', { method: 'GET' });
  if (!res.ok) {
    const detail = await parseErrorDetail(res);
    throw new Error(`Failed to load revision history: ${detail} (HTTP ${res.status})`);
  }

  const data = (await res.json()) as {
    activeSnapshotId?: string | null;
    entries?: HistoryIndexEntry[];
    snapshots?: PublishedSnapshot[];
  };

  if (Array.isArray(data.snapshots)) {
    return data.snapshots.map((snap) => ({
      ...snap,
      isActive: snap.id === data.activeSnapshotId || Boolean(snap.isActive),
    }));
  }

  if (Array.isArray(data.entries)) {
    return data.entries.map((entry) => ({
      id: entry.id,
      schemaVersion: entry.schemaVersion,
      title: entry.title,
      description: entry.description,
      createdAt: entry.createdAt,
      authorSessionId: entry.authorSessionId,
      isActive: entry.id === data.activeSnapshotId,
      canvases: {},
      contentOverrides: {},
      summary: entry.summary,
    }));
  }

  return [];
}

/**
 * Restores a historical snapshot (or 'snap-system-baseline') directly into
 * Cloudflare KV draft:workspace via POST /api/history/restore.
 * Fails stop (throws) on HTTP or network error.
 */
export async function restoreSnapshotToDraft(
  snapshotOrId: string | PublishedSnapshot | UnifiedPortalSnapshot,
  nodeIds: string[] = getActiveNodeIds(),
  lockToken?: string | null
): Promise<DraftWorkspacePayload> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable to restore snapshot.');
  }

  const snapshotId = typeof snapshotOrId === 'string' ? snapshotOrId : snapshotOrId.id;

  const res = await fetch('/api/history/restore', {
    method: 'POST',
    headers: buildAuthHeaders(lockToken, true),
    body: JSON.stringify({ snapshotId, nodeIds }),
  });

  if (!res.ok) {
    const detail = await parseErrorDetail(res);
    throw new Error(`Failed to restore snapshot to draft: ${detail} (HTTP ${res.status})`);
  }

  const restored = (await res.json()) as DraftWorkspacePayload;
  dispatchAggregateCanvasChange(true);
  dispatchDraftChange(true, Boolean(restored.dirty));
  dispatchHistoryChange();
  return restored;
}

/**
 * Bundles the live Cloudflare KV draft:workspace and publishes it atomically
 * via POST /api/publish.
 */
export async function publishNewSnapshot(
  description: string,
  title = 'Published Revision',
  sessionId?: string,
  options?: { forcePublish?: boolean; lockToken?: string | null } | boolean
): Promise<PublishSnapshotResult> {
  const cleanDesc = description ? description.trim() : '';

  if (cleanDesc.length < 4) {
    return {
      success: false,
      snapshot: null as unknown as PublishedSnapshot,
      edgeDeployed: false,
      error: 'Changelog description must be at least 4 characters long.',
    };
  }

  const lockToken = typeof options === 'object' && options !== null ? options.lockToken : undefined;
  const resolvedSession = sessionId || getSessionId();

  let canvases: Record<string, NodeCanvasDocument> = {};
  let contentOverrides: Record<string, string> = {};

  try {
    const draftWorkspace = await getDraftWorkspace(lockToken);
    canvases = draftWorkspace.canvases || {};
    contentOverrides = draftWorkspace.contentOverrides || {};
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unable to read draft workspace from KV';
    return {
      success: false,
      snapshot: null as unknown as PublishedSnapshot,
      edgeDeployed: false,
      error: msg,
    };
  }

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

  let publishData: { success?: boolean; edgeDeployed?: boolean; edgeError?: string; error?: string } | null = null;

  try {
    const endpoint =
      typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/api/publish`
        : '/api/publish';

    const publishRes = await fetch(endpoint, {
      method: 'POST',
      headers: buildAuthHeaders(lockToken, true),
      body: JSON.stringify({ snapshot }),
    });

    if (!publishRes.ok) {
      const detail = await parseErrorDetail(publishRes);
      return {
        success: false,
        snapshot: null as unknown as PublishedSnapshot,
        edgeDeployed: false,
        error: detail,
      };
    }

    publishData = await publishRes.json();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error during publish';
    return {
      success: false,
      snapshot: null as unknown as PublishedSnapshot,
      edgeDeployed: false,
      error: `Unable to reach publish server: ${msg}`,
    };
  }

  if (!publishData || publishData.success !== true) {
    return {
      success: false,
      snapshot: null as unknown as PublishedSnapshot,
      edgeDeployed: false,
      error: publishData?.error || 'Server did not confirm publication',
    };
  }

  dispatchAggregateCanvasChange(false);
  dispatchDraftChange(true, false);
  dispatchHistoryChange();

  return {
    success: true,
    snapshot,
    edgeDeployed: publishData.edgeDeployed === true,
    edgeError: publishData.edgeError,
    error: publishData.edgeError,
  };
}
