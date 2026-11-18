import { render, renderHook, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Step3ChartSetup, type ChartSetupSubTab } from '../../../src/components/chart/drawer/panels/Step3ChartSetup';
import { useChartConfigForm, type ChartConfigFormReturn } from '../../../src/components/chart/drawer/hooks/useChartConfigForm';
import type { ChartType } from '../../../src/types/chart';

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

function isDetailsOpen(details: any): boolean {
  return details.open === true || details.getAttribute('open') !== null;
}

function getSectionSequence(panel: any): Array<{ title: string; open: boolean; nameAttr: string | null }> {
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
      nameAttr: details.getAttribute('name'),
    };
  });
}

function openDetailsSection(details: any) {
  act(() => {
    details.open = true;
    details.dispatchEvent({ type: 'toggle', bubbles: false });
  });
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

function renderStep3(
  formOverrides: Partial<ChartConfigFormReturn> = {},
  setupSubTab: ChartSetupSubTab = 'data'
) {
  const form = createFormStub(formOverrides);
  const view = render(
    <Step3ChartSetup
      form={form}
      detectedColumns={DETECTED_COLUMNS}
      accentColor="var(--folio-primary)"
      setupSubTab={setupSubTab}
      setSetupSubTab={vi.fn()}
      handleSubTabKeyDown={vi.fn()}
      handleToggleSeries={vi.fn()}
    />
  );
  return { form, ...view };
}

type ExplicitChartType = Exclude<ChartType, 'auto'>;

const EXPECTED_DATA_SEQUENCES: Record<ExplicitChartType, Array<{ title: string; open: boolean }>> = {
  bar: [
    { title: 'Category (X-Axis)', open: true },
    { title: 'Metric Series (Y-Axis)', open: false },
    { title: 'Order & Direction', open: false },
    { title: 'Table Orientation', open: false },
  ],
  line: [
    { title: 'Category / Date (X-Axis)', open: true },
    { title: 'Metric Series (Y-Axis)', open: false },
    { title: 'Order & Direction', open: false },
    { title: 'Table Orientation', open: false },
  ],
  donut: [
    { title: 'Slice Categories', open: true },
    { title: 'Slice Values', open: false },
    { title: 'Slice Order & Direction', open: false },
    { title: 'Table Orientation', open: false },
  ],
  scatter: [
    { title: 'Axes Mapping', open: true },
    { title: 'Point Labels & Grouping', open: false },
    { title: 'Point Order', open: false },
    { title: 'Table Orientation', open: false },
  ],
  histogram: [
    { title: 'Values to Group (X-Axis)', open: true },
    { title: 'Binning & Distribution', open: true },
    { title: 'Subgroup Frequencies', open: false },
    { title: 'Order & Direction', open: false },
    { title: 'Table Orientation', open: false },
  ],
};

const EXPECTED_APPEARANCE_SEQUENCES: Record<ExplicitChartType, Array<{ title: string; open: boolean }>> = {
  bar: [
    { title: 'Visual Style & Layout', open: true },
    { title: 'Data Labels', open: false },
    { title: 'Titles & Axis Labels', open: false },
  ],
  line: [
    { title: 'Visual Style & Scale', open: true },
    { title: 'Data Labels', open: false },
    { title: 'Titles & Axis Labels', open: false },
  ],
  donut: [
    { title: 'Visual Style', open: true },
    { title: 'Data Labels', open: false },
    { title: 'Titles & Subtitle', open: false },
  ],
  scatter: [
    { title: 'Trendline & Analytics', open: true },
    { title: 'Axes & Scale', open: false },
    { title: 'Titles & Axis Labels', open: false },
  ],
  histogram: [
    { title: 'Visual Style & Statistics', open: true },
    { title: 'Titles & Axis Labels', open: false },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Subtask 10.5: Step3ChartSetup Regression Suite', () => {
  describe('Chart Type Segmented Switcher', () => {
    it('renders all 5 chart types in a radiogroup with correct selection state', () => {
      renderStep3({ chartType: 'donut' });

      const group = screen.getByRole('radiogroup', { name: 'Chart Type' });
      expect(group).toBeTruthy();

      const radios = screen.getAllByRole('radio');
      expect(radios.map((r) => r.textContent?.trim())).toEqual([
        'Bar',
        'Line',
        'Donut',
        'Scatter',
        'Histogram',
      ]);

      expect(radios[2].getAttribute('aria-checked')).toBe('true');
      expect(radios[2].getAttribute('tabindex')).toBe('0');
      expect(radios[0].getAttribute('aria-checked')).toBe('false');
      expect(radios[0].getAttribute('tabindex')).toBe('-1');
    });

    it('switches chart type via click and ArrowLeft/ArrowRight keyboard navigation', () => {
      const setChartType = vi.fn();
      renderStep3({ chartType: 'bar', setChartType });

      const radios = screen.getAllByRole('radio');

      fireEvent.click(radios[3]);
      expect(setChartType).toHaveBeenCalledWith('scatter');

      setChartType.mockClear();
      radios[0].focus();
      act(() => {
        (radios[0] as any).dispatchEvent({ type: 'keydown', key: 'ArrowRight', bubbles: true });
      });
      expect(setChartType).toHaveBeenCalledWith('line');
      expect(document.activeElement).toBe(radios[1]);

      setChartType.mockClear();
      act(() => {
        (radios[0] as any).dispatchEvent({ type: 'keydown', key: 'ArrowLeft', bubbles: true });
      });
      expect(setChartType).toHaveBeenCalledWith('histogram');
      expect(document.activeElement).toBe(radios[4]);
    });
  });

  describe.each<ExplicitChartType>(['bar', 'line', 'donut', 'scatter', 'histogram'])(
    'Per-Chart Sequence Invariants (%s)',
    (chartType) => {
      it('orders Data tab sections as Shape the Data with Table Orientation last', () => {
        const { container } = renderStep3({ chartType }, 'data');
        const dataPanel = findElements(container, (el) => el.id === 'setup-panel-data')[0];
        expect(dataPanel).toBeTruthy();

        const sequence = getSectionSequence(dataPanel);
        expect(sequence.map(({ title, open }) => ({ title, open }))).toEqual(
          EXPECTED_DATA_SEQUENCES[chartType]
        );
        expect(sequence.every((s) => s.nameAttr === null)).toBe(true);
      });

      it('orders Appearance tab sections as Encode the Visual -> Polish & Label', () => {
        const { container } = renderStep3({ chartType }, 'style');
        const stylePanel = findElements(container, (el) => el.id === 'setup-panel-style')[0];
        expect(stylePanel).toBeTruthy();

        const sequence = getSectionSequence(stylePanel);
        expect(sequence.map(({ title, open }) => ({ title, open }))).toEqual(
          EXPECTED_APPEARANCE_SEQUENCES[chartType]
        );
        expect(sequence.every((s) => s.nameAttr === null)).toBe(true);
      });
    }
  );

  describe('Non-Exclusive Accordion Behavior', () => {
    it('keeps the first section open when opening a second section in Data and Appearance', () => {
      const { container } = renderStep3({ chartType: 'bar' }, 'data');
      const dataPanel = findElements(container, (el) => el.id === 'setup-panel-data')[0];
      const dataDetails = findElements(dataPanel, (el) => el.tagName === 'DETAILS');

      expect(isDetailsOpen(dataDetails[0])).toBe(true);
      expect(isDetailsOpen(dataDetails[1])).toBe(false);

      openDetailsSection(dataDetails[1]);

      expect(isDetailsOpen(dataDetails[0])).toBe(true);
      expect(isDetailsOpen(dataDetails[1])).toBe(true);

      cleanup();

      const styleView = renderStep3({ chartType: 'scatter' }, 'style');
      const stylePanel = findElements(
        styleView.container,
        (el) => el.id === 'setup-panel-style'
      )[0];
      const styleDetails = findElements(stylePanel, (el) => el.tagName === 'DETAILS');

      expect(isDetailsOpen(styleDetails[0])).toBe(true);
      expect(isDetailsOpen(styleDetails[1])).toBe(false);

      openDetailsSection(styleDetails[1]);

      expect(isDetailsOpen(styleDetails[0])).toBe(true);
      expect(isDetailsOpen(styleDetails[1])).toBe(true);
    });
  });

  describe('UX Defaults & Label Refinements', () => {
    it('does not render a redundant Source Column label for the single X-axis ColumnSelect', () => {
      const { container } = renderStep3({ chartType: 'bar' }, 'data');
      const dataPanel = findElements(container, (el) => el.id === 'setup-panel-data')[0];
      expect(dataPanel.textContent).not.toContain('Source Column');
    });

    it('defaults X and Y baselines to Auto and resets scatter trendline to none on chart switch', () => {
      const { result } = renderHook(() => useChartConfigForm());

      expect(result.current.autoScaleY).toBe(true);
      expect(result.current.startAtZero).toBe(false);
      expect(result.current.autoScaleX).toBe(true);
      expect(result.current.startAtZeroX).toBe(false);

      act(() => {
        result.current.setChartType('scatter');
      });

      expect(result.current.chartType).toBe('scatter');
      expect(result.current.curveInterpolation).toBe('none');
    });
  });
});
