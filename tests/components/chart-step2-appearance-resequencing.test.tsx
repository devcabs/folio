import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Step3ChartSetup } from '../../src/components/chart/drawer/panels/Step3ChartSetup';
import type { ChartConfigFormReturn } from '../../src/components/chart/drawer/hooks/useChartConfigForm';
import type { ChartType } from '../../src/types/chart';

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

function findById(root: any, id: string): any | null {
  return findElements(root, (el) => el.id === id)[0] ?? null;
}

function hasAncestorWithClass(el: any, classFragment: string): boolean {
  let curr = el?.parentNode;
  while (curr) {
    if (typeof curr.className === 'string' && curr.className.includes(classFragment)) {
      return true;
    }
    curr = curr.parentNode;
  }
  return false;
}

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

describe('Subtask 10.3: Resequence Appearance Visual Encoding ("Encode the Visual")', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Per-chart Visual Encoding order and defaultOpen state', () => {
    const cases: Array<{
      chartType: ChartType;
      expectedFirstTitle: string;
      expectedSections: Array<{ title: string; open: boolean }>;
    }> = [
      {
        chartType: 'bar',
        expectedFirstTitle: 'Visual Style & Layout',
        expectedSections: [
          { title: 'Visual Style & Layout', open: true },
          { title: 'Data Labels', open: false },
          { title: 'Titles & Axis Labels', open: false },
        ],
      },
      {
        chartType: 'line',
        expectedFirstTitle: 'Visual Style & Scale',
        expectedSections: [
          { title: 'Visual Style & Scale', open: true },
          { title: 'Data Labels', open: false },
          { title: 'Titles & Axis Labels', open: false },
        ],
      },
      {
        chartType: 'donut',
        expectedFirstTitle: 'Visual Style',
        expectedSections: [
          { title: 'Visual Style', open: true },
          { title: 'Data Labels', open: false },
          { title: 'Titles & Subtitle', open: false },
        ],
      },
      {
        chartType: 'histogram',
        expectedFirstTitle: 'Visual Style & Statistics',
        expectedSections: [
          { title: 'Visual Style & Statistics', open: true },
          { title: 'Titles & Axis Labels', open: false },
        ],
      },
      {
        chartType: 'scatter',
        expectedFirstTitle: 'Trendline & Analytics',
        expectedSections: [
          { title: 'Trendline & Analytics', open: true },
          { title: 'Axes & Scale', open: false },
          { title: 'Titles & Axis Labels', open: false },
        ],
      },
    ];

    it.each(cases)(
      'opens Appearance on $expectedFirstTitle for $chartType',
      ({ chartType, expectedSections }) => {
        const { appearancePanel } = renderAppearance({ chartType });
        const sections = getSectionTitles(appearancePanel);
        expect(sections).toEqual(expectedSections);
      }
    );
  });

  describe('Scatter split into Trendline & Analytics and Axes & Scale', () => {
    it('places trendline/analytics controls inside Trendline & Analytics and baseline toggles inside Axes & Scale', () => {
      const { appearancePanel } = renderAppearance({
        chartType: 'scatter',
        curveInterpolation: 'smooth',
      });

      const detailsList = findElements(appearancePanel, (el) => el.tagName === 'DETAILS');
      const trendlineDetails = detailsList[0];
      const axesDetails = detailsList[1];

      expect(findById(trendlineDetails, 'cfg-scatter-trendline')).toBeTruthy();
      expect(findById(trendlineDetails, 'cfg-scatter-marker-size')).toBeTruthy();
      expect(findById(trendlineDetails, 'cfg-loess-bandwidth')).toBeTruthy();
      expect(findById(trendlineDetails, 'cfg-scatter-confidence')).toBeTruthy();
      expect(findById(trendlineDetails, 'cfg-scatter-correlation')).toBeTruthy();
      expect(findById(trendlineDetails, 'cfg-scatter-crosshairs')).toBeTruthy();

      expect(findById(axesDetails, 'cfg-scatter-trendline')).toBeNull();
      expect(
        findElements(
          axesDetails,
          (el) => el.getAttribute('role') === 'radiogroup' && el.getAttribute('aria-label') === 'Vertical (Y) Axis Baseline'
        )
      ).toHaveLength(1);
      expect(
        findElements(
          axesDetails,
          (el) => el.getAttribute('role') === 'radiogroup' && el.getAttribute('aria-label') === 'Horizontal (X) Axis Baseline'
        )
      ).toHaveLength(1);
    });
  });

  describe('Auto | Zero baseline segmented toggles', () => {
    it('replaces Line Start vertical axis at zero checkbox with Auto | Zero toggle', () => {
      const { container, form } = renderAppearance({
        chartType: 'line',
        startAtZero: true,
      });

      expect(findById(container, 'cfg-line-start-at-zero')).toBeNull();

      const group = screen.getByRole('radiogroup', { name: 'Vertical (Y) Axis Baseline' });
      const radios = findElements(group, (el) => el.getAttribute('role') === 'radio');
      expect(radios.map((r) => r.textContent?.trim())).toEqual(['Auto', 'Zero']);
      expect(radios[0].getAttribute('aria-checked')).toBe('false');
      expect(radios[1].getAttribute('aria-checked')).toBe('true');

      fireEvent.click(radios[0]);
      expect(form.setStartAtZero).toHaveBeenCalledWith(false);
      expect(form.setAutoScaleY).toHaveBeenCalledWith(true);

      fireEvent.click(radios[1]);
      expect(form.setStartAtZero).toHaveBeenCalledWith(true);
      expect(form.setAutoScaleY).toHaveBeenCalledWith(false);
    });

    it('replaces Scatter X and Y zero-baseline checkboxes with Auto | Zero toggles', () => {
      const { container, form } = renderAppearance({
        chartType: 'scatter',
        startAtZero: false,
        startAtZeroX: true,
      });

      expect(findById(container, 'cfg-scatter-start-at-zero-y')).toBeNull();
      expect(findById(container, 'cfg-scatter-start-at-zero-x')).toBeNull();

      const yGroup = screen.getByRole('radiogroup', { name: 'Vertical (Y) Axis Baseline' });
      const yRadios = findElements(yGroup, (el) => el.getAttribute('role') === 'radio');
      expect(yRadios[0].getAttribute('aria-checked')).toBe('true');
      expect(yRadios[1].getAttribute('aria-checked')).toBe('false');

      fireEvent.click(yRadios[1]);
      expect(form.setStartAtZero).toHaveBeenCalledWith(true);
      expect(form.setAutoScaleY).toHaveBeenCalledWith(false);

      const xGroup = screen.getByRole('radiogroup', { name: 'Horizontal (X) Axis Baseline' });
      const xRadios = findElements(xGroup, (el) => el.getAttribute('role') === 'radio');
      expect(xRadios[0].getAttribute('aria-checked')).toBe('false');
      expect(xRadios[1].getAttribute('aria-checked')).toBe('true');

      fireEvent.click(xRadios[0]);
      expect(form.setStartAtZeroX).toHaveBeenCalledWith(false);
      expect(form.setAutoScaleX).toHaveBeenCalledWith(true);
    });
  });

  describe('Histogram nested Include Median & Mode', () => {
    it('hides Include Median & Mode when Show Summary Statistics Card is unchecked', () => {
      const { container } = renderAppearance({
        chartType: 'histogram',
        showSummaryStats: false,
      });

      expect(findById(container, 'cfg-show-summary-stats')).toBeTruthy();
      expect(findById(container, 'cfg-show-median-mode')).toBeNull();
    });

    it('renders Include Median & Mode nested under Show Summary Statistics Card when checked', () => {
      const { container, form } = renderAppearance({
        chartType: 'histogram',
        showSummaryStats: true,
        showMedianMode: false,
      });

      const medianCheckbox = findById(container, 'cfg-show-median-mode') as HTMLInputElement;
      expect(medianCheckbox).toBeTruthy();

      expect(hasAncestorWithClass(medianCheckbox, 'nestedControl')).toBe(true);

      toggleCheckbox(medianCheckbox, true);
      expect(form.setShowMedianMode).toHaveBeenCalledWith(true);
    });
  });
});
