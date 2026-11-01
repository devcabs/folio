import React, { useState, useMemo, useRef, useCallback } from 'react';
import type { ChartSeries, HistogramBin } from '../../types/chart';
import {
  createLinearScale,
  computeHistogramBins,
  computeSummaryStats,
  generateCubicBezierPath,
  type ComputedBin,
  type Point2D,
} from '../../utils/chartMath';
import { useChartPlotArea } from '../../utils/chartDimensions';
import { useChartTooltip } from '../../hooks/useChartTooltip';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend, CHART_DIMMED_OPACITY } from './ChartLegend';
import { resolveUniqueChartColors } from '../../utils/chartColors';
import styles from './HistogramChart.module.css';

export interface HistogramChartProps {
  rawValues?: number[];
  series?: ChartSeries[];
  unit?: string;
  accentColor?: string;
  binStrategy?: 'auto' | 'custom';
  binCount?: number;
  bucketSize?: number;
  histogramYMode?: 'frequency' | 'relative';
  curveInterpolation?: 'smooth' | 'straight' | 'none';
  showSummaryStats?: boolean;
  showMedianMode?: boolean;
  showReferenceGuide?: boolean;
  sortBy?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  xLabel?: string;
  yLabel?: string;
  onSelectBin?: (bin: HistogramBin) => void;
}

