/**
 * Edge Route: /api/history, /api/history/:id, /api/history/restore
 * Cloudflare Pages Functions Catch-All Handler
 * Location: functions/api/history/[[route]].ts
 *
 * Delegated to Folio Engine edge revision history handler.
 */

import type { PagesFunctionEventContext } from '../../../src/types/edge';
import { resolveKVNamespace } from '../../../src/edge/router';
import { handleHistoryRoute } from '../../../src/edge/handlers/historyHandler';

export async function onRequest(
  context: PagesFunctionEventContext<any>
): Promise<Response> {
  const { request, env } = context;
  const kv = resolveKVNamespace(env);
  return handleHistoryRoute(request, env, kv);
}
