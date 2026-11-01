/**
 * Google Sheets Tabular Ingestion & Parsing Service
 * Document Reference: docs/tasks/task7_1_contracts_d3_math_sanitizer.md
 * 
 * Slices arbitrary bounding boxes (A5:D12), preserves number purity (nulls for blanks/errors),
 * automatically filters summary rows (Total/Average), detects multi-series groups,
 * and pre-bakes sanitized CSV receipts.
 */

import type {
  ChartDataset,
  ChartSeries,
  ChartType,
  ChartVisualConfig,
  HistogramBin,
  ScatterPoint,
} from '../types/chart';
import type { NodeCode } from '../types/node';
import {
  BoundingBoxRange,
  generatePublicCsv,
  isSummaryRow,
  parsePureNumber,
  parseRangeNotation,
  sanitizeString,
} from '../utils/chartSanitizer';
import { applyChartSorting, computeHistogramBins, sortScatterPoints } from '../utils/chartMath';
import {
  extractSpreadsheetId,
  extractSheetGid,
  formatSheetModifiedTime,
} from './sheetsVerificationService';

export interface ParseTabularParams {
  chartId: string;
  title: string;
  subtitle?: string;
  unit?: string;
  asOfDate?: string;
  chartType?: ChartType;
  nodeId?: NodeCode;
  visualConfig?: ChartVisualConfig;
  rawMatrix?: string[][];
  csvText?: string;
}

/**
 * Parses raw CSV string into 2D grid preserving RFC 4180 quotes, commas, and line breaks.
 */
export function parseCsvToMatrix(csvText: string): string[][] {
  if (!csvText || typeof csvText !== 'string') return [];

  const matrix: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else {
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r') {
        // skip carriage return
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        matrix.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    matrix.push(currentRow);
  }

  // Filter out entirely empty rows
  return matrix.filter((row) => row.some((cell) => cell.length > 0));
}

/**
 * Crops a 2D matrix according to bounding box range coordinates
 */
export function cropMatrixToRange(matrix: string[][], range: BoundingBoxRange): string[][] {
  if (!matrix || matrix.length === 0) return [];

  const cropped: string[][] = [];
  const maxRow = range.endRow !== undefined ? Math.min(range.endRow, matrix.length - 1) : matrix.length - 1;

  for (let r = range.startRow; r <= maxRow; r++) {
    const row = matrix[r] || [];
    const croppedRow: string[] = [];
    const maxCol = Math.min(range.endCol, row.length - 1);
    for (let c = range.startCol; c <= maxCol; c++) {
      croppedRow.push(row[c] !== undefined ? row[c] : '');
    }
    cropped.push(croppedRow);
  }

  return cropped;
}

/**
 * Transposes a 2D matrix (swaps rows and columns).
 * Normalizes jagged rows to the maximum column width.
 */
export function transposeMatrix<T = string | number | null>(matrix: T[][]): T[][] {
  if (!matrix || matrix.length === 0) return [];
  const rowCount = matrix.length;
  const colCount = Math.max(...matrix.map((row) => (row ? row.length : 0)));
  if (colCount === 0) return [];

  const result: T[][] = [];
  for (let c = 0; c < colCount; c++) {
    const newRow: T[] = [];
    for (let r = 0; r < rowCount; r++) {
      const val = matrix[r]?.[c];
      newRow.push(val !== undefined ? val : ('' as unknown as T));
    }
    result.push(newRow);
  }
  return result;
}

/**
 * Sorts tabular categories and series data consistently according to the specified sort rule.
 */
