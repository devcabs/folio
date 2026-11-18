/**
 * Folio Engine — Edge Revision History Handler (`history:index`, `history:snapshot:*`)
 * Location: src/edge/handlers/historyHandler.ts
 * Specification: docs/task/7.5-revision-history-and-publish-pipeline-ssot.md
 *
 * Authoritative Cloudflare KV handler for:
 * - GET  /api/history
 * - GET  /api/history/:snapshotId
 * - POST /api/history/restore
 */

import type { DraftWorkspacePayload, KVNamespace } from '../../types/edge';
import { VALID_NODES } from '../../types/edge';
import type { HistoryIndex, PublishedSnapshot } from '../../types/history';
import type { NodeCanvasDocument } from '../../types/canvas';
import { createDefaultCanvasDocument } from '../../utils/canvasDefaults';
import { verifyLockToken } from './lockHandler';
import { KV_DRAFT_WORKSPACE_KEY, KV_HISTORY_INDEX_KEY } from './draftHandler';

export const KV_HISTORY_SNAPSHOT_PREFIX = 'history:snapshot:';
export const SYSTEM_BASELINE_SNAPSHOT_ID = 'snap-system-baseline';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Handles GET /api/history, GET /api/history/:snapshotId, and POST /api/history/restore.
 */
export async function handleHistoryRoute(
  request: Request,
  _env: unknown,
  kv: KVNamespace | null
): Promise<Response> {
  if (!kv) {
    return jsonResponse({ error: 'KV storage is not configured on the edge.' }, 503);
  }

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  // GET /api/history
  if (pathname === '/api/history') {
    if (method !== 'GET') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    try {
      const index = await kv.get<HistoryIndex>(KV_HISTORY_INDEX_KEY, 'json');
      if (!index) {
        return jsonResponse({ activeSnapshotId: null, updatedAt: null, entries: [], snapshots: [] }, 200);
      }

      const entries = Array.isArray(index.entries) ? index.entries : [];
      const snapshots: PublishedSnapshot[] = [];

      for (const entry of entries) {
        const snap = await kv.get<PublishedSnapshot>(`${KV_HISTORY_SNAPSHOT_PREFIX}${entry.id}`, 'json');
        if (snap) {
          snapshots.push({
            ...snap,
            isActive: snap.id === index.activeSnapshotId,
          });
        } else {
          snapshots.push({
            id: entry.id,
            schemaVersion: entry.schemaVersion,
            title: entry.title,
            description: entry.description,
            createdAt: entry.createdAt,
            authorSessionId: entry.authorSessionId,
            isActive: entry.id === index.activeSnapshotId,
            canvases: {},
            contentOverrides: {},
            summary: entry.summary,
          });
        }
      }

      return jsonResponse(
        {
          activeSnapshotId: index.activeSnapshotId ?? null,
          updatedAt: index.updatedAt ?? null,
          entries,
          snapshots,
        },
        200
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'KV read failure';
      return jsonResponse({ error: `Failed to read revision history from KV: ${msg}` }, 502);
    }
  }

  // POST /api/history/restore
  if (pathname === '/api/history/restore') {
    if (method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    const auth = await verifyLockToken(request, kv);
    if (!auth.valid) {
      return jsonResponse({ error: auth.error }, auth.status);
    }

    let body: { snapshotId?: string; nodeIds?: string[]; authorSessionId?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonResponse({ error: 'Invalid JSON request payload' }, 400);
    }

    const snapshotId = typeof body.snapshotId === 'string' ? body.snapshotId.trim() : '';
    if (!snapshotId) {
      return jsonResponse({ error: 'snapshotId is required' }, 400);
    }

    try {
      const existingDraft = await kv.get<DraftWorkspacePayload>(KV_DRAFT_WORKSPACE_KEY, 'json');
      const historyIndex = await kv.get<HistoryIndex>(KV_HISTORY_INDEX_KEY, 'json');
      const nextRevision = (existingDraft?.revision ?? 0) + 1;
      const nowIso = new Date().toISOString();
      const authorSessionId =
        body.authorSessionId || existingDraft?.authorSessionId || 'coordinator';

      let restoredWorkspace: DraftWorkspacePayload;

      if (snapshotId === SYSTEM_BASELINE_SNAPSHOT_ID) {
        const targetNodeIds =
          Array.isArray(body.nodeIds) && body.nodeIds.length > 0
            ? body.nodeIds
            : existingDraft?.canvases && Object.keys(existingDraft.canvases).length > 0
              ? Object.keys(existingDraft.canvases)
              : [...VALID_NODES];

        const canvases: Record<string, NodeCanvasDocument> = {};
        for (const nodeId of targetNodeIds) {
          canvases[nodeId] = createDefaultCanvasDocument(nodeId);
        }

        restoredWorkspace = {
          baseSnapshotId: historyIndex?.activeSnapshotId || 'uninitialized',
          dirty: true,
          revision: nextRevision,
          updatedAt: nowIso,
          authorSessionId,
          canvases,
          contentOverrides: {},
        };
      } else {
        const snapshot = await kv.get<PublishedSnapshot>(
          `${KV_HISTORY_SNAPSHOT_PREFIX}${snapshotId}`,
          'json'
        );
        if (!snapshot) {
          return jsonResponse({ error: `Snapshot "${snapshotId}" not found in KV.` }, 404);
        }

        const clonedCanvases: Record<string, NodeCanvasDocument> = JSON.parse(
          JSON.stringify(snapshot.canvases || {})
        );
        const clonedOverrides: Record<string, string> = {
          ...(snapshot.contentOverrides || {}),
        };

        restoredWorkspace = {
          baseSnapshotId: existingDraft?.baseSnapshotId || historyIndex?.activeSnapshotId || snapshot.id,
          dirty: true,
          revision: nextRevision,
          updatedAt: nowIso,
          authorSessionId,
          canvases: clonedCanvases,
          contentOverrides: clonedOverrides,
        };
      }

      await kv.put(KV_DRAFT_WORKSPACE_KEY, JSON.stringify(restoredWorkspace));
      return jsonResponse(restoredWorkspace, 200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'KV write failure';
      return jsonResponse({ error: `Failed to restore snapshot to draft: ${msg}` }, 502);
    }
  }

  // GET /api/history/:snapshotId
  if (pathname.startsWith('/api/history/')) {
    if (method !== 'GET') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    const snapshotId = decodeURIComponent(pathname.slice('/api/history/'.length)).trim();
    if (!snapshotId) {
      return jsonResponse({ error: 'Snapshot ID is required' }, 400);
    }

    try {
      const snapshot = await kv.get<PublishedSnapshot>(
        `${KV_HISTORY_SNAPSHOT_PREFIX}${snapshotId}`,
        'json'
      );
      if (!snapshot) {
        return jsonResponse({ error: `Snapshot "${snapshotId}" not found` }, 404);
      }
      return jsonResponse(snapshot, 200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'KV read failure';
      return jsonResponse({ error: `Failed to read snapshot from KV: ${msg}` }, 502);
    }
  }

  return jsonResponse({ error: 'Endpoint not found', path: pathname }, 404);
}
