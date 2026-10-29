import { describe, it, expect } from 'vitest';
import {
  SheetChartConfigSchema,
  type SheetChartConfig,
  type ChartDataset,
} from '../../src/types/chart';
import {
  DraftItemSchema,
  type DraftItem,
} from '../../src/types/draft';

describe('Chart and Staging Type Contracts', () => {
  it('validates decoupled sheet chart config with arbitrary string nodeId', () => {
    const config: SheetChartConfig = {
      chartId: 'chart-enrollment',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sample-sheet-id/edit',
      tabName: 'Summary',
      sheetGid: '0',
      range: 'A1:D10',
      defaultType: 'bar',
      titleOverride: 'Annual Intake Trend',
      nodeId: 'arbitrary-node-xyz',
    };

    const parsed = SheetChartConfigSchema.safeParse(config);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.nodeId).toBe('arbitrary-node-xyz');
    }
  });

  it('validates decoupled chart dataset with numeric series and sanitized csv content', () => {
    const dataset: ChartDataset = {
      chartId: 'chart-sales',
      title: 'Quarterly Output',
      asOfDate: '2026-Q3',
      chartType: 'bar',
      nodeId: 'milestone-3',
      categories: ['Jan', 'Feb', 'Mar'],
      series: [
        { name: 'Target', data: [100, 120, 140] },
        { name: 'Actual', data: [95, 125, null] },
      ],
      sanitizedCsvContent: 'Category,Target,Actual\nJan,100,95\nFeb,120,125\nMar,140,',
    };

    expect(dataset.nodeId).toBe('milestone-3');
    expect(dataset.series?.[0].data).toHaveLength(3);
  });

  it('validates draft staging item with generic payload', () => {
    const draft: DraftItem<{ title: string }> = {
      entityType: 'document',
      entityId: 'doc-alpha',
      stagedValue: { title: 'Updated Strategic Plan' },
      updatedAt: '2026-10-29T10:00:00.000Z',
    };

    const parsed = DraftItemSchema.safeParse(draft);
    expect(parsed.success).toBe(true);
  });
});
