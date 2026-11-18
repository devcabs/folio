import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Step3ChartSetup } from '../../src/components/chart/drawer/panels/Step3ChartSetup';
import type { ChartConfigFormReturn } from '../../src/components/chart/drawer/hooks/useChartConfigForm';
import type { ChartType } from '../../src/types/chart';

function isDetailsOpen(details: any): boolean {
  return details.open === true || details.getAttribute('open') !== null;
}

function findElements(root: any, predicate: (el: any) => boolean): any[] {
  const results: any[] = [];
  const walk = (node: any) => {
    if (!node || node.nodeType !== 1) return;
    if (predicate(node)) results.push(node);
    for (const child of node.childNodes || []) {
      walk(child);
    }
  };
  walk(root);
  return results;
}

function createFormStub(overrides: Partial<ChartConfigFormReturn> = {}): ChartConfigFormReturn {
  return {
    transpose: false,
    setTranspose: vi.fn(),
    chartType: 'bar',
    setChartType: vi.fn(),
    barOrientation: 'vertical',
    setBarOrientation: vi.fn(),
    stacked: false,
    setStacked: vi.fn(),
    curveInterpolation: 'linear',
    setCurveInterpolation: vi.fn(),
    markerSize: 'medium',
    setMarkerSize: vi.fn(),
    showAreaFill: false,
    setShowAreaFill: vi.fn(),
    startAtZero: true,
    setStartAtZero: vi.fn(),
    setAutoScaleY: vi.fn(),
    startAtZeroX: false,
    setStartAtZeroX: vi.fn(),
    setAutoScaleX: vi.fn(),
    donutVariant: 'donut',
    setDonutVariant: vi.fn(),
    showReferenceGuide: false,
    setShowReferenceGuide: vi.fn(),
    showSummaryStats: false,
    setShowSummaryStats: vi.fn(),
    showMedianMode: false,
    setShowMedianMode: vi.fn(),
    loessBandwidth: 0.5,
    setLoessBandwidth: vi.fn(),
    showCorrelationChip: false,
    setShowCorrelationChip: vi.fn(),
    titleOverride: '',
    setTitleOverride: vi.fn(),
    subtitleOverride: '',
    setSubtitleOverride: vi.fn(),
    xLabel: '',
    setXLabel: vi.fn(),
    yLabel: '',
    setYLabel: vi.fn(),
    scatterXColIndex: 1,
    setScatterXColIndex: vi.fn(),
    scatterYColIndex: 2,
    setScatterYColIndex: vi.fn(),
    scatterLabelColIndex: 0,
    setScatterLabelColIndex: vi.fn(),
    scatterGroupColIndex: undefined,
    setScatterGroupColIndex: vi.fn(),
    categoryColIndex: 0,
    setCategoryColIndex: vi.fn(),
    includedSeriesIndices: [1, 2],
    setIncludedSeriesIndices: vi.fn(),
    binStrategy: 'auto',
    setBinStrategy: vi.fn(),
    customBinMode: 'step',
    setCustomBinMode: vi.fn(),
    bucketSize: '',
    setBucketSize: vi.fn(),
    binCount: '',
    setBinCount: vi.fn(),
    histogramYMode: 'frequency',
    setHistogramYMode: vi.fn(),
    groupOthers: false,
    setGroupOthers: vi.fn(),
    sortField: 'sheet',
    setSortField: vi.fn(),
    showValues: false,
    setShowValues: vi.fn(),
    sortBy: 'none',
    setSortBy: vi.fn(),
    sortDirection: 'asc',
    setSortDirection: vi.fn(),
    ...overrides,
  } as unknown as ChartConfigFormReturn;
}

const DETECTED_COLUMNS = [
  { index: 0, label: 'Quarter' },
  { index: 1, label: 'Revenue' },
  { index: 2, label: 'Profit' },
];

function renderStep3(
  formOverrides: Partial<ChartConfigFormReturn> = {},
  setupSubTab: 'data' | 'style' = 'data'
) {
  const form = createFormStub(formOverrides);
  const result = render(
    <Step3ChartSetup
      form={form}
      detectedColumns={DETECTED_COLUMNS}
      accentColor="#881337"
      setupSubTab={setupSubTab}
      setSetupSubTab={vi.fn()}
      handleSubTabKeyDown={vi.fn()}
      handleToggleSeries={vi.fn()}
    />
  );
  return { ...result, form };
}

