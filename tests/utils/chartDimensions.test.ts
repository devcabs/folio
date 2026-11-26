import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '../helpers/testing-library-shim';
import {
  CHART_CANVAS_DIMENSIONS,
  calculateChartPlotArea,
  useChartPlotArea,
  computeDynamicLeftMargin,
  computeTickStep,
  getVisibleTickIndices,
} from '../../src/utils/chartDimensions';
import { useChartContainerWidth } from '../../src/hooks/useChartContainerWidth';

describe('chartDimensions & useChartContainerWidth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('useChartPlotArea / calculateChartPlotArea', () => {
    it('returns positive innerWidth and innerHeight without collapsing below mobile floor for compact widths', () => {
      const compactWidths = [246, 301, 406];

      for (const width of compactWidths) {
        const { result } = renderHook(() =>
          useChartPlotArea({ width, isCompact: true })
        );

        expect(result.current.width).toBe(width);
        expect(result.current.innerWidth).toBeGreaterThan(0);
        expect(result.current.innerHeight).toBeGreaterThan(0);
        expect(result.current.height).toBeGreaterThanOrEqual(
          CHART_CANVAS_DIMENSIONS.mobileMinHeight
        );
      }
    });

    it('enforces mobileMinHeight even when an undersized height is passed in compact mode', () => {
      const result = calculateChartPlotArea({
        width: 246,
        height: 110,
        isCompact: true,
      });

      expect(result.height).toBe(CHART_CANVAS_DIMENSIONS.mobileMinHeight);
      expect(result.innerHeight).toBeGreaterThan(0);
      expect(result.baselineY).toBe(result.margin.top + result.innerHeight);
    });

    it('aligns dynamicLeftMargin cap with BarChart maxDynamicLeftMargin (180px) on desktop', () => {
      const result = calculateChartPlotArea({
        width: 800,
        dynamicLeftMargin: 180,
        isCompact: false,
      });

      expect(result.margin.left).toBe(180);
      expect(CHART_CANVAS_DIMENSIONS.maxDynamicLeftMargin).toBe(180);
    });

    it('caps dynamicLeftMargin in compact mode so horizontal labels do not starve plotWidth', () => {
      const result = calculateChartPlotArea({
        width: 246,
        dynamicLeftMargin: 180,
        isCompact: true,
      });

      expect(result.margin.left).toBeLessThan(180);
      expect(result.innerWidth).toBeGreaterThan(100);
    });
  });

  describe('computeDynamicLeftMargin', () => {
    it('expands left margin for 6-7 digit Y-ticks and accounts for hasYLabel', () => {
      const shortTicksMargin = computeDynamicLeftMargin({
        tickLabels: ['0', '50', '100'],
        hasYLabel: false,
        isCompact: false,
      });

      const largeTicksNoLabel = computeDynamicLeftMargin({
        tickLabels: ['0', '500,000', '1,500,000'],
        hasYLabel: false,
        isCompact: false,
      });

      const largeTicksWithLabel = computeDynamicLeftMargin({
        tickLabels: ['0', '500,000', '1,500,000'],
        hasYLabel: true,
        isCompact: false,
      });

      expect(largeTicksNoLabel).toBeGreaterThan(shortTicksMargin);
      expect(largeTicksWithLabel).toBeGreaterThan(largeTicksNoLabel);
    });

    it('respects compact viewport bounds so plotWidth remains usable', () => {
      const compactMargin = computeDynamicLeftMargin({
        tickLabels: ['0', '500,000', '1,500,000'],
        hasYLabel: true,
        isCompact: true,
        containerWidth: 246,
      });

      expect(compactMargin).toBeGreaterThanOrEqual(CHART_CANVAS_DIMENSIONS.compactMargins.left);
      expect(compactMargin).toBeLessThanOrEqual(CHART_CANVAS_DIMENSIONS.compactMaxDynamicLeftMargin);
      expect(246 - compactMargin - CHART_CANVAS_DIMENSIONS.compactMargins.right).toBeGreaterThan(100);
    });
  });

  describe('computeTickStep & getVisibleTickIndices', () => {
    it('returns all tick indices when plotWidth is wide', () => {
      const step = computeTickStep(12, 700, 48);
      const indices = getVisibleTickIndices(12, 700, 48);

      expect(step).toBe(1);
      expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    it('decimates 12+ categories cleanly inside 246px-340px while preserving first and last ticks', () => {
      const indices246 = getVisibleTickIndices(12, 246, 48);
      const indices340 = getVisibleTickIndices(16, 340, 52);

      expect(indices246.length).toBeLessThan(12);
      expect(indices246[0]).toBe(0);
      expect(indices246[indices246.length - 1]).toBe(11);

      expect(indices340.length).toBeLessThan(16);
      expect(indices340[0]).toBe(0);
      expect(indices340[indices340.length - 1]).toBe(15);
    });
  });

  describe('useChartContainerWidth', () => {
    it('falls back cleanly to default width (800) when ResizeObserver is absent', () => {
      vi.stubGlobal('ResizeObserver', undefined);

      const { result } = renderHook(() => useChartContainerWidth());

      expect(result.current.width).toBe(800);
      expect(result.current.isCompact).toBe(false);
      expect(result.current.containerRef).toBeDefined();
    });

    it('updates width and isCompact when ResizeObserver reports a compact container width', () => {
      let observerCallback: ((entries: Array<{ contentRect: { width: number } }>) => void) | null = null;
      const disconnectMock = vi.fn();

      class MockResizeObserver {
        constructor(cb: (entries: Array<{ contentRect: { width: number } }>) => void) {
          observerCallback = cb;
        }
        observe() {}
        disconnect() {
          disconnectMock();
        }
      }

      vi.stubGlobal('ResizeObserver', MockResizeObserver);

      const { result, unmount } = renderHook(() => {
        const hook = useChartContainerWidth();
        if (!hook.containerRef.current) {
          hook.containerRef.current = {
            getBoundingClientRect: () => ({ width: 0 }),
          } as unknown as HTMLDivElement;
        }
        return hook;
      });

      expect(observerCallback).not.toBeNull();

      act(() => {
        observerCallback?.([{ contentRect: { width: 319.6 } }]);
      });

      expect(result.current.width).toBe(320);
      expect(result.current.isCompact).toBe(true);

      unmount();
      expect(disconnectMock).toHaveBeenCalledTimes(1);
    });
  });
});
