/**
 * Folio Engine — Edge Media Handler: Google Drive Stream Proxy & Transcoder
 * Location: src/edge/handlers/mediaHandler.ts
 */

import { normalizeEdgeWidth } from '../../utils/mediaUrl';

const DRIVE_FILE_ID_REGEX = /^[a-zA-Z0-9_-]{10,64}$/;

/**
 * Renders a lightweight SVG placeholder for missing or forbidden upstream media.
 * Returned with a short 60s cache to prevent persistent edge cache poisoning.
 */
export function renderPlaceholderSvg(fileId: string, status: number): Response {
  const label = status === 403 ? 'Access Restricted (403)' : 'Photo Not Found (404)';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" fill="none">
  <rect width="800" height="600" fill="#f8fafc"/>
  <rect x="20" y="20" width="760" height="560" rx="16" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="8 8"/>
  <g transform="translate(400, 260)" text-anchor="middle">
    <!-- Camera outline icon -->
    <path d="M-36 -10 L-24 -30 L24 -30 L36 -10 L50 -10 A 10 10 0 0 1 60 0 L60 40 A 10 10 0 0 1 50 50 L-50 50 A 10 10 0 0 1 -60 40 L-60 0 A 10 10 0 0 1 -50 -10 Z" stroke="#94a3b8" stroke-width="4" fill="none"/>
    <circle cx="0" cy="20" r="18" stroke="#94a3b8" stroke-width="4" fill="none"/>
    <circle cx="36" cy="6" r="4" fill="#94a3b8"/>
    <!-- Diagnostic text -->
    <text y="90" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="600" fill="#475569">${label}</text>
    <text y="120" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#64748b">Drive ID: ${fileId.slice(0, 16)}...</text>
    <text y="150" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#94a3b8">the host application · Folio Engine</text>
  </g>
</svg>`;

  return new Response(svg, {
    status,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=60',
      'X-Engine-Media-Source': 'UPSTREAM_FALLBACK_SVG',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Extracts and normalizes requested width from query parameters (?w=800 or ?sz=w800).
 */
export function parseRequestedWidth(url: URL): number {
  const wParam = url.searchParams.get('w');
  if (wParam) {
    const parsed = parseInt(wParam, 10);
    return normalizeEdgeWidth(parsed);
  }

  const szParam = url.searchParams.get('sz');
  if (szParam) {
    const digitsOnly = szParam.replace(/\D/g, '');
    const parsed = parseInt(digitsOnly, 10);
    return normalizeEdgeWidth(parsed);
  }

  return normalizeEdgeWidth(800);
}

/**
 * Handles GET /api/media/drive/:fileId
 */
export async function handleDriveMediaRoute(
  request: Request,
  fileIdParam: string,
  ctx?: any
): Promise<Response> {
  const fileId = fileIdParam.trim();

  // 1. Sanitize fileId: Alphanumeric, hyphens, and underscores only (10 to 64 chars)
  if (!fileId || !DRIVE_FILE_ID_REGEX.test(fileId)) {
    return new Response('Invalid Drive file ID', {
      status: 400,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // 2. Parse & normalize width to whitelist
  const url = new URL(request.url);
  const width = parseRequestedWidth(url);

  // 3. Check Cloudflare Edge Cache API (caches.default)
  const cacheKey = new Request(url.toString(), request);
  const cache =
    typeof caches !== 'undefined' && caches
      ? (caches as unknown as { default: Cache }).default
      : null;

  if (cache) {
    try {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const response = new Response(cachedResponse.body, cachedResponse);
        response.headers.set('X-Engine-Media-Source', 'EDGE_CACHE');
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }
    } catch {
      // In non-worker environments or cache errors, fall through to upstream
    }
  }

  // 4. Construct upstream Google Drive URL
  const upstreamUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`;

  // 5. Fetch upstream with sanitized referrer & headers (Eliminates 403 Forbidden)
  let driveResponse: Response;
  try {
    driveResponse = await fetch(upstreamUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; EngineEdgeProxy/1.0; +https://engine.example.com)',
        'Referer': 'https://drive.google.com/',
        'Accept':
          'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
  } catch (fetchError) {
    return new Response(
      `Upstream fetch failure: ${(fetchError as Error).message}`,
      {
        status: 502,
        headers: {
          'Cache-Control': 'public, max-age=30',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // 6. Upstream Error Handling & Circuit Breaker
  if (!driveResponse.ok) {
    if (driveResponse.status === 404 || driveResponse.status === 403) {
      return renderPlaceholderSvg(fileId, driveResponse.status);
    }
    return new Response(
      `Upstream Drive error: ${driveResponse.statusText || driveResponse.status}`,
      {
        status: driveResponse.status,
        headers: {
          'Cache-Control': 'public, max-age=60',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // 7. Clone response for Cache API storage
  const contentType = driveResponse.headers.get('content-type') || 'image/jpeg';
  const responseHeaders = new Headers(driveResponse.headers);
  responseHeaders.set('Content-Type', contentType);
  responseHeaders.set(
    'Cache-Control',
    'public, max-age=31536000, s-maxage=31536000, immutable'
  );
  responseHeaders.set('ETag', `W/"drive-${fileId}-w${width}"`);
  responseHeaders.set('X-Engine-Media-Source', 'UPSTREAM_DRIVE');
  responseHeaders.set('Access-Control-Allow-Origin', '*');

  const proxyResponse = new Response(driveResponse.body, {
    status: 200,
    headers: responseHeaders,
  });

  // Asynchronously store in Cloudflare Edge Cache API
  if (cache && ctx && typeof ctx.waitUntil === 'function') {
    try {
      ctx.waitUntil(cache.put(cacheKey, proxyResponse.clone()));
    } catch {
      // Ignore cache put errors
    }
  }

  return proxyResponse;
}
