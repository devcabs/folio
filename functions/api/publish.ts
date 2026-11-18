/**
 * Edge Route: POST /api/publish
 * Cloudflare Pages Functions Handler
 * Location: functions/api/publish.ts
 *
 * Delegated to Folio Engine edge publish handler.
 */

import type { PagesFunctionEventContext } from '../../src/types/edge';
import { resolveKVNamespace } from '../../src/edge/router';
import {
  handlePublishRoute,
  type PublishRequestBody,
  type PublishResponseBody,
} from '../../src/edge/handlers/publishHandler';

export type { PublishRequestBody, PublishResponseBody };

export async function onRequestPost(
  context: PagesFunctionEventContext<any>
): Promise<Response> {
  const { request, env } = context;
  const kv = resolveKVNamespace(env);
  return handlePublishRoute(request, env, kv, context);
}
