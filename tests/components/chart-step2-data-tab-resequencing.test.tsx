import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Step3ChartSetup } from '../../src/components/chart/drawer/panels/Step3ChartSetup';
import type { ChartConfigFormReturn } from '../../src/components/chart/drawer/hooks/useChartConfigForm';

function changeSelectValue(el: any, value: string) {
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
  { index: 3, label: 'Margin' },
];

function renderStep3(
  formOverrides: Partial<ChartConfigFormReturn> = {},
  setupSubTab: 'data' | 'style' = 'data',
  columns = DETECTED_COLUMNS
) {
  const form = createFormStub(formOverrides);
  const result = render(
    <Step3ChartSetup
      form={form}
      detectedColumns={columns}
      accentColor="#881337"
      setupSubTab={setupSubTab}
      setSetupSubTab={vi.fn()}
      handleSubTabKeyDown={vi.fn()}
      handleToggleSeries={vi.fn()}
    />
  );
  return { ...result, form };
}

describe('Subtask 10.2: Resequence Data Tab ("Shape the Data")', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Data Tab Section Sequence & Default Open States', () => {
    it('orders Bar Data tab: Category (X-Axis) [open], Metric Series (Y-Axis), Order & Direction, Table Orientation', () => {
      const { container } = renderStep3({ chartType: 'bar' }, 'data');
      const dataPanel = findElements(container, (el) => el.id === 'setup-panel-data')[0];
      expect(getSectionTitles(dataPanel)).toEqual([
        { title: 'Category (X-Axis)', open: true },
        { title: 'Metric Series (Y-Axis)', open: false },
        { title: 'Order & Direction', open: false },
        { title: 'Table Orientation', open: false },
      ]);
    });

    it('orders Line Data tab: Category / Date (X-Axis) [open], Metric Series (Y-Axis), Order & Direction, Table Orientation', () => {
      const { container } = renderStep3({ chartType: 'line' }, 'data');
      const dataPanel = findElements(container, (el) => el.id === 'setup-panel-data')[0];
      expect(getSectionTitles(dataPanel)).toEqual([
        { title: 'Category / Date (X-Axis)', open: true },
        { title: 'Metric Series (Y-Axis)', open: false },
        { title: 'Order & Direction', open: false },
        { title: 'Table Orientation', open: false },
      ]);
    });

    it('orders Donut Data tab: Slice Categories [open], Slice Values, Slice Order & Direction, Table Orientation', () => {
      const { container } = renderStep3({ chartType: 'donut' }, 'data');
      const dataPanel = findElements(container, (el) => el.id === 'setup-panel-data')[0];
      expect(getSectionTitles(dataPanel)).toEqual([
        { title: 'Slice Categories', open: true },
        { title: 'Slice Values', open: false },
        { title: 'Slice Order & Direction', open: false },
        { title: 'Table Orientation', open: false },
      ]);
    });

    it('orders Scatter Data tab: Axes Mapping [open], Point Labels & Grouping, Point Order, Table Orientation', () => {
      const { container } = renderStep3({ chartType: 'scatter' }, 'data');
      const dataPanel = findElements(container, (el) => el.id === 'setup-panel-data')[0];
      expect(getSectionTitles(dataPanel)).toEqual([
        { title: 'Axes Mapping', open: true },
        { title: 'Point Labels & Grouping', open: false },
        { title: 'Point Order', open: false },
        { title: 'Table Orientation', open: false },
      ]);
    });

    it('orders Histogram Data tab: Values to Group (X-Axis) [open], Binning & Distribution [open], Subgroup Frequencies, Order & Direction, Table Orientation', () => {
      const { container } = renderStep3({ chartType: 'histogram' }, 'data');
      const dataPanel = findElements(container, (el) => el.id === 'setup-panel-data')[0];
      expect(getSectionTitles(dataPanel)).toEqual([
        { title: 'Values to Group (X-Axis)', open: true },
        { title: 'Binning & Distribution', open: true },
        { title: 'Subgroup Frequencies', open: false },
        { title: 'Order & Direction', open: false },
        { title: 'Table Orientation', open: false },
      ]);
    });
  });

  describe('Order & Direction Relocation & Header Deduplication', () => {
    it('removes Order & Direction from the Appearance tab', () => {
      const { container } = renderStep3({ chartType: 'bar' }, 'style');
      const stylePanel = findElements(container, (el) => el.id === 'setup-panel-style')[0];
      const titles = getSectionTitles(stylePanel).map((s) => s.title);
      expect(titles).not.toContain('Order & Direction');
      expect(titles).not.toContain('Slice Order & Direction');
      expect(titles).not.toContain('Point Order');
    });

    it('removes redundant "Data Order & Direction" eyebrow header inside SortingAndOrderControls', () => {
      const { container } = renderStep3({ chartType: 'bar' }, 'data');
      const dataPanel = findElements(container, (el) => el.id === 'setup-panel-data')[0];
      expect(dataPanel.textContent).not.toContain('Data Order & Direction');
    });

    it('preserves sortBy, sortField, and sortDirection bindings inside Data tab', () => {
      const { container, form } = renderStep3(
        { chartType: 'bar', sortField: 'sheet', sortDirection: 'asc', sortBy: 'none' },
        'data'
      );
      const sortFieldSelect = findElements(container, (el) => el.id === 'cfg-sort-field')[0];
      const sortDirSelect = findElements(container, (el) => el.id === 'cfg-sort-dir')[0];

      changeSelectValue(sortFieldSelect, 'Revenue');
      expect(form.setSortField).toHaveBeenCalledWith('Revenue');
      expect(form.setSortBy).toHaveBeenCalledWith('asc');

      changeSelectValue(sortDirSelect, 'desc');
      expect(form.setSortDirection).toHaveBeenCalledWith('desc');
    });
  });

  describe('Histogram Count | Percentage Segmented Choice', () => {
    it('replaces checkbox with Count | Percentage segmented radiogroup and updates histogramYMode', () => {
      const { container, form } = renderStep3(
        { chartType: 'histogram', histogramYMode: 'frequency' },
        'data'
      );

      expect(findElements(container, (el) => el.id === 'cfg-histogram-ymode')).toHaveLength(0);
      expect(container.textContent).not.toContain('Show as Percentage instead of Count');

      const group = screen.getByRole('radiogroup', { name: 'Display Values As' });
      expect(group).toBeTruthy();

      const countBtn = screen.getByRole('radio', { name: 'Count' });
      const pctBtn = screen.getByRole('radio', { name: 'Percentage' });

      expect(countBtn.getAttribute('aria-checked')).toBe('true');
      expect(pctBtn.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(pctBtn);
      expect(form.setHistogramYMode).toHaveBeenCalledWith('relative');

      fireEvent.click(countBtn);
      expect(form.setHistogramYMode).toHaveBeenCalledWith('frequency');
    });
  });

  describe('Metric Series (Y-Axis) Quick All / First Helper', () => {
    it('renders All and First helper buttons when multiple candidate columns exist and updates includedSeriesIndices', () => {
      const { form } = renderStep3(
        { chartType: 'bar', categoryColIndex: 0, includedSeriesIndices: [1, 2] },
        'data'
      );

      const allBtn = screen.getByRole('button', { name: 'All' });
      const firstBtn = screen.getByRole('button', { name: 'First' });

      fireEvent.click(allBtn);
      expect(form.setIncludedSeriesIndices).toHaveBeenCalledWith([1, 2, 3]);

      fireEvent.click(firstBtn);
      expect(form.setIncludedSeriesIndices).toHaveBeenCalledWith([1]);
    });

    it('hides All and First helper buttons when only a single candidate column exists', () => {
      renderStep3(
        { chartType: 'bar', categoryColIndex: 0, includedSeriesIndices: [1] },
        'data',
        [
          { index: 0, label: 'Quarter' },
          { index: 1, label: 'Revenue' },
        ]
      );

      expect(screen.queryByRole('button', { name: 'All' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'First' })).toBeNull();
    });
  });
});
