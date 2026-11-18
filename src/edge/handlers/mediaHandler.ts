/**
 * Folio Engine — Edge Media Handler: Google Drive Stream Proxy & Transcoder
 * Location: src/edge/handlers/mediaHandler.ts
 */

import { normalizeEdgeWidth } from '../../utils/mediaUrl';

const DRIVE_FILE_ID_REGEX = /^[a-zA-Z0-9_-]{10,64}$/;

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
  _ctx?: any
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

  // 3. Construct upstream Google Drive URL
  const upstreamUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`;

  // 4. Fetch upstream with sanitized referrer & headers
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
      JSON.stringify({
        error: 'Upstream fetch failure',
        detail: (fetchError as Error).message,
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // 5. Fail-Stop Upstream Error Handling (no synthetic SVG fallback)
  if (!driveResponse.ok) {
    return new Response(
      JSON.stringify({
        error: 'Upstream Drive media error',
        status: driveResponse.status,
        detail: driveResponse.statusText || String(driveResponse.status),
      }),
      {
        status: driveResponse.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // 6. Return bounded-cache proxy response (no 1-year immutable poisoning)
  const contentType = driveResponse.headers.get('content-type') || 'image/jpeg';
  const responseHeaders = new Headers(driveResponse.headers);
  responseHeaders.set('Content-Type', contentType);
  responseHeaders.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
  responseHeaders.set('ETag', `W/"drive-${fileId}-w${width}"`);
  responseHeaders.set('X-Engine-Media-Source', 'UPSTREAM_DRIVE');
  responseHeaders.set('Access-Control-Allow-Origin', '*');

  return new Response(driveResponse.body, {
    status: 200,
    headers: responseHeaders,
  });
}
