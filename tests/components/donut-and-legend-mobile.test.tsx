import fs from 'fs';
import path from 'path';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DonutChart } from '../../src/components/chart/DonutChart';
import { ChartLegend } from '../../src/components/chart/ChartLegend';
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

describe('DonutChart Mobile Proportions, ChartLegend Ergonomics & reset.css Containment (16.3)', () => {
  let originalGetBoundingClientRect: any;

  beforeEach(() => {
    originalGetBoundingClientRect = (MockElement.prototype as any).getBoundingClientRect;
    // Simulate a 246px compact chart container (e.g. inside a 320px mobile card)
    (MockElement.prototype as any).getBoundingClientRect = function () {
      return {
        width: 246,
        height: 246,
        top: 0,
        left: 0,
        right: 246,
        bottom: 246,
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

  describe('1. DonutChart compact mobile proportions & contrast', () => {
    it('renders a square-ish viewBox (not 800x360) at 246px container width and scales ring diameter cleanly', () => {
      const { container } = render(
        <DonutChart
          categories={['Alpha', 'Beta', 'Gamma']}
          data={[45, 35, 20]}
        />
      );

      const svg = findElements(container, (el) => el.tagName === 'SVG')[0];
      expect(svg).toBeDefined();
      const viewBox = svg.getAttribute('viewBox') || '';
      const [vx, vy, vw, vh] = viewBox.split(/\s+/).map(Number);

      expect(vx).toBe(0);
      expect(vy).toBe(0);
      expect(vw).toBe(246);
      expect(vh).toBeGreaterThanOrEqual(220);
      expect(vh).toBeLessThanOrEqual(280);

      // Ring diameter should be ~160-200px in the 246px coordinate frame
      const circles = findElements(svg, (el) => el.tagName === 'CIRCLE');
      expect(circles.length).toBeGreaterThan(0);
      const ringRadius = Number(circles[0].getAttribute('r'));
      const strokeWidth = Number(circles[0].getAttribute('stroke-width'));
      const outerDiameter = (ringRadius + strokeWidth / 2) * 2;
      expect(outerDiameter).toBeGreaterThanOrEqual(150);
      expect(outerDiameter).toBeLessThanOrEqual(210);
    });

    it('uses semantic --chart-donut-others-fill token for the "Others" rollup slice', () => {
      const { container } = render(
        <DonutChart
          categories={['A', 'B', 'C', 'D', 'E', 'F', 'G']}
          data={[30, 25, 20, 10, 8, 4, 3]}
          groupOthers={true}
        />
      );

      const svg = findElements(container, (el) => el.tagName === 'SVG')[0];
      const othersSlice = findElements(
        svg,
        (el) => el.tagName === 'CIRCLE' && (el.getAttribute('aria-label') || '').startsWith('Others:')
      )[0];

      expect(othersSlice).toBeDefined();
      expect(othersSlice.getAttribute('stroke')).toBe('var(--chart-donut-others-fill)');
    });

    it('hides sliceValueText on narrow slivers to prevent label overlap on mobile', () => {
      const { container } = render(
        <DonutChart
          categories={['Major', 'Tiny']}
          data={[97, 3]}
          showValues={true}
        />
      );

      const svg = findElements(container, (el) => el.tagName === 'SVG')[0];
      const valueLabels = findElements(
        svg,
        (el) => el.tagName === 'TEXT' && (el.textContent || '').includes('%')
      );

      // Only the 97% slice should render a label; the 3% sliver should be omitted
      expect(valueLabels.length).toBe(1);
      expect(valueLabels[0].textContent).toBe('97%');
    });
  });

  describe('2. ChartLegend tap-toggle isolation', () => {
    const items = [
      { id: 'alpha', name: 'Alpha (50%)', color: 'var(--color-node-1)' },
      { id: 'beta', name: 'Beta (30%)', color: 'var(--color-node-2)' },
      { id: 'gamma', name: 'Gamma (20%)', color: 'var(--color-node-3)' },
    ];

    it('sets aria-pressed="true" on first tap/click and clears isolation on second tap/click', () => {
      const onHover = vi.fn();
      const { container } = render(<ChartLegend items={items} onHover={onHover} />);

      const buttons = findElements(container, (el) => el.tagName === 'BUTTON');
      expect(buttons.length).toBe(3);
      expect(buttons[0].getAttribute('aria-pressed')).toBe('false');

      // First click isolates item 0
      fireEvent.click(buttons[0]);
      expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
      expect(onHover).toHaveBeenLastCalledWith(0);

      // Second click on same item clears isolation
      fireEvent.click(buttons[0]);
      expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
      expect(onHover).toHaveBeenLastCalledWith(null);
    });

    it('switches isolation to a different item when clicked', () => {
      const onHover = vi.fn();
      const { container } = render(<ChartLegend items={items} onHover={onHover} />);

      const buttons = findElements(container, (el) => el.tagName === 'BUTTON');

      fireEvent.click(buttons[0]);
      expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
      expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
      expect(onHover).toHaveBeenLastCalledWith(0);

      fireEvent.click(buttons[1]);
      expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
      expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
      expect(onHover).toHaveBeenLastCalledWith(1);
    });
  });

  describe('3. reset.css 44x44px containment in CSS modules', () => {
    const readCss = (relPath: string) =>
      fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');

    it('contains reset.css min-height/min-width on ChartLegend .legendItem', () => {
      const css = readCss('src/components/chart/ChartLegend.module.css');
      expect(css).toMatch(/min-height:\s*var\(--chart-legend-pill-min-height\)/);
      expect(css).toMatch(/min-width:\s*unset/);
    });

    it('contains reset.css on ChartTableModal, Modal, Drawer close buttons and TieredSlider .tierBtn', () => {
      const tableModalCss = readCss('src/components/chart/ChartTableModal.module.css');
      expect(tableModalCss).toMatch(/\.closeButton[\s\S]*?min-width:\s*unset/);
      expect(tableModalCss).toMatch(/\.closeButton[\s\S]*?min-height:\s*unset/);

      const modalCss = readCss('src/components/ui/Modal.module.css');
      expect(modalCss).toMatch(/\.closeButton[\s\S]*?min-width:\s*unset/);
      expect(modalCss).toMatch(/\.closeButton[\s\S]*?min-height:\s*unset/);

      const drawerCss = readCss('src/components/ui/Drawer.module.css');
      expect(drawerCss).toMatch(/\.closeButton[\s\S]*?min-width:\s*36px/);
      expect(drawerCss).toMatch(/\.closeButton[\s\S]*?min-height:\s*36px/);

      const sliderCss = readCss('src/components/ui/TieredSlider.module.css');
      expect(sliderCss).toMatch(/\.tierBtn[\s\S]*?min-width:\s*unset/);
      expect(sliderCss).toMatch(/\.tierBtn[\s\S]*?min-height:\s*unset/);
      expect(sliderCss).toMatch(/::-webkit-slider-thumb[\s\S]*?width:\s*24px/);
      expect(sliderCss).toMatch(/::-moz-range-thumb[\s\S]*?width:\s*24px/);
    });
  });
});
