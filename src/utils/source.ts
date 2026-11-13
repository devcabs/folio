import sourceSourcesRaw from '../data/source-sources.json';
import type { SourceSource, SourceSourceRegistry } from '../types/source';
import type { DevLinkData } from '../types/developer';
import { getContentObject } from './contentDb';

const registry = sourceSourcesRaw as SourceSourceRegistry;

/**
 * Normalizes point and node identifiers to ensure consistent lookup.
 * Handles both "node-access" and "access" seamlessly, trimming whitespace
 * and lowering case. Defensively handles null/undefined or empty input.
 */
export function normalizePointId(pointId: string): string {
  if (!pointId || typeof pointId !== 'string') return '';
  return pointId.trim().toLowerCase().replace(/^node-/, '');
}

/**
 * Safely retrieves the official SourceSource for a given node or point ID.
 * Incorporates dynamic client-side Content DB overrides if configured.
 * Returns null if the source is not registered or invalid.
 */
export function getSourceSource(pointId: string): SourceSource | null {
  const normalizedKey = normalizePointId(pointId);
  if (!normalizedKey) return null;
  const defaultSource = registry[normalizedKey] ?? null;

  const sourceKey = `source.${normalizedKey}.source`;
  const override = getContentObject<DevLinkData | (Partial<SourceSource> & { url?: string; label?: string }) | null>(
    sourceKey,
    null
  );

  if (override) {
    const url = 'folderUrl' in override ? override.folderUrl : override.url;
    const title = 'folderTitle' in override ? override.folderTitle : override.label;
    if (url !== undefined || title !== undefined) {
      return {
        pointId: normalizedKey,
        folderUrl: url ?? defaultSource?.folderUrl ?? '',
        folderTitle: title ?? defaultSource?.folderTitle ?? 'Official Google Drive Folder',
        description: defaultSource?.description,
        lastVerified: defaultSource?.lastVerified,
      };
    }
  }

  return defaultSource;
}

/**
 * Matches canonical Google Drive folder URL patterns:
 * - https://drive.google.com/drive/folders/{folderId}
 * - https://drive.google.com/drive/u/{userIndex}/folders/{folderId}
 * - https://drive.google.com/open?id={folderId}
 */
export const GOOGLE_DRIVE_FOLDER_REGEX =
  /^https:\/\/(?:drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|open\?id=))([a-zA-Z0-9_-]+)/;

/**
 * Validates whether a given URL string is a valid Google Drive folder URL.
 * Defensively handles null, undefined, non-string, or malformed inputs.
 */
export function isValidDriveFolderUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return GOOGLE_DRIVE_FOLDER_REGEX.test(url.trim());
}
