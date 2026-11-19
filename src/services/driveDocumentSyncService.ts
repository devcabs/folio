/**
 * Drive Document Synchronization & Differential Reconciliation Service
 * Folio Engine
 *
 * Implements Subtask 11.4:
 * - O(1) Map-based Differential Reconciliation of Google Drive PDFs with document records
 * - Identity preservation and coordinator custom-title retention
 * - Natural numeric filename sorting (reusing compareNaturalFilenames)
 * - Machine filename auto-cleaning into editorial titles
 * - Official Google Drive preview and view URL construction
 * - Google Drive REST API v3 PDF Fetcher (including 1st-level subfolders)
 */

import { extractDriveFolderId, extractResourceKey } from './driveVerificationService';
import { compareNaturalFilenames, MAX_SYNC_PAGES } from './drivePhotoSyncService';
import type {
  DriveDocumentFile,
  SyncedDocumentItem,
  DriveDocumentReconciliationResult,
  SyncFolderDocumentsResult,
} from '../types/source';
import { buildDrivePreviewUrl, buildDriveViewUrl } from '../utils/mediaUrl';

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
 * Strips .pdf extension, machine prefixes (DOC_, PDF_, numeric prefixes),
 * and underscores/hyphens into a clean editorial document title.
 */
export function cleanDriveDocumentName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return 'Official Document';
  }

  let cleaned = rawName.replace(/\.pdf$/i, '');
  cleaned = cleaned.replace(/^(?:DOC|PDF)[\s_-]+/i, '');
  cleaned = cleaned.replace(/^\d+[\s_-]+/, '');
  cleaned = cleaned.replace(/[_-]+/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned.length > 0 ? cleaned : 'Official Document';
}

/**
 * Pure O(1) Map Differential Reconciliation Engine for Google Drive PDF files.
 * Preserves existing custom titles (isCustomTitle: true) and captions.
 */
export function reconcileDriveDocuments(
  existingItems: SyncedDocumentItem[],
  incomingFiles: DriveDocumentFile[],
  pointId: string
): DriveDocumentReconciliationResult {
  if (existingItems.length === 0 && incomingFiles.length === 0) {
    return {
      items: [],
      stats: { added: 0, removed: 0, retained: 0, total: 0, hasChanged: false },
    };
  }

  const existingMap = new Map<string, SyncedDocumentItem>();
  for (let i = 0; i < existingItems.length; i++) {
    existingMap.set(existingItems[i].driveFileId, existingItems[i]);
  }

  const sortedFiles = [...incomingFiles].sort((a, b) =>
    compareNaturalFilenames(a.name, b.name)
  );

  const incomingIdSet = new Set<string>();
  const reconciled: SyncedDocumentItem[] = [];
  let added = 0;
  let retained = 0;

  for (let i = 0; i < sortedFiles.length; i++) {
    const file = sortedFiles[i];
    incomingIdSet.add(file.id);

    const existing = existingMap.get(file.id);
    const previewUrl = buildDrivePreviewUrl(file.id);
    const viewUrl = buildDriveViewUrl(file.id);

    if (existing) {
      retained++;
      reconciled.push({
        ...existing,
        orderIndex: i,
        previewUrl,
        viewUrl,
        ...(file.size !== undefined ? { size: file.size } : {}),
      });
    } else {
      added++;
      const cleanTitle = cleanDriveDocumentName(file.name);
      const dateIso = file.createdTime ? file.createdTime.split('T')[0] : undefined;
      reconciled.push({
        id: `drive-doc-${file.id}`,
        pointId,
        driveFileId: file.id,
        originalFileName: file.name,
        title: cleanTitle,
        previewUrl,
        viewUrl,
        orderIndex: i,
        isCustomTitle: false,
        ...(dateIso ? { date: dateIso, dateStamp: dateIso } : {}),
        ...(file.size !== undefined ? { size: file.size } : {}),
      });
    }
  }

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

function isPdfFile(file: DriveDocumentFile): boolean {
  if (file.mimeType === 'application/vnd.google-apps.folder') {
    return false;
  }
  return Boolean(
    file.mimeType === 'application/pdf' ||
      (file.name && /\.pdf$/i.test(file.name))
  );
}

/**
 * Queries Google Drive REST API v3 to list PDF files (mimeType === 'application/pdf'
 * or /\.pdf$/i) within a public Drive folder and its 1st-level subfolders.
 */
export async function fetchDriveFolderPdfs(
  folderUrlOrId: string
): Promise<DriveDocumentFile[]> {
  const trimmed = folderUrlOrId ? folderUrlOrId.trim() : '';
  const folderId = trimmed.includes('/') ? extractDriveFolderId(trimmed) : trimmed;

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
    'nextPageToken,files(id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime)';

  let pageToken: string | undefined = undefined;
  let pageCount = 0;
  const allFiles: DriveDocumentFile[] = [];

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
        throw new Error(
          `Google Drive folder not found [HTTP 404: ${
            errorMsg || 'Folder does not exist or has been deleted'
          }].`
        );
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
          `Access denied [HTTP 403: ${
            errorMsg || 'Forbidden'
          }]. Ensure folder General Access is set to "Anyone with the link can view".`
        );
      }
      throw new Error(`Google Drive API error [HTTP ${response.status}]: ${errorMsg}`);
    }

    const data = (await response.json()) as {
      files?: DriveDocumentFile[];
      nextPageToken?: string;
    };
    if (Array.isArray(data.files)) {
      allFiles.push(...data.files);
    }

    pageToken = data.nextPageToken;
    pageCount++;
  } while (pageToken && pageCount < MAX_SYNC_PAGES);

  const directPdfs = allFiles.filter(isPdfFile);

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
          `Google Drive subfolder scan failed for "${sub.name}" [HTTP ${subResp.status}: ${
            subResp.statusText || 'Error'
          }].`
        );
      }
      const subData = (await subResp.json()) as { files?: DriveDocumentFile[] };
      return (subData.files ?? []).filter(isPdfFile);
    });

    const subfolderResults = await Promise.all(subfolderPromises);
    for (const subPdfs of subfolderResults) {
      directPdfs.push(...subPdfs);
    }
  }

  return directPdfs;
}

/**
 * High-level orchestration function for syncing a DocumentsElement's Google Drive folder.
 */
export async function syncFolderDocuments(
  pointId: string,
  folderUrl: string,
  existingDocuments: SyncedDocumentItem[] = []
): Promise<SyncFolderDocumentsResult> {
  if (!pointId || typeof pointId !== 'string' || !pointId.trim()) {
    throw new Error('Invalid pointId: must be a non-empty string.');
  }

  if (!folderUrl || typeof folderUrl !== 'string' || !folderUrl.trim()) {
    throw new Error('Invalid folderUrl: must be a non-empty Google Drive folder URL.');
  }

  const trimmedPointId = pointId.trim();
  const trimmedFolderUrl = folderUrl.trim();

  const incomingFiles = await fetchDriveFolderPdfs(trimmedFolderUrl);
  const reconciliation = reconcileDriveDocuments(
    existingDocuments,
    incomingFiles,
    trimmedPointId
  );

  return {
    items: reconciliation.items,
    stats: reconciliation.stats,
    lastVerified: new Date().toISOString(),
  };
}
