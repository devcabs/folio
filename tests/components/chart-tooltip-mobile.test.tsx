import { render, cleanup, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

function dispatch(target: any, type: string, init: Record<string, any> = {}) {
  act(() => {
    target.dispatchEvent({ type, bubbles: true, ...init });
  });
}
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChartTooltip } from '../../src/components/chart/ChartTooltip';
import { useChartTooltip } from '../../src/hooks/useChartTooltip';
import { BarChart } from '../../src/components/chart/BarChart';
import { LineChart } from '../../src/components/chart/LineChart';
import { DonutChart } from '../../src/components/chart/DonutChart';
import { ScatterPlot } from '../../src/components/chart/ScatterPlot';
import { HistogramChart } from '../../src/components/chart/HistogramChart';
import { MockElement } from '../helpers/testing-library-shim';

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

describe('ChartTooltip Viewport Clamping, Unit Rendering & Unified Touch Lifecycle (16.4)', () => {
  let originalGetBoundingClientRect: any;

  beforeEach(() => {
    originalGetBoundingClientRect = (MockElement.prototype as any).getBoundingClientRect;
    (MockElement.prototype as any).getBoundingClientRect = function () {
      return {
        width: 246,
        height: 260,
        top: 0,
        left: 0,
        right: 246,
        bottom: 260,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    };
  });

  afterEach(() => {
    cleanup();
    (MockElement.prototype as any).getBoundingClientRect = originalGetBoundingClientRect;
    vi.restoreAllMocks();
  });

  describe('1. ChartTooltip unit rendering & placement', () => {
    it('renders unit beside value when provided and avoids duplication if already present', () => {
      const { container, rerender } = render(
        <ChartTooltip
          visible={true}
          x={120}
          y={120}
          title="Conversion"
          value="48"
          unit="%"
        />
      );

      expect(container.textContent).toContain('48');
      expect(container.textContent).toContain('%');
      const percentMatches = (container.textContent || '').match(/%/g) || [];
      expect(percentMatches.length).toBe(1);

      // Should not duplicate unit when formatted value already ends with it
      rerender(
        <ChartTooltip
          visible={true}
          x={120}
          y={120}
          title="Conversion"
          value="48%"
          unit="%"
        />
      );
      const dedupedMatches = (container.textContent || '').match(/%/g) || [];
      expect(dedupedMatches.length).toBe(1);
    });

    it('applies placement="below" styling when flipped near the top edge', () => {
      const { container } = render(
        <ChartTooltip
          visible={true}
          x={120}
          y={16}
          placement="below"
          title="Top Point"
          value={99}
        />
      );

      const tooltip = findElements(container, (el) => el.getAttribute('role') === 'tooltip')[0];
      expect(tooltip).toBeDefined();
      expect(tooltip.getAttribute('data-placement')).toBe('below');
    });
  });

  describe('2. useChartTooltip clamping & placement flip', () => {
    it('clamps left, right, and flips placement to below near top edge in a 246px container', () => {
      const { result } = renderHook(() =>
        useChartTooltip({
          containerWidth: 246,
          containerHeight: 260,
          tooltipWidth: 160,
        })
      );

      // Left edge clamp (x < halfWidth = 80, edgePadding = 8 -> minX = 88)
      act(() => {
        result.current.showTooltip({ x: 10, y: 150, value: 42 });
      });
      expect(result.current.tooltipState.x).toBeGreaterThanOrEqual(88);
      expect(result.current.tooltipState.placement).toBe('above');

      // Right edge clamp (x > 246 - 80 = 166, edgePadding = 8 -> maxX = 158)
      act(() => {
        result.current.showTooltip({ x: 240, y: 150, value: 42 });
      });
      expect(result.current.tooltipState.x).toBeLessThanOrEqual(158);
      expect(result.current.tooltipState.placement).toBe('above');

      // Top edge flip (y near top -> placement: 'below')
      act(() => {
        result.current.showTooltip({ x: 123, y: 12, value: 42 });
      });
      expect(result.current.tooltipState.placement).toBe('below');
      expect(result.current.tooltipState.y).toBeGreaterThanOrEqual(8);
    });
  });

  describe('3. Unified touch tap-to-inspect & dismiss lifecycle across all 5 visualizers', () => {
    it('BarChart retains tooltip after touch pointerup/pointerleave and dismisses on outside tap or Escape', () => {
      const { container } = render(
        <BarChart
          categories={['Q1', 'Q2']}
          series={[{ name: 'Revenue', data: [100, 200] }]}
          unit="M"
        />
      );

      const bar = findElements(container, (el) => el.tagName === 'RECT' && el.getAttribute('tabindex') === '0')[0];
      expect(bar).toBeDefined();

      dispatch(bar, 'pointerover', { pointerType: 'touch', clientX: 60, clientY: 120 });
      dispatch(bar, 'pointerup', { pointerType: 'touch', clientX: 60, clientY: 120 });
      dispatch(bar, 'pointerout', { pointerType: 'touch', clientX: 60, clientY: 120 });

      let tooltip = findElements(container, (el) => el.getAttribute('role') === 'tooltip')[0];
      expect(tooltip).toBeDefined();
      expect(tooltip.textContent).toContain('M');

      // Escape dismisses
      dispatch(document, 'keydown', { key: 'Escape' });
      tooltip = findElements(container, (el) => el.getAttribute('role') === 'tooltip')[0];
      expect(tooltip).toBeUndefined();

      // Re-open via touch and dismiss via outside pointerdown
      dispatch(bar, 'pointerover', { pointerType: 'touch', clientX: 60, clientY: 120 });
      expect(findElements(container, (el) => el.getAttribute('role') === 'tooltip').length).toBe(1);

      dispatch(document.body, 'pointerdown', { pointerType: 'touch' });
      expect(findElements(container, (el) => el.getAttribute('role') === 'tooltip').length).toBe(0);
    });

    it('LineChart retains tooltip after touch pointerup/pointerleave and dismisses on outside tap or Escape', () => {
      const { container } = render(
        <LineChart
          categories={['Jan', 'Feb']}
          series={[{ name: 'Users', data: [50, 80] }]}
          unit="k"
        />
      );

      const hitTarget = findElements(container, (el) => el.tagName === 'CIRCLE' && el.getAttribute('tabindex') === '0')[0];
      expect(hitTarget).toBeDefined();

      dispatch(hitTarget, 'pointerover', { pointerType: 'touch', clientX: 80, clientY: 100 });
      dispatch(hitTarget, 'pointerup', { pointerType: 'touch', clientX: 80, clientY: 100 });
      dispatch(hitTarget, 'pointerout', { pointerType: 'touch', clientX: 80, clientY: 100 });

      expect(findElements(container, (el) => el.getAttribute('role') === 'tooltip').length).toBe(1);

      dispatch(document, 'keydown', { key: 'Escape' });
      expect(findElements(container, (el) => el.getAttribute('role') === 'tooltip').length).toBe(0);
    });

    it('DonutChart retains slice tooltip & center callout after touch pointerleave and dismisses on outside tap', () => {
      const { container } = render(
        <DonutChart
          categories={['Alpha', 'Beta']}
          data={[60, 40]}
        />
      );

      const slice = findElements(container, (el) => el.tagName === 'CIRCLE' && el.getAttribute('tabindex') === '0')[0];
      expect(slice).toBeDefined();

      dispatch(slice, 'pointerover', { pointerType: 'touch', clientX: 120, clientY: 80 });
      dispatch(slice, 'pointerup', { pointerType: 'touch', clientX: 120, clientY: 80 });
      dispatch(slice, 'pointerout', { pointerType: 'touch', clientX: 120, clientY: 80 });

      const tooltip = findElements(container, (el) => el.getAttribute('role') === 'tooltip')[0];
      expect(tooltip).toBeDefined();
      expect(tooltip.textContent).toContain('Alpha');

      dispatch(document.body, 'pointerdown', { pointerType: 'touch' });
      expect(findElements(container, (el) => el.getAttribute('role') === 'tooltip').length).toBe(0);
    });

    it('ScatterPlot retains tooltip after touch pointerleave and dismisses on Escape', () => {
      const { container } = render(
        <ScatterPlot
          points={[
            { x: 10, y: 20, label: 'P1' },
            { x: 90, y: 80, label: 'P2' },
          ]}
        />
      );

      const hitTarget = findElements(container, (el) => el.tagName === 'CIRCLE' && el.getAttribute('tabindex') === '0')[0];
      expect(hitTarget).toBeDefined();

      dispatch(hitTarget, 'pointerover', { pointerType: 'touch', clientX: 90, clientY: 100 });
      dispatch(hitTarget, 'pointerup', { pointerType: 'touch', clientX: 90, clientY: 100 });
      dispatch(hitTarget, 'pointerout', { pointerType: 'touch', clientX: 90, clientY: 100 });

      expect(findElements(container, (el) => el.getAttribute('role') === 'tooltip').length).toBe(1);

      dispatch(document, 'keydown', { key: 'Escape' });
      expect(findElements(container, (el) => el.getAttribute('role') === 'tooltip').length).toBe(0);
    });

    it('HistogramChart retains tooltip after touch pointerleave and dismisses on outside tap', () => {
      const { container } = render(
        <HistogramChart
          rawValues={[10, 12, 15, 20, 22, 25, 30]}
          unit="ms"
        />
      );

      const hitTarget = findElements(container, (el) => el.tagName === 'RECT' && el.getAttribute('tabindex') === '0')[0];
      expect(hitTarget).toBeDefined();

      dispatch(hitTarget, 'pointerover', { pointerType: 'touch', clientX: 70, clientY: 110 });
      dispatch(hitTarget, 'pointerup', { pointerType: 'touch', clientX: 70, clientY: 110 });
      dispatch(hitTarget, 'pointerout', { pointerType: 'touch', clientX: 70, clientY: 110 });

      expect(findElements(container, (el) => el.getAttribute('role') === 'tooltip').length).toBe(1);

      dispatch(document.body, 'pointerdown', { pointerType: 'touch' });
      expect(findElements(container, (el) => el.getAttribute('role') === 'tooltip').length).toBe(0);
    });
  });

  describe('4. ScatterPlot keyboard focus SVG-to-container coordinate projection', () => {
    it('projects right-edge circle SVG cx into clamped 246px container coordinates on focus', () => {
      const { container } = render(
        <ScatterPlot
          points={[
            { x: 0, y: 0, label: 'Origin' },
            { x: 100, y: 100, label: 'FarRight' },
          ]}
        />
      );

      const circles = findElements(container, (el) => el.tagName === 'CIRCLE' && el.getAttribute('tabindex') === '0');
      expect(circles.length).toBe(2);
      const rightCircle = circles[1];

      dispatch(rightCircle, 'focusin');

      const tooltip = findElements(container, (el) => el.getAttribute('role') === 'tooltip')[0];
      expect(tooltip).toBeDefined();
      const leftPx = parseFloat(tooltip.style.left);
      expect(leftPx).toBeGreaterThanOrEqual(8);
      expect(leftPx).toBeLessThanOrEqual(246 - 8);
    });
  });
});
