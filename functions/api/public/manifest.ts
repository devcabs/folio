/**
 * Edge Route: GET /api/public/manifest
 * Cloudflare Pages Functions Handler
 * Location: functions/api/public/manifest.ts
 *
 * Delegated to Folio Engine edge public handler.
 */

import type { PublicApiContext } from './_shared';
import { handlePublicManifestRoute } from '../../src/edge/handlers/publicHandler';

export async function onRequestGet(context: PublicApiContext): Promise<Response> {
  const { request, env } = context;
  const kv = env?.KV_ENGINE_PUBLIC || env?.KV_MASID_PUBLIC || null;
  return handlePublicManifestRoute(request, kv, context);
}
