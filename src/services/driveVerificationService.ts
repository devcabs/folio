/**
 * Drive Verification Service
 * Folio Engine
 * Automated Google Drive MOV Repository & Folder Verification
 *
 * Implements a hybrid verification engine:
 * 1. Google Drive REST API v3: Directly verifies folder existence, public accessibility,
 *    and extracts official folder titles.
 * 2. Graceful Fallback: Handles offline, quota, or network restrictions without blocking coordinators.
 */

import { GOOGLE_DRIVE_FOLDER_REGEX } from '../utils/source';

export interface DriveVerificationResult {
  status: 'valid' | 'restricted' | 'not_a_folder' | 'unverified' | 'invalid_format';
  folderId?: string;
  folderTitle?: string;
  mimeType?: string;
  message?: string;
  apiError?: {
    statusCode?: number;
    reason?: string;
    rawMessage?: string;
  };
}

/**
 * Extracts canonical Google Drive folder ID from a URL.
 */
export function extractDriveFolderId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.trim().match(GOOGLE_DRIVE_FOLDER_REGEX);
  return match && match[1] ? match[1] : null;
}

/**
 * Safely accesses configured Google Drive API Key.
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
 * Extracts optional Google Drive resource key from URL query parameters.
 */
export function extractResourceKey(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/[?&]resourcekey=([a-zA-Z0-9_-]+)/);
  return match && match[1] ? match[1] : null;
}

/**
 * Automatically verifies a Google Drive folder URL:
 * - Checks if the folder exists
 * - Verifies that it is publicly accessible ("Anyone with the link can view")
 * - Supports Google Workspace Shared Drives (supportsAllDrives=true)
 * - Detects API Key / deployment referrer restrictions and falls back gracefully
 * - Formats explicit diagnostic edge error details (HTTP codes, API messages, network issues)
 * - Discovers the folder's official title
 * - Verifies that it is actually a folder (not a lone file)
 */
