import fs from 'fs';
import path from 'path';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BarChart } from '../../src/components/chart/BarChart';
import { LineChart } from '../../src/components/chart/LineChart';
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

describe('Cartesian Charts Mobile Typography, Marks, Hit-Targets & Margins (16.2)', () => {
  let originalGetBoundingClientRect: any;

  beforeEach(() => {
    originalGetBoundingClientRect = (MockElement.prototype as any).getBoundingClientRect;
    // Simulate a 246px compact chart container (e.g. inside a 320px mobile card)
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

  describe('1. BarChart compact mobile behavior', () => {
    it('uses responsive viewBox width (not fixed 800) at 246px container width', () => {
      const { container } = render(
        <BarChart
          categories={['Q1', 'Q2', 'Q3']}
          series={[{ name: 'Revenue', data: [100, 200, 150] }]}
        />
      );

      const svg = findElements(container, (el) => el.tagName === 'SVG')[0];
      expect(svg).toBeDefined();
      const viewBox = svg.getAttribute('viewBox') || '';
      const [vx, vy, vw, vh] = viewBox.split(/\s+/).map(Number);
      expect(vx).toBe(0);
      expect(vy).toBe(0);
      expect(vw).toBe(246);
      expect(vh).toBeGreaterThanOrEqual(240);
    });

    it('expands horizontal SVG height for multi-category clustered datasets so bars are not squeezed', () => {
      const categories = ['Cat A', 'Cat B', 'Cat C', 'Cat D', 'Cat E', 'Cat F'];
      const series = [
        { name: 'S1', data: [10, 20, 30, 40, 50, 60] },
        { name: 'S2', data: [15, 25, 35, 45, 55, 65] },
      ];

      const { container } = render(
        <BarChart
          categories={categories}
          series={series}
          orientation="horizontal"
        />
      );

      const svg = findElements(container, (el) => el.tagName === 'SVG')[0];
      const viewBox = svg.getAttribute('viewBox') || '';
      const [, , , vh] = viewBox.split(/\s+/).map(Number);
      // 6 categories * 2 series with >= 12px bar thickness requires height > 260
      expect(vh).toBeGreaterThan(260);

      // Verify rendered bar rects have thickness >= 12px
      const barRects = findElements(
        svg,
        (el) => el.tagName === 'RECT' && el.getAttribute('aria-label')
      );
      expect(barRects.length).toBe(12);
      for (const rect of barRects) {
        const barH = Number(rect.getAttribute('height'));
        expect(barH).toBeGreaterThanOrEqual(12);
      }
    });

    it('enforces readable minimum bar width (>= 10px) on dense 12x3 vertical clustered charts', () => {
      const categories = Array.from({ length: 12 }, (_, i) => `M${i + 1}`);
      const series = [
        { name: 'A', data: Array(12).fill(50) },
        { name: 'B', data: Array(12).fill(75) },
        { name: 'C', data: Array(12).fill(100) },
      ];

      const { container } = render(<BarChart categories={categories} series={series} />);
      const svg = findElements(container, (el) => el.tagName === 'SVG')[0];
      const barRects = findElements(
        svg,
        (el) => el.tagName === 'RECT' && el.getAttribute('aria-label')
      );
      expect(barRects.length).toBe(36);
      for (const rect of barRects) {
        const barW = Number(rect.getAttribute('width'));
        expect(barW).toBeGreaterThanOrEqual(10);
      }
    });

    it('uses compact left margin cap consistently from chartDimensions.ts for long horizontal labels', () => {
      const { container } = render(
        <BarChart
          categories={['Very Long Category Name Exceeding Cap']}
          series={[{ name: 'S1', data: [100] }]}
          orientation="horizontal"
        />
      );

      const svg = findElements(container, (el) => el.tagName === 'SVG')[0];
      const baseline = findElements(
        svg,
        (el) => el.tagName === 'LINE' && (el.className || '').includes('baseline')
      )[0];
      const x1 = Number(baseline.getAttribute('x1'));
      // Compact left margin cap at 246px is min(112, floor(246 * 0.38)) = 93
      expect(x1).toBeLessThanOrEqual(112);
      expect(x1).toBeGreaterThanOrEqual(44);
    });
  });

  describe('2. LineChart touch hit-targets & X-tick decimation', () => {
    it('renders transparent touch hit-targets (r >= 18) for data points and decimates 12-category X-ticks', () => {
      const categories = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      const series = [
        { name: 'Amount', data: [1000000, 1200000, 1400000, 1100000, 1500000, 1800000, 1700000, 1600000, 1900000, 2000000, 2100000, 2200000] },
      ];

      const { container } = render(
        <LineChart
          categories={categories}
          series={series}
          markerSize="compact"
          yLabel="Amount (PHP)"
        />
      );

      const svg = findElements(container, (el) => el.tagName === 'SVG')[0];
      const viewBox = svg.getAttribute('viewBox') || '';
      const [, , vw] = viewBox.split(/\s+/).map(Number);
      expect(vw).toBe(246);

      // Transparent touch hit-targets with r >= 18
      const hitTargets = findElements(
        svg,
        (el) =>
          el.tagName === 'CIRCLE' &&
          el.getAttribute('fill') === 'transparent' &&
          Number(el.getAttribute('r')) >= 18
      );
      expect(hitTargets.length).toBe(12);

      // Decimated X-axis labels (fewer than 12 rendered, preserving first and last)
      const xLabels = findElements(
        svg,
        (el) =>
          el.tagName === 'TEXT' &&
          (el.className || '').includes('axisText') &&
          !(el.className || '').includes('axisTextY')
      );
      expect(xLabels.length).toBeLessThan(12);
      expect(xLabels.length).toBeGreaterThanOrEqual(2);
      expect(xLabels[0].textContent).toBe('Jan');
      expect(xLabels[xLabels.length - 1].textContent).toBe('Dec');
    });
  });

  describe('3. ScatterPlot touch hit-targets & axisTitle parity', () => {
    it('renders transparent touch hit-targets (r >= 18) and renders axisTitle elements on mobile', () => {
      const points = [
        { x: 10, y: 100000, label: 'P1' },
        { x: 25, y: 500000, label: 'P2' },
        { x: 40, y: 1200000, label: 'P3' },
      ];

      const { container } = render(
        <ScatterPlot
          points={points}
          xLabel="Hours"
          yLabel="Score"
          markerSize="compact"
        />
      );

      const svg = findElements(container, (el) => el.tagName === 'SVG')[0];
      const hitTargets = findElements(
        svg,
        (el) =>
          el.tagName === 'CIRCLE' &&
          el.getAttribute('fill') === 'transparent' &&
          Number(el.getAttribute('r')) >= 18
      );
      expect(hitTargets.length).toBe(3);

      const axisTitles = findElements(
        svg,
        (el) => el.tagName === 'TEXT' && (el.className || '').includes('axisTitle')
      );
      expect(axisTitles.length).toBe(2);
      expect(axisTitles.map((t) => t.textContent)).toEqual(['Hours', 'Score']);
    });
  });

  describe('4. HistogramChart meanLabel edge flip & short-bar hit targets', () => {
    it('flips meanLabel text-anchor to "end" when mean sits near right edge (>= 80%) and renders tappable hit targets for short bars', () => {
      // Heavily right-clustered values so mean sits near the right domain edge
      const rawValues = [10, 90, 92, 95, 96, 97, 98, 99, 100, 100, 100, 100];

      const { container } = render(
        <HistogramChart
          rawValues={rawValues}
          binStrategy="custom"
          binCount={10}
          showReferenceGuide={true}
        />
      );

      const svg = findElements(container, (el) => el.tagName === 'SVG')[0];
      const meanLabel = findElements(
        svg,
        (el) => el.tagName === 'TEXT' && (el.className || '').includes('meanLabel')
      )[0];
      expect(meanLabel).toBeDefined();
      expect(meanLabel.getAttribute('text-anchor')).toBe('end');

      // Short 1-unit bar at [10-19] should have a tappable transparent hit rect >= 24px tall
      const hitRects = findElements(
        svg,
        (el) =>
          el.tagName === 'RECT' &&
          el.getAttribute('fill') === 'transparent' &&
          Number(el.getAttribute('height')) >= 24
      );
      expect(hitRects.length).toBeGreaterThan(0);
    });
  });

  describe('5. Static CSS check: no 8px mobile .axisText shrink', () => {
    it('confirms none of the 4 Cartesian CSS modules shrink .axisText to 8px under @media (max-width: 640px)', () => {
      const cssFiles = [
        'src/components/chart/BarChart.module.css',
        'src/components/chart/LineChart.module.css',
        'src/components/chart/ScatterPlot.module.css',
        'src/components/chart/HistogramChart.module.css',
      ];

      for (const relPath of cssFiles) {
        const content = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
        expect(content).not.toMatch(/font-size:\s*8px/);
      }

      // Also confirm ScatterPlot.module.css does not hide .axisTitle on mobile
      const scatterCss = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/chart/ScatterPlot.module.css'),
        'utf8'
      );
      expect(scatterCss).not.toMatch(/\.axisTitle\s*\{[^}]*display:\s*none/);
    });
  });
});
