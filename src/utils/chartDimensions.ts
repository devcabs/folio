import { useMemo } from 'react';

/**
 * Universal Viewport, Canvas & Margin Constants
 * Document Reference: docs/tasks/task7_6_common_chart_engine_drawer_components.md
 */
export const CHART_CANVAS_DIMENSIONS = {
  viewBoxWidth: 800,
  viewBoxHeight: 360,
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

/**
 * Pure calculation function for chart plot area bounds, baseline, and dynamic category margins.
 */
export function calculateChartPlotArea(options: ChartPlotAreaOptions = {}): ChartPlotAreaResult {
  const baseWidth = options.width ?? CHART_CANVAS_DIMENSIONS.viewBoxWidth;
  const baseHeight = options.height ?? CHART_CANVAS_DIMENSIONS.viewBoxHeight;
  const baseMargins = options.isCompact
    ? CHART_CANVAS_DIMENSIONS.compactMargins
    : CHART_CANVAS_DIMENSIONS.margins;

  let leftMargin = options.margins?.left ?? baseMargins.left;
  if (typeof options.dynamicLeftMargin === 'number') {
    leftMargin = Math.min(160, Math.max(baseMargins.left, options.dynamicLeftMargin));
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
