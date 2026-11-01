import React from 'react';
import type { ChartType } from '../../../../types/chart';
import type { ChartConfigFormReturn } from '../hooks/useChartConfigForm';
import { BarVisualControls } from '../controls/BarVisualControls';
import { LineVisualControls } from '../controls/LineVisualControls';
import { DonutVisualControls } from '../controls/DonutVisualControls';
import { HistogramVisualControls } from '../controls/HistogramVisualControls';
import { ScatterVisualControls } from '../controls/ScatterVisualControls';
import { ChartTitlesSection } from '../controls/ChartTitlesSection';
import { ScatterDataControls } from '../controls/ScatterDataControls';
import { StandardDataControls } from '../controls/StandardDataControls';
import { SortingAndOrderControls } from '../controls/SortingAndOrderControls';
import { ValueLabelToggle, AccordionSection } from '../../../ui';
import styles from './Step3ChartSetup.module.css';

export type ChartSetupSubTab = 'style' | 'data' | 'sorting';

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

  return (
    <div className={styles.stepPanel}>
      {/* Global Chart Type Selector */}
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="cfg-chart-type">
          <span>Chart Type</span>
        </label>
        <select
          id="cfg-chart-type"
          className={styles.select}
          value={chartType}
          onChange={(e) => setChartType(e.target.value as ChartType)}
        >
          <option value="bar">Bar Chart</option>
          <option value="line">Line Chart</option>
          <option value="donut">Donut Chart</option>
          <option value="scatter">Scatter Plot</option>
          <option value="histogram">Histogram</option>
        </select>
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
        <AccordionSection name="chart-data" title="Table Orientation" defaultOpen={false}>
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
      </div>

      {/* SUB-TAB PANEL 2: APPEARANCE */}
      <div
        id="setup-panel-style"
        role="tabpanel"
        aria-labelledby="setup-tab-style"
        className={`${styles.subTabPanel} ${setupSubTab !== 'style' ? styles.subTabPanelHidden : ''}`}
        hidden={setupSubTab !== 'style'}
      >
        {/* 1. Custom Titles & Labels Section */}
        <AccordionSection name="chart-appearance" title="Titles & Axis Labels" defaultOpen={true}>
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

        {/* 2. Chart Geometry & Visual Styling */}
        <AccordionSection name="chart-appearance" title="Geometry & Visual Style" defaultOpen={false}>
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
              startAtZero={startAtZero}
              setStartAtZero={setStartAtZero}
              setAutoScaleY={setAutoScaleY}
              startAtZeroX={startAtZeroX}
              setStartAtZeroX={setStartAtZeroX}
              setAutoScaleX={setAutoScaleX}
            />
          )}
        </AccordionSection>

        {/* 3. Data Labels & Annotations */}
        {(chartType === 'bar' || chartType === 'line' || chartType === 'donut') && (
          <AccordionSection name="chart-appearance" title="Data Labels" defaultOpen={false}>
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

        {/* 4. Sorting & Data Direction (at bottom of Appearance) */}
        <AccordionSection name="chart-appearance" title="Order & Direction" defaultOpen={false}>
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
      </div>
    </div>
  );
};


