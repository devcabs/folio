import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useSheetChartData, getMatrixCacheKey, type UseSheetChartDataReturn } from '../src/hooks/useSheetChartData';
import { setEngineConfig, resetEngineConfig } from '../src/config/engine.config';
import type { SheetChartConfig, ChartDataset } from '../src/types/chart';
import * as chartSourceService from '../src/services/chartSourceService';
import * as sheetsDataService from '../src/services/sheetsDataService';

// Ensure minimal browser DOM globals for React 19 root rendering in Node
function setupDomEnvironment() {
  class Element { }
  class HTMLElement extends Element { }
  class HTMLIFrameElement extends HTMLElement { }
  class Document { }

  (global as any).Element = (global as any).Element || Element;
  (global as any).HTMLElement = (global as any).HTMLElement || HTMLElement;
  (global as any).HTMLIFrameElement = (global as any).HTMLIFrameElement || HTMLIFrameElement;
  (global as any).Document = (global as any).Document || Document;
  (global as any).window = (global as any).window || global;

  (global as any).window.Element = (global as any).Element;
  (global as any).window.HTMLElement = (global as any).HTMLElement;
  (global as any).window.HTMLIFrameElement = (global as any).HTMLIFrameElement;
  (global as any).window.Document = (global as any).Document;

  const storageMap = new Map<string, string>();
  const mockLocalStorage = {
    getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn((key: string, val: string) => {
      storageMap.set(key, val);
    }),
    removeItem: vi.fn((key: string) => {
      storageMap.delete(key);
    }),
    clear: vi.fn(() => {
      storageMap.clear();
    }),
  };
  (global as any).window.localStorage = mockLocalStorage;

  const eventListeners: Record<string, ((e: any) => void)[]> = {};

  (global as any).window.addEventListener = (type: string, fn: any) => {
    eventListeners[type] = eventListeners[type] || [];
    eventListeners[type].push(fn);
  };
  (global as any).window.removeEventListener = (type: string, fn: any) => {
    if (eventListeners[type]) {
      eventListeners[type] = eventListeners[type].filter((f) => f !== fn);
    }
  };
  (global as any).window.dispatchEvent = (evt: any) => {
    const list = eventListeners[evt?.type] || [];
    for (const fn of [...list]) {
      fn(evt);
    }
    return true;
  };

  (global as any).addEventListener = (global as any).window.addEventListener;
  (global as any).removeEventListener = (global as any).window.removeEventListener;
  (global as any).dispatchEvent = (global as any).window.dispatchEvent;
  (global as any).IS_REACT_ACT_ENVIRONMENT = true;

  if (!(global as any).CustomEvent) {
    class CustomEvent<T = any> extends Event {
      detail: T;
      constructor(type: string, params?: { detail?: T }) {
        super(type);
        this.detail = params?.detail as T;
      }
    }
    (global as any).CustomEvent = CustomEvent;
  }

  (global as any).document = {
    nodeType: 9,
    activeElement: null,
    defaultView: (global as any).window,
    documentElement: { style: {} },
    createElement(tag: string) {
      const el = new HTMLElement();
      Object.assign(el, {
        nodeType: 1,
        tagName: tag.toUpperCase(),
        ownerDocument: (global as any).document,
        childNodes: [],
        style: {},
        setAttribute() { },
        removeAttribute() { },
        appendChild(c: any) {
          (this as any).childNodes.push(c);
        },
        removeChild() { },
        addEventListener() { },
        removeEventListener() { },
      });
      return el;
    },
    createTextNode(text: string) {
      return { nodeType: 3, textContent: text, style: {} };
    },
    addEventListener() { },
    removeEventListener() { },
  };

  return { storageMap, mockLocalStorage };
}

