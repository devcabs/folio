import React, { useRef } from 'react';
import type { ChartType } from '../../../../types/chart';
import type { ChartConfigFormReturn } from '../hooks/useChartConfigForm';
import { BarVisualControls } from '../controls/BarVisualControls';
import { LineVisualControls } from '../controls/LineVisualControls';
import { DonutVisualControls } from '../controls/DonutVisualControls';
import { HistogramVisualControls } from '../controls/HistogramVisualControls';
import { ScatterVisualControls, ScatterScaleControls } from '../controls/ScatterVisualControls';
import { ChartTitlesSection } from '../controls/ChartTitlesSection';
import { ScatterDataControls } from '../controls/ScatterDataControls';
import { StandardDataControls } from '../controls/StandardDataControls';
import { SortingAndOrderControls } from '../controls/SortingAndOrderControls';
import { ValueLabelToggle, AccordionSection } from '../../../ui';
import styles from './Step3ChartSetup.module.css';

export type ChartSetupSubTab = 'style' | 'data' | 'sorting';

const CHART_TYPE_OPTIONS: ReadonlyArray<{ value: ChartType; label: string }> = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'donut', label: 'Donut' },
  { value: 'scatter', label: 'Scatter' },
  { value: 'histogram', label: 'Histogram' },
];

const ChartTypeIcon: React.FC<{ type: ChartType }> = ({ type }) => {
  switch (type) {
    case 'bar':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <rect x="2" y="8" width="3" height="6" rx="0.75" />
          <rect x="6.5" y="4" width="3" height="10" rx="0.75" />
          <rect x="11" y="6" width="3" height="8" rx="0.75" />
        </svg>
      );
    case 'line':
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="2 12 6 7.5 9.5 9.5 14 4" />
          <circle cx="6" cy="7.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="9.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="14" cy="4" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'donut':
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="4.75" />
        </svg>
      );
    case 'scatter':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="4" cy="11" r="1.5" />
          <circle cx="6.5" cy="6.5" r="1.5" />
          <circle cx="10.5" cy="8.5" r="1.5" />
          <circle cx="12.5" cy="4" r="1.5" />
        </svg>
      );
    case 'histogram':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <rect x="2" y="9" width="3" height="5" />
          <rect x="5" y="5" width="3" height="9" />
          <rect x="8" y="3" width="3" height="11" />
          <rect x="11" y="7" width="3" height="7" />
        </svg>
      );
  }
};

interface Step3ChartSetupProps {
  form: ChartConfigFormReturn;
  detectedColumns: Array<{ index: number; label: string }>;
  accentColor: string;
  setupSubTab: ChartSetupSubTab;
  setSetupSubTab: (tab: ChartSetupSubTab) => void;
  handleSubTabKeyDown: (e: React.KeyboardEvent) => void;
  handleToggleSeries: (colIdx: number) => void;
}

