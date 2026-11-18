/**
 * Reactive Chart Data Hook (Embedded Canvas AST SSOT)
 * Folio Engine — Subtask 7.7
 *
 * Single Source of Truth:
 * - Public Mode: renders strictly from ChartElement.dataset and ChartElement.config
 *   (sanitized PublicChartConfig) hydrated on the NodeCanvasDocument AST.
 *   Zero Supabase queries, zero localStorage, zero static JSON fallbacks.
 * - Dev Mode: reads full ChartElement.config (including sheetUrl) and ChartElement.dataset
 *   from the active NodeCanvasDocument in draft:workspace, and persists live Google Sheet
 *   syncs directly into the ChartElement AST via onUpdateElement (PUT /api/draft).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  ChartDataset,
  SheetChartConfig,
  PublicChartConfig,
  ChartSyncStatus,
} from '../types/chart';
import type { ChartElement } from '../types/canvas';
import type { NodeCode } from '../types/node';
import {
  fetchLiveSheetMatrix,
  parseTabularDataset,
} from '../services/sheetsDataService';

export interface UseSheetChartDataOptions {
  chartId: string;
  nodeId?: NodeCode;
  element?: ChartElement;
  initialDataset?: ChartDataset;
  initialConfig?: SheetChartConfig | PublicChartConfig | null;
  isDevMode?: boolean;
  onUpdateElement?: (
    updates: Partial<ChartElement>
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
}

export interface UseSheetChartDataReturn {
  dataset: ChartDataset | null;
  config: SheetChartConfig | PublicChartConfig | null;
  status: ChartSyncStatus;
  errorMessage?: string;
  lastSyncedAt?: string;
  reload: () => Promise<void>;
  syncLiveSheet: () => Promise<(string | number | null)[][] | null>;
  setOverrideConfig: (config: Partial<SheetChartConfig> | null) => void;
}

/**
 * Applies config overrides (title, subtitle, unit, visualConfig) to a dataset.
 */
function applyConfigToDataset(
  baseDataset: ChartDataset,
  cfg?: Partial<SheetChartConfig | PublicChartConfig> | null
): ChartDataset {
  if (!cfg) return baseDataset;

  return {
    ...baseDataset,
    title: cfg.titleOverride || baseDataset.title,
    subtitle: cfg.subtitleOverride !== undefined ? cfg.subtitleOverride : baseDataset.subtitle,
    unit: cfg.unitOverride || baseDataset.unit,
    chartType: cfg.defaultType || baseDataset.chartType,
    visualConfig: {
      ...baseDataset.visualConfig,
      ...cfg.visualConfig,
      unit: cfg.unitOverride || cfg.visualConfig?.unit || baseDataset.visualConfig?.unit,
    },
  };
}

/**
 * Normalizes raw matrix cells to string[][] for parseTabularDataset ingestion.
 */
function normalizeMatrixToStrings(matrix: (string | number | null)[][]): string[][] {
  return matrix.map((row) =>
    Array.isArray(row)
      ? row.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
      : []
  );
}

function resolveDatasetFromAst(
  chartId: string,
  nodeId: NodeCode | undefined,
  astDataset: ChartDataset | undefined,
  astConfig: SheetChartConfig | PublicChartConfig | null | undefined
): ChartDataset | null {
  if (astDataset) {
    return applyConfigToDataset(astDataset, astConfig);
  }
  if (astConfig?.cachedDataset && astConfig.cachedDataset.length > 0) {
    return parseTabularDataset({
      chartId,
      title: astConfig.titleOverride || '',
      subtitle: astConfig.subtitleOverride,
      unit: astConfig.unitOverride,
      chartType: astConfig.defaultType,
      nodeId,
      visualConfig: astConfig.visualConfig,
      rawMatrix: normalizeMatrixToStrings(astConfig.cachedDataset),
    });
  }
  return null;
}

