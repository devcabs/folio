/**
 * Edge Route: GET /api/public/chart/:chartId
 * Cloudflare Pages Functions Handler
 * Location: functions/api/public/chart/[chartId].ts
 *
 * Delegated to Folio Engine edge public handler.
 */

import type { PublicApiContext } from '../_shared';
import { handlePublicChartRoute } from '../../../src/edge/handlers/publicHandler';

export async function onRequestGet(
  context: PublicApiContext<'chartId'>
): Promise<Response> {
  const { request, env, params } = context;
  const chartId = (params.chartId as string | undefined) || '';
  const kv = env?.KV_ENGINE_PUBLIC || env?.KV_MASID_PUBLIC || null;
  return handlePublicChartRoute(request, chartId, kv, context);
}
