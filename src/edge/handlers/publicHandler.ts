/**
 * Folio Engine — Edge Public Handlers (Node, Manifest, Chart)
 * Location: src/edge/handlers/publicHandler.ts
 */

import type {
  PublicNodePayload,
  PublicPortalManifestPayload,
  KVNamespace,
  ValidNodeId,
} from '../../types/edge';
import {
  computeWeakEtag,
  VALID_NODES,
} from '../../types/edge';
import bakedChartsData from '../../data/baked-charts.json';
import type { ChartDataset } from '../../types/chart';

export const CACHE_CONTROL_MANIFEST = 'public, max-age=0, must-revalidate';
export const CACHE_CONTROL_NODE = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300';
export const CACHE_CONTROL_FALLBACK = 'public, max-age=0, must-revalidate';
export const CACHE_CONTROL_EDGE = CACHE_CONTROL_NODE;

export interface ResponseOptions {
  status?: number;
  etag?: string;
  source?: 'KV' | 'SUPABASE_FALLBACK' | 'STATIC_FALLBACK';
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
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      'ETag': etag,
      'X-Engine-Edge-Source': source,
      'Vary': 'Accept-Encoding',
      'Access-Control-Allow-Origin': '*',
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
  _ctx?: any
): Promise<Response> {
  const nodeId = nodeIdParam.toLowerCase();

  // Strict Validation against Canonical 5 Nodes
  if (!nodeId || !VALID_NODES.includes(nodeId as ValidNodeId)) {
    return new Response(
      JSON.stringify({
        error: 'Invalid node ID',
        validNodes: VALID_NODES,
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const kvKey = `node:${nodeId}`;

  try {
    const cachedJson = kv ? await kv.get(kvKey) : null;

    if (cachedJson) {
      const etag = computeWeakEtag(cachedJson);
      const response304 = checkConditionalGet(request, etag, CACHE_CONTROL_NODE);
      if (response304) return response304;

      return createEdgeJsonResponse(cachedJson, {
        status: 200,
        etag,
        source: 'KV',
        cacheControl: CACHE_CONTROL_NODE,
      });
    }

    // Fallback on KV Cold Miss (Self-Healing)
    const fallbackPayload: PublicNodePayload = {
      nodeId,
      snapshotId: 'snapshot-latest',
      version: 1,
      updatedAt: new Date().toISOString(),
      canvas: {
        nodeId,
        version: 1,
        sections: [],
        updatedAt: new Date().toISOString(),
      },
      chartDatasets: {},
      sourceMetadata: {},
    };

    const fallbackString = JSON.stringify(fallbackPayload);
    const etag = computeWeakEtag(fallbackString);

    const response304 = checkConditionalGet(request, etag, CACHE_CONTROL_FALLBACK);
    if (response304) return response304;

    return createEdgeJsonResponse(fallbackString, {
      status: 200,
      etag,
      source: 'SUPABASE_FALLBACK',
      cacheControl: CACHE_CONTROL_FALLBACK,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown node edge error';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

/**
 * Handles GET /api/public/manifest
 */
export async function handlePublicManifestRoute(
  request: Request,
  kv: KVNamespace | null,
  _ctx?: any
): Promise<Response> {
  const kvKey = 'portal:manifest';

  try {
    const cachedJson = kv ? await kv.get(kvKey) : null;

    if (cachedJson) {
      const etag = computeWeakEtag(cachedJson);
      const response304 = checkConditionalGet(request, etag, CACHE_CONTROL_MANIFEST);
      if (response304) return response304;

      return createEdgeJsonResponse(cachedJson, {
        status: 200,
        etag,
        source: 'KV',
        cacheControl: CACHE_CONTROL_MANIFEST,
      });
    }

    // Cold Miss Self-Healing Fallback
    const fallbackManifest: PublicPortalManifestPayload = {
      activeSnapshotId: 'snapshot-latest',
      publishedAt: new Date().toISOString(),
      nodeIds: [...VALID_NODES],
      schemaVersion: 1,
    };

    const fallbackString = JSON.stringify(fallbackManifest);
    const etag = computeWeakEtag(fallbackString);

    const response304 = checkConditionalGet(request, etag, CACHE_CONTROL_MANIFEST);
    if (response304) return response304;

    return createEdgeJsonResponse(fallbackString, {
      status: 200,
      etag,
      source: 'SUPABASE_FALLBACK',
      cacheControl: CACHE_CONTROL_MANIFEST,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown manifest edge error';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

/**
 * Handles GET /api/public/chart/:chartId
 */
export async function handlePublicChartRoute(
  request: Request,
  chartIdParam: string,
  kv: KVNamespace | null,
  _ctx?: any
): Promise<Response> {
  const chartId = chartIdParam.trim();

  if (!chartId) {
    return new Response(JSON.stringify({ error: 'Chart ID is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const kvKey = `chart:${chartId}`;

  try {
    const cachedJson = kv ? await kv.get(kvKey) : null;

    if (cachedJson) {
      const etag = computeWeakEtag(cachedJson);
      const response304 = checkConditionalGet(request, etag, CACHE_CONTROL_NODE);
      if (response304) return response304;

      return createEdgeJsonResponse(cachedJson, {
        status: 200,
        etag,
        source: 'KV',
        cacheControl: CACHE_CONTROL_NODE,
      });
    }

    // Check baked charts fallback
    if (Array.isArray(bakedChartsData)) {
      const foundChart = (bakedChartsData as ChartDataset[]).find(
        (c) => c && c.chartId && c.chartId.toLowerCase() === chartId.toLowerCase()
      );

      if (foundChart) {
        const payloadString = JSON.stringify(foundChart);
        const etag = computeWeakEtag(payloadString);

        const response304 = checkConditionalGet(request, etag, CACHE_CONTROL_FALLBACK);
        if (response304) return response304;

        return createEdgeJsonResponse(payloadString, {
          status: 200,
          etag,
          source: 'STATIC_FALLBACK',
          cacheControl: CACHE_CONTROL_FALLBACK,
        });
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Chart not found',
        chartId,
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown chart edge error';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
