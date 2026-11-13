/**
 * Folio Engine — Client Media URL Utilities for Cloudflare Edge Proxy
 * Location: src/utils/mediaUrl.ts
 * Specification: docs/tasks/task15_2_edge_media_proxy_and_stream_transcoder.md
 */

export const ALLOWED_EDGE_WIDTHS = [320, 400, 600, 800, 1200, 1600] as const;
export type EdgeWidth = (typeof ALLOWED_EDGE_WIDTHS)[number];

const DEFAULT_EDGE_WIDTH: EdgeWidth = 800;
const DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{10,64}$/;

/**
 * Clamps or snaps an arbitrary image pixel width to the nearest allowed edge bucket.
 */
export function normalizeEdgeWidth(rawWidth: number): EdgeWidth {
  if (typeof rawWidth !== 'number' || isNaN(rawWidth) || rawWidth <= 0) {
    return DEFAULT_EDGE_WIDTH;
  }

  if (rawWidth <= ALLOWED_EDGE_WIDTHS[0]) {
    return ALLOWED_EDGE_WIDTHS[0];
  }
  if (rawWidth >= ALLOWED_EDGE_WIDTHS[ALLOWED_EDGE_WIDTHS.length - 1]) {
    return ALLOWED_EDGE_WIDTHS[ALLOWED_EDGE_WIDTHS.length - 1];
  }

  // Find nearest bucket (preferring larger bucket on exact ties for image crispness)
  let closest: EdgeWidth = DEFAULT_EDGE_WIDTH;
  let minDiff = Infinity;
  for (const bucket of ALLOWED_EDGE_WIDTHS) {
    const diff = Math.abs(bucket - rawWidth);
    if (diff <= minDiff) {
      minDiff = diff;
      closest = bucket;
    }
  }

  return closest;
}

export interface ResolvedSinglePhoto {
  fileId: string;
  displayUrl: string;
  thumbnailUrl: string;
  rawUrl: string;
}

/**
 * Extracts a Google Drive alphanumeric file ID specifically for SINGLE PHOTOS.
 * Strictly ignores and rejects folder URLs (/folders/).
 *
 * Supported single-photo variants:
 * - Direct ID: 1ABCxyz0123456789_-
 * - View URL: https://drive.google.com/file/d/1ABC.../view
 * - Preview URL: https://drive.google.com/file/d/1ABC.../preview
 * - Bare path: https://drive.google.com/file/d/1ABC...
 * - Open URL: https://drive.google.com/open?id=1ABC...
 * - Direct UC: https://drive.google.com/uc?id=1ABC...&export=download
 * - Thumbnail URL: https://drive.google.com/thumbnail?id=1ABC...&sz=w1600
 * - User Content CDN: https://lh3.googleusercontent.com/d/1ABC... or drive-viewer/1ABC...
 * - Multi-account: https://drive.google.com/u/1/file/d/1ABC.../view
 * - Angle-bracketed / quoted URLs: <https://...> or "https://..."
 */
export function extractDriveFileId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  // 1. Sanitize input (strip surrounding whitespace, angle brackets, and quotes)
  const trimmed = input.trim().replace(/^[<"']+|[>"']+$/g, '').trim();
  if (!trimmed) return null;

  // 2. Reject folder links explicitly (Single Photos ONLY)
  if (trimmed.includes('/folders/') || trimmed.includes('/folders')) {
    return null;
  }

  // 3. Direct alphanumeric file ID
  if (DRIVE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  // 4. Query param ?id=... or &id=... (covers /open?id=, /uc?id=, /thumbnail?id=)
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,64})/);
  if (queryMatch?.[1] && DRIVE_ID_REGEX.test(queryMatch[1])) {
    return queryMatch[1];
  }

  // 5. Google User Content CDN: lh3.googleusercontent.com/d/FILE_ID or drive-viewer/FILE_ID
  const lhMatch = trimmed.match(/googleusercontent\.com\/(?:d|drive-viewer)\/([a-zA-Z0-9_-]{10,64})/);
  if (lhMatch?.[1] && DRIVE_ID_REGEX.test(lhMatch[1])) {
    return lhMatch[1];
  }

  // 6. Direct file view path: /file/d/FILE_ID or standard /d/FILE_ID
  // Handles multi-account prefixes like /u/0/file/d/..., /u/1/d/...
  const dPathMatch = trimmed.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,64})/);
  if (dPathMatch?.[1] && DRIVE_ID_REGEX.test(dPathMatch[1])) {
    return dPathMatch[1];
  }

  return null;
}

/**
 * Resolves any valid Google Drive single-photo link variant into permanent,
 * renderable image URLs suitable for <img> tags and canvas AST persistence.
 * Returns null if the URL is invalid or is a folder URL.
 */
export function resolveSingleDrivePhotoUrl(input: string): ResolvedSinglePhoto | null {
  const fileId = extractDriveFileId(input);
  if (!fileId) return null;

  return {
    fileId,
    displayUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w320`,
    rawUrl: input.trim(),
  };
}

export interface EdgeMediaUrlOptions {
  width?: number;
  format?: 'auto' | 'webp' | 'jpeg';
}

/**
 * Generates an edge media proxy URL pointing to /api/media/drive/:fileId
 */
export function buildEdgeMediaUrl(
  fileIdOrUrl: string,
  options: EdgeMediaUrlOptions = {}
): string {
  const fileId = extractDriveFileId(fileIdOrUrl);
  if (!fileId) return fileIdOrUrl || '';

  const width = normalizeEdgeWidth(options.width ?? DEFAULT_EDGE_WIDTH);
  const base = `/api/media/drive/${fileId}?w=${width}`;

  if (options.format && options.format !== 'auto') {
    return `${base}&fmt=${options.format}`;
  }

  return base;
}

/**
 * Generates a responsive HTML `srcset` attribute value mapping to edge media proxy buckets.
 * Defaults to [400, 800, 1200, 1600] for optimal mobile and high-DPI rendering.
 */
export function buildEdgeSrcSet(
  fileIdOrUrl: string,
  widths: readonly number[] | number[] = [400, 800, 1200, 1600]
): string {
  const fileId = extractDriveFileId(fileIdOrUrl);
  if (!fileId) return '';

  return widths
    .map((w) => {
      const normalizedW = normalizeEdgeWidth(w);
      return `${buildEdgeMediaUrl(fileId, { width: normalizedW })} ${normalizedW}w`;
    })
    .join(', ');
}