export const Step3ChartSetup: React.FC<Step3ChartSetupProps> = ({
  form,
  detectedColumns,
  accentColor,
  setupSubTab,
  setSetupSubTab,
  handleSubTabKeyDown,
  handleToggleSeries,
}) => {
  const {
    transpose,
    setTranspose,
    chartType,
    setChartType,
    barOrientation,
    setBarOrientation,
    stacked,
    setStacked,
    curveInterpolation,
    setCurveInterpolation,
    markerSize,
    setMarkerSize,
    showAreaFill,
    setShowAreaFill,
    startAtZero,
    setStartAtZero,
    setAutoScaleY,
    startAtZeroX,
    setStartAtZeroX,
    setAutoScaleX,
    donutVariant,
    setDonutVariant,
    showReferenceGuide,
    setShowReferenceGuide,
    showSummaryStats,
    setShowSummaryStats,
    showMedianMode,
    setShowMedianMode,
    loessBandwidth,
    setLoessBandwidth,
    showCorrelationChip,
    setShowCorrelationChip,
    titleOverride,
    setTitleOverride,
    subtitleOverride,
    setSubtitleOverride,
    xLabel,
    setXLabel,
    yLabel,
    setYLabel,
    scatterXColIndex,
    setScatterXColIndex,
    scatterYColIndex,
    setScatterYColIndex,
    scatterLabelColIndex,
    setScatterLabelColIndex,
    scatterGroupColIndex,
    setScatterGroupColIndex,
    categoryColIndex,
    setCategoryColIndex,
    includedSeriesIndices,
    setIncludedSeriesIndices,
    binStrategy,
    setBinStrategy,
    customBinMode,
    setCustomBinMode,
    bucketSize,
    setBucketSize,
    binCount,
    setBinCount,
    histogramYMode,
    setHistogramYMode,
    groupOthers,
    setGroupOthers,
    sortField,
    setSortField,
    showValues,
    setShowValues,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
  } = form;

  const effectiveScatterX =
    typeof scatterXColIndex === 'number'
      ? scatterXColIndex
      : detectedColumns.length > 1
      ? 1
      : 0;

  const effectiveScatterY =
    typeof scatterYColIndex === 'number'
      ? scatterYColIndex
      : detectedColumns.length > 2
      ? 2
      : detectedColumns.length > 1
      ? 1
      : 0;

  const effectiveScatterLabel =
    typeof scatterLabelColIndex === 'number' ? scatterLabelColIndex : 0;

  const chartTypeRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleChartTypeKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % CHART_TYPE_OPTIONS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + CHART_TYPE_OPTIONS.length) % CHART_TYPE_OPTIONS.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = CHART_TYPE_OPTIONS.length - 1;
    }

    if (nextIndex === null) return;
    e.preventDefault();
    setChartType(CHART_TYPE_OPTIONS[nextIndex].value);
    chartTypeRefs.current[nextIndex]?.focus();
  };

  const orderSectionTitle =
    chartType === 'donut'
      ? 'Slice Order & Direction'
      : chartType === 'scatter'
      ? 'Point Order'
      : 'Order & Direction';

  const visualSectionTitle =
    chartType === 'bar'
      ? 'Visual Style & Layout'
      : chartType === 'line'
      ? 'Visual Style & Scale'
      : chartType === 'donut'
      ? 'Visual Style'
      : chartType === 'histogram'
      ? 'Visual Style & Statistics'
      : 'Trendline & Analytics';

  const titlesSectionTitle =
    chartType === 'donut' ? 'Titles & Subtitle' : 'Titles & Axis Labels';

  return (
    <div className={styles.stepPanel}>
      {/* Global Chart Type Switcher */}
      <div className={styles.formGroup}>
        <div className={styles.label}>
          <span>Chart Type</span>
        </div>
        <div
          className={styles.chartTypeGroup}
          role="radiogroup"
          aria-label="Chart Type"
        >
          {CHART_TYPE_OPTIONS.map((option, index) => {
            const isSelected = chartType === option.value;
            return (
              <button
                key={option.value}
                ref={(el) => {
                  chartTypeRefs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                className={`${styles.chartTypeOption} ${isSelected ? styles.chartTypeOptionActive : ''}`}
                onClick={() => setChartType(option.value)}
                onKeyDown={(e) => handleChartTypeKeyDown(e, index)}
              >
                <ChartTypeIcon type={option.value} />
                <span className={styles.chartTypeLabel}>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div
        className={styles.subTabGroup}
        role="tablist"
        aria-label="Chart Setup Sections"
        onKeyDown={handleSubTabKeyDown}
      >
        <button
          id="setup-tab-data"
          role="tab"
          type="button"
          aria-selected={setupSubTab === 'data'}
          aria-controls="setup-panel-data"
          tabIndex={setupSubTab === 'data' ? 0 : -1}
          className={`${styles.subTabButton} ${setupSubTab === 'data' ? styles.subTabActive : ''}`}
          onClick={() => setSetupSubTab('data')}
        >
          Data
        </button>
        <button
          id="setup-tab-style"
          role="tab"
          type="button"
          aria-selected={setupSubTab === 'style'}
          aria-controls="setup-panel-style"
          tabIndex={setupSubTab === 'style' ? 0 : -1}
          className={`${styles.subTabButton} ${setupSubTab === 'style' ? styles.subTabActive : ''}`}
          onClick={() => setSetupSubTab('style')}
        >
          Appearance
        </button>
      </div>

      {/* SUB-TAB PANEL 1: DATA */}
      <div
        id="setup-panel-data"
        role="tabpanel"
        aria-labelledby="setup-tab-data"
        className={`${styles.subTabPanel} ${setupSubTab !== 'data' ? styles.subTabPanelHidden : ''}`}
        hidden={setupSubTab !== 'data'}
      >
        {chartType === 'scatter' ? (
          <ScatterDataControls
            effectiveScatterX={effectiveScatterX}
            setScatterXColIndex={setScatterXColIndex}
            effectiveScatterY={effectiveScatterY}
            setScatterYColIndex={setScatterYColIndex}
            effectiveScatterLabel={effectiveScatterLabel}
            setScatterLabelColIndex={setScatterLabelColIndex}
            scatterGroupColIndex={scatterGroupColIndex}
            setScatterGroupColIndex={setScatterGroupColIndex}
            detectedColumns={detectedColumns}
          />
        ) : (
          <StandardDataControls
            chartType={chartType}
            categoryColIndex={categoryColIndex}
            setCategoryColIndex={setCategoryColIndex}
            detectedColumns={detectedColumns}
            includedSeriesIndices={includedSeriesIndices}
            setIncludedSeriesIndices={setIncludedSeriesIndices}
            binStrategy={binStrategy}
            setBinStrategy={setBinStrategy}
            customBinMode={customBinMode}
            setCustomBinMode={setCustomBinMode}
            bucketSize={bucketSize}
            setBucketSize={setBucketSize}
            binCount={binCount}
            setBinCount={setBinCount}
            histogramYMode={histogramYMode}
            setHistogramYMode={setHistogramYMode}
            groupOthers={groupOthers}
            setGroupOthers={setGroupOthers}
            sortField={sortField}
            setSortField={setSortField}
            accentColor={accentColor}
            handleToggleSeries={handleToggleSeries}
          />
        )}

        <AccordionSection title={orderSectionTitle} defaultOpen={false}>
          <SortingAndOrderControls
            chartType={chartType}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortField={sortField}
            setSortField={setSortField}
            sortDirection={sortDirection}
            setSortDirection={setSortDirection}
            categoryColIndex={categoryColIndex}
            detectedColumns={detectedColumns}
          />
        </AccordionSection>

        <AccordionSection title="Table Orientation" defaultOpen={false}>
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={transpose}
                onChange={(e) => setTranspose(e.target.checked)}
              />
              <span>Transpose data: Swap rows and columns</span>
            </label>
          </div>
        </AccordionSection>
      </div>

      {/* SUB-TAB PANEL 2: APPEARANCE */}
      <div
        id="setup-panel-style"
        role="tabpanel"
        aria-labelledby="setup-tab-style"
        className={`${styles.subTabPanel} ${setupSubTab !== 'style' ? styles.subTabPanelHidden : ''}`}
        hidden={setupSubTab !== 'style'}
      >
        {/* 1. Encode the Visual: Chart Geometry & Visual Styling */}
        <AccordionSection title={visualSectionTitle} defaultOpen={true}>
          {chartType === 'bar' && (
            <BarVisualControls
              barOrientation={barOrientation}
              setBarOrientation={setBarOrientation}
              stacked={stacked}
              setStacked={setStacked}
            />
          )}

          {chartType === 'line' && (
            <LineVisualControls
              curveInterpolation={curveInterpolation}
              setCurveInterpolation={setCurveInterpolation}
              markerSize={markerSize}
              setMarkerSize={setMarkerSize}
              showAreaFill={showAreaFill}
              setShowAreaFill={setShowAreaFill}
              startAtZero={startAtZero}
              setStartAtZero={setStartAtZero}
              setAutoScaleY={setAutoScaleY}
            />
          )}

          {chartType === 'donut' && (
            <DonutVisualControls
              donutVariant={donutVariant}
              setDonutVariant={setDonutVariant}
            />
          )}

          {chartType === 'histogram' && (
            <HistogramVisualControls
              curveInterpolation={curveInterpolation}
              setCurveInterpolation={setCurveInterpolation}
              showReferenceGuide={showReferenceGuide}
              setShowReferenceGuide={setShowReferenceGuide}
              showSummaryStats={showSummaryStats}
              setShowSummaryStats={setShowSummaryStats}
              showMedianMode={showMedianMode}
              setShowMedianMode={setShowMedianMode}
            />
          )}

          {chartType === 'scatter' && (
            <ScatterVisualControls
              curveInterpolation={curveInterpolation}
              setCurveInterpolation={setCurveInterpolation}
              markerSize={markerSize}
              setMarkerSize={setMarkerSize}
              loessBandwidth={loessBandwidth}
              setLoessBandwidth={setLoessBandwidth}
              showAreaFill={showAreaFill}
              setShowAreaFill={setShowAreaFill}
              showCorrelationChip={showCorrelationChip}
              setShowCorrelationChip={setShowCorrelationChip}
              showReferenceGuide={showReferenceGuide}
              setShowReferenceGuide={setShowReferenceGuide}
            />
          )}
        </AccordionSection>

        {chartType === 'scatter' && (
          <AccordionSection title="Axes & Scale" defaultOpen={false}>
            <ScatterScaleControls
              startAtZero={startAtZero}
              setStartAtZero={setStartAtZero}
              setAutoScaleY={setAutoScaleY}
              startAtZeroX={startAtZeroX}
              setStartAtZeroX={setStartAtZeroX}
              setAutoScaleX={setAutoScaleX}
            />
          </AccordionSection>
        )}

        {/* 2. Polish & Label: Data Labels & Annotations */}
        {(chartType === 'bar' || chartType === 'line' || chartType === 'donut') && (
          <AccordionSection title="Data Labels" defaultOpen={false}>
            {chartType === 'bar' && (
              <ValueLabelToggle
                id="cfg-show-values-bar-app"
                checked={showValues}
                onChange={setShowValues}
                label="Show numbers on bars"
              />
            )}

            {chartType === 'line' && (
              <ValueLabelToggle
                id="cfg-show-values-line-app"
                checked={showValues}
                onChange={setShowValues}
                label="Show numbers on points"
              />
            )}

            {chartType === 'donut' && (
              <ValueLabelToggle
                id="cfg-show-values-donut-app"
                checked={showValues}
                onChange={setShowValues}
                label="Show percentages or values on slices"
              />
            )}
          </AccordionSection>
        )}

        {/* 3. Polish & Label: Custom Titles & Labels Section */}
        <AccordionSection title={titlesSectionTitle} defaultOpen={false}>
          <ChartTitlesSection
            titleOverride={titleOverride}
            setTitleOverride={setTitleOverride}
            subtitleOverride={subtitleOverride}
            setSubtitleOverride={setSubtitleOverride}
            xLabel={xLabel}
            setXLabel={setXLabel}
            yLabel={yLabel}
            setYLabel={setYLabel}
            chartType={chartType}
          />
        </AccordionSection>
      </div>
    </div>
  );
};


