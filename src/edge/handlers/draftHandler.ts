/**
 * Folio Engine — Edge Draft Workspace Handler (`draft:workspace`)
 * Location: src/edge/handlers/draftHandler.ts
 * Specification: docs/task/7.4-draft-sandbox-and-cloud-sync-ssot.md
 *
 * Authoritative Cloudflare KV handler for /api/draft and /api/draft/init:
 * - Requires Authorization: Bearer <lockToken> verified against lock:coordinator
 * - Supports cold-boot bootstrapping when portal:manifest === null && history:index === null
 * - Fails stop with HTTP 502 if portal:manifest exists but any expected node:* key is missing
 * - Enforces optimistic concurrency (expectedRevision / expectedUpdatedAt) on PUT /api/draft
 */

import {
  PageRegistrySchema,
  type DraftWorkspacePayload,
  type KVNamespace,
  type PageNode,
  type PublicNodePayload,
  type PublicPortalManifestPayload,
} from '../../types/edge';
import type { PublishedSnapshot } from '../../types/history';
import type { NodeCanvasDocument } from '../../types/canvas';
import { createDefaultCanvasDocument, normalizeCanvasDocument } from '../../utils/canvasDefaults';
import { verifyLockToken } from './lockHandler';
import { KV_HISTORY_SNAPSHOT_PREFIX } from './historyHandler';

export const KV_DRAFT_WORKSPACE_KEY = 'draft:workspace';
export const KV_PORTAL_MANIFEST_KEY = 'portal:manifest';
export const KV_HISTORY_INDEX_KEY = 'history:index';

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

function extractCanvasFromNodeRecord(raw: unknown): NodeCanvasDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const candidate =
    obj.canvas && typeof obj.canvas === 'object'
      ? (obj.canvas as Record<string, unknown>)
      : obj;
  if (
    typeof candidate.nodeId === 'string' &&
    typeof candidate.version === 'number' &&
    (Array.isArray(candidate.elements) || Array.isArray(candidate.sections))
  ) {
    return normalizeCanvasDocument(candidate, candidate.nodeId);
  }
  return null;
}

async function readNodeCanvasBaseline(
  kv: KVNamespace,
  snapshotId: string,
  nodeId: string,
  activeSnapshot?: PublishedSnapshot | null
): Promise<NodeCanvasDocument | null> {
  let nodeRecordCanvas: NodeCanvasDocument | null = null;

  try {
    const versioned = await kv.get<PublicNodePayload | NodeCanvasDocument>(
      `node:${snapshotId}:${nodeId}`,
      'json'
    );
    nodeRecordCanvas = extractCanvasFromNodeRecord(versioned);
  } catch {
    nodeRecordCanvas = null;
  }

  if (!nodeRecordCanvas) {
    try {
      const unversioned = await kv.get<PublicNodePayload | NodeCanvasDocument>(
        `node:${nodeId}`,
        'json'
      );
      nodeRecordCanvas = extractCanvasFromNodeRecord(unversioned);
    } catch {
      nodeRecordCanvas = null;
    }
  }

  // Prefer the unstripped authoring AST from history:snapshot:${snapshotId} when available
  // (preserves ChartElement.config.sheetUrl and raw Drive URLs while still requiring node:* presence)
  const snapshotCanvas = extractCanvasFromNodeRecord(activeSnapshot?.canvases?.[nodeId]);
  if (nodeRecordCanvas && snapshotCanvas) {
    return JSON.parse(JSON.stringify(snapshotCanvas)) as NodeCanvasDocument;
  }

  return nodeRecordCanvas;
}

type BaselineBuildResult =
  | { ok: true; workspace: DraftWorkspacePayload }
  | { ok: false; status: number; error: string };

