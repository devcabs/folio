import React, { useState, useMemo, useRef } from 'react';
import type { ScatterPoint } from '../../types/chart';
import {
  createLinearScale,
  computeDataExtent,
  computeLinearRegression,
  computeConfidenceBand,
  computeCurveConfidenceBand,
  computeLoessCurve,
  computePolynomialRegression,
  computeCohortMeans,
  generateCubicBezierPath,
} from '../../utils/chartMath';
import { useChartPlotArea } from '../../utils/chartDimensions';
import { useChartTooltip } from '../../hooks/useChartTooltip';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend, CHART_DIMMED_OPACITY, type ChartLegendItem } from './ChartLegend';
import { resolveUniqueChartColors } from '../../utils/chartColors';
import styles from './ScatterPlot.module.css';

export interface ScatterPlotProps {
  points?: ScatterPoint[];
  xLabel?: string;
  yLabel?: string;
  unit?: string;
  accentColor?: string;
  curveInterpolation?: 'none' | 'linear' | 'smooth' | 'polynomial' | 'straight';
  loessBandwidth?: number;
  showAreaFill?: boolean;
  markerSize?: 'compact' | 'regular' | 'prominent';
  autoScaleY?: boolean;
  autoScaleX?: boolean;
  startAtZero?: boolean;
  startAtZeroX?: boolean;
  showCorrelationChip?: boolean;
  showReferenceGuide?: boolean;
  onSelectPoint?: (point: ScatterPoint) => void;
}

