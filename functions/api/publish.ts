/**
 * Edge Route: POST /api/publish
 * Cloudflare Pages Functions Handler
 * Location: functions/api/publish.ts
 *
 * Delegated to Folio Engine edge publish handler.
 */

import type { PagesFunctionEventContext } from '../../src/types/edge';
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
  const kv = env?.KV_ENGINE_PUBLIC || env?.KV_MASID_PUBLIC || null;
  return handlePublishRoute(request, env, kv, context);
}