async function buildBaselineDraftWorkspace(
  kv: KVNamespace,
  requestedNodeIds: string[],
  authorSessionId: string
): Promise<BaselineBuildResult> {
  let manifest: PublicPortalManifestPayload | null = null;
  let historyIndex: unknown = null;

  try {
    manifest = await kv.get<PublicPortalManifestPayload>(KV_PORTAL_MANIFEST_KEY, 'json');
    historyIndex = await kv.get<unknown>(KV_HISTORY_INDEX_KEY, 'json');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'KV read failure';
    return { ok: false, status: 502, error: `Failed to read portal baseline from KV: ${msg}` };
  }

  const nowIso = new Date().toISOString();

  if (manifest !== null) {
    let activeSnapshot: PublishedSnapshot | null = null;
    try {
      activeSnapshot = await kv.get<PublishedSnapshot>(
        `${KV_HISTORY_SNAPSHOT_PREFIX}${manifest.activeSnapshotId}`,
        'json'
      );
    } catch {
      activeSnapshot = null;
    }

    const livePages: Record<string, PageNode> =
      manifest.pages && Object.keys(manifest.pages).length > 0
        ? JSON.parse(JSON.stringify(manifest.pages))
        : activeSnapshot?.pages
          ? JSON.parse(JSON.stringify(activeSnapshot.pages))
          : {};
    const pageIds = Object.keys(livePages);

    const manifestNodeIds = Array.isArray(manifest.nodeIds) ? manifest.nodeIds : [];
    const targetNodeIds = Array.from(new Set([...manifestNodeIds, ...requestedNodeIds, ...pageIds]));
    const canvases: Record<string, NodeCanvasDocument> = {};

    for (const nodeId of targetNodeIds) {
      const baseline = await readNodeCanvasBaseline(
        kv,
        manifest.activeSnapshotId,
        nodeId,
        activeSnapshot
      );
      if (!baseline) {
        if (manifestNodeIds.includes(nodeId)) {
          return {
            ok: false,
            status: 502,
            error: `Baseline node "${nodeId}" for snapshot "${manifest.activeSnapshotId}" is missing or unreadable in KV.`,
          };
        }
        canvases[nodeId] = createDefaultCanvasDocument(nodeId);
      } else {
        canvases[nodeId] = baseline;
      }
    }

    const liveOverrides =
      manifest.contentOverrides && Object.keys(manifest.contentOverrides).length > 0
        ? { ...manifest.contentOverrides }
        : activeSnapshot?.contentOverrides
          ? { ...activeSnapshot.contentOverrides }
          : {};

    return {
      ok: true,
      workspace: {
        baseSnapshotId: manifest.activeSnapshotId,
        dirty: false,
        revision: 1,
        updatedAt: nowIso,
        authorSessionId,
        canvases,
        contentOverrides: liveOverrides,
        pages: livePages,
      },
    };
  }

  if (historyIndex === null) {
    const canvases: Record<string, NodeCanvasDocument> = {};
    for (const nodeId of requestedNodeIds) {
      canvases[nodeId] = createDefaultCanvasDocument(nodeId);
    }
    return {
      ok: true,
      workspace: {
        baseSnapshotId: 'uninitialized',
        dirty: true,
        revision: 1,
        updatedAt: nowIso,
        authorSessionId,
        canvases,
        contentOverrides: {},
        pages: {},
      },
    };
  }

  return {
    ok: false,
    status: 502,
    error: 'Corrupted KV state: history:index exists without portal:manifest.',
  };
}

