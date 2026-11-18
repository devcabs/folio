/**
 * Google Sheets Access Verification & Tab Discovery Service
 * Folio Engine
 * Document Reference: docs/tasks/task7_2_access_verification_sheets_api.md
 *
 * Implements:
 * 1. Pre-flight link access verification: Validates public read access via GViz probe
 *    (with optional Sheets API v4 metadata check) and produces tailored sharing guidance.
 * 2. Automatic Sheet Tab Discovery: Discovers tab names and sheet IDs (GIDs) via
 *    public htmlview metadata (or Sheets API v4 when enabled) without requiring a Sheets API key.
 */

export interface SheetMetadataTab {
  title: string;
  sheetId: number;
  index: number;
}

export interface SheetAccessCheckResult {
  accessible: boolean;
  spreadsheetId: string | null;
  sheetGid?: string | null;
  title?: string;
  error?: string;
  tabs?: SheetMetadataTab[];
  modifiedTime?: string;
}

/**
 * Extracts Google Spreadsheet ID from diverse URL patterns:
 * - https://docs.google.com/spreadsheets/d/{id}/edit#gid=0
 * - https://docs.google.com/spreadsheets/d/{id}/export?format=csv
 * - https://docs.google.com/spreadsheets/d/{id}/gviz/tq?tqx=out:csv
 * - https://docs.google.com/spreadsheets/u/0/d/{id}/view
 * - Raw spreadsheet ID (25+ alphanumeric characters with dashes/underscores)
 */
