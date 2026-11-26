/**
 * Drive Photo Synchronization & Differential Reconciliation Service
 * Folio Engine
 *
 * Implements Subtask 6.1:
 * - O(1) Map-based Differential Reconciliation of Google Drive photos with source gallery records
 * - Identity preservation and coordinator custom-title retention
 * - Natural numeric filename sorting (01_, 02_, ... 10_)
 * - Machine filename auto-cleaning into editorial titles
 * - Fallback high-res and thumbnail URL constructor
 * - Google Drive REST API v3 Image Fetcher
 */

import { extractDriveFolderId, extractResourceKey } from './driveVerificationService';
import type {
  DrivePhotoFile,
  SyncedSourceItem,
  DriveReconciliationResult,
  SyncFolderPhotosResult,
} from '../types/source';
import {
  buildDrivePreviewUrl,
  buildDriveViewUrl,
  buildEdgeMediaUrl,
} from '../utils/mediaUrl';

/**
 * Safely retrieves the configured Google Drive API key from environment variables.
 */
function getGoogleApiKey(): string | null {
  const key =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_DRIVE_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_GOOGLE_DRIVE_API_KEY) ||
    '';
  if (key && !key.includes('your-google-drive-api-key')) {
    return key.trim();
  }
  return null;
}

/**
 * Strips machine prefixes, extensions, and sequence numbers from raw filenames
 * converting them into clean editorial titles.
 */
export function cleanDriveFileName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return 'Source Photo';
  }

  let cleaned = rawName.replace(
    /\.(jpe?g|png|webp|gif|heic|tiff|bmp|avif|mp4|mov|webm|m4v|avi|mkv)$/i,
    ''
  );
  cleaned = cleaned.replace(/^(?:IMG|VID|MOV)_\d+_/i, '');
  cleaned = cleaned.replace(/^\d+[\s_-]+/, '');
  cleaned = cleaned.replace(/[_-]+/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned.length > 0 ? cleaned : 'Source Photo';
}

function isVideoDriveFile(file: DrivePhotoFile): boolean {
  return Boolean(
    (file.mimeType && file.mimeType.startsWith('video/')) ||
    /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name)
  );
}

function parseVideoDurationMs(file: DrivePhotoFile): number | undefined {
  const raw = file.videoMediaMetadata?.durationMillis;
  const parsed =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : undefined;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : undefined;
}

/**
 * Performs natural numeric comparison on filenames to ensure sequential ordering
 * (e.g. "01_Photo.jpg", "02_Photo.jpg", "10_Photo.jpg").
 */
export function compareNaturalFilenames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Generates an Edge Media Proxy high-resolution URL (/api/media/drive/:fileId?w=1600).
 */
export function formatHighResDriveUrl(
  thumbnailLink?: string,
  fileId?: string
): string {
  if (fileId) {
    return buildEdgeMediaUrl(fileId, { width: 1600 });
  }
  return thumbnailLink || '';
}

/**
 * Generates an Edge Media Proxy thumbnail URL (/api/media/drive/:fileId?w=320).
 */
export function formatThumbnailDriveUrl(
  _thumbnailLink?: string,
  fileId?: string
): string {
  if (fileId) {
    return buildEdgeMediaUrl(fileId, { width: 320 });
  }
  return '';
}

/**
 * Pure O(1) Map Differential Reconciliation Engine.
 * Reconciles incoming Google Drive photo files against existing synced source records.
 *
 * Invariants:
 * 1. Preserves existing item instances, IDs, and custom titles (isCustomTitle: true).
 * 2. Appends new images with clean titles and natural orderIndex.
 * 3. Prunes images deleted from Google Drive.
 * 4. Yields accurate differential stats and hasChanged boolean.
 */
