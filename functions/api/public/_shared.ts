/**
 * Shared Edge Utilities for Cloudflare Pages Functions
 * Location: functions/api/public/_shared.ts
 * Specification: docs/tasks/task15_1_edge_routing_and_kv_schema_architecture.md
 */

import type { PagesFunctionEventContext, EdgeEnv } from '../../../src/types/edge';
import { computeWeakEtag, VALID_NODES, type ValidNodeId } from '../../../src/types/edge';

export { computeWeakEtag, VALID_NODES, type ValidNodeId };

export const CACHE_CONTROL_EDGE = 'public, max-age=60, s-maxage=86400, stale-while-revalidate=604800';
export const CACHE_CONTROL_FALLBACK = 'public, max-age=30, s-maxage=300';

export interface ResponseOptions {
  status?: number;
  etag?: string;
  source?: 'KV' | 'SUPABASE_FALLBACK';
  cacheControl?: string;
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
  const cacheControl = options.cacheControl ?? (options.source === 'KV' ? CACHE_CONTROL_EDGE : CACHE_CONTROL_FALLBACK);
  const source = options.source ?? 'KV';

  return new Response(payloadString, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      'ETag': etag,
      'X-Engine-Edge-Source': source,
      'Vary': 'Accept-Encoding',
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
  cacheControl: string = CACHE_CONTROL_EDGE
): Response | null {
  const clientEtag = request.headers.get('if-none-match');
  if (clientEtag && clientEtag === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': cacheControl,
      },
    });
  }
  return null;
}

export type PublicApiContext<P extends string = string> = PagesFunctionEventContext<EdgeEnv, P>;