export function sortTabularData(
  categories: string[],
  series: ChartSeries[],
  sortBy?: 'none' | 'asc' | 'desc' | 'category-asc' | 'category-desc'
): { categories: string[]; series: ChartSeries[] } {
  if (!sortBy || sortBy === 'none' || categories.length === 0) {
    return { categories, series };
  }

  const indices = categories.map((_, i) => i);

  indices.sort((a, b) => {
    if (sortBy === 'category-asc') {
      return (categories[a] || '').localeCompare(categories[b] || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    }
    if (sortBy === 'category-desc') {
      return (categories[b] || '').localeCompare(categories[a] || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    }

    // Value sort: compute sum across series for row a and row b
    let valA = 0;
    let valB = 0;
    for (const s of series) {
      const vA = s.data[a];
      const vB = s.data[b];
      if (typeof vA === 'number' && Number.isFinite(vA)) valA += vA;
      if (typeof vB === 'number' && Number.isFinite(vB)) valB += vB;
    }

    if (sortBy === 'desc') {
      return valB - valA;
    }
    return valA - valB;
  });

  const newCategories = indices.map((i) => categories[i]);
  const newSeries = series.map((s) => ({
    ...s,
    data: indices.map((i) => s.data[i]),
  }));

  return { categories: newCategories, series: newSeries };
}

/**
 * Main ingestion function: converts raw matrix or CSV string into a validated ChartDataset.
 */
export function parseTabularDataset(params: ParseTabularParams): ChartDataset {
  const {
    chartId,
    title,
    subtitle,
    unit: paramUnit,
    asOfDate = 'SY 2024-2025',
    chartType = 'bar',
    nodeId,
    visualConfig = {},
    rawMatrix,
    csvText,
  } = params;

  let unit = visualConfig.unit || paramUnit || '';
  let workingMatrix: string[][] = rawMatrix ? [...rawMatrix] : parseCsvToMatrix(csvText || '');

  // Apply bounding box range if configured
  if (visualConfig.range) {
    const parsedRange = parseRangeNotation(visualConfig.range);
    if (parsedRange) {
      workingMatrix = cropMatrixToRange(workingMatrix, parsedRange);
    }
  }

  // Apply matrix transposition if configured
  if (visualConfig.transpose) {
    workingMatrix = transposeMatrix(workingMatrix);
  }

  // Edge case: Empty matrix
  if (workingMatrix.length === 0) {
    return {
      chartId,
      title: sanitizeString(title),
      subtitle: subtitle ? sanitizeString(subtitle) : undefined,
      unit,
      asOfDate,
      chartType,
      nodeId,
      visualConfig,
      categories: [],
      series: [],
      sanitizedCsvContent: '',
    };
  }

  // Extract header row
  const headerRow = workingMatrix[0] || [];
  const categoryCol = typeof visualConfig.categoryColIndex === 'number' ? visualConfig.categoryColIndex : 0;

  // Determine series columns
  const seriesColIndices: number[] = [];
  const seriesNames: string[] = [];

  if (Array.isArray(visualConfig.includedSeriesIndices) && visualConfig.includedSeriesIndices.length > 0) {
    for (const colIdx of visualConfig.includedSeriesIndices) {
      if (colIdx !== categoryCol && colIdx >= 0 && colIdx < headerRow.length) {
        seriesColIndices.push(colIdx);
        seriesNames.push(sanitizeString(headerRow[colIdx]) || `Col ${colIdx + 1}`);
      }
    }
  } else {
    // Default: all columns except categoryCol
    for (let c = 0; c < headerRow.length; c++) {
      if (c !== categoryCol) {
        seriesColIndices.push(c);
        seriesNames.push(sanitizeString(headerRow[c]) || `Col ${c + 1}`);
      }
    }
  }

  // If there's only 1 column total, use the first header as single series name
  if (seriesNames.length === 0 && headerRow.length === 1) {
    seriesColIndices.push(0);
    seriesNames.push(sanitizeString(headerRow[0]) || 'Value');
  }

  const shouldExcludeSummary = visualConfig.excludeSummaryRows !== false;
  let rawCategories: string[] = [];
  const seriesDataMatrix: (number | null)[][] = seriesNames.map(() => []);

  // Process data rows
  for (let r = 1; r < workingMatrix.length; r++) {
    const row = workingMatrix[r];
    const categoryLabel = sanitizeString(row[categoryCol] || `Row ${r}`);

    // Auto-exclude summary/aggregate rows
    if (shouldExcludeSummary && isSummaryRow(categoryLabel)) {
      continue;
    }

    rawCategories.push(categoryLabel);

    // Extract numbers for each series
    for (let s = 0; s < seriesColIndices.length; s++) {
      const colIdx = seriesColIndices[s];
      const rawVal = row[colIdx];
      const parsedNum = parsePureNumber(rawVal);
      seriesDataMatrix[s].push(parsedNum);
    }
  }

  // Automatic unit inference from column headers disabled per user request

  // Construct initial ChartSeries list
  let initialSeries: ChartSeries[] = seriesNames.map((name, idx) => ({
    name,
    data: seriesDataMatrix[idx] || [],
  }));

  // Apply sorting if configured (two-dropdown sortField takes precedence over legacy sortBy)
  let sorted: { categories: string[]; series: ChartSeries[] };
  if (visualConfig.sortField) {
    sorted = applyChartSorting(
      rawCategories,
      initialSeries,
      visualConfig.sortField,
      visualConfig.sortDirection || 'asc'
    );
  } else {
    sorted = sortTabularData(rawCategories, initialSeries, visualConfig.sortBy);
  }
  const categories = sorted.categories;
  const series = sorted.series;

  // Resolve resolved chart type if 'auto'
  let resolvedType: ChartType = chartType;
  if (resolvedType === 'auto') {
    resolvedType = series.length > 1 ? 'bar' : 'bar';
  }

  // Handle Histogram binning
  let bins: HistogramBin[] | undefined;
  let rawValues: (number | null)[] | undefined;

  if (resolvedType === 'histogram') {
    rawValues = series.flatMap((s) => s.data);
    const validNums = rawValues.filter((v): v is number => v !== null && Number.isFinite(v));
    const computed = computeHistogramBins(validNums, {
      strategy: visualConfig.binStrategy,
      binCount: visualConfig.binCount,
      bucketSize: visualConfig.bucketSize,
    });
    bins = computed.map((b) => ({
      x0: b.x0,
      x1: b.x1,
      count: b.count,
    }));
  }

  // Handle Scatter Plot points
  let scatterPoints: ScatterPoint[] | undefined;
  if (resolvedType === 'scatter') {
    scatterPoints = [];

    // Determine effective column indices (explicit configuration or standard defaults)
    const xCol =
      typeof visualConfig.scatterXColIndex === 'number'
        ? visualConfig.scatterXColIndex
        : headerRow.length > 1
          ? 1
          : 0;
    const yCol =
      typeof visualConfig.scatterYColIndex === 'number'
        ? visualConfig.scatterYColIndex
        : headerRow.length > 2
          ? 2
          : headerRow.length > 1
            ? 1
            : 0;
    const labelCol =
      typeof visualConfig.scatterLabelColIndex === 'number'
        ? visualConfig.scatterLabelColIndex
        : categoryCol;
    const groupCol = visualConfig.scatterGroupColIndex;

    if (workingMatrix.length > 1) {
      for (let r = 1; r < workingMatrix.length; r++) {
        const row = workingMatrix[r];
        const rowCategory = sanitizeString(row[categoryCol] || `Row ${r}`);
        if (shouldExcludeSummary && isSummaryRow(rowCategory)) {
          continue;
        }

        const rawX = row[xCol];
        const rawY = row[yCol];
        const xVal = parsePureNumber(rawX);
        const yVal = parsePureNumber(rawY);

        if (xVal !== null && yVal !== null) {
          const ptLabel =
            typeof labelCol === 'number' && labelCol >= 0 && row[labelCol]
              ? sanitizeString(row[labelCol])
              : rowCategory;

          const ptGroup =
            typeof groupCol === 'number' && groupCol >= 0 && row[groupCol]
              ? sanitizeString(row[groupCol])
              : undefined;

          scatterPoints.push({
            x: xVal,
            y: yVal,
            label: ptLabel,
            group: ptGroup,
          });
        }
      }
    }

    // Fallback: use first two series if matrix parsing yielded no points (e.g., baked datasets)
    if (scatterPoints.length === 0 && series.length >= 2) {
      const len = categories.length;
      for (let i = 0; i < len; i++) {
        const xVal = series[0].data[i];
        const yVal = series[1].data[i];
        if (xVal !== null && yVal !== null) {
          scatterPoints.push({
            x: xVal,
            y: yVal,
            label: categories[i],
            group: series[0].name,
          });
        }
      }
    }

    // Apply sorting to scatter points if configured
    if (visualConfig.sortField) {
      scatterPoints = sortScatterPoints(
        scatterPoints,
        visualConfig.sortField,
        visualConfig.sortDirection || 'asc'
      );
    }
  }

  // Generate public downloadable CSV receipts
  const sanitizedCsvContent = generatePublicCsv(categories, series, title, unit);

  const formattedModifiedDate = formatSheetModifiedTime(visualConfig.lastModifiedTime);
  const finalAsOfDate = formattedModifiedDate || asOfDate;

  return {
    chartId,
    title: sanitizeString(title),
    subtitle: subtitle ? sanitizeString(subtitle) : undefined,
    unit,
    asOfDate: finalAsOfDate,
    chartType: resolvedType,
    nodeId,
    visualConfig,
    categories,
    series,
    bins,
    rawValues,
    scatterPoints,
    sanitizedCsvContent,
  };
}

export interface FetchLiveSheetMatrixParams {
  sheetUrl: string;
  tabName?: string;
  sheetGid?: string;
  range?: string;
  timeoutMs?: number;
}

/**
 * Fetches real-time tabular data from a public Google Sheet via GViz CSV endpoint.
 * Returns a 2D string matrix of cell contents without mocking or synthetic placeholders.
 */
export async function fetchLiveSheetMatrix(
  params: FetchLiveSheetMatrixParams
): Promise<string[][]> {
  const { sheetUrl, tabName, sheetGid, range, timeoutMs = 8000 } = params;
  if (!sheetUrl || typeof sheetUrl !== 'string') return [];

  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) return [];

  const resolvedGid = sheetGid || extractSheetGid(sheetUrl) || undefined;

  let queryUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/gviz/tq?tqx=out:csv`;

  if (resolvedGid) {
    queryUrl += `&gid=${encodeURIComponent(resolvedGid)}`;
  } else if (tabName && tabName.trim()) {
    queryUrl += `&sheet=${encodeURIComponent(tabName.trim())}`;
  }

  if (range && range.trim()) {
    queryUrl += `&range=${encodeURIComponent(range.trim())}`;
  }

  // Cache buster ensuring instantaneous real-time querying
  queryUrl += `&_folio_t=${Date.now()}`;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: { Accept: 'text/csv,text/plain,*/*' },
      signal: controller?.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) {
      return [];
    }

    const csvText = await res.text();

    // Verify it is not an HTML login redirect or error payload
    if (
      csvText.includes('<!DOCTYPE html') ||
      csvText.includes('accounts.google.com') ||
      csvText.includes('ServiceLogin')
    ) {
      return [];
    }

    return parseCsvToMatrix(csvText);
  } catch {
    if (timeoutId) clearTimeout(timeoutId);
    return [];
  }
}

