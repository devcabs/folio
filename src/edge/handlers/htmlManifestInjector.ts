/**
 * Folio Engine — Edge HTML Manifest Injection Middleware
 * Location: src/edge/handlers/htmlManifestInjector.ts
 *
 * Injects the active `portal:manifest` JSON directly into HTML responses as
 * `window.__FOLIO_MANIFEST__` at the Cloudflare Edge to eliminate cold-load
 * manifest fetch latency on deep subpage URLs.
 */

import type { KVNamespace, PublicPortalManifestPayload } from '../../types/edge';
import { CACHE_CONTROL_MANIFEST } from './publicHandler';

const PORTAL_MANIFEST_KV_KEY = 'portal:manifest';

/**
 * Serializes a manifest JSON string or payload object into an XSS-safe
 * `<script>` tag assigning `window.__FOLIO_MANIFEST__`.
 */
export function serializeManifestForHtmlScript(
  manifestInput: string | PublicPortalManifestPayload
): string {
  const normalizedJson =
    typeof manifestInput === 'string'
      ? JSON.stringify(JSON.parse(manifestInput))
      : JSON.stringify(manifestInput);

  const escaped = normalizedJson
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return `<script id="folio-manifest-bootstrap">window.__FOLIO_MANIFEST__=${escaped};</script>`;
}

/**
 * Safely parses `manifestRaw` and injects the bootstrap `<script>` tag into
 * `html` immediately before `</head>` (falling back to `</body>` or start).
 * Returns the original `html` untouched if `manifestRaw` is malformed.
 */
export function injectManifestIntoHtml(html: string, manifestRaw: string): string {
  if (!manifestRaw) return html;

  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestRaw);
  } catch {
    return html;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return html;
  }

  const scriptTag = serializeManifestForHtmlScript(parsed as PublicPortalManifestPayload);

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, (match) => `${scriptTag}${match}`);
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, (match) => `${scriptTag}${match}`);
  }
  return `${scriptTag}${html}`;
}

/**
 * Injects `portal:manifest` from Edge KV into 2xx `text/html` GET responses.
 * Non-HTML assets, non-GET requests, non-2xx statuses, and missing/corrupt
 * KV states pass through untouched with zero body buffering.
 */
export async function maybeInjectManifestResponse(
  request: Request,
  response: Response,
  kv: KVNamespace | null
): Promise<Response> {
  if (request.method.toUpperCase() !== 'GET') return response;
  if (!kv) return response;
  if (response.status < 200 || response.status >= 300) return response;

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html')) return response;

  let manifestRaw: string | null = null;
  try {
    manifestRaw = await kv.get(PORTAL_MANIFEST_KV_KEY);
  } catch {
    return response;
  }

  if (!manifestRaw) return response;

  // Validate JSON before consuming the response body stream so corrupt KV
  // entries pass through the original Response untouched.
  try {
    const parsed = JSON.parse(manifestRaw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return response;
    }
  } catch {
    return response;
  }

  const html = await response.text();
  const injectedHtml = injectManifestIntoHtml(html, manifestRaw);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('Cache-Control', CACHE_CONTROL_MANIFEST);

  return new Response(injectedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
