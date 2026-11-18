/**
 * Edge Route: GET /api/public/manifest
 * Cloudflare Pages Functions Handler
 * Location: functions/api/public/manifest.ts
 *
 * Delegated to Folio Engine edge public handler.
 */

import type { PublicApiContext } from './_shared';
import { resolveKVNamespace } from '../../src/edge/router';
import { handlePublicManifestRoute } from '../../src/edge/handlers/publicHandler';

export async function onRequestGet(context: PublicApiContext): Promise<Response> {
  const { request, env } = context;
  const kv = resolveKVNamespace(env);
  return handlePublicManifestRoute(request, kv, context);
}
