import { z } from 'zod';

export type ChartType = 'bar' | 'line' | 'donut' | 'scatter' | 'histogram' | 'table' | 'auto';

export interface ChartSeries {
  name: string;
  data: (number | null)[];
  color?: string;
}

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
  group?: string;
}

export interface HistogramBin {
  x0: number;
  x1: number;
  count: number;
}

export interface ChartVisualConfig {
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  xLabel?: string;
  yLabel?: string;
  unit?: string;

  tabName?: string;
  sheetGid?: string;
  range?: string;
  excludeSummaryRows?: boolean;
  transpose?: boolean;

  binStrategy?: 'auto' | 'custom';
  binCount?: number;
  bucketSize?: number;
  histogramYMode?: 'frequency' | 'relative';
  showSummaryStats?: boolean;
  showMedianMode?: boolean;
  showReferenceGuide?: boolean;

  barVariant?: 'standard' | 'progress';
  targetValue?: number;
  targetLabel?: string;

  categoryColIndex?: number;
  includedSeriesIndices?: number[];

  sortBy?: 'none' | 'asc' | 'desc' | 'category-asc' | 'category-desc';
  sortField?: string;
  sortDirection?: 'asc' | 'desc';

  orientation?: 'vertical' | 'horizontal';
  barOrientation?: 'vertical' | 'horizontal';
  stacked?: boolean;
  showValues?: boolean;

  autoScaleY?: boolean;
  autoScaleX?: boolean;
  startAtZero?: boolean;
  startAtZeroX?: boolean;

  curveInterpolation?: 'smooth' | 'straight' | 'none' | 'linear' | 'polynomial';
  loessBandwidth?: number;
  showAreaFill?: boolean;
  markerSize?: 'compact' | 'regular' | 'prominent';

  scatterXColIndex?: number;
  scatterYColIndex?: number;
  scatterLabelColIndex?: number;
  scatterGroupColIndex?: number;
  showCorrelationChip?: boolean;

  donutVariant?: 'donut' | 'pie';
  groupOthers?: boolean;

  lastModifiedTime?: string;
}

export interface ChartDataset {
  chartId: string;
  title: string;
  subtitle?: string;
  unit?: string;
  asOfDate: string;
  chartType: ChartType;
  nodeId?: string;
  visualConfig?: ChartVisualConfig;

  categories?: string[];
  series?: ChartSeries[];

  scatterPoints?: ScatterPoint[];

  rawValues?: (number | null)[];
  bins?: HistogramBin[];

  sanitizedCsvContent: string;
}

export interface SheetChartConfig {
  chartId: string;
  sheetUrl: string;
  tabName?: string;
  sheetGid?: string;
  range?: string;
  defaultType?: ChartType;
  titleOverride?: string;
  subtitleOverride?: string;
  unitOverride?: string;
  nodeId: string;
  visualConfig?: ChartVisualConfig;
  cachedDataset?: (string | number | null)[][] | null;
  updatedAt?: string;
  updatedBy?: string;
}

export type ChartSyncStatus =
  | 'idle'
  | 'syncing'
  | 'success'
  | 'pending_data'
  | 'error';

export type ChartProblemCategory =
  | 'unlinked'
  | 'connection_error'
  | 'data_format'
  | 'none';

export interface ChartState {
  dataset: ChartDataset | null;
  status: ChartSyncStatus;
  errorMessage?: string;
  lastSyncedAt?: string;
}

/**
 * Zod Schemas for Runtime Validation
 */
export const SheetChartConfigSchema = z.object({
  chartId: z.string().min(1),
  sheetUrl: z.string().url(),
  tabName: z.string().optional(),
  sheetGid: z.string().optional(),
  range: z.string().optional(),
  defaultType: z.enum(['bar', 'line', 'donut', 'scatter', 'histogram', 'table', 'auto']).optional(),
  titleOverride: z.string().optional(),
  subtitleOverride: z.string().optional(),
  unitOverride: z.string().optional(),
  nodeId: z.string().min(1),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
});
