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

/**
 * Extracts a Google Drive alphanumeric file ID from a raw ID or standard Drive URL formats:
 * - Direct ID: 1ABCxyz0123456789_-
 * - Thumbnail URL: https://drive.google.com/thumbnail?id=1ABC...&sz=w1600
 * - File View URL: https://drive.google.com/file/d/1ABC.../view
 * - Open URL: https://drive.google.com/open?id=1ABC...
 */
export function extractDriveFileId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 1. Direct alphanumeric ID check
  if (DRIVE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  // 2. Query param ?id=... or &id=...
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,64})/);
  if (queryMatch?.[1] && DRIVE_ID_REGEX.test(queryMatch[1])) {
    return queryMatch[1];
  }

  // 3. Path /d/ID or /folders/ID
  const pathMatch = trimmed.match(/\/(?:d|folders)\/([a-zA-Z0-9_-]{10,64})/);
  if (pathMatch?.[1] && DRIVE_ID_REGEX.test(pathMatch[1])) {
    return pathMatch[1];
  }

  return null;
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