export const HistogramChart: React.FC<HistogramChartProps> = ({
  rawValues = [],
  series = [],
  unit = 'learners',
  accentColor = 'var(--folio-primary)',
  binStrategy = 'auto',
  binCount,
  bucketSize,
  histogramYMode = 'frequency',
  curveInterpolation = 'none',
  showSummaryStats = false,
  showMedianMode = false,
  showReferenceGuide = false,
  sortField,
  sortDirection = 'asc',
  xLabel,
  yLabel,
  onSelectBin,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Canonical Tooltip Hook
  const { tooltipState, showTooltip, hideTooltip } = useChartTooltip();

  // Hover state for 2-way legend synchronization
  const [hoveredSeriesName, setHoveredSeriesName] = useState<string | null>(null);

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

  // Normalize effective series list
  const effectiveSeries = useMemo<ChartSeries[]>(() => {
    if (series && series.length > 0) {
      return series;
    }
    if (rawValues && rawValues.length > 0) {
      return [
        {
          name: 'Distribution',
          data: rawValues,
        },
      ];
    }
    return [];
  }, [series, rawValues]);

  // Color assignments
  const seriesColors = useMemo(() => {
    return resolveUniqueChartColors({
      count: effectiveSeries.length,
      accentColor,
      tierMode: 'bright',
    });
  }, [effectiveSeries.length, accentColor]);

  // Extract all valid numbers across all series to form global domain
  const { allNumbers, primaryData } = useMemo(() => {
    const all: number[] = [];
    let prim: number[] = [];

    effectiveSeries.forEach((s, idx) => {
      const valid = s.data.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      all.push(...valid);
      if (idx === 0) prim = valid;
    });

    return { allNumbers: all, primaryData: prim };
  }, [effectiveSeries]);

  // Summary statistics for primary series
  const stats = useMemo(() => {
    return computeSummaryStats(primaryData);
  }, [primaryData]);

  // Compute shared histogram bins across all series
  const { processedSeries, templateBins, maxCountOrPct } = useMemo(() => {
    if (allNumbers.length === 0) {
      return { processedSeries: [], templateBins: [], maxCountOrPct: 10 };
    }

    const minAll = Math.min(...allNumbers);
    const maxAll = Math.max(...allNumbers);

    // Compute base template bins over global range using primary series strategy
    const rawTemplate = computeHistogramBins(primaryData.length > 0 ? primaryData : allNumbers, {
      strategy: binStrategy,
      binCount,
      bucketSize,
      min: minAll,
      max: maxAll,
    });

    // Populate each series into template bins
    const seriesHists = effectiveSeries.map((s, sIdx) => {
      const sData = s.data.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      const totalCount = sData.length;

      const bins: (ComputedBin & { percentage: number })[] = rawTemplate.map((tb) => ({
        x0: tb.x0,
        x1: tb.x1,
        count: 0,
        percentage: 0,
      }));

      const lastIdx = bins.length - 1;
      for (const val of sData) {
        for (let i = 0; i <= lastIdx; i++) {
          const b = bins[i];
          const isInside = i === lastIdx ? val >= b.x0 && val <= b.x1 : val >= b.x0 && val < b.x1;
          if (isInside) {
            b.count++;
            break;
          }
        }
      }

      for (const b of bins) {
        b.percentage = totalCount > 0 ? (b.count / totalCount) * 100 : 0;
      }

      return {
        name: s.name,
        color: s.color || seriesColors[sIdx] || 'var(--folio-primary)',
        data: sData,
        totalCount,
        bins,
      };
    });

    // Determine sorting if requested
    let finalTemplate = [...rawTemplate];
    if (sortField === 'frequency' && seriesHists.length > 0) {
      // Sort template bins by primary series frequency
      const indexed = finalTemplate.map((b, idx) => ({
        bin: b,
        count: seriesHists[0].bins[idx]?.count ?? 0,
        idx,
      }));
      indexed.sort((a, b) => (sortDirection === 'desc' ? b.count - a.count : a.count - b.count));
      finalTemplate = indexed.map((item) => item.bin);
      for (const sh of seriesHists) {
        sh.bins = indexed.map((item) => sh.bins[item.idx]);
      }
    } else if (sortDirection === 'desc' && sortField !== 'sheet' && sortField !== 'sheet_order') {
      finalTemplate.reverse();
      for (const sh of seriesHists) {
        sh.bins.reverse();
      }
    }

    // Find maximum count or percentage across all series bins
    let maxVal = 0;
    for (const sh of seriesHists) {
      for (const b of sh.bins) {
        const val = histogramYMode === 'relative' ? b.percentage : b.count;
        if (val > maxVal) maxVal = val;
      }
    }

    return {
      processedSeries: seriesHists,
      templateBins: finalTemplate,
      maxCountOrPct: maxVal > 0 ? maxVal * 1.15 : 10,
    };
  }, [
    allNumbers,
    primaryData,
    effectiveSeries,
    binStrategy,
    binCount,
    bucketSize,
    seriesColors,
    sortField,
    sortDirection,
    histogramYMode,
  ]);

  // Linear Y Scale
  const yScale = useMemo(() => {
    return createLinearScale([0, maxCountOrPct], [baselineY, margin.top], true);
  }, [maxCountOrPct, baselineY, margin.top]);

  const yTicks = useMemo(() => yScale.ticks(5), [yScale]);

  // Geometry calculations
  const numBins = Math.max(templateBins.length, 1);
  const binSlotWidth = innerWidth / numBins;
  // 1.5px hairline gap between adjacent bars
  const barPadding = 0.75;
  const barActualWidth = Math.max(binSlotWidth - barPadding * 2, 2);

  // Mean Reference Line position along the continuous x-axis
  const meanXPosition = useMemo(() => {
    if (!showReferenceGuide || templateBins.length === 0 || stats.n === 0) return null;
    const minEdge = templateBins[0].x0;
    const maxEdge = templateBins[templateBins.length - 1].x1;
    const domainSpan = maxEdge - minEdge;
    if (domainSpan <= 0) return null;
    const fraction = (stats.mean - minEdge) / domainSpan;
    if (fraction < 0 || fraction > 1) return null;
    return margin.left + fraction * innerWidth;
  }, [showReferenceGuide, templateBins, stats, margin.left, innerWidth]);

  // Smooth trend curve path computation (for primary series)
  const { curvePath, areaPath } = useMemo(() => {
    if (curveInterpolation !== 'smooth' || processedSeries.length === 0 || templateBins.length === 0) {
      return { curvePath: '', areaPath: '' };
    }

    const primaryBins = processedSeries[0].bins;
    const points: Point2D[] = primaryBins.map((bin, idx) => {
      const cx = margin.left + idx * binSlotWidth + binSlotWidth / 2;
      const val = histogramYMode === 'relative' ? bin.percentage : bin.count;
      const cy = yScale(val);
      return { x: cx, y: cy };
    });

    const cPath = generateCubicBezierPath(points);
    if (!cPath || points.length === 0) return { curvePath: '', areaPath: '' };

    const firstPt = points[0];
    const lastPt = points[points.length - 1];
    const aPath = `${cPath} L ${lastPt.x.toFixed(2)} ${baselineY} L ${firstPt.x.toFixed(2)} ${baselineY} Z`;

    return { curvePath: cPath, areaPath: aPath };
  }, [
    curveInterpolation,
    processedSeries,
    templateBins,
    margin.left,
    binSlotWidth,
    histogramYMode,
    yScale,
    baselineY,
  ]);

  // Pointer event handlers for tooltip
  const handlePointerEnter = useCallback(
    (
      e: React.PointerEvent<SVGRectElement>,
      bin: ComputedBin & { percentage: number },
      seriesName: string,
      color: string
    ) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pctStr = `${bin.percentage.toFixed(1)}%`;
      
      showTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        title: `Range: [${bin.x0} – ${bin.x1}]`,
        seriesName,
        value: bin.count,
        unit: `${unit} (${pctStr})`,
        color,
      });
    },
    [showTooltip, unit]
  );

  const handlePointerLeave = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  if (allNumbers.length === 0) {
    return (
      <div className={styles.emptyState}>
        No valid numerical data available for histogram distribution.
      </div>
    );
  }

  const hasMultipleSeries = processedSeries.length > 1;

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Organic Summary Statistics */}
      {(showSummaryStats || showMedianMode) && stats.n > 0 && (
        <div className={styles.organicStats} role="region" aria-label="Distribution Summary Statistics">
          {showSummaryStats && (
            <>
              <span className={styles.statItem}>
                <span className={styles.statLabel}>N</span>
                <span className={styles.statValue}>{stats.n.toLocaleString()}</span>
              </span>
              <span className={styles.statDivider} aria-hidden="true">·</span>
              <span className={styles.statItem}>
                <span className={styles.statLabel}>Mean (μ)</span>
                <span className={styles.statValue}>{stats.mean}</span>
              </span>
            </>
          )}

          {showMedianMode && (
            <>
              {showSummaryStats && <span className={styles.statDivider} aria-hidden="true">·</span>}
              <span className={styles.statItem}>
                <span className={styles.statLabel}>Median</span>
                <span className={styles.statValue}>{stats.median}</span>
              </span>
              {stats.mode !== undefined && (
                <>
                  <span className={styles.statDivider} aria-hidden="true">·</span>
                  <span className={styles.statItem}>
                    <span className={styles.statLabel}>Mode</span>
                    <span className={styles.statValue}>{stats.mode}</span>
                  </span>
                </>
              )}
            </>
          )}

          {showSummaryStats && (
            <>
              <span className={styles.statDivider} aria-hidden="true">·</span>
              <span className={styles.statItem}>
                <span className={styles.statLabel}>Std Dev (σ)</span>
                <span className={styles.statValue}>±{stats.stdDev}</span>
              </span>
            </>
          )}
        </div>
      )}

      {/* SVG Canvas */}
      <div className={styles.svgWrapper}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={styles.chartSvg}
          role="img"
          aria-label="Histogram Frequency Distribution"
        >
          <defs>
            {/* Top gradient fading to baseline for smooth trend curve */}
            <linearGradient id="hist-trend-curve-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={processedSeries[0]?.color || accentColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={processedSeries[0]?.color || accentColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

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
                  {histogramYMode === 'relative'
                    ? `${tickVal.toFixed(0)}%`
                    : tickVal.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
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

          {/* Render Series Bins */}
          {processedSeries.map((s, sIdx) => {
            const isComparative = sIdx > 0;
            const isHovered = hoveredSeriesName === s.name;
            const isDimmed = hoveredSeriesName !== null && !isHovered;
            
            // Resting opacity: comparative cohorts use canonical 60% opacity fill
            const baseOpacity = isComparative ? 0.60 : 0.85;
            const currentOpacity = isDimmed ? CHART_DIMMED_OPACITY : baseOpacity;

            return (
              <g key={`series-bins-${s.name}-${sIdx}`}>
                {s.bins.map((bin, bIdx) => {
                  const barX = margin.left + bIdx * binSlotWidth + barPadding;
                  const val = histogramYMode === 'relative' ? bin.percentage : bin.count;
                  const barY = yScale(val);
                  const barH = Math.max(baselineY - barY, 0);

                  return (
                    <rect
                      key={`rect-${sIdx}-${bIdx}-${bin.x0}-${bin.x1}`}
                      x={barX}
                      y={barY}
                      width={barActualWidth}
                      height={barH}
                      rx={3}
                      ry={3}
                      fill={s.color}
                      stroke={isComparative ? s.color : 'none'}
                      strokeWidth={isComparative ? 1 : 0}
                      fillOpacity={currentOpacity}
                      className={styles.barRect}
                      tabIndex={0}
                      onPointerEnter={(e) => handlePointerEnter(e, bin, s.name, s.color)}
                      onPointerMove={(e) => handlePointerEnter(e, bin, s.name, s.color)}
                      onPointerLeave={handlePointerLeave}
                      onClick={() => onSelectBin?.({ x0: bin.x0, x1: bin.x1, count: bin.count })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onSelectBin?.({ x0: bin.x0, x1: bin.x1, count: bin.count });
                        }
                      }}
                      aria-label={`${s.name} Range [${bin.x0} – ${bin.x1}]: ${bin.count} ${unit} (${bin.percentage.toFixed(1)}%)`}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Smooth Trend Curve & Area Overlay */}
          {curveInterpolation === 'smooth' && curvePath && (
            <g className={styles.trendOverlay}>
              {areaPath && (
                <path d={areaPath} fill="url(#hist-trend-curve-grad)" />
              )}
              <path
                d={curvePath}
                className={styles.trendCurve}
                stroke={processedSeries[0]?.color || accentColor}
              />
            </g>
          )}

          {/* Mean Reference Line on Plot */}
          {showReferenceGuide && meanXPosition !== null && (
            <g className={styles.meanGuideGroup}>
              <line
                x1={meanXPosition}
                y1={margin.top}
                x2={meanXPosition}
                y2={baselineY}
                className={styles.meanLine}
              />
              <text
                x={meanXPosition + 4}
                y={margin.top + 10}
                className={styles.meanLabel}
              >
                Mean: {stats.mean}
              </text>
            </g>
          )}

          {/* X Axis Bin Range Labels */}
          {templateBins.map((bin, idx) => {
            const barX = margin.left + idx * binSlotWidth + binSlotWidth / 2;
            return (
              <text
                key={`axis-label-${idx}-${bin.x0}-${bin.x1}`}
                x={barX}
                y={baselineY + 20}
                className={styles.axisText}
              >
                {bin.x0}–{bin.x1}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Comparative Cohort Legend */}
      {hasMultipleSeries && (
        <ChartLegend
          items={processedSeries.map((s) => ({
            id: s.name,
            name: s.name,
            color: s.color,
          }))}
          activeIndex={hoveredSeriesName !== null ? processedSeries.findIndex((s) => s.name === hoveredSeriesName) : null}
          onHover={(idx) => {
            if (idx === null || idx === undefined) {
              setHoveredSeriesName(null);
            } else {
              setHoveredSeriesName(processedSeries[idx]?.name || null);
            }
          }}
        />
      )}

      {/* Floating Tooltip */}
      <ChartTooltip
        visible={tooltipState.visible}
        x={tooltipState.x}
        y={tooltipState.y}
        title={tooltipState.title}
        seriesName={tooltipState.seriesName}
        value={tooltipState.value}
        unit={tooltipState.unit || unit}
        color={tooltipState.color}
      />
    </div>
  );
};