export const ScatterPlot: React.FC<ScatterPlotProps> = ({
  points = [],
  xLabel,
  yLabel,
  unit,
  accentColor = 'var(--folio-primary)',
  curveInterpolation = 'none',
  loessBandwidth = 0.5,
  showAreaFill = false,
  markerSize = 'regular',
  autoScaleY = false,
  autoScaleX = false,
  startAtZero,
  startAtZeroX,
  showCorrelationChip = false,
  showReferenceGuide = false,
  onSelectPoint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Canonical Tooltip Hook
  const { tooltipState, showTooltip, hideTooltip } = useChartTooltip();

  // Cohort Legend hover state for 2-way dimming
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Canonical Plot Area dimensions (Universal 800x360)
  const {
    width,
    height,
    margin,
    innerWidth,
    innerHeight,
    baselineY,
  } = useChartPlotArea({
    margins: {
      bottom: xLabel ? 56 : 48,
      left: yLabel ? 64 : 56,
    },
  });

  // Base marker radius mapping
  const baseRadius = useMemo(() => {
    switch (markerSize) {
      case 'compact':
        return 3;
      case 'prominent':
        return 7;
      case 'regular':
      default:
        return 5;
    }
  }, [markerSize]);

  // Valid non-null points
  const validPoints = useMemo(() => {
    return points.filter(
      (p) => typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y)
    );
  }, [points]);

  // Groups and colors
  const { distinctGroups, groupColorMap, legendItems } = useMemo(() => {
    const rawGroups = validPoints.map((p) => p.group).filter(Boolean) as string[];
    const distinct = Array.from(new Set(rawGroups));

    if (distinct.length === 0) {
      return {
        distinctGroups: [],
        groupColorMap: {} as Record<string, string>,
        legendItems: [] as ChartLegendItem[],
      };
    }

    const colors = resolveUniqueChartColors({
      count: distinct.length,
      accentColor,
      tierMode: 'bright',
    });

    const map: Record<string, string> = {};
    const items: ChartLegendItem[] = [];

    distinct.forEach((group, idx) => {
      const col = colors[idx] || accentColor;
      map[group] = col;
      items.push({
        id: `group-${idx}-${group}`,
        name: group,
        color: col,
      });
    });

    return { distinctGroups: distinct, groupColorMap: map, legendItems: items };
  }, [validPoints, accentColor]);

  const activeHoveredGroup = hoveredGroupIndex !== null ? distinctGroups[hoveredGroupIndex] : null;

  // Extents & Continuous Scales
  const { xScale, yScale, xTicks, yTicks, xDataRange } = useMemo(() => {
    const xVals = validPoints.map((p) => p.x);
    const yVals = validPoints.map((p) => p.y);

    const [xMinRaw, xMaxRaw] = computeDataExtent(xVals);
    const [yMinRaw, yMaxRaw] = computeDataExtent(yVals);

    const shouldStartAtZeroX = startAtZeroX !== undefined ? startAtZeroX : !autoScaleX;
    const shouldStartAtZeroY = startAtZero !== undefined ? startAtZero : !autoScaleY;

    let domainX: [number, number];
    if (!shouldStartAtZeroX) {
      const span = xMaxRaw - xMinRaw || 10;
      const min = Math.max(0, xMinRaw - span * 0.1);
      const max = xMaxRaw + span * 0.1;
      domainX = [min, max];
    } else {
      const max = xMaxRaw > 0 ? xMaxRaw * 1.1 : 100;
      domainX = [0, max];
    }

    let domainY: [number, number];
    if (!shouldStartAtZeroY) {
      const span = yMaxRaw - yMinRaw || 10;
      const min = Math.max(0, yMinRaw - span * 0.1);
      const max = yMaxRaw + span * 0.1;
      domainY = [min, max];
    } else {
      const max = yMaxRaw > 0 ? yMaxRaw * 1.15 : 100;
      domainY = [0, max];
    }

    const xs = createLinearScale(domainX, [margin.left, margin.left + innerWidth], true);
    const ys = createLinearScale(domainY, [baselineY, margin.top], true);

    return {
      xScale: xs,
      yScale: ys,
      xTicks: xs.ticks(6),
      yTicks: ys.ticks(5),
      xDataRange: [xMinRaw, xMaxRaw] as [number, number],
    };
  }, [validPoints, innerWidth, baselineY, margin.left, margin.top, autoScaleX, autoScaleY, startAtZero, startAtZeroX]);

  // Linear Regression & Correlation
  const regression = useMemo(() => {
    return computeLinearRegression(validPoints);
  }, [validPoints]);

  // Smooth LOESS curve
  const loessPoints = useMemo(() => {
    if (curveInterpolation !== 'smooth' || validPoints.length < 2) return [];
    return computeLoessCurve(validPoints, loessBandwidth);
  }, [curveInterpolation, validPoints, loessBandwidth]);

  const loessPath = useMemo(() => {
    if (loessPoints.length < 2) return '';
    const svgPts = loessPoints.map((p) => ({
      x: xScale(p.x),
      y: yScale(p.y),
    }));
    return generateCubicBezierPath(svgPts);
  }, [loessPoints, xScale, yScale]);

  // Polynomial (Quadratic) curve
  const polynomialResult = useMemo(() => {
    if (curveInterpolation !== 'polynomial' || validPoints.length < 2) return null;
    return computePolynomialRegression(validPoints, 40);
  }, [curveInterpolation, validPoints]);

  const polynomialPath = useMemo(() => {
    if (!polynomialResult || polynomialResult.points.length < 2) return '';
    const svgPts = polynomialResult.points.map((p) => ({
      x: xScale(p.x),
      y: yScale(p.y),
    }));
    return generateCubicBezierPath(svgPts);
  }, [polynomialResult, xScale, yScale]);

  // Dynamic Confidence Band Coordinates (adapts to linear, polynomial, or smooth curve)
  const confidenceBandPolygon = useMemo(() => {
    if (!showAreaFill) return '';

    let band: { x: number; y0: number; y1: number }[] = [];
    if (curveInterpolation === 'linear') {
      band = computeConfidenceBand(validPoints, regression.slope, regression.intercept);
    } else if (curveInterpolation === 'polynomial' && polynomialResult) {
      band = computeCurveConfidenceBand(validPoints, polynomialResult.points, 3);
    } else if (curveInterpolation === 'smooth' && loessPoints.length > 0) {
      band = computeCurveConfidenceBand(validPoints, loessPoints, 2);
    }

    if (band.length < 2) return '';

    const upper = band
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(2)} ${yScale(p.y1).toFixed(2)}`)
      .join(' ');
    const lower = [...band]
      .reverse()
      .map((p) => `L ${xScale(p.x).toFixed(2)} ${yScale(p.y0).toFixed(2)}`)
      .join(' ');

    return `${upper} ${lower} Z`;
  }, [
    showAreaFill,
    curveInterpolation,
    validPoints,
    regression,
    polynomialResult,
    loessPoints,
    xScale,
    yScale,
  ]);

  // Cohort Averages (Mean Quadrant Crosshairs)
  const cohortMeans = useMemo(() => {
    if (!showReferenceGuide || validPoints.length === 0) return null;
    return computeCohortMeans(validPoints);
  }, [showReferenceGuide, validPoints]);

  const handlePointerEnter = (
    e: React.PointerEvent<SVGCircleElement>,
    point: ScatterPoint,
    idx: number
  ) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ptColor = (point.group && groupColorMap[point.group]) || accentColor;

    setHoveredPointIndex(idx);
    showTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      title: point.label || 'Data Point',
      seriesName: point.group || xLabel || 'Coordinate',
      value: `X: ${point.x.toLocaleString()}  ·  Y: ${point.y.toLocaleString()}`,
      color: ptColor,
      unit,
    });
  };

  const handlePointerLeave = () => {
    setHoveredPointIndex(null);
    hideTooltip();
  };

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Top Bar: Correlation Badge */}
      {showCorrelationChip && regression.n >= 2 && (
        <div className={styles.topBar}>
          <div className={styles.correlationChip}>
            <span>r = {regression.r >= 0 ? `+${regression.r.toFixed(2)}` : regression.r.toFixed(2)}</span>
            <span className={styles.chipDivider}>·</span>
            <span>R² = {regression.rSquared.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className={styles.svgWrapper}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={styles.chartSvg}
          role="img"
          aria-label="Scatter Plot Visualizer"
        >
          {/* Shaded Confidence Band (15% opacity gradient) */}
          {confidenceBandPolygon && (
            <path
              d={confidenceBandPolygon}
              fill={accentColor}
              className={styles.confidenceBand}
            />
          )}

          {/* Horizontal grid lines */}
          {yTicks.map((tickVal) => {
            const y = yScale(tickVal);
            return (
              <g key={`y-grid-${tickVal}`}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={margin.left + innerWidth}
                  y2={y}
                  className={styles.gridLine}
                />
                <text x={margin.left - 10} y={y} className={styles.axisTextY}>
                  {tickVal.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Vertical grid lines */}
          {xTicks.map((tickVal) => {
            const x = xScale(tickVal);
            return (
              <line
                key={`x-grid-${tickVal}`}
                x1={x}
                y1={margin.top}
                x2={x}
                y2={baselineY}
                className={styles.gridLine}
              />
            );
          })}

          {/* Baseline axes */}
          <line
            x1={margin.left}
            y1={baselineY}
            x2={margin.left + innerWidth}
            y2={baselineY}
            className={styles.axisLine}
          />
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={baselineY}
            className={styles.axisLine}
          />

          {/* X Axis ticks */}
          {xTicks.map((tickVal) => {
            const x = xScale(tickVal);
            return (
              <text
                key={`x-tick-${tickVal}`}
                x={x}
                y={baselineY + 20}
                className={styles.axisText}
              >
                {tickVal.toLocaleString()}
              </text>
            );
          })}

          {/* Mean Quadrant Crosshairs */}
          {cohortMeans && (
            <g aria-label="Mean quadrant crosshairs">
              {/* Vertical average line at meanX */}
              <line
                x1={xScale(cohortMeans.meanX)}
                y1={margin.top}
                x2={xScale(cohortMeans.meanX)}
                y2={baselineY}
                className={styles.meanLine}
              />
              {/* Horizontal average line at meanY */}
              <line
                x1={margin.left}
                y1={yScale(cohortMeans.meanY)}
                x2={margin.left + innerWidth}
                y2={yScale(cohortMeans.meanY)}
                className={styles.meanLine}
              />
            </g>
          )}

          {/* Linear Regression Trendline */}
          {curveInterpolation === 'linear' && regression.n >= 2 && (() => {
            const x1 = xScale(xDataRange[0]);
            const y1 = yScale(regression.slope * xDataRange[0] + regression.intercept);
            const x2 = xScale(xDataRange[1]);
            const y2 = yScale(regression.slope * xDataRange[1] + regression.intercept);
            return (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={accentColor}
                className={styles.trendLine}
              />
            );
          })()}

          {/* Smooth LOESS Trendline */}
          {curveInterpolation === 'smooth' && loessPath && (
            <path
              d={loessPath}
              stroke={accentColor}
              className={styles.trendLine}
            />
          )}

          {/* Polynomial Curve Trendline */}
          {curveInterpolation === 'polynomial' && polynomialPath && (
            <path
              d={polynomialPath}
              stroke={accentColor}
              className={styles.trendLine}
            />
          )}

          {/* Axis Titles */}
          {xLabel && (
            <text
              x={margin.left + innerWidth / 2}
              y={height - 8}
              textAnchor="middle"
              className={styles.axisTitle}
            >
              {xLabel}
            </text>
          )}

          {yLabel && (
            <text
              x={-(margin.top + innerHeight / 2)}
              y={16}
              transform="rotate(-90)"
              textAnchor="middle"
              className={styles.axisTitle}
            >
              {yLabel}
            </text>
          )}

          {/* Scatter Points */}
          {validPoints.map((pt, idx) => {
            const cx = xScale(pt.x);
            const cy = yScale(pt.y);
            const ptColor = (pt.group && groupColorMap[pt.group]) || accentColor;

            // Hover and Dimming states
            const isHovered = hoveredPointIndex === idx;
            const isCohortDimmed = activeHoveredGroup !== null && pt.group !== activeHoveredGroup;

            let opacity = 0.60;
            if (isCohortDimmed) {
              opacity = CHART_DIMMED_OPACITY;
            } else if (isHovered) {
              opacity = 1.0;
            }

            const currentR = isHovered ? 8 : baseRadius;

            return (
              <circle
                key={`point-${idx}-${pt.x}-${pt.y}`}
                cx={cx}
                cy={cy}
                r={currentR}
                fill={ptColor}
                opacity={opacity}
                className={styles.pointNode}
                tabIndex={0}
                onPointerEnter={(e) => handlePointerEnter(e, pt, idx)}
                onPointerMove={(e) => handlePointerEnter(e, pt, idx)}
                onPointerLeave={handlePointerLeave}
                onClick={() => onSelectPoint?.(pt)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectPoint?.(pt);
                  }
                }}
                onFocus={() => {
                  setHoveredPointIndex(idx);
                  showTooltip({
                    x: cx,
                    y: cy,
                    title: pt.label || 'Data Point',
                    seriesName: pt.group || xLabel || 'Coordinate',
                    value: `X: ${pt.x.toLocaleString()}  ·  Y: ${pt.y.toLocaleString()}`,
                    color: ptColor,
                    unit,
                  });
                }}
                onBlur={() => {
                  setHoveredPointIndex(null);
                  hideTooltip();
                }}
                aria-label={`${pt.label || 'Point'}: (${pt.x}, ${pt.y})`}
              />
            );
          })}
        </svg>
      </div>

      {/* Floating Tooltip */}
      <ChartTooltip
        visible={tooltipState.visible}
        x={tooltipState.x}
        y={tooltipState.y}
        title={tooltipState.title}
        seriesName={tooltipState.seriesName}
        value={tooltipState.value}
        unit={tooltipState.unit}
        color={tooltipState.color}
      />

      {/* Interactive Legend (Multi-group cohort isolation) */}
      {legendItems.length > 0 && (
        <ChartLegend
          items={legendItems}
          activeIndex={hoveredGroupIndex}
          onHover={setHoveredGroupIndex}
        />
      )}
    </div>
  );
};
