/**
 * Edge Route: GET /api/public/node/:nodeId
 * Cloudflare Pages Functions Handler
 * Location: functions/api/public/node/[nodeId].ts
 *
 * Delegated to Folio Engine edge public handler.
 */

import type { PublicApiContext } from '../_shared';
import { handlePublicNodeRoute } from '../../../src/edge/handlers/publicHandler';

export async function onRequestGet(
  context: PublicApiContext<'nodeId'>
): Promise<Response> {
  const { request, env, params } = context;
  const nodeId = (params.nodeId as string | undefined) || '';
  const kv = env?.KV_ENGINE_PUBLIC || env?.KV_MASID_PUBLIC || null;
  return handlePublicNodeRoute(request, nodeId, kv, context);
}
