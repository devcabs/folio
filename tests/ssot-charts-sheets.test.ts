/**
 * Subtask 7.7: Embedded AST Chart Configuration & Google Sheets Pipeline SSOT Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ChartElement } from '../src/types/canvas';
import type { ChartDataset, SheetChartConfig, PublicChartConfig } from '../src/types/chart';
import { useSheetChartData } from '../src/hooks/useSheetChartData';
import { fetchLiveSheetMatrix } from '../src/services/sheetsDataService';
import { verifySheetAccess, fetchSheetTabs } from '../src/services/sheetsVerificationService';
import { useLiveMatrixSync } from '../src/components/chart/drawer/hooks/useLiveMatrixSync';

const ROOT = path.resolve(__dirname, '..');

function makeSampleDataset(overrides?: Partial<ChartDataset>): ChartDataset {
  return {
    chartId: 'chart-test-1',
    title: 'Enrollment Rate',
    subtitle: '2020-2025',
    unit: '%',
    chartType: 'bar',
    nodeId: 'access',
    asOfDate: 'Nov 2026',
    categories: ['2024', '2025'],
    series: [{ name: 'Rate', data: [88, 92] }],
    sanitizedCsvContent: 'Year,Rate\n2024,88\n2025,92',
    ...overrides,
  };
}

function makeSampleConfig(overrides?: Partial<SheetChartConfig>): SheetChartConfig {
  return {
    chartId: 'chart-test-1',
    nodeId: 'access',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0',
    tabName: 'Data',
    sheetGid: '0',
    range: 'A1:B3',
    defaultType: 'bar',
    titleOverride: 'Enrollment Rate',
    updatedAt: '2026-11-18T00:00:00.000Z',
    ...overrides,
  };
}

describe('Subtask 7.7: Chart Config & Google Sheets Pipeline SSOT', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('1. SSOT Codebase Hygiene & Purged Sidecars', () => {
    it('deletes src/services/chartSourceService.ts', () => {
      const target = path.join(ROOT, 'src/services/chartSourceService.ts');
      expect(fs.existsSync(target)).toBe(false);
    });

    it('contains zero imports of baked-charts.json or chart_matrix_ / _chart_source_ in src/', () => {
      const filesToCheck = [
        'src/hooks/useSheetChartData.ts',
        'src/components/canvas/CanvasChart.tsx',
        'src/components/chart/ChartCard.tsx',
        'src/components/chart/ChartConfigDrawer.tsx',
        'src/types/canvas.ts',
        'src/index.ts',
      ];

      for (const rel of filesToCheck) {
        const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        expect(content).not.toContain('baked-charts.json');
        expect(content).not.toContain('chartSourceService');
        expect(content).not.toContain('chart_matrix_');
        expect(content).not.toContain('_chart_source_');
        expect(content).not.toContain('saveChartConfigDetailed');
      }
    });

    it('removes /htmlview scraping and hardcoded Sheet1 fallback from sheetsVerificationService & useSheetVerification', () => {
      const verifSrc = fs.readFileSync(
        path.join(ROOT, 'src/services/sheetsVerificationService.ts'),
        'utf8'
      );
      expect(verifSrc).not.toContain('htmlview');
      expect(verifSrc).not.toContain('parseHtmlViewTabs');

      const hookSrc = fs.readFileSync(
        path.join(ROOT, 'src/components/chart/drawer/hooks/useSheetVerification.ts'),
        'utf8'
      );
      expect(hookSrc).not.toContain("setTabName('Sheet1')");
    });
  });

  describe('2. Self-Contained ChartElement in useSheetChartData', () => {
    it('renders strictly from element.dataset and PublicChartConfig in Public Mode with zero network calls', () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const publicConfig: PublicChartConfig = {
        chartId: 'chart-test-1',
        nodeId: 'access',
        defaultType: 'bar',
        titleOverride: 'Public Title Override',
        updatedAt: '2026-11-18T00:00:00.000Z',
      };
      const element: ChartElement = {
        id: 'el-chart-1',
        type: 'chart',
        chartId: 'chart-test-1',
        title: 'Enrollment Rate',
        config: publicConfig,
        dataset: makeSampleDataset(),
      };

      const { result } = renderHook(() =>
        useSheetChartData({
          chartId: element.chartId,
          nodeId: 'access',
          element,
          isDevMode: false,
        })
      );

      expect(result.current.status).toBe('success');
      expect(result.current.dataset?.title).toBe('Public Title Override');
      expect(result.current.dataset?.categories).toEqual(['2024', '2025']);
      expect(result.current.config).toEqual(publicConfig);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns pending_data in Public Mode when element has no dataset or cachedDataset (no baked-charts.json fallback)', () => {
      const element: ChartElement = {
        id: 'el-chart-empty',
        type: 'chart',
        chartId: 'chart_access_main', // ID that might exist in baked-charts.json
        title: 'Unconfigured Chart',
      };

      const { result } = renderHook(() =>
        useSheetChartData({
          chartId: element.chartId,
          nodeId: 'access',
          element,
          isDevMode: false,
        })
      );

      expect(result.current.status).toBe('pending_data');
      expect(result.current.dataset).toBeNull();
    });

    it('syncLiveSheet writes compiled ChartDataset and SheetChartConfig to AST via onUpdateElement', async () => {
      const csvBody = 'Year,Rate\n2024,90\n2025,95';
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => csvBody,
      });
      vi.stubGlobal('fetch', fetchMock);

      const onUpdateElement = vi.fn().mockResolvedValue({ ok: true });
      const config = makeSampleConfig();
      const element: ChartElement = {
        id: 'el-chart-1',
        type: 'chart',
        chartId: 'chart-test-1',
        title: 'Enrollment Rate',
        config,
      };

      const { result } = renderHook(() =>
        useSheetChartData({
          chartId: element.chartId,
          nodeId: 'access',
          element,
          isDevMode: true,
          onUpdateElement,
        })
      );

      await act(async () => {
        await result.current.syncLiveSheet();
      });

      expect(onUpdateElement).toHaveBeenCalledTimes(1);
      const updates = onUpdateElement.mock.calls[0][0] as Partial<ChartElement>;
      expect(updates.config?.cachedDataset).toEqual([
        ['Year', 'Rate'],
        ['2024', '90'],
        ['2025', '95'],
      ]);
      expect(updates.dataset?.categories).toEqual(['2024', '2025']);
      expect(result.current.status).toBe('success');
    });

    it('fails stop when onUpdateElement returns { ok: false } on KV write failure', async () => {
      const csvBody = 'Year,Rate\n2024,90\n2025,95';
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => csvBody,
        })
      );

      const onUpdateElement = vi.fn().mockResolvedValue({
        ok: false,
        error: 'Draft canvas KV write failed: HTTP 500',
      });

      const element: ChartElement = {
        id: 'el-chart-1',
        type: 'chart',
        chartId: 'chart-test-1',
        title: 'Enrollment Rate',
        config: makeSampleConfig(),
      };

      const { result } = renderHook(() =>
        useSheetChartData({
          chartId: element.chartId,
          nodeId: 'access',
          element,
          isDevMode: true,
          onUpdateElement,
        })
      );

      let caught: unknown;
      await act(async () => {
        try {
          await result.current.syncLiveSheet();
        } catch (err) {
          caught = err;
        }
      });

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toMatch(/KV write failed/i);
      expect(result.current.status).toBe('error');
      expect(result.current.errorMessage).toMatch(/KV write failed/i);
    });
  });

  describe('3. Fail-Stop fetchLiveSheetMatrix & useLiveMatrixSync', () => {
    it('throws on invalid Google Sheet URL', async () => {
      await expect(
        fetchLiveSheetMatrix({ sheetUrl: 'https://example.com/not-a-sheet' })
      ).rejects.toThrow();
    });

    it('throws on HTTP 403 / 404 / 500 instead of returning []', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          text: async () => 'Forbidden',
        })
      );

      await expect(
        fetchLiveSheetMatrix({
          sheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
        })
      ).rejects.toThrow(/403/);
    });

    it('throws on HTML login redirect instead of returning []', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html><html><body>ServiceLogin accounts.google.com</body></html>',
        })
      );

      await expect(
        fetchLiveSheetMatrix({
          sheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
        })
      ).rejects.toThrow(/login|redirect|sharing/i);
    });

    it('throws on network error instead of returning []', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network timeout')));

      await expect(
        fetchLiveSheetMatrix({
          sheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
        })
      ).rejects.toThrow(/Network timeout/);
    });

    it('useLiveMatrixSync exposes syncError and does not fall back to previewMatrix when live fetch fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => 'Server Error',
        })
      );

      const stalePreview = [
        ['Year', 'Rate'],
        ['2020', '50'],
      ];

      const { result } = renderHook(() =>
        useLiveMatrixSync({
          sheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
          tabName: 'Data',
          sheetGid: '0',
          range: 'A1:B2',
          previewMatrix: stalePreview,
        })
      );

      let caught: unknown;
      await act(async () => {
        try {
          await result.current.executeSync();
        } catch (err) {
          caught = err;
        }
      });

      expect(caught).toBeInstanceOf(Error);
      expect(result.current.syncError).toBeTruthy();
      expect(result.current.liveMatrix).toEqual([]);
      expect(result.current.activeMatrix).toEqual([]);
    });
  });

  describe('4. Single-Source Google Sheets Verification', () => {
    it('verifySheetAccess fails stop when API key is missing instead of falling back to GViz', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const res = await verifySheetAccess(
        'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
        { apiKey: '' }
      );

      expect(res.accessible).toBe(false);
      expect(res.error).toBeTruthy();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fetchSheetTabs throws when Sheets API v4 fails instead of scraping /htmlview', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          text: async () => 'Forbidden',
        })
      );

      await expect(
        fetchSheetTabs(
          '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
          'valid-looking-api-key-123456'
        )
      ).rejects.toThrow();
    });
  });
});
