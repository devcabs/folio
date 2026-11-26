import React, { useState, useMemo, useRef, useCallback } from 'react';
import type { ChartSeries } from '../../types/chart';
import {
  createLinearScale,
  generateCubicBezierPath,
  generateStraightLinePath,
  type Point2D,
} from '../../utils/chartMath';
import { resolveUniqueChartColors } from '../../utils/chartColors';
import {
  computeDynamicLeftMargin,
  getVisibleTickIndices,
  useChartPlotArea,
} from '../../utils/chartDimensions';
import { useChartContainerWidth } from '../../hooks/useChartContainerWidth';
import { useChartTooltip } from '../../hooks/useChartTooltip';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend, CHART_DIMMED_OPACITY } from './ChartLegend';
import styles from './LineChart.module.css';

export interface LineChartProps {
  categories: string[];
  series: ChartSeries[];
  unit?: string;
  accentColor?: string;
  curveInterpolation?: 'smooth' | 'straight' | 'none';
  showAreaFill?: boolean;
  markerSize?: 'compact' | 'regular' | 'prominent';
  autoScaleY?: boolean;
  startAtZero?: boolean;
  showValues?: boolean;
  xLabel?: string;
  yLabel?: string;
  showLegend?: boolean;
  onSelectDataPoint?: (point: { category: string; seriesName: string; value: number | null }) => void;
}

interface IndexedPoint extends Point2D {
  val: number;
  cat: string;
  colIndex: number;
}

