/**
 * Edge Route: /api/lock
 * Cloudflare Pages Functions Handler
 * Location: functions/api/lock.ts
 *
 * Delegated to Folio Engine edge lock handler.
 */

import type { PagesFunctionEventContext } from '../../src/types/edge';
import { resolveKVNamespace } from '../../src/edge/router';
import { handleLockRoute } from '../../src/edge/handlers/lockHandler';

export async function onRequest(
  context: PagesFunctionEventContext<any>
): Promise<Response> {
  const { request, env } = context;
  const kv = resolveKVNamespace(env);
  return handleLockRoute(request, env, kv);
}
