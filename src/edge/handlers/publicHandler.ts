/**
 * Folio Engine — Edge Public Handlers (Node, Manifest)
 * Location: src/edge/handlers/publicHandler.ts
 */

import type { KVNamespace } from '../../types/edge';
import { computeWeakEtag } from '../../types/edge';

export const CACHE_CONTROL_MANIFEST = 'public, max-age=0, must-revalidate';
export const CACHE_CONTROL_NODE = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300';
export const CACHE_CONTROL_FALLBACK = 'public, max-age=0, must-revalidate';
export const CACHE_CONTROL_EDGE = CACHE_CONTROL_NODE;

const NODE_ID_REGEX = /^[a-z0-9_-]{1,64}$/;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
} as const;

export interface ResponseOptions {
  status?: number;
  etag?: string;
  source?: 'KV';
  cacheControl?: string;
  headers?: Record<string, string>;
}

/**
 * Creates a standard JSON Response with caching, ETag, and edge source headers.
 */
export function createEdgeJsonResponse(
  payloadString: string,
  options: ResponseOptions = {}
): Response {
  const status = options.status ?? 200;
  const etag = options.etag ?? computeWeakEtag(payloadString);
  const cacheControl =
    options.cacheControl ??
    (options.source === 'KV' ? CACHE_CONTROL_NODE : CACHE_CONTROL_FALLBACK);
  const source = options.source ?? 'KV';

  return new Response(payloadString, {
    status,
    headers: {
      ...JSON_HEADERS,
      'Cache-Control': cacheControl,
      'ETag': etag,
      'X-Engine-Edge-Source': source,
      'Vary': 'Accept-Encoding',
      ...(options.headers || {}),
    },
  });
}

/**
 * Evaluates conditional GET (If-None-Match) against the computed ETag.
 * Returns 304 Response if matching, or null if request must continue.
 */
export function checkConditionalGet(
  request: Request,
  etag: string,
  cacheControl: string = CACHE_CONTROL_FALLBACK
): Response | null {
  const clientEtag = request.headers.get('if-none-match');
  if (clientEtag && clientEtag === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': cacheControl,
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
  return null;
}

/**
 * Handles GET /api/public/node/:nodeId (and legacy node route alias)
 */
export async function handlePublicNodeRoute(
  request: Request,
  nodeIdParam: string,
  kv: KVNamespace | null,
  _ctx?: unknown
): Promise<Response> {
  const nodeId = nodeIdParam.trim().toLowerCase();

  if (!nodeId || !NODE_ID_REGEX.test(nodeId)) {
    return new Response(JSON.stringify({ error: 'Invalid node ID' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  if (!kv) {
    return new Response(
      JSON.stringify({ error: 'KV namespace binding not configured' }),
      { status: 503, headers: JSON_HEADERS }
    );
  }

  try {
    let activeSnapshotId: string | null = null;
    const manifestRaw = await kv.get('portal:manifest');
    if (manifestRaw) {
      try {
        const parsedManifest = JSON.parse(manifestRaw) as { activeSnapshotId?: unknown };
        if (
          typeof parsedManifest?.activeSnapshotId === 'string' &&
          parsedManifest.activeSnapshotId
        ) {
          activeSnapshotId = parsedManifest.activeSnapshotId;
        }
      } catch {
        // Ignore malformed manifest
      }
    }

    let cachedJson: string | null = null;
    if (activeSnapshotId) {
      cachedJson = await kv.get(`node:${activeSnapshotId}:${nodeId}`);
      if (!cachedJson) {
        const unversioned = await kv.get(`node:${nodeId}`);
        if (unversioned) {
          try {
            const parsedNode = JSON.parse(unversioned) as { snapshotId?: unknown };
            if (parsedNode?.snapshotId === activeSnapshotId) {
              cachedJson = unversioned;
            }
          } catch {
            // Ignore malformed unversioned node
          }
        }
      }
    } else {
      cachedJson = await kv.get(`node:${nodeId}`);
    }

    if (!cachedJson) {
      return new Response(
        JSON.stringify({ error: 'Resource not found in Edge KV' }),
        { status: 404, headers: JSON_HEADERS }
      );
    }

    const etag = computeWeakEtag(cachedJson);
    const response304 = checkConditionalGet(request, etag, CACHE_CONTROL_NODE);
    if (response304) return response304;

    return createEdgeJsonResponse(cachedJson, {
      status: 200,
      etag,
      source: 'KV',
      cacheControl: CACHE_CONTROL_NODE,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown node edge error';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}

/**
 * Handles GET /api/public/manifest
 */
export async function handlePublicManifestRoute(
  request: Request,
  kv: KVNamespace | null,
  _ctx?: unknown
): Promise<Response> {
  if (!kv) {
    return new Response(
      JSON.stringify({ error: 'KV namespace binding not configured' }),
      { status: 503, headers: JSON_HEADERS }
    );
  }

  try {
    const cachedJson = await kv.get('portal:manifest');

    if (!cachedJson) {
      return new Response(
        JSON.stringify({ error: 'Resource not found in Edge KV' }),
        { status: 404, headers: JSON_HEADERS }
      );
    }

    const etag = computeWeakEtag(cachedJson);
    const response304 = checkConditionalGet(request, etag, CACHE_CONTROL_MANIFEST);
    if (response304) return response304;

    return createEdgeJsonResponse(cachedJson, {
      status: 200,
      etag,
      source: 'KV',
      cacheControl: CACHE_CONTROL_MANIFEST,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown manifest edge error';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}
