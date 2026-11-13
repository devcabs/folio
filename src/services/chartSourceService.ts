/**
 * Supabase Cloud Storage & Chart Source Persistence Service
 * Folio Engine
 * Document Reference: docs/tasks/task7_2_access_verification_sheets_api.md
 *
 * Implements:
 * 1. PostgREST / Supabase persistence for live chart configurations.
 * 2. Instant-paint client cache backed by localStorage.
 * 3. Zero-leak data security enforcement (internal Google Sheet URLs are stripped
 *    for public consumers).
 * 4. Fault-tolerant offline and fallback handling.
 */

import type { SheetChartConfig } from '../types/chart';
import type { NodeCode } from '../types/node';
import { getStorageNamespace } from '../config/engine.config';

export const getChartSourcePrefix = (ns?: string) => (ns || getStorageNamespace()) + '_chart_source_';
export const LOCAL_STORAGE_PREFIX = getChartSourcePrefix();
export const getChartSourcesManifestKey = (ns?: string) => (ns || getStorageNamespace()) + '_chart_sources_manifest';
export const LOCAL_STORAGE_ALL_KEY = getChartSourcesManifestKey();
export const EVENT_CHART_SOURCE_CHANGE = 'engine-chart-source-change';

/**
 * Helper to dispatch window events for live reactivity across chart components.
 */
export function notifyChartChange(chartId: string, config: SheetChartConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_CHART_SOURCE_CHANGE, {
        detail: { chartId, config },
      })
    );
  } catch {
    // Non-browser or restricted context
  }
}

/**
 * Publicly safe version of SheetChartConfig with private Google Sheet URL omitted.
 */
export type PublicChartConfig = Omit<SheetChartConfig, 'sheetUrl'>;

export interface ChartSourceDbRow {
  chart_id: string;
  node_id: string;
  sheet_url: string;
  tab_name?: string | null;
  sheet_gid?: string | null;
  range?: string | null;
  default_type?: string | null;
  title_override?: string | null;
  subtitle_override?: string | null;
  unit_override?: string | null;
  visual_config?: Record<string, unknown> | null;
  cached_dataset?: (string | number | null)[][] | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

// In-memory runtime cache
const memoryCache = new Map<string, SheetChartConfig>();

import { getSupabaseConfig } from '../utils/supabase-config';
export { getSupabaseConfig };

/**
 * Safe local storage reader.
 */
function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safe local storage writer with quota failure detection.
 */
function setStorageItem(key: string, value: string): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Safe local storage remover.
 */
function removeStorageItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore exceptions
  }
}

/**
 * Maps database record to typed client model.
 */
export function mapDbRowToChartConfig(row: ChartSourceDbRow): SheetChartConfig {
  const rowVisualConfig = (row.visual_config as Record<string, unknown>) ?? {};
  const embeddedDataset = rowVisualConfig.__cached_dataset as (string | number | null)[][] | undefined;
  const visualConfig = { ...rowVisualConfig };
  delete visualConfig.__cached_dataset;

  return {
    chartId: row.chart_id,
    nodeId: (row.node_id || 'access') as NodeCode,
    sheetUrl: row.sheet_url,
    tabName: row.tab_name ?? undefined,
    sheetGid: row.sheet_gid ?? undefined,
    range: row.range ?? undefined,
    defaultType: (row.default_type as SheetChartConfig['defaultType']) || 'bar',
    titleOverride: row.title_override ?? undefined,
    subtitleOverride: row.subtitle_override ?? undefined,
    unitOverride: row.unit_override ?? undefined,
    visualConfig: visualConfig as SheetChartConfig['visualConfig'],
    cachedDataset: row.cached_dataset ?? embeddedDataset ?? null,
    updatedAt: row.updated_at ?? new Date().toISOString(),
    updatedBy: row.updated_by ?? 'coordinator',
  };
}

/**
 * Maps client model to database record payload.
 */