export function useSheetChartData({
  chartId,
  nodeId,
  element,
  initialDataset,
  initialConfig,
  isDevMode = false,
  onUpdateElement,
}: UseSheetChartDataOptions): UseSheetChartDataReturn {
  const astConfig = element?.config ?? initialConfig ?? null;
  const astDataset = element?.dataset ?? initialDataset;

  const resolvedFromAst = useMemo(
    () => resolveDatasetFromAst(chartId, nodeId, astDataset, astConfig),
    [chartId, nodeId, astDataset, astConfig]
  );

  const [dataset, setDataset] = useState<ChartDataset | null>(resolvedFromAst);
  const [config, setConfig] = useState<SheetChartConfig | PublicChartConfig | null>(astConfig);
  const [overrideConfig, setOverrideConfig] = useState<Partial<SheetChartConfig> | null>(null);
  const [status, setStatus] = useState<ChartSyncStatus>(() =>
    resolvedFromAst ? 'success' : 'pending_data'
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(() =>
    astConfig?.updatedAt || (resolvedFromAst ? new Date().toISOString() : undefined)
  );

  const isMountedRef = useRef(true);
  const inFlightSyncRef = useRef<Promise<(string | number | null)[][] | null> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep local state synchronized with Canvas AST updates
  useEffect(() => {
    setConfig(astConfig);
    setDataset(resolvedFromAst);
    setStatus(resolvedFromAst ? 'success' : 'pending_data');
    if (astConfig?.updatedAt) {
      setLastSyncedAt(astConfig.updatedAt);
    }
  }, [astConfig, resolvedFromAst]);

  const reload = useCallback(async () => {
    setConfig(astConfig);
    setDataset(resolvedFromAst);
    setStatus(resolvedFromAst ? 'success' : 'pending_data');
    setErrorMessage(undefined);
  }, [astConfig, resolvedFromAst]);

  // Explicit manual sync from Google Sheet (Dev Mode only)
  const syncLiveSheet = useCallback((): Promise<(string | number | null)[][] | null> => {
    if (!chartId) return Promise.resolve(null);
    if (!isDevMode) {
      return Promise.reject(new Error('Live Google Sheet sync is only available in Developer Mode.'));
    }
    if (inFlightSyncRef.current) {
      return inFlightSyncRef.current;
    }

    const activeConfig = (config || astConfig) as SheetChartConfig | null;
    if (!activeConfig || !('sheetUrl' in activeConfig) || !activeConfig.sheetUrl) {
      return Promise.reject(new Error('No Google Sheet linked to this chart.'));
    }

    setStatus('syncing');
    setErrorMessage(undefined);

    const syncPromise = (async () => {
      try {
        const liveMatrix = await fetchLiveSheetMatrix({
          sheetUrl: activeConfig.sheetUrl,
          tabName: activeConfig.tabName,
          sheetGid: activeConfig.sheetGid,
          range: activeConfig.range,
          timeoutMs: 8000,
        });

        if (!isMountedRef.current) return null;

        // Defensive Guard: Reject empty or 0-row results
        if (!liveMatrix || liveMatrix.length === 0) {
          const emptyMsg = 'Google Sheet returned 0 valid data rows. Previous chart data preserved.';
          setStatus('error');
          setErrorMessage(emptyMsg);
          throw new Error(emptyMsg);
        }

        const liveDataset = parseTabularDataset({
          chartId,
          title: activeConfig.titleOverride || '',
          subtitle: activeConfig.subtitleOverride,
          unit: activeConfig.unitOverride,
          chartType: activeConfig.defaultType,
          nodeId,
          visualConfig: activeConfig.visualConfig,
          rawMatrix: normalizeMatrixToStrings(liveMatrix),
        });

        const updatedConfig: SheetChartConfig = {
          ...activeConfig,
          cachedDataset: liveMatrix,
          updatedAt: new Date().toISOString(),
        };

        if (onUpdateElement) {
          const updateResult = await onUpdateElement({
            config: updatedConfig,
            dataset: liveDataset,
            title: updatedConfig.titleOverride || liveDataset.title || element?.title || '',
            subtitle: updatedConfig.subtitleOverride ?? liveDataset.subtitle,
          });

          if (updateResult && typeof updateResult === 'object' && 'ok' in updateResult && !updateResult.ok) {
            throw new Error(updateResult.error || 'Failed to persist synced chart to draft KV.');
          }
        }

        if (!isMountedRef.current) return liveMatrix;

        setDataset(liveDataset);
        setConfig(updatedConfig);
        setLastSyncedAt(updatedConfig.updatedAt);
        setStatus('success');
        return liveMatrix;
      } catch (err: unknown) {
        if (!isMountedRef.current) return null;
        const msg = err instanceof Error ? err.message : 'Failed to sync live sheet data';
        setErrorMessage(msg);
        setStatus('error');
        throw err;
      } finally {
        inFlightSyncRef.current = null;
      }
    })();

    inFlightSyncRef.current = syncPromise;
    return syncPromise;
  }, [chartId, isDevMode, config, astConfig, nodeId, onUpdateElement, element?.title]);

  // Derived effective dataset with live in-drawer overrides
  const effectiveDataset = useMemo<ChartDataset | null>(() => {
    if (!dataset) return null;
    return overrideConfig ? applyConfigToDataset(dataset, overrideConfig) : dataset;
  }, [dataset, overrideConfig]);

  // Derived effective config
  const effectiveConfig = useMemo<SheetChartConfig | PublicChartConfig | null>(() => {
    if (!config && !overrideConfig) return null;
    return {
      ...(config || ({} as SheetChartConfig)),
      ...(overrideConfig || {}),
    } as SheetChartConfig | PublicChartConfig;
  }, [config, overrideConfig]);

  return {
    dataset: effectiveDataset,
    config: effectiveConfig,
    status,
    errorMessage,
    lastSyncedAt,
    reload,
    syncLiveSheet,
    setOverrideConfig,
  };
}
