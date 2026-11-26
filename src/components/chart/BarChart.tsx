import React, { useState, useMemo, useRef } from 'react';
import type { ChartSeries } from '../../types/chart';
import { createBandScale, createLinearScale, createRoundedRectPath } from '../../utils/chartMath';
import { resolveUniqueChartColors } from '../../utils/chartColors';
import {
  CHART_CANVAS_DIMENSIONS,
  computeDynamicLeftMargin,
  getMaxDynamicLeftMargin,
  getVisibleTickIndices,
  useChartPlotArea,
} from '../../utils/chartDimensions';
import { useChartContainerWidth } from '../../hooks/useChartContainerWidth';
import { useChartTooltip } from '../../hooks/useChartTooltip';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';
import styles from './BarChart.module.css';

export interface BarChartProps {
  categories: string[];
  series: ChartSeries[];
  unit?: string;
  accentColor?: string;
  orientation?: 'vertical' | 'horizontal';
  barOrientation?: 'vertical' | 'horizontal';
  stacked?: boolean;
  showValues?: boolean;
  xLabel?: string;
  yLabel?: string;
  showLegend?: boolean;
  onSelectDataPoint?: (point: { category: string; seriesName: string; value: number | null }) => void;
  // Deprecated/pruned props preserved for non-breaking API compatibility
  variant?: 'standard' | 'progress';
  targetValue?: number;
  targetLabel?: string;
}

const MIN_LABEL_PIXEL_THRESHOLD = 16;
const MIN_VERTICAL_BAR_WIDTH = 10;
const DIMMED_OPACITY = 0.15;

