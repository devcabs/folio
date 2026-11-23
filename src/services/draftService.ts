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

import { dispatchAggregateCanvasChange, EVENT_DRAFT_CANVAS_CHANGE } from './canvasLayoutService';
import { getActiveNodeIds } from '../config/engine.config';
import type { NodeCanvasDocument } from '../types/canvas';
import type { DraftWorkspacePayload } from '../types/edge';
import type { PageRegistry } from '../types/page';
import type {
  CloudDraftSyncStatus,
  DraftSyncStatusEventDetail,
} from '../types/draft';
import { EVENT_DRAFT_CONTENT_CHANGE } from '../utils/contentDb';

export const EVENT_DRAFT_STATUS_CHANGE = 'engine-draft-status-change';
export const EVENT_CLOUD_DRAFT_SYNC_STATUS = 'engine-cloud-draft-sync-status';
export const EVENT_DRAFT_UPDATED_AT_SYNC = 'engine-draft-updated-at-sync';
export const EVENT_DRAFT_PAGES_CHANGE = 'engine-draft-pages-change';

let draftMutationChain: Promise<unknown> = Promise.resolve();

/**
 * Serializes PUT /api/draft mutations in FIFO order across Portal Chrome and Canvas
 * surfaces so optimistic concurrency timestamps (expectedUpdatedAt) never race into HTTP 409.
 */
export function enqueueDraftMutation<T>(task: () => Promise<T>): Promise<T> {
  const next = draftMutationChain.then(task, task);
  draftMutationChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

let lastKnownDraftUpdatedAt: string | null = null;

/**
 * Returns the latest authoritative KV draft:workspace `updatedAt` timestamp observed
 * across any Dev Mode surface (init, read, save, discard, or EVENT_DRAFT_UPDATED_AT_SYNC).
 */
export function getLastKnownDraftUpdatedAt(): string | null {
  return lastKnownDraftUpdatedAt;
}

/**
 * Updates the tracked authoritative KV draft:workspace `updatedAt` timestamp.
 */
export function setLastKnownDraftUpdatedAt(updatedAt: string | null): void {
  lastKnownDraftUpdatedAt = updatedAt || null;
}

/**
 * Clears the tracked authoritative KV draft:workspace `updatedAt` timestamp.
 */
export function clearLastKnownDraftUpdatedAt(): void {
  lastKnownDraftUpdatedAt = null;
}

/**
 * Broadcasts the authoritative KV draft:workspace `updatedAt` timestamp so all mounted
 * Dev Mode surfaces (PortalChromeContext, useDocumentCanvas) stay synchronized.
 */
export function dispatchDraftUpdatedAtSync(updatedAt: string): void {
  if (!updatedAt) return;
  lastKnownDraftUpdatedAt = updatedAt;
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(EVENT_DRAFT_UPDATED_AT_SYNC, {
      detail: { updatedAt },
    })
  );
}

/**
 * Broadcasts the authoritative KV draft:workspace `pages` registry so mounted
 * PortalChromeContext surfaces update reactively without an extra GET /api/draft round-trip.
 */
export function dispatchDraftPagesSync(pages: PageRegistry): void {
  if (!pages || typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(EVENT_DRAFT_PAGES_CHANGE, {
      detail: { pages },
    })
  );
}

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
export function dispatchDraftChange(isActive = true, isDirty = false, pages?: PageRegistry): void {
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
        ...(pages ? { pages } : {}),
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
    if (workspace.updatedAt) {
      lastKnownDraftUpdatedAt = workspace.updatedAt;
    }
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

  const workspace = (await res.json()) as DraftWorkspacePayload;
  if (workspace.updatedAt) {
    lastKnownDraftUpdatedAt = workspace.updatedAt;
  }
  return workspace;
}

/**
 * Persists updates to Cloudflare KV draft:workspace via PUT /api/draft.
 * Enforces optimistic concurrency (expectedRevision / expectedUpdatedAt) and fails stop on error.
 */
export async function saveDraftWorkspace(
  workspace: Partial<DraftWorkspacePayload> & { deletedPageIds?: string[] },
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
    if (updated.updatedAt) {
      // Update module-level SSOT synchronously so the next enqueued task reads the correct
      // timestamp immediately — do NOT rely solely on the async CustomEvent listener.
      lastKnownDraftUpdatedAt = updated.updatedAt;
      dispatchDraftUpdatedAtSync(updated.updatedAt);
    }
    if (updated.pages) {
      dispatchDraftPagesSync(updated.pages);
    }
    dispatchDraftChange(true, Boolean(updated.dirty), updated.pages);
    return updated;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Draft workspace save failed';
    notifySyncStatus('error', msg);
    throw err instanceof Error ? err : new Error(msg);
  }
}

/**
 * Serializes an atomic multi-surface workspace mutation (canvases + pages + contentOverrides + deletedPageIds)
 * through `enqueueDraftMutation`, broadcasts canvas & timestamp sync events, and returns the authoritative KV payload.
 *
 * NOTE: `expectedUpdatedAt` is intentionally read lazily from `getLastKnownDraftUpdatedAt()` at execution
 * time (not at enqueue time) so that chained mutations in the FIFO queue always use the authoritative
 * timestamp written by the preceding task — preventing HTTP 409 concurrency conflicts.
 */
export async function commitDraftWorkspaceTransaction(
  payload: {
    canvases?: Record<string, NodeCanvasDocument>;
    pages?: PageRegistry;
    contentOverrides?: Record<string, string>;
    deletedPageIds?: string[];
  },
  options: { lockToken?: string | null; expectedUpdatedAt?: string | null } = {}
): Promise<DraftWorkspacePayload> {
  return enqueueDraftMutation(async () => {
    // Read lazily at execution time so queued tasks always see the latest authoritative timestamp,
    // not the stale snapshot captured at enqueue time by the caller.
    const liveExpectedUpdatedAt = getLastKnownDraftUpdatedAt() ?? options.expectedUpdatedAt ?? undefined;
    const updated = await saveDraftWorkspace(
      payload,
      options.lockToken,
      undefined,
      liveExpectedUpdatedAt
    );

    if (
      payload.canvases &&
      typeof window !== 'undefined' &&
      typeof window.dispatchEvent === 'function'
    ) {
      for (const [nodeId, document] of Object.entries(payload.canvases)) {
        const authoritativeDoc = updated.canvases?.[nodeId] ?? document;
        window.dispatchEvent(
          new CustomEvent(EVENT_DRAFT_CANVAS_CHANGE, {
            detail: { nodeId, document: authoritativeDoc },
          })
        );
      }
    }

    return updated;
  });
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
    if (fresh.updatedAt) {
      dispatchDraftUpdatedAtSync(fresh.updatedAt);
    }
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