export function reconcileDrivePhotos(
  existingItems: SyncedSourceItem[],
  incomingFiles: DrivePhotoFile[],
  pointId: string
): DriveReconciliationResult {
  // Fast early-exit optimization if both collections are empty
  if (existingItems.length === 0 && incomingFiles.length === 0) {
    return {
      items: [],
      stats: { added: 0, removed: 0, retained: 0, total: 0, hasChanged: false },
    };
  }

  // Build O(1) Lookup Map for existing items
  const existingMap = new Map<string, SyncedSourceItem>();
  for (let i = 0; i < existingItems.length; i++) {
    existingMap.set(existingItems[i].driveFileId, existingItems[i]);
  }

  // Sort incoming files by natural numeric filename collation
  const sortedFiles = [...incomingFiles].sort((a, b) =>
    compareNaturalFilenames(a.name, b.name)
  );

  const incomingIdSet = new Set<string>();
  const reconciled: SyncedSourceItem[] = [];
  let added = 0;
  let retained = 0;

  for (let i = 0; i < sortedFiles.length; i++) {
    const file = sortedFiles[i];
    incomingIdSet.add(file.id);

    const existing = existingMap.get(file.id);
    const thumbUrl = formatThumbnailDriveUrl(file.thumbnailLink, file.id);
    const highResUrl = formatHighResDriveUrl(file.thumbnailLink, file.id);
    const isVideo = isVideoDriveFile(file);
    const durationMs = isVideo ? parseVideoDurationMs(file) : undefined;
    const videoMetadata = isVideo
      ? {
        mediaType: 'video' as const,
        mimeType: file.mimeType,
        videoPreviewUrl: buildDrivePreviewUrl(file.id),
        videoViewUrl: buildDriveViewUrl(file.id),
        ...(durationMs !== undefined ? { durationMs } : {}),
      }
      : {};

    if (existing) {
      // Retain existing item instance (preserves isCustomTitle, custom title/caption)
      retained++;
      reconciled.push({
        ...existing,
        ...videoMetadata,
        orderIndex: i,
        thumbnailUrl: thumbUrl,
        fullImageUrl: highResUrl,
        imageSrc: highResUrl,
        photo: {
          ...existing.photo,
          src: highResUrl,
          alt: existing.title,
          caption: existing.title,
          showCaption: true,
        },
      });
    } else {
      // Construct new synced source item
      added++;
      const cleanTitle = cleanDriveFileName(file.name);
      const dateIso = file.createdTime ? file.createdTime.split('T')[0] : '2026-10-09';
      reconciled.push({
        id: `drive-${file.id}`,
        pointId,
        driveFileId: file.id,
        originalFileName: file.name,
        title: cleanTitle,
        category: isVideo ? 'MOV Video' : 'MOV Photo',
        date: dateIso,
        dateStamp: dateIso,
        imageSrc: highResUrl,
        thumbnailUrl: thumbUrl,
        fullImageUrl: highResUrl,
        photo: {
          src: highResUrl,
          alt: cleanTitle,
          caption: cleanTitle,
          showCaption: true,
        },
        orderIndex: i,
        isCustomTitle: false,
        ...videoMetadata,
      });
    }
  }

  // Calculate pruned removals
  let removed = 0;
  for (let i = 0; i < existingItems.length; i++) {
    if (!incomingIdSet.has(existingItems[i].driveFileId)) {
      removed++;
    }
  }

  const hasChanged = added > 0 || removed > 0 || reconciled.length !== existingItems.length;

  return {
    items: reconciled,
    stats: {
      added,
      removed,
      retained,
      total: reconciled.length,
      hasChanged,
    },
  };
}

/**
 * Maximum number of pages to fetch when syncing a Drive folder (safety limit).
 * 100 items per page * 5 pages = up to 500 images per folder.
 */
export const MAX_SYNC_PAGES = 5;

/**
 * Queries Google Drive REST API v3 to list image files within a public folder root.
 * Supports public shared drives, resource keys, subfolder scanning, and Google Workspace links.
 */