export const LineChart: React.FC<LineChartProps> = ({
  categories = [],
  series = [],
  unit,
  accentColor,
  curveInterpolation = 'smooth',
  showAreaFill = false,
  markerSize = 'regular',
  autoScaleY = true,
  startAtZero,
  showValues = false,
  xLabel,
  yLabel,
  showLegend = true,
  onSelectDataPoint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth, isCompact } = useChartContainerWidth({ ref: containerRef });

  // Hover state for 2-way legend synchronization
  const [hoveredSeriesName, setHoveredSeriesName] = useState<string | null>(null);
  const [activeCrosshairX, setActiveCrosshairX] = useState<number | null>(null);

  // Canonical Tooltip Hook
  const {
    tooltipState,
    handleMarkPointerEnter,
    handleMarkPointerLeave,
    handleMarkClick,
  } = useChartTooltip({
    containerRef,
    containerWidth,
    onDismiss: () => {
      setHoveredSeriesName(null);
      setActiveCrosshairX(null);
    },
  });

  // Resolved Series Colors & Min/Max calculation
  const { seriesList, yDomainMin, yDomainMax } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let hasFinite = false;

    for (const s of series) {
      for (const val of s.data) {
        if (typeof val === 'number' && Number.isFinite(val)) {
          hasFinite = true;
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
    }

    if (!hasFinite) {
      min = 0;
      max = 100;
    }

    const assignedColors = resolveUniqueChartColors({
      count: series.length,
      accentColor,
      tierMode: 'bright',
    });

    const list = series.map((s, idx) => ({
      ...s,
      resolvedColor: s.color || assignedColors[idx] || 'var(--folio-primary)',
    }));

    // Vertical scale: Start at zero vs zoom to data range [min * 0.90, max * 1.10]
    const shouldStartAtZero = startAtZero !== undefined ? startAtZero : !autoScaleY;
    let domainMin: number;
    let domainMax: number;

    if (!shouldStartAtZero) {
      if (min === max) {
        domainMin = Math.max(0, min * 0.90);
        domainMax = max > 0 ? max * 1.10 : 100;
      } else {
        domainMin = min > 0 ? Math.max(0, min * 0.90) : min * 1.10;
        domainMax = max > 0 ? max * 1.10 : max * 0.90;
      }
    } else {
      domainMin = 0;
      domainMax = max > 0 ? max * 1.10 : 100;
    }

    return {
      seriesList: list,
      yDomainMin: domainMin,
      yDomainMax: domainMax,
    };
  }, [series, accentColor, autoScaleY, startAtZero]);

  const estimatedYTickLabels = useMemo(() => {
    return createLinearScale([yDomainMin, yDomainMax], [100, 0], true)
      .ticks(5)
      .map((t) => t.toLocaleString());
  }, [yDomainMin, yDomainMax]);

  const dynamicLeftMargin = useMemo(() => {
    return computeDynamicLeftMargin({
      tickLabels: estimatedYTickLabels,
      hasYLabel: Boolean(yLabel),
      isCompact,
      containerWidth,
    });
  }, [estimatedYTickLabels, yLabel, isCompact, containerWidth]);

  // Canonical Plot Area dimensions (responsive to containerWidth)
  const {
    width,
    height,
    margin,
    innerWidth,
    innerHeight,
    baselineY,
  } = useChartPlotArea({
    width: containerWidth,
    isCompact,
    dynamicLeftMargin,
    margins: {
      bottom: xLabel ? (isCompact ? 46 : 56) : (isCompact ? 36 : 48),
    },
  });

  const visibleXIndices = useMemo(() => {
    return new Set(getVisibleTickIndices(categories.length, innerWidth, isCompact ? 48 : 56));
  }, [categories.length, innerWidth, isCompact]);

  // Scalers
  const numCats = Math.max(categories.length, 1);
  const xPositions = useMemo(() => {
    if (numCats === 1) return [margin.left + innerWidth / 2];
    const step = innerWidth / (numCats - 1);
    return categories.map((_, idx) => margin.left + idx * step);
  }, [numCats, innerWidth, margin.left, categories]);

  const yScale = useMemo(() => {
    return createLinearScale([yDomainMin, yDomainMax], [baselineY, margin.top], true);
  }, [yDomainMin, yDomainMax, baselineY, margin.top]);

  const yTicks = useMemo(() => yScale.ticks(5), [yScale]);

  // Marker Radius calculation
  const markerRadius = useMemo(() => {
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

  // Pointer Interaction Handlers
  const handlePointerEnterPoint = useCallback(
    (
      e: React.PointerEvent<SVGCircleElement>,
      p: IndexedPoint,
      seriesName: string,
      color: string
    ) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      setHoveredSeriesName(seriesName);
      setActiveCrosshairX(p.x);

      handleMarkPointerEnter(
        e,
        {
          x: clientX,
          y: clientY,
          title: p.cat,
          seriesName,
          value: p.val,
          unit,
          color,
        },
        `${p.cat}::${seriesName}`
      );
    },
    [handleMarkPointerEnter, unit]
  );

  const handlePointerLeavePoint = useCallback(
    (e?: React.PointerEvent<SVGElement>) => {
      handleMarkPointerLeave(e);
    },
    [handleMarkPointerLeave]
  );

  // Active legend item index
  const activeLegendIndex = useMemo(() => {
    if (hoveredSeriesName === null) return null;
    const idx = seriesList.findIndex((s) => s.name === hoveredSeriesName);
    return idx !== -1 ? idx : null;
  }, [hoveredSeriesName, seriesList]);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.svgWrapper}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={styles.chartSvg}
          role="img"
          aria-label="Line Chart Visualizer"
          onPointerLeave={handlePointerLeavePoint}
        >
          <defs>
            {seriesList.map((s, idx) => (
              <linearGradient
                key={`grad-${idx}`}
                id={`area-grad-${idx}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                {/* Canonical 15% top opacity fading to 1% baseline */}
                <stop offset="0%" stopColor={s.resolvedColor} stopOpacity="0.15" />
                <stop offset="100%" stopColor={s.resolvedColor} stopOpacity="0.01" />
              </linearGradient>
            ))}
          </defs>

          {/* Subtle horizontal grid lines */}
          {yTicks.map((tickVal) => {
            const y = yScale(tickVal);
            return (
              <g key={`grid-${tickVal}`}>
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

          {/* Zero baseline */}
          <line
            x1={margin.left}
            y1={baselineY}
            x2={margin.left + innerWidth}
            y2={baselineY}
            className={styles.baseline}
          />

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

          {/* Vertical Crosshair Guide */}
          {activeCrosshairX !== null && (
            <line
              x1={activeCrosshairX}
              y1={margin.top}
              x2={activeCrosshairX}
              y2={baselineY}
              className={styles.crosshairLine}
            />
          )}

          {/* X Axis ticks & labels (decimated on compact viewports) */}
          {categories.map((cat, idx) =>
            visibleXIndices.has(idx) ? (
              <text
                key={`x-label-${cat}`}
                x={xPositions[idx]}
                y={baselineY + 22}
                className={styles.axisText}
              >
                {cat}
              </text>
            ) : null
          )}

          {/* Series Lines, Area Fills, Dashed Gap Bridges, and Nodes */}
          {seriesList.map((s, sIdx) => {
            // Collect valid non-null points
            const validPoints: IndexedPoint[] = [];
            s.data.forEach((val, idx) => {
              if (typeof val === 'number' && Number.isFinite(val)) {
                validPoints.push({
                  x: xPositions[idx],
                  y: yScale(val),
                  val,
                  cat: categories[idx],
                  colIndex: idx,
                });
              }
            });

            if (validPoints.length === 0) return null;

            // Partition valid points into contiguous slices and dashed gap bridges
            const slices: IndexedPoint[][] = [];
            const bridges: [IndexedPoint, IndexedPoint][] = [];

            let currentSlice: IndexedPoint[] = [validPoints[0]];

            for (let i = 1; i < validPoints.length; i++) {
              const prev = validPoints[i - 1];
              const curr = validPoints[i];

              if (curr.colIndex === prev.colIndex + 1) {
                // Contiguous segment
                currentSlice.push(curr);
              } else {
                // Gap encountered! Save current slice and record dashed bridging segment
                slices.push(currentSlice);
                bridges.push([prev, curr]);
                currentSlice = [curr];
              }
            }
            slices.push(currentSlice);

            const isDimmed = hoveredSeriesName !== null && hoveredSeriesName !== s.name;
            const seriesOpacity = isDimmed ? CHART_DIMMED_OPACITY : 1;

            return (
              <g
                key={`series-${s.name}-${sIdx}`}
                className={isDimmed ? styles.dimmed : undefined}
                style={{ opacity: seriesOpacity, transition: 'opacity var(--duration-fast) var(--ease-out)' }}
              >
                {/* Area Gradient Fills for Contiguous Slices */}
                {showAreaFill &&
                  slices.map((slice, sliceIdx) => {
                    if (slice.length < 2) return null;
                    const pathD =
                      curveInterpolation === 'straight'
                        ? generateStraightLinePath(slice)
                        : generateCubicBezierPath(slice);
                    const areaD = `${pathD} L ${slice[slice.length - 1].x} ${baselineY} L ${slice[0].x} ${baselineY} Z`;

                    return (
                      <path
                        key={`area-${sIdx}-${sliceIdx}`}
                        d={areaD}
                        fill={`url(#area-grad-${sIdx})`}
                        className={styles.areaPath}
                      />
                    );
                  })}

                {/* Solid Line Paths for Contiguous Slices */}
                {slices.map((slice, sliceIdx) => {
                  if (slice.length < 2) return null;
                  const pathD =
                    curveInterpolation === 'straight'
                      ? generateStraightLinePath(slice)
                      : generateCubicBezierPath(slice);

                  return (
                    <path
                      key={`path-${sIdx}-${sliceIdx}`}
                      d={pathD}
                      stroke={s.resolvedColor}
                      className={styles.splinePath}
                    />
                  );
                })}

                {/* Dashed Bridging Segments Across Missing Data Gaps */}
                {bridges.map(([pA, pB], bIdx) => (
                  <line
                    key={`bridge-${sIdx}-${bIdx}`}
                    x1={pA.x}
                    y1={pA.y}
                    x2={pB.x}
                    y2={pB.y}
                    stroke={s.resolvedColor}
                    className={styles.dashedBridge}
                  />
                ))}

                {/* Direct Point Value Labels (collision-thinned on compact viewports) */}
                {showValues &&
                  (() => {
                    let lastLabelX = -Infinity;
                    const minLabelGap = isCompact ? 36 : 24;
                    return validPoints.map((p, pIdx) => {
                      if (Math.abs(p.x - lastLabelX) < minLabelGap) {
                        return null;
                      }
                      lastLabelX = p.x;
                      return (
                        <text
                          key={`val-label-${s.name}-${pIdx}`}
                          x={p.x}
                          y={p.y - (markerRadius + 5)}
                          className={styles.pointValueLabel}
                        >
                          {p.val.toLocaleString()}
                        </text>
                      );
                    });
                  })()}

                {/* Data Point Anchors / Nodes with >= 18px Touch Hit-Targets */}
                {validPoints.map((p, pIdx) => (
                  <g key={`point-${s.name}-${pIdx}`}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={markerRadius}
                      fill={s.resolvedColor}
                      className={styles.dataNode}
                      style={{ pointerEvents: 'none' }}
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={20}
                      fill="transparent"
                      className={styles.hitTarget}
                      tabIndex={0}
                      onPointerEnter={(e) => handlePointerEnterPoint(e, p, s.name, s.resolvedColor)}
                      onPointerMove={(e) => handlePointerEnterPoint(e, p, s.name, s.resolvedColor)}
                      onPointerLeave={handlePointerLeavePoint}
                      onClick={() => {
                        if (!handleMarkClick(`${p.cat}::${s.name}`)) {
                          onSelectDataPoint?.({ category: p.cat, seriesName: s.name, value: p.val });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onSelectDataPoint?.({ category: p.cat, seriesName: s.name, value: p.val });
                        }
                      }}
                      aria-label={`${p.cat}, ${s.name}: ${p.val.toLocaleString()}`}
                    />
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating Crosshair Tooltip */}
      <ChartTooltip
        visible={tooltipState.visible}
        x={tooltipState.x}
        y={tooltipState.y}
        placement={tooltipState.placement}
        title={tooltipState.title}
        seriesName={tooltipState.seriesName}
        value={tooltipState.value}
        unit={unit}
        color={tooltipState.color}
      />

      {/* Canonical Multi-Series Legend with Two-Way Synchronization */}
      {showLegend && seriesList.length > 1 && (
        <ChartLegend
          items={seriesList.map((s) => ({
            id: s.name,
            name: s.name,
            color: s.resolvedColor,
          }))}
          activeIndex={activeLegendIndex}
          onHover={(idx) => {
            if (idx === null || idx === undefined) {
              setHoveredSeriesName(null);
            } else {
              setHoveredSeriesName(seriesList[idx]?.name || null);
            }
          }}
        />
      )}
    </div>
  );
};