describe('Subtask 2.4: Google Sheets Tabular Sync Empty-Dataset Guard', () => {
  let activeRoots: Root[] = [];

  beforeEach(() => {
    setupDomEnvironment();
    activeRoots = [];
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const root of activeRoots) {
      try {
        React.act(() => {
          root.unmount();
        });
      } catch {
        // Ignore unmount errors in teardown
      }
    }
    activeRoots = [];
    vi.restoreAllMocks();
  });

  const mockExistingConfig: SheetChartConfig = {
    chartId: 'chart-test-empty-guard',
    nodeId: 'node-test',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
    tabName: 'Sheet1',
    range: 'A1:C10',
    titleOverride: 'Active Production Chart',
    cachedDataset: [
      ['Category', '2023', '2024'],
      ['Alpha', '100', '150'],
      ['Beta', '200', '250'],
    ],
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const initialTestDataset: ChartDataset = {
    chartId: 'chart-test-empty-guard',
    title: 'Active Production Chart',
    chartType: 'bar',
    categories: ['Alpha', 'Beta'],
    series: [
      { name: '2023', data: [100, 200] },
      { name: '2024', data: [150, 250] },
    ],
    sanitizedCsvContent: '',
    asOfDate: '2026-01-01T00:00:00.000Z',
  };

  function renderHookHarness(options: {
    chartId: string;
    initialDataset?: ChartDataset;
    existingConfig?: SheetChartConfig | null;
  }) {
    let latestResult: UseSheetChartDataReturn | null = null;

    vi.spyOn(chartSourceService, 'getCachedChartConfig').mockReturnValue(
      options.existingConfig !== undefined ? options.existingConfig : mockExistingConfig
    );
    vi.spyOn(chartSourceService, 'fetchChartConfig').mockResolvedValue(
      options.existingConfig !== undefined ? options.existingConfig : mockExistingConfig
    );

    function Harness() {
      latestResult = useSheetChartData({
        chartId: options.chartId,
        initialDataset: options.initialDataset ?? initialTestDataset,
      });
      return null;
    }

    const doc = (globalThis as any).document;
    const container = doc.createElement('div');
    container.ownerDocument.defaultView = (globalThis as any).window;
    const root = createRoot(container as any);
    activeRoots.push(root);

    React.act(() => {
      root.render(React.createElement(Harness));
    });

    return {
      getResult: () => latestResult!,
      root,
    };
  }

  describe('Empty Dataset Guard (Zero Rows Handling)', () => {
    it('aborts sync, rejects promise, sets status to error, and preserves previous dataset when fetchLiveSheetMatrix returns []', async () => {
      // Mock fetchLiveSheetMatrix to return an empty array []
      vi.spyOn(sheetsDataService, 'fetchLiveSheetMatrix').mockResolvedValue([]);
      const saveSpy = vi.spyOn(chartSourceService, 'saveChartConfigDetailed').mockResolvedValue({
        success: true,
        savedLocally: true,
        savedToCloud: true,
      });

      const harness = renderHookHarness({
        chartId: 'chart-test-empty-guard',
        existingConfig: mockExistingConfig,
      });

      // Confirm baseline state
      const initialDatasetSnapshot = harness.getResult().dataset;
      expect(initialDatasetSnapshot).not.toBeNull();
      expect(initialDatasetSnapshot?.title).toBe('Active Production Chart');

      let thrownError: Error | null = null;
      await React.act(async () => {
        try {
          await harness.getResult().syncLiveSheet();
        } catch (err: unknown) {
          thrownError = err instanceof Error ? err : new Error(String(err));
        }
      });

      // 1. Assert that the syncLiveSheet call threw the descriptive guard error
      expect(thrownError).not.toBeNull();
      expect((thrownError as Error | null)?.message).toBe(
        'Google Sheet returned 0 valid data rows. Previous chart data preserved.'
      );

      // 2. Assert status is 'error'
      expect(harness.getResult().status).toBe('error');

      // 3. Assert errorMessage is set correctly
      expect(harness.getResult().errorMessage).toBe(
        'Google Sheet returned 0 valid data rows. Previous chart data preserved.'
      );

      // 4. Assert previous dataset is completely preserved and NOT wiped or replaced with empty array
      expect(harness.getResult().dataset).toEqual(initialDatasetSnapshot);
      expect(harness.getResult().dataset?.categories).toEqual(['Alpha', 'Beta']);

      // 5. Assert saveChartConfigDetailed was never called (no empty data persisted to Supabase)
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('rejects and preserves previous dataset when fetchLiveSheetMatrix returns null or undefined', async () => {
      vi.spyOn(sheetsDataService, 'fetchLiveSheetMatrix').mockResolvedValue(
        null as unknown as string[][]
      );
      const saveSpy = vi.spyOn(chartSourceService, 'saveChartConfigDetailed').mockResolvedValue({
        success: true,
        savedLocally: true,
        savedToCloud: true,
      });

      const harness = renderHookHarness({
        chartId: 'chart-test-empty-guard',
        existingConfig: mockExistingConfig,
      });

      const initialDatasetSnapshot = harness.getResult().dataset;

      let thrownError: Error | null = null;
      await React.act(async () => {
        try {
          await harness.getResult().syncLiveSheet();
        } catch (err: unknown) {
          thrownError = err instanceof Error ? err : new Error(String(err));
        }
      });

      expect(thrownError).not.toBeNull();
      expect((thrownError as Error | null)?.message).toBe(
        'Google Sheet returned 0 valid data rows. Previous chart data preserved.'
      );
      expect(harness.getResult().status).toBe('error');
      expect(harness.getResult().errorMessage).toBe(
        'Google Sheet returned 0 valid data rows. Previous chart data preserved.'
      );
      expect(harness.getResult().dataset).toEqual(initialDatasetSnapshot);
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('In-Flight Request Deduplication Guard (Double-Click Protection)', () => {
    it('shares the same in-flight promise for concurrent syncLiveSheet calls and calls fetchLiveSheetMatrix once', async () => {
      let resolveFetch!: (val: string[][]) => void;
      const fetchPromise = new Promise<string[][]>((resolve) => {
        resolveFetch = resolve;
      });

      const fetchSpy = vi
        .spyOn(sheetsDataService, 'fetchLiveSheetMatrix')
        .mockReturnValue(fetchPromise);
      vi.spyOn(chartSourceService, 'saveChartConfigDetailed').mockResolvedValue({
        success: true,
        savedLocally: true,
        savedToCloud: true,
      });

      const harness = renderHookHarness({
        chartId: 'chart-test-empty-guard',
        existingConfig: mockExistingConfig,
      });

      let promise1: Promise<(string | number | null)[][] | null> = null!;
      let promise2: Promise<(string | number | null)[][] | null> = null!;

      React.act(() => {
        promise1 = harness.getResult().syncLiveSheet();
        promise2 = harness.getResult().syncLiveSheet();
      });

      // Both invocations return the identical in-flight Promise instance
      expect(promise1).toBe(promise2);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Resolve the in-flight request with valid matrix data
      const newMatrix = [
        ['Category', 'Count'],
        ['Gamma', '500'],
      ];

      await React.act(async () => {
        resolveFetch(newMatrix);
        await Promise.all([promise1, promise2]);
      });

      expect(harness.getResult().status).toBe('success');
      expect(harness.getResult().dataset?.categories).toEqual(['Gamma']);

      // After completion, subsequent click starts a new sync promise
      let promise3: Promise<(string | number | null)[][] | null> = null!;
      fetchSpy.mockResolvedValueOnce([
        ['Category', 'Count'],
        ['Delta', '600'],
      ]);

      await React.act(async () => {
        promise3 = harness.getResult().syncLiveSheet();
        await promise3;
      });

      expect(promise3).not.toBe(promise1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(harness.getResult().dataset?.categories).toEqual(['Delta']);
    });
  });

  describe('Successful Sync State & Cache Persistence', () => {
    it('persists valid matrix to localStorage and calls saveChartConfigDetailed on success', async () => {
      const validMatrix = [
        ['Month', 'Revenue'],
        ['Jan', '1000'],
        ['Feb', '1500'],
      ];

      vi.spyOn(sheetsDataService, 'fetchLiveSheetMatrix').mockResolvedValue(validMatrix);
      const saveSpy = vi.spyOn(chartSourceService, 'saveChartConfigDetailed').mockResolvedValue({
        success: true,
        savedLocally: true,
        savedToCloud: true,
      });
      const notifySpy = vi.spyOn(chartSourceService, 'notifyChartChange').mockImplementation(() => { });

      const harness = renderHookHarness({
        chartId: 'chart-test-empty-guard',
        existingConfig: mockExistingConfig,
      });

      let resultMatrix: (string | number | null)[][] | null = null;
      await React.act(async () => {
        resultMatrix = await harness.getResult().syncLiveSheet();
      });

      expect(resultMatrix).toEqual(validMatrix);
      expect(harness.getResult().status).toBe('success');
      expect(harness.getResult().errorMessage).toBeUndefined();
      expect(harness.getResult().dataset?.categories).toEqual(['Jan', 'Feb']);

      // Verify saveChartConfigDetailed was called with updated cachedDataset
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          chartId: 'chart-test-empty-guard',
          cachedDataset: validMatrix,
        })
      );
      expect(notifySpy).toHaveBeenCalled();

      // Verify canonical localStorage key was written
      const canonicalKey = getMatrixCacheKey('chart-test-empty-guard');
      const stored = window.localStorage.getItem(canonicalKey);
      expect(stored).toBe(JSON.stringify(validMatrix));
    });

    it('throws descriptive error if no Google Sheet URL is linked', async () => {
      const harness = renderHookHarness({
        chartId: 'chart-no-url',
        existingConfig: {
          chartId: 'chart-no-url',
          nodeId: 'node-test',
          sheetUrl: '',
        },
      });

      let thrownError: Error | null = null;
      await React.act(async () => {
        try {
          await harness.getResult().syncLiveSheet();
        } catch (err: unknown) {
          thrownError = err instanceof Error ? err : new Error(String(err));
        }
      });

      expect(thrownError).not.toBeNull();
      expect((thrownError as Error | null)?.message).toBe('No Google Sheet linked to this chart.');
    });
  });

  describe('Removal of Legacy Fallback Key', () => {
    it('does NOT read from dead legacy key folio_chart_matrix_<chartId>', () => {
      // Set custom namespace so canonical key differs from legacy folio_ prefix
      setEngineConfig({ appNamespace: 'tenant_custom' });

      // Put legacy data in old key format
      window.localStorage.setItem(
        'folio_chart_matrix_chart-legacy-test',
        JSON.stringify([
          ['Category', 'Value'],
          ['LegacyItem', '999'],
        ])
      );

      const harness = renderHookHarness({
        chartId: 'chart-legacy-test',
        existingConfig: null,
      });

      // Since legacy fallback was removed, the legacy key in localStorage is ignored
      // and it resolves to baseline/initial dataset, NOT the legacy matrix
      expect(harness.getResult().dataset?.categories).not.toContain('LegacyItem');

      resetEngineConfig();
    });
  });
});
