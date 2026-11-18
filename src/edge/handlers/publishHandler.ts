/**
 * Folio Engine — Edge Publish Handler (Two-Phase Versioned Cloudflare KV SSOT)
 * Location: src/edge/handlers/publishHandler.ts
 * Specification: docs/task/7.5-revision-history-and-publish-pipeline-ssot.md
 *
 * Implements split-brain-safe two-phase publishing exclusively in Cloudflare KV:
 * - Phase A: Stage immutable history:snapshot:${id}, node:${id}:${nodeId}, and node:${nodeId}
 * - Phase B: Flip portal:manifest, history:index, and reset draft:workspace (dirty: false)
 */

import type { HistoryIndex, HistoryIndexEntry, PublishedSnapshot } from '../../types/history';
import type { DraftWorkspacePayload, KVNamespace } from '../../types/edge';
import {
  compilePublicNodePayload,
  compilePortalManifest,
} from '../../services/edgePreBakeService';
import { verifyLockToken } from './lockHandler';
import { KV_DRAFT_WORKSPACE_KEY, KV_HISTORY_INDEX_KEY, KV_PORTAL_MANIFEST_KEY } from './draftHandler';
import { KV_HISTORY_SNAPSHOT_PREFIX } from './historyHandler';

export interface PublishRequestBody {
  snapshot: PublishedSnapshot;
}

export interface PublishResponseBody {
  success: boolean;
  snapshotId?: string;
  publishedAt?: string;
  edgeDeployed?: boolean;
  edgeError?: string;
  error?: string;
}

function jsonResponse(body: PublishResponseBody, status: number): Response {
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
 * Handles POST /api/publish
 */
export async function handlePublishRoute(
  request: Request,
  _env: unknown,
  kv: KVNamespace | null,
  _ctx?: unknown
): Promise<Response> {
  try {
    if (!kv) {
      return jsonResponse(
        {
          success: false,
          error: 'KV namespace binding not configured on edge runtime',
        },
        503
      );
    }

    // Verify coordinator lock token
    const auth = await verifyLockToken(request, kv);
    if (!auth.valid) {
      return jsonResponse(
        {
          success: false,
          error: auth.error || 'Unauthorized: Invalid coordinator lock token',
        },
        auth.status
      );
    }

    let body: PublishRequestBody;
    try {
      body = (await request.json()) as PublishRequestBody;
    } catch {
      return jsonResponse(
        {
          success: false,
          error: 'Invalid JSON request payload',
        },
        400
      );
    }

    const { snapshot } = body || {};

    // Validate snapshot contract
    if (
      !snapshot ||
      typeof snapshot !== 'object' ||
      !snapshot.id ||
      typeof snapshot.id !== 'string' ||
      !snapshot.canvases ||
      typeof snapshot.canvases !== 'object'
    ) {
      return jsonResponse(
        {
          success: false,
          error: 'Malformed snapshot payload: id and canvases are required',
        },
        400
      );
    }

    if (!snapshot.authorSessionId) {
      return jsonResponse(
        {
          success: false,
          error: 'Unauthorized: Missing author session ID',
        },
        401
      );
    }

    try {
      const targetNodes = Object.keys(snapshot.canvases);

      // ───────────────────────────────────────────────────────────────────────
      // Phase A: Stage Immutable Payloads First
      // ───────────────────────────────────────────────────────────────────────
      // 1. Write full self-contained snapshot (preserves ChartElement.config.sheetUrl for rollbacks)
      await kv.put(`${KV_HISTORY_SNAPSHOT_PREFIX}${snapshot.id}`, JSON.stringify(snapshot));

      // 2. Compile & stage versioned immutable node payloads + active node keys
      for (const nodeId of targetNodes) {
        const compiled = compilePublicNodePayload(nodeId, snapshot);
        const serialized = JSON.stringify(compiled);
        await kv.put(`node:${snapshot.id}:${nodeId}`, serialized);
        await kv.put(`node:${nodeId}`, serialized);
      }

      // ───────────────────────────────────────────────────────────────────────
      // Phase B: Flip Active Pointers Last (Zero Split-Brain Guarantee)
      // ───────────────────────────────────────────────────────────────────────
      const nowIso = new Date().toISOString();

      // 3. Flip portal:manifest
      const manifestPayload = compilePortalManifest(snapshot, targetNodes);
      await kv.put(KV_PORTAL_MANIFEST_KEY, JSON.stringify(manifestPayload));

      // 4. Update history:index
      const existingIndex = await kv.get<HistoryIndex>(KV_HISTORY_INDEX_KEY, 'json');
      const entry: HistoryIndexEntry = {
        id: snapshot.id,
        schemaVersion: snapshot.schemaVersion || 1,
        title: snapshot.title,
        description: snapshot.description,
        createdAt: snapshot.createdAt,
        authorSessionId: snapshot.authorSessionId,
        summary: snapshot.summary,
      };
      const prevEntries = Array.isArray(existingIndex?.entries)
        ? existingIndex.entries.filter((e) => e.id !== snapshot.id)
        : [];
      const nextIndex: HistoryIndex = {
        activeSnapshotId: snapshot.id,
        updatedAt: nowIso,
        entries: [entry, ...prevEntries],
      };
      await kv.put(KV_HISTORY_INDEX_KEY, JSON.stringify(nextIndex));

      // 5. Reset draft:workspace to clean state anchored at this published snapshot
      const existingDraft = await kv.get<DraftWorkspacePayload>(KV_DRAFT_WORKSPACE_KEY, 'json');
      const nextDraft: DraftWorkspacePayload = {
        baseSnapshotId: snapshot.id,
        dirty: false,
        revision: (existingDraft?.revision ?? 0) + 1,
        updatedAt: nowIso,
        authorSessionId: snapshot.authorSessionId,
        canvases: JSON.parse(JSON.stringify(snapshot.canvases)),
        contentOverrides: { ...(snapshot.contentOverrides || {}) },
      };
      await kv.put(KV_DRAFT_WORKSPACE_KEY, JSON.stringify(nextDraft));

      return jsonResponse(
        {
          success: true,
          snapshotId: snapshot.id,
          publishedAt: snapshot.createdAt,
          edgeDeployed: true,
        },
        200
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Edge KV deployment error';
      return jsonResponse(
        {
          success: false,
          edgeDeployed: false,
          edgeError: msg,
          error: `Cloudflare KV deployment failed: ${msg}`,
        },
        502
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown publish failure';
    return jsonResponse(
      {
        success: false,
        error: msg,
      },
      500
    );
  }
}