export function mapChartConfigToDbRow(config: SheetChartConfig): ChartSourceDbRow {
  const visualConfig = {
    ...((config.visualConfig as Record<string, unknown>) ?? {}),
    ...(config.cachedDataset ? { __cached_dataset: config.cachedDataset } : {}),
  };
  return {
    chart_id: config.chartId,
    node_id: config.nodeId,
    sheet_url: config.sheetUrl,
    tab_name: config.tabName ?? null,
    sheet_gid: config.sheetGid ?? null,
    range: config.range ?? null,
    default_type: config.defaultType || 'bar',
    title_override: config.titleOverride ?? null,
    subtitle_override: config.subtitleOverride ?? null,
    unit_override: config.unitOverride ?? null,
    visual_config: visualConfig,
    cached_dataset: config.cachedDataset ?? null,
    updated_at: config.updatedAt || new Date().toISOString(),
    updated_by: config.updatedBy || 'coordinator',
  };
}

/**
 * Strips internal Google Sheet URL for public/client presentations (Zero-Leak Security).
 */
export function sanitizePublicChartConfig(config: SheetChartConfig): PublicChartConfig {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sheetUrl, ...safeConfig } = config;
  return safeConfig;
}

/**
 * Loads a cached chart configuration from memory or local storage.
 */
export function getCachedChartConfig(chartId: string): SheetChartConfig | null {
  if (memoryCache.has(chartId)) {
    return memoryCache.get(chartId)!;
  }

  const raw = getStorageItem(`${getChartSourcePrefix()}${chartId}`);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SheetChartConfig;
      memoryCache.set(chartId, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  return null;
}

export interface SetCachedChartConfigOptions {
  memoryOnly?: boolean;
}

/**
 * Saves a chart configuration to memory and optionally local storage.
 * When options.memoryOnly is true, skips localStorage writes to enforce storage purity for public visits.
 * Returns true if stored locally (or in memory in non-browser environments).
 */
export function setCachedChartConfig(
  config: SheetChartConfig,
  options?: SetCachedChartConfigOptions
): boolean {
  if (!config || !config.chartId) return false;
  memoryCache.set(config.chartId, config);

  if (options?.memoryOnly) {
    notifyChartChange(config.chartId, config);
    return true;
  }

  const stored = setStorageItem(`${getChartSourcePrefix()}${config.chartId}`, JSON.stringify(config));

  // Update known IDs manifest
  try {
    const manifestKey = getChartSourcesManifestKey();
    const rawList = getStorageItem(manifestKey);
    const idList: string[] = rawList ? JSON.parse(rawList) : [];
    if (!idList.includes(config.chartId)) {
      idList.push(config.chartId);
      setStorageItem(manifestKey, JSON.stringify(idList));
    }
  } catch {
    // Ignore error
  }

  notifyChartChange(config.chartId, config);

  return stored || typeof window === 'undefined';
}

/**
 * Asynchronously fetches a chart configuration from Supabase or local cache.
 */
export async function fetchChartConfig(
  chartId: string,
  options?: { forceRefresh?: boolean }
): Promise<SheetChartConfig | null> {
  if (!chartId) return null;

  // 1. Check local cache first unless refresh is forced
  if (!options?.forceRefresh) {
    const cached = getCachedChartConfig(chartId);
    if (cached) return cached;
  }

  // 2. Query Supabase PostgREST if configured
  const config = getSupabaseConfig();
  if (config) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

      const endpoint = `${config.url}/rest/v1/chart_sources?chart_id=eq.${encodeURIComponent(
        chartId
      )}&select=*`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller?.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        const rows = (await response.json()) as ChartSourceDbRow[];
        if (Array.isArray(rows) && rows.length > 0) {
          const clientConfig = mapDbRowToChartConfig(rows[0]);
          setCachedChartConfig(clientConfig);
          return clientConfig;
        }
      }
    } catch {
      // Return cached fallback on network issues
    }
  }

  return getCachedChartConfig(chartId);
}

/**
 * Fetches all chart configurations belonging to a specific node.
 */
export async function fetchChartConfigsByNode(
  nodeId: NodeCode,
  _options?: { forceRefresh?: boolean }
): Promise<SheetChartConfig[]> {
  const config = getSupabaseConfig();
  if (config) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

      const endpoint = `${config.url}/rest/v1/chart_sources?node_id=eq.${encodeURIComponent(
        nodeId
      )}&select=*`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller?.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        const rows = (await response.json()) as ChartSourceDbRow[];
        if (Array.isArray(rows)) {
          const configs = rows.map(mapDbRowToChartConfig);
          for (const item of configs) {
            setCachedChartConfig(item);
          }
          return configs;
        }
      }
    } catch {
      // Fall through to local cache scan
    }
  }

  // Scan cached items matching node
  const results: SheetChartConfig[] = [];
  try {
    const rawList = getStorageItem(getChartSourcesManifestKey());
    const idList: string[] = rawList ? JSON.parse(rawList) : [];
    for (const id of idList) {
      const item = getCachedChartConfig(id);
      if (item && item.nodeId === nodeId) {
        results.push(item);
      }
    }
  } catch {
    // Ignore error
  }

  return results;
}