export async function verifyDriveFolderUrl(url: string): Promise<DriveVerificationResult> {
  const folderId = extractDriveFolderId(url);
  if (!folderId) {
    return {
      status: 'invalid_format',
      message: 'Invalid URL format. Please paste a Google Drive folder link.',
    };
  }

  const apiKey = getGoogleApiKey();

  // Tier 1: Official Google Drive REST API v3
  if (apiKey) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

      const resourceKey = extractResourceKey(url);
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (resourceKey) {
        headers['X-Goog-Drive-Resource-Keys'] = `${folderId}/${resourceKey}`;
      }

      // supportsAllDrives=true and includeItemsFromAllDrives=true are mandatory
      // for Google Workspace Shared Drives (e.g. / organization accounts).
      const endpoint = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        folderId
      )}?fields=id,name,mimeType&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${encodeURIComponent(
        apiKey
      )}`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: controller?.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as { id: string; name: string; mimeType: string };
        const isFolder = data.mimeType === 'application/vnd.google-apps.folder';

        if (!isFolder) {
          return {
            status: 'not_a_folder',
            folderId: data.id,
            folderTitle: data.name,
            mimeType: data.mimeType,
            message: `Notice: This link points to an individual file ("${data.name}"), not a folder archive.`,
          };
        }

        return {
          status: 'valid',
          folderId: data.id,
          folderTitle: data.name,
          mimeType: data.mimeType,
          message: `Publicly accessible folder verified: "${data.name}"`,
        };
      }

      // Check error details returned by Google
      const errJson = (await response.json().catch(() => null)) as {
        error?: {
          code?: number;
          message?: string;
          status?: string;
          errors?: Array<{ reason?: string; message?: string }>;
        };
      } | null;

      const errorReason = errJson?.error?.errors?.[0]?.reason || errJson?.error?.status || '';
      const errorMessage = errJson?.error?.message || response.statusText || '';

      // Check for API Key / deployment infrastructure errors:
      // (e.g. HTTP Referrer blocked on deployment domain, quota exceeded, Drive API disabled on project)
      const isApiKeyOrInfrastructureIssue =
        errorReason === 'API_KEY_HTTP_REFERRER_BLOCKED' ||
        errorReason === 'ipRefererBlocked' ||
        errorReason === 'accessNotConfigured' ||
        errorReason === 'SERVICE_DISABLED' ||
        errorReason === 'keyInvalid' ||
        errorReason === 'dailyLimitExceeded' ||
        errorReason === 'rateLimitExceeded' ||
        errorReason === 'userRateLimitExceeded' ||
        errorMessage.toLowerCase().includes('referrer') ||
        errorMessage.toLowerCase().includes('api key') ||
        errorMessage.toLowerCase().includes('quota') ||
        errorMessage.toLowerCase().includes('blocked');

      if (isApiKeyOrInfrastructureIssue) {
        const diagInfo = errorMessage ? `[API Key: ${errorMessage}]` : `[API Reason: ${errorReason}]`;
        console.warn(
          '[DriveVerification] Google Drive API Key or Referrer restriction detected:',
          errorMessage || errorReason
        );
        return {
          status: 'unverified',
          folderId,
          message: `Folder format is valid, but Google Drive API reported a key/referrer issue ${diagInfo}. Ensure access is set to "Anyone with the link can view".`,
          apiError: {
            statusCode: response.status,
            reason: errorReason,
            rawMessage: errorMessage,
          },
        };
      }

      // Secondary probe for public folders if files.get returned 404 (e.g. shared link without metadata permission):
      // Try querying if child files or images are listable under this parent folder
      if (response.status === 404) {
        try {
          const listEndpoint = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
            `'${folderId}' in parents and trashed = false`
          )}&pageSize=1&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${encodeURIComponent(
            apiKey
          )}`;
          const listResp = await fetch(listEndpoint, { method: 'GET', headers });
          if (listResp.ok) {
            return {
              status: 'valid',
              folderId,
              message: 'Publicly accessible folder verified.',
            };
          }
        } catch {
          // Probe failed
        }
      }

      if (response.status === 403) {
        const reasonDetail = errorMessage ? ` [HTTP 403: ${errorMessage}]` : ' [HTTP 403: Forbidden]';
        return {
          status: 'restricted',
          folderId,
          message: `Folder is restricted or requires login${reasonDetail}. Set General Access to "Anyone with the link can view".`,
          apiError: {
            statusCode: 403,
            reason: errorReason,
            rawMessage: errorMessage,
          },
        };
      }

      if (response.status === 404) {
        const reasonDetail = errorMessage ? ` [HTTP 404: ${errorMessage}]` : ' [HTTP 404: Not Found]';
        return {
          status: 'restricted',
          folderId,
          message: `Folder not found or inaccessible via API${reasonDetail}. Set General Access to "Anyone with the link can view".`,
          apiError: {
            statusCode: 404,
            reason: errorReason,
            rawMessage: errorMessage,
          },
        };
      }

      // Other non-OK status codes (e.g. 500, 502, 503)
      return {
        status: 'unverified',
        folderId,
        message: `Folder link format is valid, but Google Drive API returned HTTP ${response.status} (${errorMessage || 'Unexpected error'}). Ensure access is set to "Anyone with the link can view".`,
        apiError: {
          statusCode: response.status,
          reason: errorReason,
          rawMessage: errorMessage,
        },
      };
    } catch (err) {
      // Diagnostic network/CORS fallback
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const netMsg = isAbort
        ? 'Request timed out (6s)'
        : err instanceof Error
          ? err.message
          : 'Network or CORS connection error';

      return {
        status: 'unverified',
        folderId,
        message: `Folder link format is valid, but Google Drive API could not be reached [Network/CORS: ${netMsg}]. Ensure access is set to "Anyone with the link can view".`,
        apiError: {
          rawMessage: netMsg,
        },
      };
    }
  }

  // Tier 2: Resilient syntax fallback when no API key is available
  return {
    status: 'unverified',
    folderId,
    message: 'Folder link format is valid [No API Key configured]. Ensure access is set to "Anyone with the link can view".',
  };
}
