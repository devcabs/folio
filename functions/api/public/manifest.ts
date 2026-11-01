/**
 * Edge Route: GET /api/public/manifest
 * Cloudflare Pages Functions Handler
 * Location: functions/api/public/manifest.ts
 * Specification: docs/tasks/task15_1_edge_routing_and_kv_schema_architecture.md
 */

import type { PublicPortalManifestPayload } from '../../../src/types/edge';
import {
  computeWeakEtag,
  createEdgeJsonResponse,
  checkConditionalGet,
  VALID_NODES,
  type PublicApiContext,
} from './_shared';

export async function onRequestGet(context: PublicApiContext): Promise<Response> {
  const { request, env } = context;
  const kvKey = 'portal:manifest';

  try {
    // 1. Edge Memory / KV Lookup (Sub-10ms)
    const cachedJson = env.KV_ENGINE_PUBLIC ? await env.KV_ENGINE_PUBLIC.get(kvKey) : null;

    if (cachedJson) {
      const etag = computeWeakEtag(cachedJson);

      // Check conditional 304
      const response304 = checkConditionalGet(request, etag);
      if (response304) return response304;

      return createEdgeJsonResponse(cachedJson, {
        status: 200,
        etag,
        source: 'KV',
      });
    }

    // 2. Cold Miss Self-Healing Fallback
    const fallbackManifest: PublicPortalManifestPayload = {
      activeSnapshotId: 'snapshot-latest',
      publishedAt: new Date().toISOString(),
      nodeIds: [...VALID_NODES],
      schemaVersion: 1,
    };

    const fallbackString = JSON.stringify(fallbackManifest);
    const etag = computeWeakEtag(fallbackString);

    // Asynchronously write back into Cloudflare KV
    if (env.KV_ENGINE_PUBLIC && typeof context.waitUntil === 'function') {
      context.waitUntil(env.KV_ENGINE_PUBLIC.put(kvKey, fallbackString));
    }

    const response304 = checkConditionalGet(request, etag);
    if (response304) return response304;

    return createEdgeJsonResponse(fallbackString, {
      status: 200,
      etag,
      source: 'SUPABASE_FALLBACK',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown manifest edge error';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