describe('Subtask 10.1: Chart Type Switcher & Non-Exclusive Accordions', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Segmented Chart Type Switcher', () => {
    it('renders a radiogroup with 5 chart type radio buttons and no native select', () => {
      const { container } = renderStep3({ chartType: 'bar' });

      expect(
        findElements(container, (el) => el.tagName === 'SELECT' && el.id === 'cfg-chart-type')
      ).toHaveLength(0);

      const radiogroup = screen.getByRole('radiogroup', { name: 'Chart Type' });
      expect(radiogroup).toBeTruthy();

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(5);
      expect(radios.map((r) => r.textContent?.trim())).toEqual([
        'Bar',
        'Line',
        'Donut',
        'Scatter',
        'Histogram',
      ]);

      expect(radios[0].getAttribute('aria-checked')).toBe('true');
      expect(radios[0].getAttribute('tabindex')).toBe('0');
      for (const radio of radios.slice(1)) {
        expect(radio.getAttribute('aria-checked')).toBe('false');
        expect(radio.getAttribute('tabindex')).toBe('-1');
      }
    });

    it.each<[ChartType, string]>([
      ['bar', 'Bar'],
      ['line', 'Line'],
      ['donut', 'Donut'],
      ['scatter', 'Scatter'],
      ['histogram', 'Histogram'],
    ])('clicking %s option updates chartType to %s', (expectedType, label) => {
      const setChartType = vi.fn();
      renderStep3({ chartType: expectedType === 'bar' ? 'line' : 'bar', setChartType });

      const radio = screen.getByRole('radio', { name: label });
      fireEvent.click(radio);

      expect(setChartType).toHaveBeenCalledTimes(1);
      expect(setChartType).toHaveBeenCalledWith(expectedType);
    });

    it('supports ArrowLeft and ArrowRight keyboard navigation with wrap-around', () => {
      const setChartType = vi.fn();
      renderStep3({ chartType: 'bar', setChartType });

      const barRadio = screen.getByRole('radio', { name: 'Bar' });
      const lineRadio = screen.getByRole('radio', { name: 'Line' });
      const histogramRadio = screen.getByRole('radio', { name: 'Histogram' });

      barRadio.focus();
      act(() => {
        barRadio.dispatchEvent({ type: 'keydown', key: 'ArrowRight', bubbles: true });
      });
      expect(setChartType).toHaveBeenCalledWith('line');
      expect(document.activeElement).toBe(lineRadio);

      setChartType.mockClear();
      act(() => {
        barRadio.dispatchEvent({ type: 'keydown', key: 'ArrowLeft', bubbles: true });
      });
      expect(setChartType).toHaveBeenCalledWith('histogram');
      expect(document.activeElement).toBe(histogramRadio);
    });
  });

  describe('Non-Exclusive Accordions', () => {
    it('allows multiple AccordionSections in Data tab to stay open simultaneously (standard chart)', () => {
      const { container } = renderStep3({ chartType: 'bar' }, 'data');
      const dataPanel = findElements(container, (el) => el.id === 'setup-panel-data')[0];
      const detailsList = findElements(dataPanel, (el) => el.tagName === 'DETAILS');

      expect(detailsList.length).toBeGreaterThanOrEqual(3);
      for (const details of detailsList) {
        expect(details.getAttribute('name')).toBeNull();
      }

      const categoryDetails = detailsList.find((d) =>
        d.textContent?.includes('Category (X-Axis)')
      )!;
      const orientationDetails = detailsList.find((d) =>
        d.textContent?.includes('Table Orientation')
      )!;
      const seriesDetails = detailsList.find((d) =>
        d.textContent?.includes('Metric Series (Y-Axis)')
      )!;

      expect(isDetailsOpen(categoryDetails)).toBe(true);

      act(() => {
        orientationDetails.open = true;
        orientationDetails.dispatchEvent({ type: 'toggle', bubbles: false });
      });

      act(() => {
        seriesDetails.open = true;
        seriesDetails.dispatchEvent({ type: 'toggle', bubbles: false });
      });

      expect(isDetailsOpen(categoryDetails)).toBe(true);
      expect(isDetailsOpen(orientationDetails)).toBe(true);
      expect(isDetailsOpen(seriesDetails)).toBe(true);
    });

    it('allows multiple AccordionSections in Data tab to stay open simultaneously (scatter chart)', () => {
      const { container } = renderStep3({ chartType: 'scatter' }, 'data');
      const dataPanel = findElements(container, (el) => el.id === 'setup-panel-data')[0];
      const detailsList = findElements(dataPanel, (el) => el.tagName === 'DETAILS');

      expect(detailsList.length).toBeGreaterThanOrEqual(3);
      for (const details of detailsList) {
        expect(details.getAttribute('name')).toBeNull();
      }

      const axesDetails = detailsList.find((d) => d.textContent?.includes('Axes Mapping'))!;
      const labelsDetails = detailsList.find((d) =>
        d.textContent?.includes('Point Labels & Grouping')
      )!;

      expect(isDetailsOpen(axesDetails)).toBe(true);
      act(() => {
        labelsDetails.open = true;
        labelsDetails.dispatchEvent({ type: 'toggle', bubbles: false });
      });

      expect(isDetailsOpen(axesDetails)).toBe(true);
      expect(isDetailsOpen(labelsDetails)).toBe(true);
    });

    it('allows multiple AccordionSections in Appearance tab to stay open simultaneously', () => {
      const { container } = renderStep3({ chartType: 'bar' }, 'style');
      const stylePanel = findElements(container, (el) => el.id === 'setup-panel-style')[0];
      const detailsList = findElements(stylePanel, (el) => el.tagName === 'DETAILS');

      expect(detailsList.length).toBeGreaterThanOrEqual(3);
      for (const details of detailsList) {
        expect(details.getAttribute('name')).toBeNull();
      }

      const visualDetails = detailsList.find((d) =>
        d.textContent?.includes('Visual Style & Layout')
      )!;
      const titlesDetails = detailsList.find((d) =>
        d.textContent?.includes('Titles & Axis Labels')
      )!;
      const dataLabelsDetails = detailsList.find((d) =>
        d.textContent?.includes('Data Labels')
      )!;

      expect(isDetailsOpen(visualDetails)).toBe(true);

      act(() => {
        titlesDetails.open = true;
        titlesDetails.dispatchEvent({ type: 'toggle', bubbles: false });
      });
      act(() => {
        dataLabelsDetails.open = true;
        dataLabelsDetails.dispatchEvent({ type: 'toggle', bubbles: false });
      });

      expect(isDetailsOpen(visualDetails)).toBe(true);
      expect(isDetailsOpen(titlesDetails)).toBe(true);
      expect(isDetailsOpen(dataLabelsDetails)).toBe(true);
    });
  });

  describe('CSS Token Purity', () => {
    it('has zero raw hex colors in Step3ChartSetup.module.css', () => {
      const cssPath = path.resolve(
        __dirname,
        '../../src/components/chart/drawer/panels/Step3ChartSetup.module.css'
      );
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      expect(cssContent).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
  });
});
