import React from 'react';
import type { ChartDataset, ChartType } from '../../types/chart';
import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import { DonutChart } from './DonutChart';
import { ScatterPlot } from './ScatterPlot';
import { HistogramChart } from './HistogramChart';
import styles from './ChartRouter.module.css';

export interface ChartRouterProps {
  dataset: ChartDataset;
  overrideType?: ChartType;
  accentColor?: string;
}

import { NODE_ACCENT_TOKENS } from '../../utils/chartColors';

export const ChartRouter: React.FC<ChartRouterProps> = ({
  dataset,
  overrideType,
  accentColor,
}) => {
  const chartType = overrideType || dataset.chartType || 'bar';

  const resolvedColor =
    accentColor ||
    (dataset.nodeId && NODE_ACCENT_TOKENS[dataset.nodeId]) ||
    'var(--folio-primary)';

  const categories = dataset.categories || [];
  const series = dataset.series || [];
  const unit = dataset.unit || dataset.visualConfig?.unit;

  // 1. Bar Chart
  if (chartType === 'bar') {
    return (
      <div className={styles.routerContainer}>
        <BarChart
          categories={categories}
          series={series}
          unit={unit}
          accentColor={resolvedColor}
          variant={dataset.visualConfig?.barVariant || 'standard'}
          targetValue={dataset.visualConfig?.targetValue}
          targetLabel={dataset.visualConfig?.targetLabel}
          orientation={dataset.visualConfig?.barOrientation || 'vertical'}
          stacked={dataset.visualConfig?.stacked || false}
          showValues={dataset.visualConfig?.showValues || false}
          xLabel={dataset.visualConfig?.xLabel}
          yLabel={dataset.visualConfig?.yLabel}
        />
      </div>
    );
  }

  // 2. Line Chart
  if (chartType === 'line') {
    return (
      <div className={styles.routerContainer}>
        <LineChart
          categories={categories}
          series={series}
          unit={unit}
          accentColor={resolvedColor}
          curveInterpolation={
            dataset.visualConfig?.curveInterpolation === 'linear' ||
            dataset.visualConfig?.curveInterpolation === 'polynomial'
              ? 'straight'
              : dataset.visualConfig?.curveInterpolation
          }
          showAreaFill={dataset.visualConfig?.showAreaFill}
          markerSize={dataset.visualConfig?.markerSize}
          autoScaleY={dataset.visualConfig?.autoScaleY}
          startAtZero={dataset.visualConfig?.startAtZero}
          showValues={dataset.visualConfig?.showValues}
          xLabel={dataset.visualConfig?.xLabel}
          yLabel={dataset.visualConfig?.yLabel}
        />
      </div>
    );
  }

  // 3. Donut Chart
  if (chartType === 'donut') {
    // If multi-series, sum or take primary series data
    const rawData =
      series.length > 0
        ? series[0].data.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0))
        : [];

    return (
      <div className={styles.routerContainer}>
        <DonutChart
          categories={categories}
          data={rawData}
          unit={unit}
          accentColor={resolvedColor}
          donutVariant={dataset.visualConfig?.donutVariant}
          groupOthers={dataset.visualConfig?.groupOthers}
          showValues={dataset.visualConfig?.showValues}
          seriesName={series[0]?.name}
        />
      </div>
    );
  }

  // 4. Scatter Plot
  if (chartType === 'scatter') {
    let points = dataset.scatterPoints || [];

    // Fallback: derive points from multi-series if scatterPoints array is empty (e.g. baked datasets)
    if (points.length === 0 && series.length >= 2) {
      const len = categories.length;
      const fallbackPoints: typeof points = [];
      for (let i = 0; i < len; i++) {
        const xVal = series[0].data[i];
        const yVal = series[1].data[i];
        if (
          typeof xVal === 'number' &&
          Number.isFinite(xVal) &&
          typeof yVal === 'number' &&
          Number.isFinite(yVal)
        ) {
          fallbackPoints.push({
            x: xVal,
            y: yVal,
            label: categories[i],
            group: series[0].name,
          });
        }
      }
      points = fallbackPoints;
    }

    return (
      <div className={styles.routerContainer}>
        <ScatterPlot
          points={points}
          xLabel={dataset.visualConfig?.xLabel || (points === dataset.scatterPoints ? undefined : series[0]?.name)}
          yLabel={dataset.visualConfig?.yLabel || (points === dataset.scatterPoints ? undefined : series[1]?.name)}
          unit={unit}
          accentColor={resolvedColor}
          curveInterpolation={dataset.visualConfig?.curveInterpolation}
          loessBandwidth={dataset.visualConfig?.loessBandwidth}
          showAreaFill={dataset.visualConfig?.showAreaFill}
          markerSize={dataset.visualConfig?.markerSize}
          autoScaleY={dataset.visualConfig?.autoScaleY}
          autoScaleX={dataset.visualConfig?.autoScaleX}
          startAtZero={dataset.visualConfig?.startAtZero}
          startAtZeroX={dataset.visualConfig?.startAtZeroX}
          showCorrelationChip={dataset.visualConfig?.showCorrelationChip}
          showReferenceGuide={dataset.visualConfig?.showReferenceGuide}
        />
      </div>
    );
  }

  // 5. Histogram
  if (chartType === 'histogram') {
    const rawValues =
      dataset.rawValues?.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)) ||
      (series.length > 0
        ? series[0].data.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        : []);

    return (
      <div className={styles.routerContainer}>
        <HistogramChart
          rawValues={rawValues}
          series={series}
          binStrategy={dataset.visualConfig?.binStrategy}
          binCount={dataset.visualConfig?.binCount}
          bucketSize={dataset.visualConfig?.bucketSize}
          histogramYMode={dataset.visualConfig?.histogramYMode}
          curveInterpolation={
            dataset.visualConfig?.curveInterpolation === 'linear' ||
            dataset.visualConfig?.curveInterpolation === 'polynomial'
              ? 'straight'
              : dataset.visualConfig?.curveInterpolation
          }
          showSummaryStats={dataset.visualConfig?.showSummaryStats}
          showMedianMode={dataset.visualConfig?.showMedianMode}
          showReferenceGuide={dataset.visualConfig?.showReferenceGuide}
          sortBy={dataset.visualConfig?.sortBy}
          sortField={dataset.visualConfig?.sortField}
          sortDirection={dataset.visualConfig?.sortDirection}
          xLabel={dataset.visualConfig?.xLabel}
          yLabel={dataset.visualConfig?.yLabel}
          unit={unit}
          accentColor={resolvedColor}
        />
      </div>
    );
  }

  // Fallback: Empty / Unrecognized type
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyTitle}>Data Distribution Pending</div>
      <div className={styles.emptySubtitle}>
        The designated visualizer for this indicator is being formatted.
      </div>
    </div>
  );
};
