/**
 * Chart Contracts & TypeScript Data Models
 * Document Reference: docs/tasks/task7_1_contracts_d3_math_sanitizer.md & docs/04_DATA_MODELS.md
 * 
 * Strict contracts for the host application Data Charts.
 * Supports Bar, Line, Donut, Scatter, and Histogram charts with number purity and zero URL leaks.
 */

import type { NodeCode } from './node';

export type ChartType = 'bar' | 'line' | 'donut' | 'scatter' | 'histogram' | 'auto';

export interface ChartSeries {
  name: string;
  data: (number | null)[]; // Null represents missing values / blank cells
  color?: string;          // Optional override; defaults to Node accent token
}

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
  group?: string;
}

export interface HistogramBin {
  x0: number; // Bin lower bound (inclusive)
  x1: number; // Bin upper bound (exclusive)
  count: number; // Frequency count
}

/**
 * Contextual visual configuration parameters editable via the Sidebar Drawer
 */
export interface ChartVisualConfig {
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  xLabel?: string;
  yLabel?: string;
  unit?: string;               // Configured by coordinator (e.g. "₱", "%", "learners")

  tabName?: string;
  sheetGid?: string;
  range?: string;              // e.g. "A5:D12"
  excludeSummaryRows?: boolean; // Default true: filters Total, Grand Total, Average
  transpose?: boolean;          // Default false: swaps rows and columns for horizontal tabular data

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

  // Task 7.7: Column role mapping & Series selection
  categoryColIndex?: number;       // 0-indexed column used for category/dimension (default: 0)
  includedSeriesIndices?: number[]; // Column indices included as metric series (if undefined, all numeric)

  // Task 7.7 & 7.8: Tabular ordering
  sortBy?: 'none' | 'asc' | 'desc' | 'category-asc' | 'category-desc';
  sortField?: string;              // 'sheet_order' | 'category' | series column name
  sortDirection?: 'asc' | 'desc';  // 'asc' | 'desc'

  // Task 7.7 & 7.8: Display variants
  orientation?: 'vertical' | 'horizontal';
  barOrientation?: 'vertical' | 'horizontal';
  stacked?: boolean;
  showValues?: boolean;

  // Unified Axis Scaling (Tier 1)
  autoScaleY?: boolean;
  autoScaleX?: boolean;
  startAtZero?: boolean;
  startAtZeroX?: boolean;

  // Task 7.9 & 7.12: Curve & Line controls
  curveInterpolation?: 'smooth' | 'straight' | 'none' | 'linear' | 'polynomial';
  loessBandwidth?: number; // LOESS smoothing span (0.2 to 0.8, default 0.5)
  showAreaFill?: boolean;
  markerSize?: 'compact' | 'regular' | 'prominent';

  // Task 7.12: Scatter Plot visual & column role mapping controls
  scatterXColIndex?: number;
  scatterYColIndex?: number;
  scatterLabelColIndex?: number;
  scatterGroupColIndex?: number;
  showCorrelationChip?: boolean;

  // Task 7.10: Donut Chart visual controls
  donutVariant?: 'donut' | 'pie';
  groupOthers?: boolean;

  // Task 7.7: Sheet last modified ISO timestamp
  lastModifiedTime?: string;
}

export interface ChartDataset {
  chartId: string;
  title: string;
  subtitle?: string;
  unit?: string;
  asOfDate: string;             // ISO Date or "SY 2024-2025 Q3"
  chartType: ChartType;
  nodeId?: NodeCode;
  visualConfig?: ChartVisualConfig;

  // Standard Tabular Series (Bar, Line, Donut)
  categories?: string[];
  series?: ChartSeries[];

  // Scatter Plot Data
  scatterPoints?: ScatterPoint[];

  // Histogram Data
  rawValues?: (number | null)[];
  bins?: HistogramBin[];

  // Receipts
  sanitizedCsvContent: string;
}

export interface SheetChartConfig {
  chartId: string;
  sheetUrl: string;             // Private Google Sheet URL (Server/DevMode only)
  tabName?: string;             // Selected tab name
  sheetGid?: string;            // Tab GID
  range?: string;               // Validated cell range (e.g. "A5:D12")
  defaultType?: ChartType;
  titleOverride?: string;
  subtitleOverride?: string;
  unitOverride?: string;
  nodeId: NodeCode;
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
  | 'unlinked'          // No sheet configured
  | 'connection_error'  // Network failed, 403 forbidden / private sheet, 404
  | 'data_format'       // Empty rows, missing numbers, invalid range
  | 'none';             // Valid data present

export interface ChartState {
  dataset: ChartDataset | null;
  status: ChartSyncStatus;
  errorMessage?: string;
  lastSyncedAt?: string;
}

