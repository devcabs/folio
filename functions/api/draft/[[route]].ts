/**
 * Edge Route: /api/draft and /api/draft/init
 * Cloudflare Pages Functions Catch-All Handler
 * Location: functions/api/draft/[[route]].ts
 *
 * Delegated to Folio Engine edge draft workspace handler.
 */

import type { PagesFunctionEventContext } from '../../../src/types/edge';
import { resolveKVNamespace } from '../../../src/edge/router';
import { handleDraftRoute } from '../../../src/edge/handlers/draftHandler';

export async function onRequest(
  context: PagesFunctionEventContext<any>
): Promise<Response> {
  const { request, env } = context;
  const kv = resolveKVNamespace(env);
  return handleDraftRoute(request, env, kv);
}
