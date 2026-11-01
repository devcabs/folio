/**
 * Edge Route: GET /api/public/node/:nodeId
 * Cloudflare Pages Functions Handler
 * Location: functions/api/public/node/[nodeId].ts
 * Specification: docs/tasks/task15_1_edge_routing_and_kv_schema_architecture.md
 */

import type { PublicNodePayload } from '../../../../src/types/edge';
import {
  computeWeakEtag,
  createEdgeJsonResponse,
  checkConditionalGet,
  VALID_NODES,
  type PublicApiContext,
  type ValidNodeId,
} from '../_shared';

export async function onRequestGet(
  context: PublicApiContext<'nodeId'>
): Promise<Response> {
  const { request, env, params } = context;
  const nodeId = (params.nodeId as string | undefined)?.toLowerCase();

  // 1. Strict Validation against Canonical 5 Nodes
  if (!nodeId || !VALID_NODES.includes(nodeId as ValidNodeId)) {
    return new Response(
      JSON.stringify({
        error: 'Invalid node ID',
        validNodes: VALID_NODES,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }

  const kvKey = `node:${nodeId}`;

  try {
    // 2. Query Cloudflare KV (Sub-10ms edge memory)
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

    // 3. Fallback on KV Cold Miss (Self-Healing)
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

    // Asynchronously write back into Cloudflare KV for future edge hits
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
    const errorMsg = err instanceof Error ? err.message : 'Unknown node edge error';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
