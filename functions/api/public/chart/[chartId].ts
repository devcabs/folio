/**
 * Edge Route: GET /api/public/chart/:chartId
 * Cloudflare Pages Functions Handler
 * Location: functions/api/public/chart/[chartId].ts
 * Specification: docs/tasks/task15_1_edge_routing_and_kv_schema_architecture.md
 */

import {
  computeWeakEtag,
  createEdgeJsonResponse,
  checkConditionalGet,
  type PublicApiContext,
} from '../_shared';

export async function onRequestGet(
  context: PublicApiContext<'chartId'>
): Promise<Response> {
  const { request, env, params } = context;
  const chartId = params.chartId as string | undefined;

  if (!chartId || chartId.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Chart ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const kvKey = `chart:${chartId}`;

  try {
    // 1. Query Cloudflare KV (Sub-10ms edge memory)
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

    // 2. Chart Not Found in KV
    return new Response(
      JSON.stringify({
        error: 'Chart not found',
        chartId,
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown chart edge error';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