export const BarChart: React.FC<BarChartProps> = ({
  categories = [],
  series = [],
  unit,
  accentColor,
  orientation: propOrientation,
  barOrientation,
  stacked = false,
  showValues = false,
  xLabel,
  yLabel,
  showLegend = true,
  onSelectDataPoint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth, isCompact } = useChartContainerWidth({ ref: containerRef });
  const orientation = propOrientation || barOrientation || 'vertical';
  const isHorizontal = orientation === 'horizontal';

  // Hover state for 2-way legend synchronization
  const [activeSeriesName, setActiveSeriesName] = useState<string | null>(null);

  // Canonical Tooltip hook
  const {
    tooltipState,
    handleMarkPointerEnter,
    handleMarkPointerLeave,
    handleMarkClick,
  } = useChartTooltip({
    containerRef,
    containerWidth,
    onDismiss: () => setActiveSeriesName(null),
  });

  // Prepare series with resolved colors and domain bounds
  const { maxValue, seriesList } = useMemo(() => {
    const assignedColors = resolveUniqueChartColors({
      count: series.length,
      accentColor,
      tierMode: 'bright',
    });

    const list = series.map((s, idx) => ({
      ...s,
      resolvedColor: s.color || assignedColors[idx] || 'var(--folio-primary)',
    }));

    let computedMax = 0;

    if (stacked) {
      // Stacked Mode: Max is the peak cumulative sum across categories
      const numCats = categories.length;
      for (let c = 0; c < numCats; c++) {
        let sum = 0;
        for (const s of list) {
          const val = s.data[c];
          if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
            sum += val;
          }
        }
        if (sum > computedMax) computedMax = sum;
      }
    } else {
      // Clustered Mode: Max is the peak single value in any series
      for (const s of list) {
        for (const val of s.data) {
          if (typeof val === 'number' && Number.isFinite(val) && val > computedMax) {
            computedMax = val;
          }
        }
      }
    }

    const finalMax = computedMax > 0 ? computedMax * 1.10 : 100;
    return { maxValue: finalMax, seriesList: list };
  }, [series, categories, accentColor, stacked]);

  // Estimate Y-tick strings before plot area calculation so vertical left margin scales for 6-7 digit ticks
  const estimatedYTickLabels = useMemo(() => {
    if (isHorizontal) return [];
    return createLinearScale([0, maxValue], [100, 0], true)
      .ticks(5)
      .map((t) => t.toLocaleString());
  }, [isHorizontal, maxValue]);

  // Dynamic left margin calculation (aligned with chartDimensions.ts compact & desktop caps)
  const dynamicLeftMargin = useMemo(() => {
    if (isHorizontal) {
      if (categories.length === 0) return undefined;
      const baseLeft = isCompact
        ? CHART_CANVAS_DIMENSIONS.compactMargins.left
        : CHART_CANVAS_DIMENSIONS.margins.left;
      const maxChars = Math.max(...categories.map((c) => String(c).length), 4);
      const charWidth = isCompact ? 6.5 : 7;
      const extraForLabel = yLabel ? (isCompact ? 18 : 22) : 0;
      const estimated = Math.ceil(maxChars * charWidth + 16 + extraForLabel);
      return Math.min(getMaxDynamicLeftMargin(containerWidth, isCompact), Math.max(baseLeft, estimated));
    }
    return computeDynamicLeftMargin({
      tickLabels: estimatedYTickLabels,
      hasYLabel: Boolean(yLabel),
      isCompact,
      containerWidth,
    });
  }, [isHorizontal, categories, yLabel, isCompact, containerWidth, estimatedYTickLabels]);

  const numSeries = Math.max(seriesList.length, 1);
  const barGap = !stacked && numSeries > 1 ? (isCompact ? 2 : 3) : 0;

  // Responsive dimensions: expand vertical width for dense clustered bars, expand horizontal height for multi-category bars
  const bottomMargin = xLabel ? (isCompact ? 46 : 56) : (isCompact ? 36 : 48);
  const topMargin = showValues && !isHorizontal ? (isCompact ? 24 : 28) : undefined;
  const rightMargin = isHorizontal && showValues ? (isCompact ? 44 : 56) : undefined;

  const targetWidth = useMemo(() => {
    if (isHorizontal || categories.length === 0) return containerWidth;
    const minBandWidth = stacked
      ? 16
      : numSeries * MIN_VERTICAL_BAR_WIDTH + (numSeries - 1) * barGap;
    const slotWidth = minBandWidth / 0.75;
    const leftEst = dynamicLeftMargin ?? (isCompact ? CHART_CANVAS_DIMENSIONS.compactMargins.left : CHART_CANVAS_DIMENSIONS.margins.left);
    const rightEst = rightMargin ?? (isCompact ? CHART_CANVAS_DIMENSIONS.compactMargins.right : CHART_CANVAS_DIMENSIONS.margins.right);
    const requiredWidth = Math.ceil(leftEst + (categories.length + 0.25) * slotWidth + rightEst);
    return Math.max(containerWidth, requiredWidth);
  }, [isHorizontal, categories.length, containerWidth, stacked, numSeries, barGap, dynamicLeftMargin, isCompact, rightMargin]);

  const targetHeight = useMemo(() => {
    const baseHeight = isCompact
      ? CHART_CANVAS_DIMENSIONS.mobileDefaultHeight
      : CHART_CANVAS_DIMENSIONS.viewBoxHeight;
    if (!isHorizontal || categories.length === 0) return baseHeight;
    const minBarThickness = isCompact ? 14 : 16;
    const minBandHeight = stacked
      ? 24
      : numSeries * minBarThickness + (numSeries - 1) * barGap;
    const slotHeight = minBandHeight / 0.75;
    const effectiveTop = topMargin ?? (isCompact ? CHART_CANVAS_DIMENSIONS.compactMargins.top : CHART_CANVAS_DIMENSIONS.margins.top);
    const requiredHeight = Math.ceil(effectiveTop + (categories.length + 0.25) * slotHeight + bottomMargin);
    return Math.max(baseHeight, requiredHeight);
  }, [isHorizontal, categories.length, isCompact, stacked, numSeries, barGap, topMargin, bottomMargin]);

  const needsHorizontalScroll = !isHorizontal && targetWidth > containerWidth;

  // Canonical Plot Area calculation
  const {
    width,
    height,
    margin,
    innerWidth,
    innerHeight,
    baselineY,
  } = useChartPlotArea({
    width: targetWidth,
    height: targetHeight,
    isCompact,
    dynamicLeftMargin,
    margins: {
      top: topMargin,
      right: rightMargin,
      bottom: bottomMargin,
    },
  });

  // Geometry Scalers
  const categoryScale = useMemo(() => {
    if (isHorizontal) {
      // Horizontal: category scale along vertical Y axis (top to bottom)
      return createBandScale(categories, [margin.top, margin.top + innerHeight], 0.25);
    }
    // Vertical: category scale along horizontal X axis (left to right)
    return createBandScale(categories, [margin.left, margin.left + innerWidth], 0.25);
  }, [categories, isHorizontal, margin.left, margin.top, innerWidth, innerHeight]);

  const valueScale = useMemo(() => {
    if (isHorizontal) {
      // Horizontal: linear scale along horizontal X axis (left to right)
      return createLinearScale([0, maxValue], [margin.left, margin.left + innerWidth], true);
    }
    // Vertical: linear scale along vertical Y axis (bottom to top)
    return createLinearScale([0, maxValue], [baselineY, margin.top], true);
  }, [maxValue, isHorizontal, margin.left, margin.top, innerWidth, baselineY]);

  // Grid ticks
  const ticks = useMemo(() => {
    return valueScale.ticks(5);
  }, [valueScale]);

  const bandDimension = categoryScale.bandwidth();
  const singleBarDimension = stacked
    ? bandDimension
    : Math.max((bandDimension - (numSeries - 1) * barGap) / numSeries, 2);

  // Decimate vertical X-axis category labels on tight/compact viewports
  const visibleCategoryIndices = useMemo(() => {
    if (isHorizontal) return new Set<number>();
    return new Set(getVisibleTickIndices(categories.length, innerWidth, isCompact ? 44 : 52));
  }, [isHorizontal, categories.length, innerWidth, isCompact]);

  // Tooltip interaction handlers
  const handlePointerEnter = (
    e: React.PointerEvent<SVGElement>,
    cat: string,
    seriesName: string,
    val: number | null,
    color: string
  ) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    setActiveSeriesName(seriesName);
    handleMarkPointerEnter(
      e,
      {
        x: clientX,
        y: clientY,
        title: cat,
        seriesName,
        value: val,
        unit,
        color,
      },
      `${cat}::${seriesName}`
    );
  };

  const handlePointerLeave = (e?: React.PointerEvent<SVGElement>) => {
    handleMarkPointerLeave(e);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.svgWrapper}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={styles.chartSvg}
          style={needsHorizontalScroll ? { width: `${width}px`, minWidth: `${width}px` } : undefined}
          role="graphics-document document"
          aria-label="Bar Chart Visualizer"
        >
          {/* Subtle Grid Lines & Axis Values */}
          {isHorizontal ? (
            // Horizontal layout: vertical grid lines extending from baseline
            ticks.map((tickVal) => {
              const x = valueScale(tickVal);
              return (
                <g key={`grid-x-${tickVal}`}>
                  <line
                    x1={x}
                    y1={margin.top}
                    x2={x}
                    y2={baselineY}
                    className={styles.gridLine}
                  />
                  <text
                    x={x}
                    y={baselineY + 18}
                    className={styles.axisText}
                  >
                    {tickVal.toLocaleString()}
                  </text>
                </g>
              );
            })
          ) : (
            // Vertical layout: horizontal grid lines
            ticks.map((tickVal) => {
              const y = valueScale(tickVal);
              return (
                <g key={`grid-y-${tickVal}`}>
                  <line
                    x1={margin.left}
                    y1={y}
                    x2={margin.left + innerWidth}
                    y2={y}
                    className={styles.gridLine}
                  />
                  <text
                    x={margin.left - 10}
                    y={y}
                    className={styles.axisTextY}
                  >
                    {tickVal.toLocaleString()}
                  </text>
                </g>
              );
            })
          )}

          {/* Zero Baseline (Tufte rule) */}
          {isHorizontal ? (
            <line
              x1={margin.left}
              y1={margin.top}
              x2={margin.left}
              y2={baselineY}
              className={styles.baseline}
            />
          ) : (
            <line
              x1={margin.left}
              y1={baselineY}
              x2={margin.left + innerWidth}
              y2={baselineY}
              className={styles.baseline}
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

          {/* Bars Rendering */}
          {categories.map((cat, catIdx) => {
            if (isHorizontal) {
              // -------------------------------------------------------------
              // HORIZONTAL RENDERING
              // -------------------------------------------------------------
              const catY = categoryScale(cat) ?? margin.top;
              let cumX = margin.left;
              let compositeTotal = 0;

              // Truncate category label on left axis with tooltip on hover
              const rawLabel = String(cat);
              const displayLabel = rawLabel.length > 16 ? `${rawLabel.slice(0, 14)}...` : rawLabel;

              const validSeriesIndices = stacked
                ? seriesList
                    .map((s, idx) => ({ idx, val: s.data[catIdx] }))
                    .filter((item) => typeof item.val === 'number' && Number.isFinite(item.val) && item.val > 0)
                    .map((item) => item.idx)
                : [];

              return (
                <g key={`cat-group-h-${cat}`}>
                  {/* Category Axis Label */}
                  <text
                    x={margin.left - 10}
                    y={catY + bandDimension / 2}
                    className={styles.axisTextLeft}
                    tabIndex={0}
                    onPointerEnter={(e) => {
                      if (rawLabel !== displayLabel) {
                        handlePointerEnter(e, rawLabel, '', null, '');
                      }
                    }}
                    onClick={(e) => {
                      if (rawLabel !== displayLabel) {
                        handlePointerEnter(e as unknown as React.PointerEvent<SVGElement>, rawLabel, '', null, '');
                      }
                    }}
                    onPointerLeave={handlePointerLeave}
                  >
                    <title>{rawLabel}</title>
                    {displayLabel}
                  </text>

                  {/* Series Bars */}
                  {seriesList.map((s, sIdx) => {
                    const val = s.data[catIdx] ?? null;
                    if (val === null || val === undefined) return null;

                    const isDimmed = activeSeriesName !== null && activeSeriesName !== s.name;
                    const opacity = isDimmed ? DIMMED_OPACITY : 1;

                    let barX: number;
                    let barY: number;
                    let barW: number;
                    let barH: number;

                    if (stacked) {
                      barW = Math.max(((val / maxValue) * innerWidth), 0);
                      barX = cumX;
                      barY = catY;
                      barH = singleBarDimension;
                      cumX += barW;
                      compositeTotal += val;
                    } else {
                      barW = Math.max(valueScale(val) - margin.left, 0);
                      barX = margin.left;
                      barY = catY + sIdx * (singleBarDimension + barGap);
                      barH = singleBarDimension;
                    }

                    let barPath = '';
                    if (stacked) {
                      const isFirst = validSeriesIndices.length > 0 && validSeriesIndices[0] === sIdx;
                      const isLast = validSeriesIndices.length > 0 && validSeriesIndices[validSeriesIndices.length - 1] === sIdx;
                      const isOnly = isFirst && isLast;

                      const radii = isOnly
                        ? { tl: 3, tr: 3, br: 3, bl: 3 }
                        : isFirst
                        ? { tl: 3, bl: 3, tr: 0, br: 0 }
                        : isLast
                        ? { tr: 3, br: 3, tl: 0, bl: 0 }
                        : { tl: 0, tr: 0, br: 0, bl: 0 };

                      barPath = createRoundedRectPath(barX, barY, barW, barH, radii);
                    }

                    return (
                      <React.Fragment key={`bar-frag-h-${cat}-${s.name}-${sIdx}`}>
                        {stacked ? (
                          <path
                            d={barPath}
                            fill={s.resolvedColor}
                            style={{ opacity }}
                            className={styles.barRect}
                            tabIndex={0}
                            onPointerEnter={(e) =>
                              handlePointerEnter(e, cat, s.name, val, s.resolvedColor)
                            }
                            onPointerMove={(e) =>
                              handlePointerEnter(e, cat, s.name, val, s.resolvedColor)
                            }
                            onPointerLeave={handlePointerLeave}
                            onClick={() => {
                              if (!handleMarkClick(`${cat}::${s.name}`)) {
                                onSelectDataPoint?.({ category: cat, seriesName: s.name, value: val });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                onSelectDataPoint?.({ category: cat, seriesName: s.name, value: val });
                              }
                            }}
                            aria-label={`${cat}, ${s.name}: ${val}`}
                          />
                        ) : (
                          <rect
                            x={barX}
                            y={barY}
                            width={barW}
                            height={barH}
                            rx={3}
                            ry={3}
                            fill={s.resolvedColor}
                            style={{ opacity }}
                            className={styles.barRect}
                            tabIndex={0}
                            onPointerEnter={(e) =>
                              handlePointerEnter(e, cat, s.name, val, s.resolvedColor)
                            }
                            onPointerMove={(e) =>
                              handlePointerEnter(e, cat, s.name, val, s.resolvedColor)
                            }
                            onPointerLeave={handlePointerLeave}
                            onClick={() => {
                              if (!handleMarkClick(`${cat}::${s.name}`)) {
                                onSelectDataPoint?.({ category: cat, seriesName: s.name, value: val });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                onSelectDataPoint?.({ category: cat, seriesName: s.name, value: val });
                              }
                            }}
                            aria-label={`${cat}, ${s.name}: ${val}`}
                          />
                        )}

                        {/* Direct value labels */}
                        {showValues && !stacked && (
                          <text
                            x={barX + barW + 6}
                            y={barY + barH / 2 + 4}
                            textAnchor="start"
                            className={styles.valueLabel}
                          >
                            {val.toLocaleString()}
                          </text>
                        )}

                        {/* Stacked inner segment label respecting MIN_LABEL_PIXEL_THRESHOLD = 24px */}
                        {showValues && stacked && barW >= MIN_LABEL_PIXEL_THRESHOLD && (
                          <text
                            x={barX + barW / 2}
                            y={barY + barH / 2 + 3}
                            textAnchor="middle"
                            className={styles.valueLabelInside}
                          >
                            {val.toLocaleString()}
                          </text>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Cumulative composite sum at the end of stacked composite bar */}
                  {showValues && stacked && compositeTotal > 0 && (
                    <text
                      x={cumX + 6}
                      y={catY + bandDimension / 2 + 4}
                      textAnchor="start"
                      className={styles.valueLabel}
                    >
                      {compositeTotal.toLocaleString()}
                    </text>
                  )}
                </g>
              );
            }

            // ---------------------------------------------------------------
            // VERTICAL RENDERING
            // ---------------------------------------------------------------
            const catX = categoryScale(cat) ?? margin.left;
            let cumY = baselineY;
            let compositeTotal = 0;

            const validSeriesIndices = stacked
              ? seriesList
                  .map((s, idx) => ({ idx, val: s.data[catIdx] }))
                  .filter((item) => typeof item.val === 'number' && Number.isFinite(item.val) && item.val > 0)
                  .map((item) => item.idx)
              : [];

            return (
              <g key={`cat-group-v-${cat}`}>
                {seriesList.map((s, sIdx) => {
                  const val = s.data[catIdx] ?? null;
                  if (val === null || val === undefined) return null;

                  const isDimmed = activeSeriesName !== null && activeSeriesName !== s.name;
                  const opacity = isDimmed ? DIMMED_OPACITY : 1;

                  let barX: number;
                  let barY: number;
                  let barW: number;
                  let barH: number;

                  if (stacked) {
                    barH = Math.max(((val / maxValue) * innerHeight), 0);
                    barY = cumY - barH;
                    barX = catX;
                    barW = singleBarDimension;
                    cumY -= barH;
                    compositeTotal += val;
                  } else {
                    barY = valueScale(val);
                    barH = Math.max(baselineY - barY, 0);
                    barX = catX + sIdx * (singleBarDimension + barGap);
                    barW = singleBarDimension;
                  }

                  let barPath = '';
                  if (stacked) {
                    const isFirst = validSeriesIndices.length > 0 && validSeriesIndices[0] === sIdx;
                    const isLast = validSeriesIndices.length > 0 && validSeriesIndices[validSeriesIndices.length - 1] === sIdx;
                    const isOnly = isFirst && isLast;

                    const radii = isOnly
                      ? { tl: 3, tr: 3, br: 3, bl: 3 }
                      : isFirst
                      ? { bl: 3, br: 3, tl: 0, tr: 0 }
                      : isLast
                      ? { tl: 3, tr: 3, bl: 0, br: 0 }
                      : { tl: 0, tr: 0, br: 0, bl: 0 };

                    barPath = createRoundedRectPath(barX, barY, barW, barH, radii);
                  }

                  return (
                    <React.Fragment key={`bar-frag-v-${cat}-${s.name}-${sIdx}`}>
                      {stacked ? (
                        <path
                          d={barPath}
                          fill={s.resolvedColor}
                          style={{ opacity }}
                          className={styles.barRect}
                          tabIndex={0}
                          onPointerEnter={(e) =>
                            handlePointerEnter(e, cat, s.name, val, s.resolvedColor)
                          }
                          onPointerMove={(e) =>
                            handlePointerEnter(e, cat, s.name, val, s.resolvedColor)
                          }
                          onPointerLeave={handlePointerLeave}
                          onClick={() => {
                            if (!handleMarkClick(`${cat}::${s.name}`)) {
                              onSelectDataPoint?.({ category: cat, seriesName: s.name, value: val });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              onSelectDataPoint?.({ category: cat, seriesName: s.name, value: val });
                            }
                          }}
                          aria-label={`${cat}, ${s.name}: ${val}`}
                        />
                      ) : (
                        <rect
                          x={barX}
                          y={barY}
                          width={barW}
                          height={barH}
                          rx={3}
                          ry={3}
                          fill={s.resolvedColor}
                          style={{ opacity }}
                          className={styles.barRect}
                          tabIndex={0}
                          onPointerEnter={(e) =>
                            handlePointerEnter(e, cat, s.name, val, s.resolvedColor)
                          }
                          onPointerMove={(e) =>
                            handlePointerEnter(e, cat, s.name, val, s.resolvedColor)
                          }
                          onPointerLeave={handlePointerLeave}
                          onClick={() => {
                            if (!handleMarkClick(`${cat}::${s.name}`)) {
                              onSelectDataPoint?.({ category: cat, seriesName: s.name, value: val });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              onSelectDataPoint?.({ category: cat, seriesName: s.name, value: val });
                            }
                          }}
                          aria-label={`${cat}, ${s.name}: ${val}`}
                        />
                      )}

                      {/* Clustered direct value labels at top of individual bars */}
                      {showValues && !stacked && (
                        <text
                          x={barX + barW / 2}
                          y={barY - 6}
                          textAnchor="middle"
                          className={styles.valueLabel}
                        >
                          {val.toLocaleString()}
                        </text>
                      )}

                      {/* Stacked inner segment label respecting MIN_LABEL_PIXEL_THRESHOLD = 24px */}
                      {showValues && stacked && barH >= MIN_LABEL_PIXEL_THRESHOLD && (
                        <text
                          x={barX + barW / 2}
                          y={barY + barH / 2 + 4}
                          textAnchor="middle"
                          className={styles.valueLabelInside}
                        >
                          {val.toLocaleString()}
                        </text>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Cumulative composite sum at top of stacked composite bar */}
                {showValues && stacked && compositeTotal > 0 && (
                  <text
                    x={catX + bandDimension / 2}
                    y={cumY - 6}
                    textAnchor="middle"
                    className={styles.valueLabel}
                  >
                    {compositeTotal.toLocaleString()}
                  </text>
                )}

                {/* Category Axis Label */}
                {visibleCategoryIndices.has(catIdx) && (
                  <text
                    x={catX + bandDimension / 2}
                    y={baselineY + 22}
                    className={styles.axisText}
                  >
                    {cat}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating touch/hover Tooltip */}
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

      {/* Canonical Interactive Series Legend */}
      {showLegend && seriesList.length > 1 && (
        <ChartLegend
          items={seriesList.map((s) => ({
            id: s.name,
            name: s.name,
            color: s.resolvedColor,
          }))}
          activeIndex={activeSeriesName !== null ? seriesList.findIndex((s) => s.name === activeSeriesName) : null}
          onHover={(idx) => setActiveSeriesName(idx !== null ? seriesList[idx]?.name ?? null : null)}
        />
      )}
    </div>
  );
};
