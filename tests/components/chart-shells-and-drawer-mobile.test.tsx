import fs from 'node:fs';
import path from 'node:path';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Step4Review } from '../../src/components/chart/drawer/panels/Step4Review';
import { StandardDataControls } from '../../src/components/chart/drawer/controls/StandardDataControls';
import { RangePreviewMatrix } from '../../src/components/chart/RangePreviewMatrix';
import { ChartGhostWireframe } from '../../src/components/chart/ChartGhostWireframe';
import { ChartTableModal } from '../../src/components/chart/ChartTableModal';
import type { ChartDataset } from '../../src/types/chart';

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

describe('Chart Shells, Modals, Config Drawer & Authoring Mobile Polish (16.5)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('1. Step4Review renders ChartRouter (not empty fallback) when given a rawValues-only histogram dataset', () => {
    const rawValuesDataset: ChartDataset = {
      chartId: 'test-hist',
      title: 'Test Histogram',
      asOfDate: '2026-01-01',
      sanitizedCsvContent: '',
      chartType: 'histogram',
      categories: [],
      series: [],
      rawValues: [12, 18, 22, 25, 30, 34, 41, 45, 52, 60],
    };

    const { container } = render(
      <Step4Review
        isSyncing={false}
        previewDataset={rawValuesDataset}
        chartType="histogram"
        accentColor="var(--folio-primary)"
        range="A1:A11"
      />
    );

    const text = container.textContent || '';
    expect(text).not.toContain('No data points found in range');
    const svgs = findElements(container, (el) => el.tagName === 'SVG');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('2. StandardDataControls renders series items with defined .seriesCountBadge / .draggableRowContent styling and exposes micro-arrows', () => {
    const drawerCss = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/chart/ChartConfigDrawer.module.css'),
      'utf8'
    );
    expect(drawerCss).toContain('.draggableRowContent');
    expect(drawerCss).toContain('.seriesCountBadge');

    const { container } = render(
      <StandardDataControls
        chartType="bar"
        categoryColIndex={0}
        setCategoryColIndex={vi.fn()}
        detectedColumns={[
          { index: 0, label: 'Region' },
          { index: 1, label: 'Total Enrolled Learners SY 2025-2026' },
          { index: 2, label: 'Graduated Learners SY 2025-2026' },
        ]}
        includedSeriesIndices={[1, 2]}
        setIncludedSeriesIndices={vi.fn()}
        binStrategy="auto"
        setBinStrategy={vi.fn()}
        customBinMode="step"
        setCustomBinMode={vi.fn()}
        bucketSize={10}
        setBucketSize={vi.fn()}
        binCount={5}
        setBinCount={vi.fn()}
        histogramYMode="frequency"
        setHistogramYMode={vi.fn()}
        groupOthers={false}
        setGroupOthers={vi.fn()}
        sortField="sheet"
        setSortField={vi.fn()}
        accentColor="var(--folio-primary)"
        handleToggleSeries={vi.fn()}
      />
    );

    // Open the collapsed "Metric Series (Y-Axis)" accordion if needed
    const buttons = findElements(container, (el) => el.tagName === 'BUTTON');
    const metricToggle = buttons.find((b) => (b.textContent || '').includes('Metric Series'));
    if (metricToggle && metricToggle.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(metricToggle);
    }

    const moveUpButtons = findElements(
      container,
      (el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Move item up'
    );
    const moveDownButtons = findElements(
      container,
      (el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Move item down'
    );
    expect(moveUpButtons.length).toBeGreaterThan(0);
    expect(moveDownButtons.length).toBeGreaterThan(0);
  });

  it('3. RangePreviewMatrix supports selecting a multi-cell range via touch/tap anchor + end cell selection', () => {
    const onRangeSelect = vi.fn();
    const matrix = [
      ['Region', 'Enrolled', 'Graduated'],
      ['North', 120, 110],
      ['South', 95, 90],
    ];

    const { container } = render(
      <RangePreviewMatrix
        matrix={matrix}
        range="A1:A1"
        isSelecting={true}
        onRangeSelect={onRangeSelect}
      />
    );

    const cells = findElements(container, (el) => el.tagName === 'TD' && (el.getAttribute('title') || '').startsWith('Cell '));
    const cellA1 = cells.find((c) => c.getAttribute('title') === 'Cell A1');
    const cellC3 = cells.find((c) => c.getAttribute('title') === 'Cell C3');
    expect(cellA1).toBeDefined();
    expect(cellC3).toBeDefined();

    // First tap / click on A1 (anchor)
    fireEvent.click(cellA1);
    expect(onRangeSelect).toHaveBeenLastCalledWith('A1:A1');

    // Second tap / click on C3 should extend the range to A1:C3
    fireEvent.click(cellC3);
    expect(onRangeSelect).toHaveBeenLastCalledWith('A1:C3');
  });

  it('4. ChartGhostWireframe does not use preserveAspectRatio="none"', () => {
    const { container } = render(<ChartGhostWireframe />);
    const svg = findElements(container, (el) => el.tagName === 'SVG')[0];
    expect(svg).toBeDefined();
    expect(svg.getAttribute('preserveAspectRatio')).not.toBe('none');
  });

  it('5. ChartRouter empty state preserves .emptySubtitle visibility in CSS', () => {
    const routerCss = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/chart/ChartRouter.module.css'),
      'utf8'
    );
    expect(routerCss).not.toMatch(/\.emptySubtitle\s*\{[^}]*display\s*:\s*none/);
  });

  it('6. ChartTableModal uses compact minTableWidth so 1-2 series tables fit 375px-480px viewports cleanly', () => {
    const dataset: ChartDataset = {
      chartId: 'test-bar',
      title: 'Regional Enrollment',
      asOfDate: '2026-01-01',
      sanitizedCsvContent: '',
      chartType: 'bar',
      categories: ['North', 'South'],
      series: [
        { name: 'Enrolled', data: [120, 95] },
        { name: 'Graduated', data: [110, 90] },
      ],
    };

    render(
      <ChartTableModal
        isOpen={true}
        onClose={vi.fn()}
        dataset={dataset}
        title="Regional Enrollment"
      />
    );

    const table = findElements(document.body, (el) => el.tagName === 'TABLE')[0];
    expect(table).toBeDefined();
    const minWidth = parseInt(table.style.minWidth || '0', 10);
    expect(minWidth).toBeLessThanOrEqual(375);
  });
});
