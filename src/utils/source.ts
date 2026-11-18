/**
 * Pure Google Drive URL validation and point ID normalization utilities.
 */

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
 * Matches canonical Google Drive folder URL patterns:
 * - https://drive.google.com/drive/folders/{folderId}
 * - https://drive.google.com/drive/u/{userIndex}/folders/{folderId}
 * - https://drive.google.com/open?id={folderId}
 */
export const GOOGLE_DRIVE_FOLDER_REGEX =
  /^https:\/\/(?:drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|open\?id=))([a-zA-Z0-9_-]+)/;

/**
 * Extracts canonical Google Drive folder ID from a URL.
 */
export function extractDriveFolderId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.trim().match(GOOGLE_DRIVE_FOLDER_REGEX);
  return match && match[1] ? match[1] : null;
}

/**
 * Validates whether a given URL string is a valid Google Drive folder URL.
 * Defensively handles null, undefined, non-string, or malformed inputs.
 */
export function isValidDriveFolderUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return GOOGLE_DRIVE_FOLDER_REGEX.test(url.trim());
}
