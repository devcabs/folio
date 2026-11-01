import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useChartPlotArea } from '../../utils/chartDimensions';
import { useChartTooltip } from '../../hooks/useChartTooltip';
import { resolveUniqueChartColors } from '../../utils/chartColors';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend, CHART_DIMMED_OPACITY } from './ChartLegend';
import styles from './DonutChart.module.css';

export interface DonutChartProps {
  categories: string[];
  data: number[];
  unit?: string;
  accentColor?: string;
  donutVariant?: 'donut' | 'pie';
  groupOthers?: boolean;
  showValues?: boolean;
  seriesName?: string;
  onSelectDataPoint?: (point: { category: string; value: number }) => void;
}

const MIN_LABEL_PIXEL_THRESHOLD = 24;

export const DonutChart: React.FC<DonutChartProps> = ({
  categories = [],
  data = [],
  accentColor,
  donutVariant = 'donut',
  groupOthers = true,
  showValues = false,
  onSelectDataPoint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPie = donutVariant === 'pie';

  // Canonical Tooltip Hook
  const { tooltipState, showTooltip, hideTooltip } = useChartTooltip();

  // Active slice index for two-way synchronization between legend and slices
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Canonical 800x360 Plot Area
  const { width, height } = useChartPlotArea();

  const cx = width / 2; // 400
  const cy = height / 2; // 180

  // Geometry: Balanced Donut with 65% inner radius cutout
  const outerRadius = 120;
  const innerRadius = isPie ? 0 : 78; // 65% cutout for donut (78 / 120 = 0.65)
  const ringRadius = (outerRadius + innerRadius) / 2; // 99 for donut
  const strokeWidth = outerRadius - innerRadius; // 42 for donut
  const circumference = 2 * Math.PI * ringRadius;

  // Prepare categories & data (Long-tail "Others" Rollup & slice math)
  const { validTotal, segments } = useMemo(() => {
    // 1. Sanitize incoming pairs
    const pairs: { category: string; value: number }[] = [];
    let sum = 0;
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i] || `Category ${i + 1}`;
      const rawVal = data[i];
      const val = typeof rawVal === 'number' && Number.isFinite(rawVal) && rawVal > 0 ? rawVal : 0;
      pairs.push({ category: cat, value: val });
      sum += val;
    }

    const safeTotal = sum > 0 ? sum : 1;

    // 2. Long-tail category rollup if groupOthers !== false and pairs.length > 5
    let workingPairs: { category: string; value: number; isOther?: boolean }[] = [];
    if (groupOthers && pairs.length > 5) {
      // Sort descending to keep top 5
      const sorted = [...pairs].sort((a, b) => b.value - a.value);
      const top5 = sorted.slice(0, 5);
      const rest = sorted.slice(5);
      const othersSum = rest.reduce((acc, curr) => acc + curr.value, 0);

      workingPairs = [...top5];
      if (othersSum > 0 || rest.length > 0) {
        workingPairs.push({
          category: 'Others',
          value: othersSum,
          isOther: true,
        });
      }
    } else {
      workingPairs = pairs;
    }

    // 3. Resolve colors
    const nonOtherCount = workingPairs.filter((p) => !p.isOther).length;
    const colors = resolveUniqueChartColors({
      count: nonOtherCount,
      accentColor,
      tierMode: 'bright',
    });

    let nonOtherIdx = 0;
    let accumulatedAngle = -Math.PI / 2; // Start at 12 o'clock (-90deg)
    let accumulatedFraction = 0;

    const segs = workingPairs.map((item, idx) => {
      const fraction = item.value / safeTotal;
      const angle = fraction * 2 * Math.PI;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angle;
      accumulatedAngle = endAngle;

      const dashLength = fraction * circumference;
      const dashSpace = circumference - dashLength;
      const dashOffset = -accumulatedFraction * circumference;
      accumulatedFraction += fraction;

      const percentage = Math.round(fraction * 100);
      const color = item.isOther
        ? 'var(--bg-surface-muted)'
        : colors[nonOtherIdx++] || 'var(--folio-primary)';

      // Mid-angle for slice labels
      const midAngle = startAngle + angle / 2;
      const labelRadius = isPie ? outerRadius * 0.65 : ringRadius;
      const labelX = cx + labelRadius * Math.cos(midAngle);
      const labelY = cy + labelRadius * Math.sin(midAngle);
      const arcLength = fraction * circumference;

      // Solid pie wedge path
      let wedgePath = '';
      if (isPie) {
        if (fraction >= 0.9999) {
          wedgePath = '';
        } else {
          const x1 = cx + outerRadius * Math.cos(startAngle);
          const y1 = cy + outerRadius * Math.sin(startAngle);
          const x2 = cx + outerRadius * Math.cos(endAngle);
          const y2 = cy + outerRadius * Math.sin(endAngle);
          const largeArc = angle > Math.PI ? 1 : 0;
          wedgePath = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
        }
      }

      return {
        id: `${item.category}-${idx}`,
        category: item.category,
        value: item.value,
        percentage,
        fraction,
        color,
        dashLength,
        dashSpace,
        dashOffset,
        wedgePath,
        labelX,
        labelY,
        arcLength,
        isOther: item.isOther,
      };
    });

    return { validTotal: sum, segments: segs };
  }, [categories, data, groupOthers, accentColor, circumference, cx, cy, isPie, outerRadius, ringRadius]);

  // Pointer interactions
  const handlePointerEnterSlice = useCallback(
    (e: React.PointerEvent, idx: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const seg = segments[idx];
      if (!seg) return;

      setActiveIndex(idx);
      showTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        title: seg.category,
        seriesName: `${seg.percentage}%`,
        value: seg.value,
        color: seg.color,
      });
    },
    [segments, showTooltip]
  );

  const handlePointerLeaveSlice = useCallback(() => {
    setActiveIndex(null);
    hideTooltip();
  }, [hideTooltip]);

  const activeSegment = activeIndex !== null ? segments[activeIndex] : null;

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.svgWrapper}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={styles.chartSvg}
          role="img"
          aria-label="Donut Chart Visualizer"
        >
          {/* Background resting ring for donut */}
          {!isPie && (
            <circle
              cx={cx}
              cy={cy}
              r={ringRadius}
              stroke="var(--bg-surface-muted)"
              strokeWidth={strokeWidth}
              fill="none"
              opacity={0.35}
            />
          )}

          {/* Slices: Solid Pie Mode */}
          {isPie ? (
            <g className={styles.slicesGroup}>
              {segments.map((seg, idx) => {
                const isDimmed = activeIndex !== null && activeIndex !== idx;
                const opacity = isDimmed ? CHART_DIMMED_OPACITY : 1;

                if (seg.fraction >= 0.9999) {
                  return (
                    <circle
                      key={seg.id}
                      cx={cx}
                      cy={cy}
                      r={outerRadius}
                      fill={seg.color}
                      opacity={opacity}
                      className={styles.segmentSlice}
                      tabIndex={0}
                      onPointerEnter={(e) => handlePointerEnterSlice(e, idx)}
                      onPointerMove={(e) => handlePointerEnterSlice(e, idx)}
                      onPointerLeave={handlePointerLeaveSlice}
                      onClick={() => onSelectDataPoint?.({ category: seg.category, value: seg.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onSelectDataPoint?.({ category: seg.category, value: seg.value });
                        }
                      }}
                      aria-label={`${seg.category}: ${seg.value.toLocaleString()} (${seg.percentage}%)`}
                    />
                  );
                }

                return (
                  <path
                    key={seg.id}
                    d={seg.wedgePath}
                    fill={seg.color}
                    opacity={opacity}
                    className={styles.segmentSlice}
                    tabIndex={0}
                    onPointerEnter={(e) => handlePointerEnterSlice(e, idx)}
                    onPointerMove={(e) => handlePointerEnterSlice(e, idx)}
                    onPointerLeave={handlePointerLeaveSlice}
                    onClick={() => onSelectDataPoint?.({ category: seg.category, value: seg.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onSelectDataPoint?.({ category: seg.category, value: seg.value });
                      }
                    }}
                    aria-label={`${seg.category}: ${seg.value.toLocaleString()} (${seg.percentage}%)`}
                  />
                );
              })}
            </g>
          ) : (
            /* Slices: Donut Ring Mode */
            <g transform={`rotate(-90 ${cx} ${cy})`} className={styles.slicesGroup}>
              {segments.map((seg, idx) => {
                const isSelected = activeIndex !== null && activeIndex === idx;
                const isDimmed = activeIndex !== null && activeIndex !== idx;
                const opacity = isDimmed ? CHART_DIMMED_OPACITY : 1;
                const currentStrokeWidth = isSelected ? strokeWidth + 6 : strokeWidth;

                return (
                  <circle
                    key={seg.id}
                    cx={cx}
                    cy={cy}
                    r={ringRadius}
                    stroke={seg.color}
                    strokeWidth={currentStrokeWidth}
                    strokeDasharray={`${seg.dashLength.toFixed(2)} ${seg.dashSpace.toFixed(2)}`}
                    strokeDashoffset={seg.dashOffset.toFixed(2)}
                    fill="none"
                    opacity={opacity}
                    className={styles.segmentSlice}
                    tabIndex={0}
                    onPointerEnter={(e) => handlePointerEnterSlice(e, idx)}
                    onPointerMove={(e) => handlePointerEnterSlice(e, idx)}
                    onPointerLeave={handlePointerLeaveSlice}
                    onClick={() => onSelectDataPoint?.({ category: seg.category, value: seg.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onSelectDataPoint?.({ category: seg.category, value: seg.value });
                      }
                    }}
                    aria-label={`${seg.category}: ${seg.value.toLocaleString()} (${seg.percentage}%)`}
                  />
                );
              })}
            </g>
          )}

          {/* Direct Slice Value Labels (when showValues is enabled & arc exceeds threshold) */}
          {showValues && (
            <g className={styles.labelsGroup} pointerEvents="none">
              {segments.map((seg, idx) => {
                if (seg.arcLength < MIN_LABEL_PIXEL_THRESHOLD) return null;
                const isDimmed = activeIndex !== null && activeIndex !== idx;
                return (
                  <text
                    key={`label-${seg.id}`}
                    x={seg.labelX}
                    y={seg.labelY}
                    opacity={isDimmed ? CHART_DIMMED_OPACITY : 1}
                    className={styles.sliceValueText}
                  >
                    {seg.percentage}%
                  </text>
                );
              })}
            </g>
          )}

          {/* Dynamic Morphing Center Callout (Donut mode only) */}
          {!isPie && (
            <g className={styles.centerCalloutGroup} pointerEvents="none">
              {activeSegment ? (
                <>
                  <text
                    x={cx}
                    y={cy - 8}
                    textAnchor="middle"
                    className={styles.centerCategoryText}
                  >
                    {activeSegment.category.length > 14
                      ? `${activeSegment.category.slice(0, 13)}…`
                      : activeSegment.category}
                  </text>
                  <text
                    x={cx}
                    y={cy + 16}
                    textAnchor="middle"
                    className={styles.centerMetricText}
                  >
                    {activeSegment.value.toLocaleString()} ({activeSegment.percentage}%)
                  </text>
                </>
              ) : (
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={styles.centerTotalText}
                >
                  {validTotal.toLocaleString()}
                </text>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Floating Canonical Tooltip */}
      <ChartTooltip
        visible={tooltipState.visible}
        x={tooltipState.x}
        y={tooltipState.y}
        title={tooltipState.title}
        seriesName={tooltipState.seriesName}
        value={tooltipState.value}
        color={tooltipState.color}
      />

      {/* Canonical Interactive Multi-Slice Legend */}
      <ChartLegend
        items={segments.map((seg) => ({
          id: seg.id,
          name: `${seg.category} (${seg.percentage}%)`,
          color: seg.color,
        }))}
        activeIndex={activeIndex}
        onHover={(idx) => {
          setActiveIndex(idx);
          if (idx === null) {
            hideTooltip();
          }
        }}
      />
    </div>
  );
};
