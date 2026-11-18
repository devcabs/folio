/**
 * Folio Engine — Live Cloudflare KV Draft Workspace Service (`draft:workspace`)
 * Location: src/services/draftService.ts
 * Specification: docs/task/7.4-draft-sandbox-and-cloud-sync-ssot.md
 *
 * Epic 7 Subtask 7.4:
 * - Zero module-level inMemoryDraft* shadow stores.
 * - Zero browser storage (localStorage / sessionStorage / indexedDB) reads or writes.
 * - Zero Supabase engine_drafts calls.
 * - Direct fail-stop HTTP calls to /api/draft and /api/draft/init authenticated with Bearer <lockToken>.
 */

import { dispatchAggregateCanvasChange } from './canvasLayoutService';
import { getActiveNodeIds } from '../config/engine.config';
import type { NodeCanvasDocument } from '../types/canvas';
import type { DraftWorkspacePayload } from '../types/edge';
import type {
  CloudDraftSyncStatus,
  DraftSyncStatusEventDetail,
} from '../types/draft';
import { EVENT_DRAFT_CONTENT_CHANGE } from '../utils/contentDb';

export const EVENT_DRAFT_STATUS_CHANGE = 'engine-draft-status-change';
export const EVENT_CLOUD_DRAFT_SYNC_STATUS = 'engine-cloud-draft-sync-status';

function resolveActiveNodeIds(): string[] {
  return getActiveNodeIds();
}

let currentSyncStatus: CloudDraftSyncStatus = 'saved';

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
 * Emits global CustomEvent to notify components of draft workspace updates.
 */
export function dispatchDraftChange(isActive = true, isDirty = false): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;

  window.dispatchEvent(
    new CustomEvent(EVENT_DRAFT_STATUS_CHANGE, {
      detail: {
        isActive,
        isDirty,
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
  if (typeof window === 'undefined') return () => { };

  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ isActive?: boolean; isDirty?: boolean }>).detail;
    callback({
      isActive: Boolean(detail?.isActive),
      isDirty: Boolean(detail?.isDirty),
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
  if (typeof window === 'undefined') return () => { };
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<DraftSyncStatusEventDetail>).detail;
    callback(detail);
  };
  window.addEventListener(EVENT_CLOUD_DRAFT_SYNC_STATUS, handler);
  return () => window.removeEventListener(EVENT_CLOUD_DRAFT_SYNC_STATUS, handler);
}

/**
 * Initializes or resumes the live Cloudflare KV draft workspace via POST /api/draft/init.
 * Fails stop (throws) on non-2xx HTTP status or network error.
 */
export async function initDraftSession(
  nodeIds: string[] = resolveActiveNodeIds(),
  lockToken?: string | null
): Promise<DraftWorkspacePayload> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable to initialize draft:workspace.');
  }

  notifySyncStatus('saving');
  try {
    const res = await fetch('/api/draft/init', {
      method: 'POST',
      headers: buildAuthHeaders(lockToken, true),
      body: JSON.stringify({ nodeIds }),
    });

    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new Error(`Draft workspace initialization failed: ${detail} (HTTP ${res.status})`);
    }

    const workspace = (await res.json()) as DraftWorkspacePayload;
    notifySyncStatus('saved');
    dispatchDraftChange(true, Boolean(workspace.dirty));
    dispatchAggregateCanvasChange(true);
    return workspace;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Draft initialization failed';
    notifySyncStatus('error', msg);
    throw err instanceof Error ? err : new Error(msg);
  }
}

/**
 * Reads the live Cloudflare KV draft workspace via GET /api/draft.
 * Fails stop (throws) on non-2xx HTTP status or network error.
 */
export async function getDraftWorkspace(
  lockToken?: string | null
): Promise<DraftWorkspacePayload> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable to read draft:workspace.');
  }

  const res = await fetch('/api/draft', {
    method: 'GET',
    headers: buildAuthHeaders(lockToken, false),
  });

  if (!res.ok) {
    const detail = await parseErrorDetail(res);
    throw new Error(`Draft workspace KV read failed: ${detail} (HTTP ${res.status})`);
  }

  return (await res.json()) as DraftWorkspacePayload;
}

/**
 * Persists updates to Cloudflare KV draft:workspace via PUT /api/draft.
 * Enforces optimistic concurrency (expectedRevision / expectedUpdatedAt) and fails stop on error.
 */
export async function saveDraftWorkspace(
  workspace: Partial<DraftWorkspacePayload>,
  lockToken?: string | null,
  expectedRevision?: number,
  expectedUpdatedAt?: string
): Promise<DraftWorkspacePayload> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable to save draft:workspace.');
  }

  notifySyncStatus('saving');
  try {
    const body: Record<string, unknown> = { ...workspace };
    if (expectedRevision !== undefined) {
      body.expectedRevision = expectedRevision;
    }
    if (expectedUpdatedAt !== undefined) {
      body.expectedUpdatedAt = expectedUpdatedAt;
    }

    const res = await fetch('/api/draft', {
      method: 'PUT',
      headers: buildAuthHeaders(lockToken, true),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new Error(`Draft workspace KV write failed: ${detail} (HTTP ${res.status})`);
    }

    const updated = (await res.json()) as DraftWorkspacePayload;
    notifySyncStatus('saved');
    dispatchDraftChange(true, Boolean(updated.dirty));
    return updated;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Draft workspace save failed';
    notifySyncStatus('error', msg);
    throw err instanceof Error ? err : new Error(msg);
  }
}

/**
 * Persists a single node canvas AST into Cloudflare KV draft:workspace via PUT /api/draft.
 * Fails stop (throws) on non-2xx HTTP status or network error.
 */
export async function saveDraftNodeCanvas(
  nodeId: string,
  canvas: NodeCanvasDocument,
  lockToken?: string | null,
  expectedRevision?: number,
  expectedUpdatedAt?: string
): Promise<DraftWorkspacePayload> {
  return saveDraftWorkspace(
    { canvases: { [nodeId]: canvas } },
    lockToken,
    expectedRevision,
    expectedUpdatedAt
  );
}

/**
 * Discards uncommitted draft changes in Cloudflare KV via DELETE /api/draft
 * and re-clones from the live published baseline.
 * Fails stop (throws) on non-2xx HTTP status or network error.
 */
export async function discardDraftWorkspace(
  nodeIds: string[] = resolveActiveNodeIds(),
  lockToken?: string | null
): Promise<DraftWorkspacePayload> {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable to discard draft:workspace.');
  }

  notifySyncStatus('saving');
  try {
    const res = await fetch('/api/draft', {
      method: 'DELETE',
      headers: buildAuthHeaders(lockToken, true),
      body: JSON.stringify({ nodeIds }),
    });

    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new Error(`Draft workspace discard failed: ${detail} (HTTP ${res.status})`);
    }

    const fresh = (await res.json()) as DraftWorkspacePayload;
    notifySyncStatus('saved');
    dispatchDraftChange(true, Boolean(fresh.dirty));
    dispatchAggregateCanvasChange(true);
    return fresh;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Draft workspace discard failed';
    notifySyncStatus('error', msg);
    throw err instanceof Error ? err : new Error(msg);
  }
}

export const discardDraftSession = discardDraftWorkspace;