export function extractSpreadsheetId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  // Pattern 1: Standard /spreadsheets/d/{id} or /spreadsheets/u/{n}/d/{id}
  const matchPath = trimmed.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]{20,})/);
  if (matchPath && matchPath[1]) {
    return matchPath[1];
  }

  // Pattern 2: Raw spreadsheet ID (Google Spreadsheet IDs are base64-like strings >= 25 chars)
  if (/^[a-zA-Z0-9-_]{25,80}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Extracts sheet tab GID (numerical identifier) from URL hash or query parameters:
 * - #gid=123456789
 * - ?gid=123456789
 */
export function extractSheetGid(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  const match = url.match(/[#?&]gid=([0-9]+)/);
  return match && match[1] ? match[1] : null;
}

/**
 * Retrieves configured Google API key defensively from Vite or Node runtime.
 */
export function getGoogleApiKey(): string | null {
  const key =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_DRIVE_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_GOOGLE_DRIVE_API_KEY) ||
    '';

  if (key && !key.includes('your-google-drive-api-key') && key.trim().length > 10) {
    return key.trim();
  }
  return null;
}

/**
 * Pure parser for Google Sheets API v4 metadata response.
 */
export function parseSheetsApiMetadata(data: unknown): SheetMetadataTab[] {
  if (!data || typeof data !== 'object') return [];

  const rawSheets = (data as { sheets?: unknown[] }).sheets;
  if (!Array.isArray(rawSheets)) return [];

  const tabs: SheetMetadataTab[] = [];

  for (let i = 0; i < rawSheets.length; i++) {
    const sheet = rawSheets[i] as {
      properties?: {
        title?: string;
        sheetId?: number | string;
        index?: number;
      };
    };

    if (sheet && sheet.properties && typeof sheet.properties.title === 'string') {
      const title = sheet.properties.title.trim();
      const rawId = sheet.properties.sheetId;
      const sheetId = typeof rawId === 'number' ? rawId : Number(rawId) || 0;
      const index = typeof sheet.properties.index === 'number' ? sheet.properties.index : i;

      tabs.push({ title, sheetId, index });
    }
  }

  return tabs;
}

/**
 * Pure parser for tab names and sheet GIDs from public Google Sheets htmlview payload.
 * Google embeds workbook sheets as:
 * items.push({name: "Sheet1", pageUrl: "...", gid: "0", ...})
 */
export function parseHtmlViewTabs(html: string): SheetMetadataTab[] {
  if (!html || typeof html !== 'string') return [];

  const regex = /items\.push\(\{\s*name:\s*"([^"\\]*(?:\\.[^"\\]*)*)"[^}]*gid:\s*"([0-9-]+)"/g;
  let match: RegExpExecArray | null;
  const tabs: SheetMetadataTab[] = [];

  while ((match = regex.exec(html)) !== null) {
    let title = match[1];
    try {
      title = JSON.parse(`"${title}"`);
    } catch {
      // keep raw string if JSON unescape fails
    }
    const rawGid = match[2];
    const sheetId = Number(rawGid) || 0;
    tabs.push({
      title: title.trim(),
      sheetId,
      index: tabs.length,
    });
  }

  return tabs;
}

/**
 * Discovers available sheet tabs using:
 * 1. Public htmlview tab metadata (no Google Sheets API required, works for any public sheet).
 * 2. Optional Google Sheets API v4 metadata endpoint if enabled.
 */
export async function fetchSheetTabs(
  spreadsheetIdOrUrl: string,
  apiKey?: string,
  options?: { timeoutMs?: number }
): Promise<SheetMetadataTab[]> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl) || spreadsheetIdOrUrl;
  if (!spreadsheetId) {
    return [];
  }

  const timeoutMs = options?.timeoutMs ?? 6000;

  // Primary: Public htmlview tab discovery (works without Google Sheets API enabled)
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const htmlUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
      spreadsheetId
    )}/htmlview`;

    const response = await fetch(htmlUrl, {
      method: 'GET',
      headers: { Accept: 'text/html,*/*' },
      signal: controller?.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (response.ok) {
      const htmlText = await response.text();
      const tabs = parseHtmlViewTabs(htmlText);
      if (tabs && tabs.length > 0) {
        return tabs;
      }
    }
  } catch {
    // Fall through to optional API check
  }

  // Secondary fallback: Google Sheets API v4 if an API key with Sheets scope is provided
  const key = apiKey !== undefined ? apiKey : getGoogleApiKey();
  if (key) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}?fields=properties.title,sheets.properties&key=${encodeURIComponent(key)}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller?.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const tabs = parseSheetsApiMetadata(data);
        if (tabs && tabs.length > 0) {
          return tabs;
        }
      }
    } catch {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  return [];
}

/**
 * Verifies public readability of a Google Sheet link.
 *
 * Uses the public GViz CSV probe (matching fetchLiveSheetMatrix) as the authoritative check
 * for "Anyone with the link can view", plus /htmlview tab discovery and Drive API modifiedTime.
 */
export async function verifySheetAccess(
  url: string,
  options?: { apiKey?: string; timeoutMs?: number }
): Promise<SheetAccessCheckResult> {
  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) {
    return {
      accessible: false,
      spreadsheetId: null,
      error: 'Invalid Google Sheets URL format. Please paste a valid Google Spreadsheet link.',
    };
  }

  const sheetGid = extractSheetGid(url);
  const timeoutMs = options?.timeoutMs ?? 6000;

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const probeUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
      spreadsheetId
    )}/gviz/tq?tqx=out:csv&tq=SELECT+1+LIMIT+1`;

    const response = await fetch(probeUrl, {
      method: 'GET',
      headers: { Accept: 'text/csv,text/plain,*/*' },
      signal: controller?.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        accessible: false,
        spreadsheetId,
        sheetGid,
        error: "Access Restricted: Please set Google Sheet sharing to 'Anyone with the link can view'.",
      };
    }

    const text = await response.text();

    // If redirected to login page or HTML payload returned
    if (
      text.includes('<!DOCTYPE html') ||
      text.includes('ServiceLogin') ||
      text.includes('accounts.google.com')
    ) {
      return {
        accessible: false,
        spreadsheetId,
        sheetGid,
        error: "Access Restricted: Please set Google Sheet sharing to 'Anyone with the link can view'.",
      };
    }

    const [tabs, modifiedTime] = await Promise.all([
      fetchSheetTabs(spreadsheetId, options?.apiKey, { timeoutMs: 4000 }),
      fetchSheetModifiedTime(spreadsheetId, options?.apiKey, { timeoutMs: 4000 }),
    ]);

    return {
      accessible: true,
      spreadsheetId,
      sheetGid,
      tabs: tabs.length > 0 ? tabs : undefined,
      modifiedTime: modifiedTime || undefined,
    };
  } catch {
    return {
      accessible: false,
      spreadsheetId,
      sheetGid,
      error: "Unable to verify sheet access. Ensure the sheet is public and shared with 'Anyone with the link can view'.",
    };
  }
}

/**
 * Formats an ISO 8601 modified timestamp into human-readable academic format (e.g. "Oct 14, 2024").
 */
export function formatSheetModifiedTime(isoDate?: string | null): string | null {
  if (!isoDate || typeof isoDate !== 'string') return null;
  const parsed = new Date(isoDate);
  if (isNaN(parsed.getTime())) return null;

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    }).format(parsed);
  } catch {
    return null;
  }
}

/**
 * Fetches the authentic last modification date of a Google Sheet via Google Drive API v3.
 */
export async function fetchSheetModifiedTime(
  spreadsheetIdOrUrl: string,
  apiKey?: string,
  options?: { timeoutMs?: number }
): Promise<string | null> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl) || spreadsheetIdOrUrl;
  if (!spreadsheetId) return null;

  const key = apiKey || getGoogleApiKey();
  if (!key) return null;

  const timeoutMs = options?.timeoutMs ?? 5000;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      spreadsheetId
    )}?fields=modifiedTime&key=${encodeURIComponent(key)}`;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (typeof window === 'undefined') {
      headers['Referer'] = 'https://engine.example.com';
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller?.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as { modifiedTime?: string };
      if (data && typeof data.modifiedTime === 'string') {
        return data.modifiedTime;
      }
    }
    return null;
  } catch {
    if (timeoutId) clearTimeout(timeoutId);
    return null;
  }
}
