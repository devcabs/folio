/**
 * Reactive Chart Data Hook (SWR + Instant Synchronous Baseline Paint)
 * Folio Engine — Subtask 7.4.6
 * Document Reference: docs/tasks/task7_4_drawer_range_matrix_supabase_deploy.md
 *
 * Implements:
 * 1. Instant <10ms synchronous initial render from baked JSON & local storage cache.
 * 2. SWR background re-validation from Supabase cloud storage.
 * 3. Live in-drawer configuration override support for real-time previewing.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  ChartDataset,
  SheetChartConfig,
  ChartSyncStatus,
} from '../types/chart';
import type { NodeCode } from '../types/node';
import {
  getCachedChartConfig,
  setCachedChartConfig,
  fetchChartConfig,
  saveChartConfigDetailed,
  notifyChartChange,
  EVENT_CHART_SOURCE_CHANGE,
} from '../services/chartSourceService';
import {
  fetchLiveSheetMatrix,
  parseTabularDataset,
} from '../services/sheetsDataService';
import { getStorageKey } from '../config/engine.config';
import bakedChartsData from '../data/baked-charts.json';

const bakedCharts: ChartDataset[] = bakedChartsData as ChartDataset[];
export const getMatrixCacheKey = (chartId: string) => getStorageKey('chart_matrix_' + chartId);

export interface UseSheetChartDataOptions {
  chartId: string;
  nodeId?: NodeCode;
  initialDataset?: ChartDataset;
  pollIntervalMs?: number;
  isDevMode?: boolean;
}

export interface UseSheetChartDataReturn {
  dataset: ChartDataset | null;
  config: SheetChartConfig | null;
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
  cfg?: Partial<SheetChartConfig> | null
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
 * Normalizes raw JSONB matrix cells to string[][] for parseTabularDataset ingestion.
 */
function normalizeMatrixToStrings(matrix: (string | number | null)[][]): string[][] {
  return matrix.map((row) =>
    Array.isArray(row)
      ? row.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
      : []
  );
}

