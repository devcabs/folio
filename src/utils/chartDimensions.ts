import { useMemo } from 'react';

/**
 * Universal Viewport, Canvas & Margin Constants
 * Document Reference: docs/tasks/task7_6_common_chart_engine_drawer_components.md
 *                     docs/task/16.1-responsive-chart-dimensions-tokens-and-container-measurement.md
 */
export const CHART_CANVAS_DIMENSIONS = {
  viewBoxWidth: 800,
  viewBoxHeight: 360,
  mobileDefaultHeight: 260,
  mobileMinHeight: 240,
  maxDynamicLeftMargin: 180,
  compactMaxDynamicLeftMargin: 112,
  margins: { top: 28, right: 32, bottom: 48, left: 56 },
  compactMargins: { top: 16, right: 16, bottom: 36, left: 44 },
} as const;

export interface ChartPlotMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartPlotAreaOptions {
  width?: number;
  height?: number;
  margins?: Partial<ChartPlotMargins>;
  dynamicLeftMargin?: number;
  isCompact?: boolean;
}

export interface ChartPlotAreaResult {
  width: number;
  height: number;
  margin: ChartPlotMargins;
  innerWidth: number;
  innerHeight: number;
  baselineY: number;
}

export interface DynamicLeftMarginOptions {
  tickLabels: string[];
  hasYLabel?: boolean;
  isCompact?: boolean;
  containerWidth?: number;
}

const COMPACT_LEFT_MARGIN_RATIO = 0.38;

/**
 * Returns the maximum allowed dynamic left margin for the current viewport width/mode
 * so horizontal labels or wide Y-ticks do not starve the plot area on narrow screens.
 */
export function getMaxDynamicLeftMargin(width: number, isCompact = false): number {
  if (!isCompact) {
    return CHART_CANVAS_DIMENSIONS.maxDynamicLeftMargin;
  }
  const baseCompactLeft = CHART_CANVAS_DIMENSIONS.compactMargins.left;
  const proportionalCap = Math.floor(width * COMPACT_LEFT_MARGIN_RATIO);
  return Math.min(
    CHART_CANVAS_DIMENSIONS.compactMaxDynamicLeftMargin,
    Math.max(baseCompactLeft, proportionalCap)
  );
}

/**
 * Estimates required left margin from formatted Y-tick strings (e.g. "1,500,000"),
 * optional Y-axis label presence, and compact viewport bounds.
 */
export function computeDynamicLeftMargin({
  tickLabels,
  hasYLabel = false,
  isCompact = false,
  containerWidth,
}: DynamicLeftMarginOptions): number {
  const baseLeft = isCompact
    ? CHART_CANVAS_DIMENSIONS.compactMargins.left
    : CHART_CANVAS_DIMENSIONS.margins.left;
  const effectiveWidth =
    containerWidth ?? (isCompact ? 320 : CHART_CANVAS_DIMENSIONS.viewBoxWidth);
  const maxLeft = getMaxDynamicLeftMargin(effectiveWidth, isCompact);

  const maxChars = tickLabels.reduce(
    (longest, label) => Math.max(longest, String(label).length),
    0
  );
  const charWidth = isCompact ? 6.5 : 7;
  const tickPadding = isCompact ? 14 : 16;
  const yLabelExtra = hasYLabel ? (isCompact ? 18 : 22) : 0;

  const estimated = Math.ceil(maxChars * charWidth + tickPadding + yLabelExtra);
  return Math.min(maxLeft, Math.max(baseLeft, estimated));
}

/**
 * Computes the tick stride (1 = render all ticks) so X-axis category labels
 * maintain at least `minLabelWidth` pixels between rendered ticks.
 */
export function computeTickStep(
  totalCount: number,
  plotWidth: number,
  minLabelWidth = 48
): number {
  if (totalCount <= 1 || plotWidth <= 0 || minLabelWidth <= 0) {
    return 1;
  }
  const maxVisibleTicks = Math.max(2, Math.floor(plotWidth / minLabelWidth));
  if (totalCount <= maxVisibleTicks) {
    return 1;
  }
  return Math.ceil(totalCount / maxVisibleTicks);
}

/**
 * Returns the ordered category indices to render on the X-axis, decimating
 * dense mobile axes while preserving first and last tick landmarks.
 */
export function getVisibleTickIndices(
  totalCount: number,
  plotWidth: number,
  minLabelWidth = 48
): number[] {
  if (totalCount <= 0) {
    return [];
  }
  const step = computeTickStep(totalCount, plotWidth, minLabelWidth);
  if (step <= 1) {
    return Array.from({ length: totalCount }, (_, i) => i);
  }

  const indices: number[] = [];
  for (let i = 0; i < totalCount; i += step) {
    indices.push(i);
  }

  const lastIndex = totalCount - 1;
  if (indices[indices.length - 1] !== lastIndex) {
    if (lastIndex - indices[indices.length - 1] < Math.ceil(step * 0.5)) {
      indices[indices.length - 1] = lastIndex;
    } else {
      indices.push(lastIndex);
    }
  }

  return indices;
}

/**
 * Pure calculation function for chart plot area bounds, baseline, and dynamic category margins.
 */
export function calculateChartPlotArea(options: ChartPlotAreaOptions = {}): ChartPlotAreaResult {
  const isCompact = Boolean(options.isCompact);
  const baseWidth =
    options.width && options.width > 0 ? options.width : CHART_CANVAS_DIMENSIONS.viewBoxWidth;

  const rawHeight =
    options.height && options.height > 0
      ? options.height
      : isCompact
        ? CHART_CANVAS_DIMENSIONS.mobileDefaultHeight
        : CHART_CANVAS_DIMENSIONS.viewBoxHeight;
  const baseHeight = isCompact
    ? Math.max(CHART_CANVAS_DIMENSIONS.mobileMinHeight, rawHeight)
    : rawHeight;

  const baseMargins = isCompact
    ? CHART_CANVAS_DIMENSIONS.compactMargins
    : CHART_CANVAS_DIMENSIONS.margins;

  let leftMargin = options.margins?.left ?? baseMargins.left;
  if (typeof options.dynamicLeftMargin === 'number') {
    const maxLeft = getMaxDynamicLeftMargin(baseWidth, isCompact);
    leftMargin = Math.min(maxLeft, Math.max(baseMargins.left, options.dynamicLeftMargin));
  }

  const margin: ChartPlotMargins = {
    top: options.margins?.top ?? baseMargins.top,
    right: options.margins?.right ?? baseMargins.right,
    bottom: options.margins?.bottom ?? baseMargins.bottom,
    left: leftMargin,
  };

  const innerWidth = Math.max(0, baseWidth - margin.left - margin.right);
  const innerHeight = Math.max(0, baseHeight - margin.top - margin.bottom);
  const baselineY = margin.top + innerHeight;

  return {
    width: baseWidth,
    height: baseHeight,
    margin,
    innerWidth,
    innerHeight,
    baselineY,
  };
}

/**
 * Unified Plot Area Calculation Hook.
 * Calculates inner dimensions and baseline across all Folio Engine chart engines.
 */
export function useChartPlotArea(options: ChartPlotAreaOptions = {}): ChartPlotAreaResult {
  const top = options.margins?.top;
  const right = options.margins?.right;
  const bottom = options.margins?.bottom;
  const left = options.margins?.left;

  return useMemo(
    () => calculateChartPlotArea(options),
    [
      options.width,
      options.height,
      top,
      right,
      bottom,
      left,
      options.dynamicLeftMargin,
      options.isCompact,
    ]
  );
}