export async function fetchDriveFolderImages(folderUrlOrId: string): Promise<DrivePhotoFile[]> {
  const trimmed = folderUrlOrId ? folderUrlOrId.trim() : '';
  const folderId = trimmed.includes('/')
    ? extractDriveFolderId(trimmed)
    : trimmed;

  if (!folderId) {
    throw new Error('Invalid Google Drive folder link or folder ID.');
  }

  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    throw new Error('Google Drive API Key is not configured in VITE_GOOGLE_DRIVE_API_KEY.');
  }

  const resourceKey = extractResourceKey(trimmed);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (resourceKey) {
    headers['X-Goog-Drive-Resource-Keys'] = `${folderId}/${resourceKey}`;
  }

  const query = `'${folderId}' in parents and trashed = false`;
  const fields =
    'nextPageToken,files(id,name,mimeType,thumbnailLink,createdTime,modifiedTime,videoMediaMetadata(durationMillis,width,height))';

  let pageToken: string | undefined = undefined;
  let pageCount = 0;
  const allFiles: DrivePhotoFile[] = [];

  do {
    let endpoint = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=${encodeURIComponent(
      fields
    )}&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${encodeURIComponent(
      apiKey
    )}`;

    if (pageToken) {
      endpoint += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errJson = (await response.json().catch(() => null)) as {
        error?: {
          code?: number;
          message?: string;
          status?: string;
          errors?: Array<{ reason?: string; message?: string }>;
        };
      } | null;

      const errorReason = errJson?.error?.errors?.[0]?.reason || errJson?.error?.status || '';
      const errorMsg = errJson?.error?.message || response.statusText || '';

      if (response.status === 404) {
        throw new Error(`Google Drive folder not found [HTTP 404: ${errorMsg || 'Folder does not exist or has been deleted'}].`);
      }
      if (response.status === 403) {
        if (
          errorReason === 'API_KEY_HTTP_REFERRER_BLOCKED' ||
          errorReason === 'ipRefererBlocked' ||
          errorMsg.toLowerCase().includes('referrer')
        ) {
          throw new Error(
            `Google Cloud API Key Referrer Block [HTTP 403: ${errorMsg}]. Add your deployment domain to allowed HTTP referrers in Google Cloud Console.`
          );
        }
        throw new Error(
          `Access denied [HTTP 403: ${errorMsg || 'Forbidden'}]. Ensure folder General Access is set to "Anyone with the link can view".`
        );
      }
      throw new Error(`Google Drive API error [HTTP ${response.status}]: ${errorMsg}`);
    }

    const data = (await response.json()) as { files?: DrivePhotoFile[]; nextPageToken?: string };
    if (Array.isArray(data.files)) {
      allFiles.push(...data.files);
    }

    pageToken = data.nextPageToken;
    pageCount++;
  } while (pageToken && pageCount < MAX_SYNC_PAGES);

  const isMediaFile = (f: DrivePhotoFile) =>
    Boolean(
      (f.mimeType && (f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/'))) ||
      /\.(jpe?g|png|webp|gif|heic|tiff|bmp|avif|mp4|mov|webm|m4v|avi|mkv)$/i.test(f.name)
    );

  const directImages = allFiles.filter(isMediaFile);

  // If there are subfolders in this directory, probe 1st-level subfolders for images
  const subfolders = allFiles.filter(
    (f) => f.mimeType === 'application/vnd.google-apps.folder'
  );

  if (subfolders.length > 0) {
    const subfolderPromises = subfolders.slice(0, 5).map(async (sub) => {
      const subQuery = `'${sub.id}' in parents and trashed = false`;
      const subEndpoint = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        subQuery
      )}&fields=${encodeURIComponent(
        fields
      )}&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${encodeURIComponent(
        apiKey
      )}`;
      const subResp = await fetch(subEndpoint, { method: 'GET', headers });
      if (!subResp.ok) {
        throw new Error(
          `Google Drive subfolder scan failed for "${sub.name}" [HTTP ${subResp.status}: ${subResp.statusText || 'Error'}].`
        );
      }
      const subData = (await subResp.json()) as { files?: DrivePhotoFile[] };
      return (subData.files ?? []).filter(isMediaFile);
    });

    const subfolderResults = await Promise.all(subfolderPromises);
    for (const subImages of subfolderResults) {
      directImages.push(...subImages);
    }
  }

  return directImages;
}

/**
 * High-level orchestration function for syncing a gallery's Google Drive folder.
 *
 * 1. Fetches image files from Google Drive REST API v3
 * 2. Reconciles incoming files with existing synced items (O(1) Map diff)
 * 3. Returns the reconciled items, diff stats, and verification timestamp
 *    for direct persistence onto GalleryElement in the NodeCanvasDocument AST.
 */
export async function syncFolderPhotos(
  pointId: string,
  folderUrl: string,
  existingPhotos: SyncedSourceItem[] = []
): Promise<SyncFolderPhotosResult> {
  if (!pointId || typeof pointId !== 'string' || !pointId.trim()) {
    throw new Error('Invalid pointId: must be a non-empty string.');
  }

  if (!folderUrl || typeof folderUrl !== 'string' || !folderUrl.trim()) {
    throw new Error('Invalid folderUrl: must be a non-empty Google Drive folder URL.');
  }

  const trimmedPointId = pointId.trim();
  const trimmedFolderUrl = folderUrl.trim();

  // 1. Fetch images from Google Drive API v3
  const incomingFiles = await fetchDriveFolderImages(trimmedFolderUrl);

  // 2. Perform differential reconciliation
  const reconciliation = reconcileDrivePhotos(existingPhotos, incomingFiles, trimmedPointId);

  return {
    items: reconciliation.items,
    stats: reconciliation.stats,
    lastVerified: new Date().toISOString(),
  };
}