/**
 * Detailed outcome of persisting chart configuration across local and cloud stores.
 */
export interface SaveChartConfigResult {
  /**
   * Whether the configuration was persisted (at least locally).
   */
  success: boolean;
  /**
   * Whether the configuration was saved to local browser storage / memory cache.
   */
  savedLocally: boolean;
  /**
   * Whether the configuration was synced to Supabase cloud.
   */
  savedToCloud: boolean;
  /**
   * Diagnostic error explanation with specific cause.
   */
  error?: string;
  /**
   * Diagnostic error code (e.g. PGRST205, HTTP_404, AUTH_FORBIDDEN, NETWORK_ERROR, QUOTA_EXCEEDED).
   */
  errorCode?: string;
  /**
   * HTTP status code if rejected by remote server.
   */
  statusCode?: number;
  /**
   * Additional diagnostic details or server hints.
   */
  details?: string;
}

/**
 * Persists chart configuration with granular diagnostics and variance reporting.
 */
export async function saveChartConfigDetailed(
  config: SheetChartConfig,
  token?: string
): Promise<SaveChartConfigResult> {
  if (!config || !config.chartId) {
    return {
      success: false,
      savedLocally: false,
      savedToCloud: false,
      error: 'Chart ID is missing or undefined.',
      errorCode: 'MISSING_CHART_ID',
    };
  }

  if (!config.sheetUrl || !config.sheetUrl.trim()) {
    return {
      success: false,
      savedLocally: false,
      savedToCloud: false,
      error: 'Google Sheet URL is required.',
      errorCode: 'MISSING_SHEET_URL',
    };
  }

  const updatedConfig: SheetChartConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };

  // 1. Instant local persistence
  const savedLocally = setCachedChartConfig(updatedConfig);

  // 2. Persist to Supabase if configured
  const sbConfig = getSupabaseConfig();
  if (!sbConfig) {
    return {
      success: savedLocally,
      savedLocally,
      savedToCloud: false,
      details: 'Offline mode: Supabase cloud is not configured.',
    };
  }

  try {
    const authToken = token || sbConfig.anonKey;
    const dbRow = mapChartConfigToDbRow(updatedConfig);

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

    let response: Response;
    try {
      response = await fetch(`${sbConfig.url}/rest/v1/chart_sources`, {
        method: 'POST',
        headers: {
          apikey: sbConfig.anonKey,
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(dbRow),
        signal: controller?.signal,
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    if (response.ok) {
      return {
        success: true,
        savedLocally,
        savedToCloud: true,
      };
    }

    // Parse diagnostic error information from Supabase
    let errPayload: { code?: string; message?: string; details?: string; hint?: string } | null = null;
    let errRawText = '';
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        errPayload = await response.json();
      } else {
        errRawText = await response.text();
      }
    } catch {
      // Body reading fallback
    }

    const statusCode = response.status;
    const errorCode = errPayload?.code;
    const serverMessage = errPayload?.message || errRawText || response.statusText;

    // Schema resilience: If remote Supabase schema cache does not yet have 'cached_dataset' column,
    // automatically retry the write omitting 'cached_dataset'. The dataset remains safely preserved
    // in visual_config.__cached_dataset and local storage until the database migration is applied.
    if (
      statusCode === 400 &&
      dbRow.cached_dataset !== undefined &&
      serverMessage.includes('cached_dataset') &&
      serverMessage.includes('column')
    ) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { cached_dataset: _omitted, ...rowWithoutCachedDataset } = dbRow;
        const retryController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const retryTimeoutId = retryController ? setTimeout(() => retryController.abort(), 8000) : null;
        let retryResponse: Response;
        try {
          retryResponse = await fetch(`${sbConfig.url}/rest/v1/chart_sources`, {
            method: 'POST',
            headers: {
              apikey: sbConfig.anonKey,
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=representation',
            },
            body: JSON.stringify(rowWithoutCachedDataset),
            signal: retryController?.signal,
          });
        } finally {
          if (retryTimeoutId) clearTimeout(retryTimeoutId);
        }

        if (retryResponse.ok) {
          return {
            success: true,
            savedLocally,
            savedToCloud: true,
          };
        }
      } catch {
        // Fall through to error reporting below
      }
    }

    // Granular variance categorization
    let specificError = '';
    if (statusCode === 404 || errorCode === 'PGRST205') {
      specificError = "Supabase table 'chart_sources' not found (HTTP 404, PGRST205). Database migration required.";
    } else if (statusCode === 401 || statusCode === 403 || errorCode === 'PGRST301') {
      specificError = `Supabase write permission denied (HTTP ${statusCode}: Row-Level Security policy).`;
    } else if (statusCode === 400 || statusCode === 422) {
      specificError = `Database schema rejected payload (HTTP ${statusCode}: ${serverMessage || 'Constraint violation'}).`;
    } else if (statusCode === 409) {
      specificError = `Database conflict (HTTP 409: ${serverMessage || 'Duplicate constraint'}).`;
    } else if (statusCode >= 500) {
      specificError = `Supabase cloud server unavailable (HTTP ${statusCode}).`;
    } else {
      specificError = `Supabase rejected request (HTTP ${statusCode}: ${serverMessage}).`;
    }

    return {
      success: savedLocally,
      savedLocally,
      savedToCloud: false,
      error: specificError,
      errorCode,
      statusCode,
      details: errPayload?.details || errPayload?.hint,
    };
  } catch (err: unknown) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    const netError = isAbort
      ? 'Request timed out connecting to Supabase cloud.'
      : 'Network connection error connecting to Supabase cloud.';

    return {
      success: savedLocally,
      savedLocally,
      savedToCloud: false,
      error: netError,
      errorCode: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Formats a high-variance, user-facing error message with diagnostic context.
 */
export function formatSaveErrorMessage(
  result: SaveChartConfigResult | Error | unknown,
  action: 'save' | 'deploy' = 'save'
): string {
  if (!result) {
    return action === 'deploy'
      ? 'Failed to deploy chart configuration: Unknown error.'
      : 'Failed to save chart configuration: Unknown error.';
  }

  // Handle SaveChartConfigResult
  if (typeof result === 'object' && result !== null && 'savedLocally' in result) {
    const res = result as SaveChartConfigResult;
    const baseAction = action === 'deploy' ? 'deploy' : 'save';

    // Neither local nor cloud storage succeeded
    if (!res.savedLocally && !res.savedToCloud) {
      return `Failed to ${baseAction} chart configuration: ${res.error || 'Local storage and cloud sync failed.'}`;
    }

    // Saved locally, but cloud deployment / synchronization failed
    if (res.savedLocally && !res.savedToCloud) {
      if (action === 'deploy') {
        return `Failed to deploy to Supabase: ${res.error || 'Cloud service unavailable.'} (Saved to local browser cache)`;
      }
      return `Saved locally to browser, but cloud sync failed: ${res.error || 'Database unavailable.'}`;
    }
  }

  // Handle standard Error instances
  if (result instanceof Error) {
    return `Failed to ${action} chart configuration: ${result.message}`;
  }

  return `Failed to ${action} chart configuration: ${String(result)}`;
}

/**
 * Persists chart configuration to local cache and Supabase cloud.
 * Maintained for backward compatibility.
 */
export async function saveChartConfig(
  config: SheetChartConfig,
  token?: string
): Promise<boolean> {
  const result = await saveChartConfigDetailed(config, token);
  return result.success;
}

/**
 * Clears cached chart configurations.
 */
export function resetChartSourceCache(chartId?: string): void {
  if (chartId) {
    memoryCache.delete(chartId);
    removeStorageItem(`${getChartSourcePrefix()}${chartId}`);
  } else {
    memoryCache.clear();
    try {
      const manifestKey = getChartSourcesManifestKey();
      const rawList = getStorageItem(manifestKey);
      const idList: string[] = rawList ? JSON.parse(rawList) : [];
      for (const id of idList) {
        removeStorageItem(`${getChartSourcePrefix()}${id}`);
      }
      removeStorageItem(manifestKey);
    } catch {
      // Ignore error
    }
  }
}