export function useSheetChartData({
  chartId,
  nodeId,
  initialDataset,
  pollIntervalMs,
  isDevMode = false,
}: UseSheetChartDataOptions): UseSheetChartDataReturn {
  // Synchronous Initial Resolution for Instant <10ms Paint
  const [cachedConfig] = useState<SheetChartConfig | null>(() => {
    return getCachedChartConfig(chartId);
  });

  const [initialResolvedDataset] = useState<ChartDataset | null>(() => {
    // 1. Check if cached liveMatrix exists in localStorage for instant real-world paint
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        let raw = window.localStorage.getItem(getMatrixCacheKey(chartId));
        if (!raw) {
          raw = window.localStorage.getItem('folio_chart_matrix_' + chartId);
        }
        if (raw) {
          const parsedMatrix = JSON.parse(raw);
          if (Array.isArray(parsedMatrix) && parsedMatrix.length > 0) {
            return parseTabularDataset({
              chartId,
              title: cachedConfig?.titleOverride || '',
              subtitle: cachedConfig?.subtitleOverride,
              unit: cachedConfig?.unitOverride,
              chartType: cachedConfig?.defaultType,
              nodeId,
              visualConfig: cachedConfig?.visualConfig,
              rawMatrix: parsedMatrix,
            });
          }
        }
      }
    } catch {
      // Fall through to baseline
    }

    // 2. Check if cachedConfig has cachedDataset
    if (cachedConfig?.cachedDataset && cachedConfig.cachedDataset.length > 0) {
      return parseTabularDataset({
        chartId,
        title: cachedConfig?.titleOverride || '',
        subtitle: cachedConfig?.subtitleOverride,
        unit: cachedConfig?.unitOverride,
        chartType: cachedConfig?.defaultType,
        nodeId,
        visualConfig: cachedConfig?.visualConfig,
        rawMatrix: normalizeMatrixToStrings(cachedConfig.cachedDataset),
      });
    }

    if (initialDataset) {
      return applyConfigToDataset(initialDataset, cachedConfig);
    }
    const matchedBaked = bakedCharts.find((c) => c.chartId === chartId);
    if (matchedBaked) {
      return applyConfigToDataset(matchedBaked, cachedConfig);
    }
    if (nodeId) {
      const nodeBaked = bakedCharts.find((c) => c.nodeId === nodeId);
      if (nodeBaked) {
        return applyConfigToDataset(nodeBaked, cachedConfig);
      }
    }
    return null;
  });

  const [dataset, setDataset] = useState<ChartDataset | null>(initialResolvedDataset);
  const [config, setConfig] = useState<SheetChartConfig | null>(cachedConfig);
  const [overrideConfig, setOverrideConfig] = useState<Partial<SheetChartConfig> | null>(null);
  const [status, setStatus] = useState<ChartSyncStatus>(() => {
    return initialResolvedDataset ? 'success' : 'pending_data';
  });
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(() => {
    return cachedConfig?.updatedAt || (initialResolvedDataset ? new Date().toISOString() : undefined);
  });

  const isMountedRef = useRef(true);

  // Background SWR fetch from Supabase (Zero GViz calls on load)
  const loadCloudConfig = useCallback(async () => {
    if (!chartId) return;

    try {
      // Force refresh ensures we actually query Supabase cloud instead of stalling on stale local cache
      const remoteConfig = await fetchChartConfig(chartId, { forceRefresh: true });

      if (!isMountedRef.current) return;

      if (remoteConfig) {
        setConfig(remoteConfig);
        setCachedChartConfig(remoteConfig);
        setLastSyncedAt(remoteConfig.updatedAt || new Date().toISOString());

        // Zero GViz read path (both dev and public): parse from cached_dataset if present
        if (remoteConfig.cachedDataset && remoteConfig.cachedDataset.length > 0) {
          const parsedDataset = parseTabularDataset({
            chartId,
            title: remoteConfig.titleOverride || '',
            subtitle: remoteConfig.subtitleOverride,
            unit: remoteConfig.unitOverride,
            chartType: remoteConfig.defaultType,
            nodeId,
            visualConfig: remoteConfig.visualConfig,
            rawMatrix: normalizeMatrixToStrings(remoteConfig.cachedDataset),
          });
          if (isMountedRef.current) {
            setDataset(parsedDataset);
            setStatus('success');
          }
          return;
        }

        // Fallback: update dataset with remote overrides on top of baseline
        setDataset((prev) => {
          if (!prev) {
            const baked = bakedCharts.find((c) => c.chartId === chartId);
            return baked ? applyConfigToDataset(baked, remoteConfig) : null;
          }
          return applyConfigToDataset(prev, remoteConfig);
        });

        setStatus('success');
      } else {
        // Fall back to baked if available
        setDataset((prev) => {
          if (prev) return prev;
          const baked = bakedCharts.find((c) => c.chartId === chartId);
          return baked ? applyConfigToDataset(baked, getCachedChartConfig(chartId)) : null;
        });
        setStatus((prev) => (prev === 'syncing' ? 'success' : prev));
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'Failed to sync chart configuration';
      setErrorMessage(msg);
      setStatus((prev) => (prev === 'syncing' ? 'success' : prev));
    }
  }, [chartId, nodeId]);

  // Explicit manual sync from Google Sheet (ONLY on user click)
  const syncLiveSheet = useCallback(async (): Promise<(string | number | null)[][] | null> => {
    if (!chartId) return null;
    const activeConfig = config || cachedConfig;
    if (!activeConfig?.sheetUrl) {
      throw new Error('No Google Sheet linked to this chart.');
    }

    setStatus('syncing');
    setErrorMessage(undefined);

    try {
      const liveMatrix = await fetchLiveSheetMatrix({
        sheetUrl: activeConfig.sheetUrl,
        tabName: activeConfig.tabName,
        sheetGid: activeConfig.sheetGid,
        range: activeConfig.range,
        timeoutMs: 8000,
      });

      if (!isMountedRef.current) return null;

      if (liveMatrix && liveMatrix.length > 0) {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(
              getMatrixCacheKey(chartId),
              JSON.stringify(liveMatrix)
            );
          }
        } catch {
          // Ignore quota errors
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

        await saveChartConfigDetailed(updatedConfig);
        setCachedChartConfig(updatedConfig);
        notifyChartChange(chartId, updatedConfig);

        setDataset(liveDataset);
        setConfig(updatedConfig);
        setLastSyncedAt(updatedConfig.updatedAt);
        setStatus('success');
        return liveMatrix;
      } else {
        setStatus('success');
        return [];
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return null;
      const msg = err instanceof Error ? err.message : 'Failed to sync live sheet data';
      setErrorMessage(msg);
      setStatus('error');
      throw err;
    }
  }, [chartId, config, cachedConfig, nodeId]);

  // Initial SWR mount effect & optional polling
  useEffect(() => {
    isMountedRef.current = true;
    loadCloudConfig();

    let intervalId: number | null = null;
    if (isDevMode && pollIntervalMs && pollIntervalMs > 0) {
      intervalId = window.setInterval(loadCloudConfig, pollIntervalMs);
    }

    return () => {
      isMountedRef.current = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [loadCloudConfig, pollIntervalMs, isDevMode]);

  // Real-time event listener for live chart configuration updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleChartChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ chartId: string; config: SheetChartConfig }>;
      if (customEvent.detail && customEvent.detail.chartId === chartId) {
        if (customEvent.detail.config) {
          const freshConfig = customEvent.detail.config;
          setConfig(freshConfig);
          if (freshConfig.cachedDataset && freshConfig.cachedDataset.length > 0) {
            const freshDataset = parseTabularDataset({
              chartId,
              title: freshConfig.titleOverride || '',
              subtitle: freshConfig.subtitleOverride,
              unit: freshConfig.unitOverride,
              chartType: freshConfig.defaultType,
              nodeId,
              visualConfig: freshConfig.visualConfig,
              rawMatrix: normalizeMatrixToStrings(freshConfig.cachedDataset),
            });
            setDataset(freshDataset);
            setStatus('success');
            return;
          }
        }
        loadCloudConfig();
      }
    };

    window.addEventListener(EVENT_CHART_SOURCE_CHANGE, handleChartChange);
    return () => {
      window.removeEventListener(EVENT_CHART_SOURCE_CHANGE, handleChartChange);
    };
  }, [chartId, nodeId, loadCloudConfig]);

  // Derived effective dataset with live in-drawer overrides
  const effectiveDataset = useMemo<ChartDataset | null>(() => {
    if (!dataset) return null;
    return overrideConfig ? applyConfigToDataset(dataset, overrideConfig) : dataset;
  }, [dataset, overrideConfig]);

  // Derived effective config
  const effectiveConfig = useMemo<SheetChartConfig | null>(() => {
    if (!config && !overrideConfig) return null;
    return {
      ...(config || ({} as SheetChartConfig)),
      ...(overrideConfig || {}),
    } as SheetChartConfig;
  }, [config, overrideConfig]);

  return {
    dataset: effectiveDataset,
    config: effectiveConfig,
    status,
    errorMessage,
    lastSyncedAt,
    reload: loadCloudConfig,
    syncLiveSheet,
    setOverrideConfig,
  };
}
