import { act } from 'react';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { ChartCard } from '../../src/components/chart/ChartCard';
import type { ChartDataset } from '../../src/types/chart';

vi.mock('../../src/hooks/useDeveloperMode', () => ({
  useDeveloperMode: () => ({
    isDevMode: false,
    isDesktop: true,
    showToast: vi.fn(),
  }),
}));

const MULTI_SERIES_DATASET: ChartDataset = {
  chartId: 'kebab-test-chart',
  title: 'Enrollment by Cohort',
  subtitle: 'Annual breakdown',
  asOfDate: '2026-03-01',
  sanitizedCsvContent: 'Category,Cohort A,Cohort B\n2024,100,120\n2025,140,160',
  chartType: 'bar',
  categories: ['2024', '2025'],
  series: [
    { name: 'Cohort A', data: [100, 140] },
    { name: 'Cohort B', data: [120, 160] },
  ],
};

describe('ChartCard Mobile Kebab Menu & Legend Toggle (16.7)', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-csv'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('1. Kebab IconButton renders with aria-haspopup="menu" and toggles aria-expanded', () => {
    render(<ChartCard chartId="kebab-test-chart" dataset={MULTI_SERIES_DATASET} />);

    const kebabBtn = screen.getByRole('button', { name: 'Chart actions' });
    expect(kebabBtn.getAttribute('aria-haspopup')).toBe('menu');
    expect(kebabBtn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(kebabBtn);
    expect(kebabBtn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', { name: 'Chart actions menu' })).toBeTruthy();

    fireEvent.click(kebabBtn);
    expect(kebabBtn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('2. View Table menuitem opens ChartTableModal and closes the menu', () => {
    render(<ChartCard chartId="kebab-test-chart" dataset={MULTI_SERIES_DATASET} />);

    fireEvent.click(screen.getByRole('button', { name: 'Chart actions' }));
    const viewTableItem = screen.getByRole('menuitem', { name: 'View Table' });
    fireEvent.click(viewTableItem);

    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('3. Download Data (CSV) menuitem triggers CSV export and closes the menu', () => {
    render(<ChartCard chartId="kebab-test-chart" dataset={MULTI_SERIES_DATASET} />);

    fireEvent.click(screen.getByRole('button', { name: 'Chart actions' }));
    const downloadItem = screen.getByRole('menuitem', { name: 'Download Data (CSV)' });
    fireEvent.click(downloadItem);

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('4. Show Legend menuitemcheckbox defaults to aria-checked="false" (hidden) and toggles ChartLegend visibility', () => {
    const { container } = render(
      <ChartCard chartId="kebab-test-chart" dataset={MULTI_SERIES_DATASET} />
    );

    // Legend hidden by default
    expect(container.querySelector('[aria-label="Chart legend"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Chart actions' }));
    const legendToggle = screen.getByRole('menuitemcheckbox', { name: /Show Legend/i });
    expect(legendToggle.getAttribute('aria-checked')).toBe('false');

    // Toggle on -> legend visible
    fireEvent.click(legendToggle);
    expect(legendToggle.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('[aria-label="Chart legend"]')).toBeTruthy();

    // Toggle back off -> legend hidden
    fireEvent.click(legendToggle);
    expect(legendToggle.getAttribute('aria-checked')).toBe('false');
    expect(container.querySelector('[aria-label="Chart legend"]')).toBeNull();
  });

  it('5. Escape keydown and outside pointerdown dismiss the kebab menu', () => {
    render(
      <div>
        <div data-testid="outside-area">Outside</div>
        <ChartCard chartId="kebab-test-chart" dataset={MULTI_SERIES_DATASET} />
      </div>
    );

    const kebabBtn = screen.getByRole('button', { name: 'Chart actions' });

    // Dismiss via Escape
    fireEvent.click(kebabBtn);
    expect(screen.getByRole('menu')).toBeTruthy();
    act(() => {
      document.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }));
    });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(kebabBtn.getAttribute('aria-expanded')).toBe('false');

    // Dismiss via outside pointerdown
    fireEvent.click(kebabBtn);
    expect(screen.getByRole('menu')).toBeTruthy();
    const outsideEl = screen.getByTestId('outside-area');
    act(() => {
      const pointerEvent = new Event('pointerdown');
      Object.defineProperty(pointerEvent, 'target', { value: outsideEl });
      document.dispatchEvent(pointerEvent);
    });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(kebabBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('6. Does not render kebab button when dataset is missing (hasData is false)', () => {
    render(<ChartCard chartId="empty-chart" dataset={null} />);
    expect(screen.queryByRole('button', { name: 'Chart actions' })).toBeNull();
  });
});
