import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Step3ChartSetup } from '../../src/components/chart/drawer/panels/Step3ChartSetup';
import type { ChartConfigFormReturn } from '../../src/components/chart/drawer/hooks/useChartConfigForm';
import type { ChartType } from '../../src/types/chart';

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

function findById(root: any, id: string): any | null {
  return findElements(root, (el) => el.id === id)[0] ?? null;
}

function isDetailsOpen(details: any): boolean {
  return details.open === true || details.getAttribute('open') !== null;
}

function getSectionTitles(panel: any): Array<{ title: string; open: boolean }> {
  const detailsList = findElements(panel, (el) => el.tagName === 'DETAILS');
  return detailsList.map((details) => {
    const summary = findElements(details, (el) => el.tagName === 'SUMMARY')[0];
    const titleSpan = summary
      ? findElements(
          summary,
          (el) => el.tagName === 'SPAN' && typeof el.className === 'string' && el.className.includes('title')
        )[0]
      : undefined;
    return {
      title: (titleSpan?.textContent ?? summary?.textContent ?? '').trim(),
      open: isDetailsOpen(details),
    };
  });
}

function toggleCheckbox(el: any, checked: boolean) {
  const propKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  const reactProps = propKey ? el[propKey] : undefined;
  if (reactProps?.onChange) {
    act(() => {
      reactProps.onChange({ target: { checked } });
    });
    return;
  }
  fireEvent.click(el);
}

function changeInputValue(el: any, value: string) {
  const propKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  const reactProps = propKey ? el[propKey] : undefined;
  if (reactProps?.onChange) {
    act(() => {
      reactProps.onChange({ target: { value } });
    });
    return;
  }
  fireEvent.change(el, { target: { value } });
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
    markerSize: 'regular',
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

function renderAppearance(formOverrides: Partial<ChartConfigFormReturn> = {}) {
  const form = createFormStub(formOverrides);
  const result = render(
    <Step3ChartSetup
      form={form}
      detectedColumns={DETECTED_COLUMNS}
      accentColor="#881337"
      setupSubTab="style"
      setSetupSubTab={vi.fn()}
      handleSubTabKeyDown={vi.fn()}
      handleToggleSeries={vi.fn()}
    />
  );
  const appearancePanel = findById(result.container, 'setup-panel-style');
  return { ...result, form, appearancePanel };
}

describe('Subtask 10.4: Consolidate "Polish & Label" Section', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Polish & Label section ordering and conditional titles', () => {
    const cases: Array<{
      chartType: ChartType;
      expectedSections: Array<{ title: string; open: boolean }>;
    }> = [
      {
        chartType: 'bar',
        expectedSections: [
          { title: 'Visual Style & Layout', open: true },
          { title: 'Data Labels', open: false },
          { title: 'Titles & Axis Labels', open: false },
        ],
      },
      {
        chartType: 'line',
        expectedSections: [
          { title: 'Visual Style & Scale', open: true },
          { title: 'Data Labels', open: false },
          { title: 'Titles & Axis Labels', open: false },
        ],
      },
      {
        chartType: 'donut',
        expectedSections: [
          { title: 'Visual Style', open: true },
          { title: 'Data Labels', open: false },
          { title: 'Titles & Subtitle', open: false },
        ],
      },
      {
        chartType: 'scatter',
        expectedSections: [
          { title: 'Trendline & Analytics', open: true },
          { title: 'Axes & Scale', open: false },
          { title: 'Titles & Axis Labels', open: false },
        ],
      },
      {
        chartType: 'histogram',
        expectedSections: [
          { title: 'Visual Style & Statistics', open: true },
          { title: 'Titles & Axis Labels', open: false },
        ],
      },
    ];

    it.each(cases)(
      'places Data Labels immediately after Visual Encoding and Titles at the bottom for $chartType',
      ({ chartType, expectedSections }) => {
        const { appearancePanel } = renderAppearance({ chartType });
        expect(getSectionTitles(appearancePanel)).toEqual(expectedSections);
      }
    );
  });

  describe('Titles, axis labels, and Data Labels controls update form state', () => {
    it('updates titleOverride, subtitleOverride, xLabel, yLabel, and showValues for Cartesian charts', () => {
      const { appearancePanel, form } = renderAppearance({
        chartType: 'bar',
        titleOverride: 'Initial Title',
        subtitleOverride: 'Initial Subtitle',
        xLabel: 'Quarter',
        yLabel: 'USD',
        showValues: false,
      });

      const titleInput = findById(appearancePanel, 'cfg-title');
      const subtitleInput = findById(appearancePanel, 'cfg-subtitle');
      const xLabelInput = findById(appearancePanel, 'cfg-xlabel');
      const yLabelInput = findById(appearancePanel, 'cfg-ylabel');
      const showValuesInput = findById(appearancePanel, 'cfg-show-values-bar-app');

      expect(titleInput).toBeTruthy();
      expect(subtitleInput).toBeTruthy();
      expect(xLabelInput).toBeTruthy();
      expect(yLabelInput).toBeTruthy();
      expect(showValuesInput).toBeTruthy();

      changeInputValue(titleInput, 'Revenue by Quarter');
      changeInputValue(subtitleInput, 'FY 2026');
      changeInputValue(xLabelInput, 'Fiscal Quarter');
      changeInputValue(yLabelInput, 'Amount ($M)');
      toggleCheckbox(showValuesInput, true);

      expect(form.setTitleOverride).toHaveBeenCalledWith('Revenue by Quarter');
      expect(form.setSubtitleOverride).toHaveBeenCalledWith('FY 2026');
      expect(form.setXLabel).toHaveBeenCalledWith('Fiscal Quarter');
      expect(form.setYLabel).toHaveBeenCalledWith('Amount ($M)');
      expect(form.setShowValues).toHaveBeenCalledWith(true);
    });

    it('hides X/Y axis label inputs and updates showValues for donut', () => {
      const { appearancePanel, form } = renderAppearance({
        chartType: 'donut',
        showValues: false,
      });

      expect(findById(appearancePanel, 'cfg-title')).toBeTruthy();
      expect(findById(appearancePanel, 'cfg-subtitle')).toBeTruthy();
      expect(findById(appearancePanel, 'cfg-xlabel')).toBeNull();
      expect(findById(appearancePanel, 'cfg-ylabel')).toBeNull();

      const donutShowValues = findById(appearancePanel, 'cfg-show-values-donut-app');
      expect(donutShowValues).toBeTruthy();
      toggleCheckbox(donutShowValues, true);
      expect(form.setShowValues).toHaveBeenCalledWith(true);
    });
  });
});