async function handleInitDraft(request: Request, kv: KVNamespace): Promise<Response> {
  let body: { nodeIds?: unknown; authorSessionId?: unknown } = {};
  try {
    const rawText = await request.text();
    if (rawText.trim()) {
      body = JSON.parse(rawText) as { nodeIds?: unknown; authorSessionId?: unknown };
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  if (body.nodeIds !== undefined && !Array.isArray(body.nodeIds)) {
    return jsonResponse({ error: 'nodeIds must be an array of strings.' }, 400);
  }

  const requestedNodeIds = Array.isArray(body.nodeIds)
    ? body.nodeIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  const authorSessionId =
    typeof body.authorSessionId === 'string' && body.authorSessionId.trim()
      ? body.authorSessionId.trim()
      : 'coordinator';

  const built = await buildBaselineDraftWorkspace(kv, requestedNodeIds, authorSessionId);
  if (!built.ok) {
    return jsonResponse({ error: built.error }, built.status);
  }

  try {
    await kv.put(KV_DRAFT_WORKSPACE_KEY, JSON.stringify(built.workspace));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'KV write failure';
    return jsonResponse({ error: `Failed to persist draft:workspace in KV: ${msg}` }, 502);
  }

  return jsonResponse(built.workspace, 200);
}

async function handleGetDraft(kv: KVNamespace): Promise<Response> {
  try {
    const draft = await kv.get<DraftWorkspacePayload>(KV_DRAFT_WORKSPACE_KEY, 'json');
    if (!draft) {
      return jsonResponse({ error: 'No active draft workspace found in KV.' }, 404);
    }
    return jsonResponse(draft, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'KV read failure';
    return jsonResponse({ error: `Failed to read draft:workspace from KV: ${msg}` }, 502);
  }
}

async function handlePutDraft(request: Request, kv: KVNamespace): Promise<Response> {
  let body: {
    expectedUpdatedAt?: unknown;
    expectedRevision?: unknown;
    canvases?: unknown;
    contentOverrides?: unknown;
    pages?: unknown;
    deletedPageIds?: unknown;
    baseSnapshotId?: unknown;
    dirty?: unknown;
    authorSessionId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  let validatedPages: Record<string, PageNode> | undefined;
  if (body.pages !== undefined) {
    const parsed = PageRegistrySchema.safeParse(body.pages);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return jsonResponse({ error: `Invalid pages payload: ${issueMsg}` }, 400);
    }
    validatedPages = parsed.data;
  }

  let validatedDeletedPageIds: string[] = [];
  if (body.deletedPageIds !== undefined) {
    if (
      !Array.isArray(body.deletedPageIds) ||
      body.deletedPageIds.some((id) => typeof id !== 'string' || id.trim().length === 0)
    ) {
      return jsonResponse(
        { error: 'deletedPageIds must be an array of non-empty strings.' },
        400
      );
    }
    validatedDeletedPageIds = body.deletedPageIds;
  }

  let existing: DraftWorkspacePayload | null = null;
  try {
    existing = await kv.get<DraftWorkspacePayload>(KV_DRAFT_WORKSPACE_KEY, 'json');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'KV read failure';
    return jsonResponse({ error: `Failed to read draft:workspace from KV: ${msg}` }, 502);
  }

  if (!existing) {
    return jsonResponse({ error: 'No active draft workspace found in KV. Initialize draft first.' }, 404);
  }

  const updatedAtMismatch =
    typeof body.expectedUpdatedAt === 'string' && body.expectedUpdatedAt !== existing.updatedAt;
  const revisionMismatch =
    typeof body.expectedRevision === 'number' && body.expectedRevision !== existing.revision;

  if (updatedAtMismatch || revisionMismatch) {
    return jsonResponse(
      {
        error: 'Draft workspace was modified concurrently',
        latestWorkspace: existing,
      },
      409
    );
  }

  const mergedCanvases: Record<string, NodeCanvasDocument> =
    body.canvases && typeof body.canvases === 'object' && !Array.isArray(body.canvases)
      ? { ...existing.canvases, ...(body.canvases as Record<string, NodeCanvasDocument>) }
      : { ...existing.canvases };

  const nextOverrides: Record<string, string> =
    body.contentOverrides && typeof body.contentOverrides === 'object' && !Array.isArray(body.contentOverrides)
      ? { ...(body.contentOverrides as Record<string, string>) }
      : existing.contentOverrides;

  const nextPages: Record<string, PageNode> =
    validatedPages !== undefined ? { ...validatedPages } : { ...(existing.pages || {}) };

  for (const delId of validatedDeletedPageIds) {
    delete mergedCanvases[delId];
    delete nextPages[delId];
  }

  const updated: DraftWorkspacePayload = {
    baseSnapshotId: typeof body.baseSnapshotId === 'string' ? body.baseSnapshotId : existing.baseSnapshotId,
    dirty: typeof body.dirty === 'boolean' ? body.dirty : true,
    revision: (existing.revision || 0) + 1,
    updatedAt: new Date().toISOString(),
    authorSessionId:
      typeof body.authorSessionId === 'string' && body.authorSessionId.trim()
        ? body.authorSessionId.trim()
        : existing.authorSessionId,
    canvases: mergedCanvases,
    contentOverrides: nextOverrides,
    pages: nextPages,
  };

  try {
    await kv.put(KV_DRAFT_WORKSPACE_KEY, JSON.stringify(updated));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'KV write failure';
    return jsonResponse({ error: `Failed to update draft:workspace in KV: ${msg}` }, 502);
  }

  return jsonResponse(updated, 200);
}

async function handleDeleteDraft(request: Request, kv: KVNamespace): Promise<Response> {
  let body: { nodeIds?: unknown; authorSessionId?: unknown } = {};
  try {
    const rawText = await request.text();
    if (rawText.trim()) {
      body = JSON.parse(rawText) as { nodeIds?: unknown; authorSessionId?: unknown };
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  let existing: DraftWorkspacePayload | null = null;
  try {
    existing = await kv.get<DraftWorkspacePayload>(KV_DRAFT_WORKSPACE_KEY, 'json');
  } catch {
    // Non-fatal when discarding
  }

  const requestedNodeIds = Array.isArray(body.nodeIds)
    ? body.nodeIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : Object.keys(existing?.canvases || {});
  const authorSessionId =
    typeof body.authorSessionId === 'string' && body.authorSessionId.trim()
      ? body.authorSessionId.trim()
      : existing?.authorSessionId || 'coordinator';

  const built = await buildBaselineDraftWorkspace(kv, requestedNodeIds, authorSessionId);
  if (!built.ok) {
    return jsonResponse({ error: built.error }, built.status);
  }

  try {
    await kv.put(KV_DRAFT_WORKSPACE_KEY, JSON.stringify(built.workspace));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'KV write failure';
    return jsonResponse({ error: `Failed to reset draft:workspace in KV: ${msg}` }, 502);
  }

  return jsonResponse(built.workspace, 200);
}

/**
 * Handles GET, POST /init, PUT, and DELETE /api/draft requests.
 */
export async function handleDraftRoute(
  request: Request,
  _env: any,
  kv: KVNamespace | null
): Promise<Response> {
  if (!kv) {
    return jsonResponse({ error: 'KV storage is not configured on the edge.' }, 503);
  }

  const auth = await verifyLockToken(request, kv);
  if (!auth.valid) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  if (pathname === '/api/draft/init') {
    if (method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }
    return handleInitDraft(request, kv);
  }

  if (pathname === '/api/draft') {
    if (method === 'GET') return handleGetDraft(kv);
    if (method === 'PUT') return handlePutDraft(request, kv);
    if (method === 'DELETE') return handleDeleteDraft(request, kv);
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  return jsonResponse({ error: 'Endpoint not found', path: pathname }, 404);
}
