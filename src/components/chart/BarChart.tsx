import React, { useState, useMemo, useRef } from 'react';
import type { ChartSeries } from '../../types/chart';
import { createBandScale, createLinearScale, createRoundedRectPath } from '../../utils/chartMath';
import { resolveUniqueChartColors } from '../../utils/chartColors';
import { useChartPlotArea } from '../../utils/chartDimensions';
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
  onSelectDataPoint?: (point: { category: string; seriesName: string; value: number | null }) => void;
  // Deprecated/pruned props preserved for non-breaking API compatibility
  variant?: 'standard' | 'progress';
  targetValue?: number;
  targetLabel?: string;
}

const MIN_LABEL_PIXEL_THRESHOLD = 24;
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
  onSelectDataPoint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const orientation = propOrientation || barOrientation || 'vertical';
  const isHorizontal = orientation === 'horizontal';

  // Hover state for 2-way legend synchronization
  const [activeSeriesName, setActiveSeriesName] = useState<string | null>(null);

  // Canonical Tooltip hook
  const { tooltipState, showTooltip, hideTooltip } = useChartTooltip();

  // Dynamic left margin calculation for horizontal layout (clamped up to 180px)
  const dynamicLeftMargin = useMemo(() => {
    if (!isHorizontal || categories.length === 0) return undefined;
    const maxChars = Math.max(...categories.map((c) => String(c).length), 4);
    // Approximate ~7px per character plus padding, clamped between 56px and 180px
    const extraForLabel = yLabel ? 24 : 0;
    return Math.min(180, Math.max(56, maxChars * 7 + 16 + extraForLabel));
  }, [isHorizontal, categories, yLabel]);

  // Canonical Plot Area calculation
  const {
    width,
    height,
    margin,
    innerWidth,
    innerHeight,
    baselineY,
  } = useChartPlotArea({
    dynamicLeftMargin,
    margins: {
      bottom: xLabel ? 56 : 48,
      left: !isHorizontal && yLabel ? 64 : undefined,
    },
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

  const numSeries = Math.max(seriesList.length, 1);
  const bandDimension = categoryScale.bandwidth();
  const barGap = !stacked && numSeries > 1 ? 3 : 0;
  const singleBarDimension = stacked
    ? bandDimension
    : Math.max((bandDimension - (numSeries - 1) * barGap) / numSeries, 2);

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
    showTooltip({
      x: clientX,
      y: clientY,
      title: cat,
      seriesName,
      value: val,
      unit,
      color,
    });
  };

  const handlePointerLeave = () => {
    setActiveSeriesName(null);
    hideTooltip();
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.svgWrapper}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={styles.chartSvg}
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
                    onPointerLeave={handlePointerLeave}
                  >
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
                            onClick={() => onSelectDataPoint?.({ category: cat, seriesName: s.name, value: val })}
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
                            onClick={() => onSelectDataPoint?.({ category: cat, seriesName: s.name, value: val })}
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
                          onClick={() => onSelectDataPoint?.({ category: cat, seriesName: s.name, value: val })}
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
                          onClick={() => onSelectDataPoint?.({ category: cat, seriesName: s.name, value: val })}
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
                <text
                  x={catX + bandDimension / 2}
                  y={baselineY + 22}
                  className={styles.axisText}
                >
                  {cat}
                </text>
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
        title={tooltipState.title}
        seriesName={tooltipState.seriesName}
        value={tooltipState.value}
        unit={unit}
        color={tooltipState.color}
      />

      {/* Canonical Interactive Series Legend */}
      {seriesList.length > 1 && (
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
