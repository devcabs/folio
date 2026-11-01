import { useState, useMemo, useCallback } from 'react';
import type { SheetChartConfig, ChartType } from '../../../../types/chart';
import type { NodeCode } from '../../../../types/node';

export interface FormSnapshot {
  sheetUrl: string;
  tabName: string;
  sheetGid: string;
  range: string;
  chartType: ChartType;
  unit: string;
  titleOverride: string;
  subtitleOverride: string;
  barVariant: 'standard' | 'progress';
  targetValue: number | undefined;
  targetLabel: string;
  categoryColIndex: number;
  includedSeriesIndices: number[] | undefined;
  sortBy: 'none' | 'asc' | 'desc' | 'category-asc' | 'category-desc';
  sortField: string;
  sortDirection: 'asc' | 'desc';
  orientation: 'vertical' | 'horizontal';
  barOrientation: 'vertical' | 'horizontal';
  stacked: boolean;
  showValues: boolean;
  lastModifiedTime: string | undefined;
  excludeSummaryRows: boolean;
  transpose: boolean;
  curveInterpolation: 'smooth' | 'straight' | 'linear' | 'none' | 'polynomial';
  showAreaFill: boolean;
  markerSize: 'compact' | 'regular' | 'prominent';
  autoScaleY: boolean;
  startAtZero: boolean;
  scatterXColIndex?: number;
  scatterYColIndex?: number;
  scatterLabelColIndex?: number;
  scatterGroupColIndex?: number;
  autoScaleX: boolean;
  startAtZeroX: boolean;
  loessBandwidth: number;
  showCorrelationChip: boolean;
  donutVariant: 'donut' | 'pie';
  groupOthers: boolean;
  binStrategy: 'auto' | 'custom';
  customBinMode: 'step' | 'count';
  binCount: number;
  bucketSize: number;
  histogramYMode: 'frequency' | 'relative';
  showSummaryStats: boolean;
  showMedianMode: boolean;
  showReferenceGuide: boolean;
  xLabel: string;
  yLabel: string;
}

export function createSnapshotFromConfig(cfg?: SheetChartConfig): FormSnapshot {
  return {
    sheetUrl: (cfg?.sheetUrl || '').trim(),
    tabName: (cfg?.tabName || '').trim(),
    sheetGid: (cfg?.sheetGid || '').trim(),
    range: (cfg?.range || '').trim(),
    chartType: cfg?.defaultType || 'bar',
    unit: (cfg?.unitOverride || cfg?.visualConfig?.unit || '').trim(),
    titleOverride: (cfg?.titleOverride || '').trim(),
    subtitleOverride: (cfg?.subtitleOverride || '').trim(),
    barVariant: cfg?.visualConfig?.barVariant || 'standard',
    targetValue: cfg?.visualConfig?.targetValue,
    targetLabel: (cfg?.visualConfig?.targetLabel || 'Target').trim(),
    categoryColIndex: cfg?.visualConfig?.categoryColIndex ?? 0,
    includedSeriesIndices: cfg?.visualConfig?.includedSeriesIndices,
    sortBy: cfg?.visualConfig?.sortBy || 'none',
    sortField: cfg?.visualConfig?.sortField || (cfg?.visualConfig?.sortBy?.startsWith('category') ? 'category' : 'sheet_order'),
    sortDirection: cfg?.visualConfig?.sortDirection || (cfg?.visualConfig?.sortBy?.includes('desc') ? 'desc' : 'asc'),
    orientation: cfg?.visualConfig?.orientation || cfg?.visualConfig?.barOrientation || 'vertical',
    barOrientation: cfg?.visualConfig?.barOrientation || cfg?.visualConfig?.orientation || 'vertical',
    stacked: cfg?.visualConfig?.stacked || false,
    showValues: cfg?.visualConfig?.showValues || false,
    lastModifiedTime: cfg?.visualConfig?.lastModifiedTime,
    excludeSummaryRows: cfg?.visualConfig?.excludeSummaryRows ?? true,
    transpose: cfg?.visualConfig?.transpose ?? false,
    curveInterpolation: cfg?.visualConfig?.curveInterpolation || (cfg?.defaultType === 'scatter' ? 'none' : 'smooth'),
    showAreaFill: cfg?.visualConfig?.showAreaFill || false,
    markerSize: cfg?.visualConfig?.markerSize || 'regular',
    autoScaleY: cfg?.visualConfig?.autoScaleY || false,
    startAtZero: cfg?.visualConfig?.startAtZero ?? (cfg?.visualConfig?.autoScaleY ? false : true),
    scatterXColIndex: cfg?.visualConfig?.scatterXColIndex,
    scatterYColIndex: cfg?.visualConfig?.scatterYColIndex,
    scatterLabelColIndex: cfg?.visualConfig?.scatterLabelColIndex,
    scatterGroupColIndex: cfg?.visualConfig?.scatterGroupColIndex,
    autoScaleX: cfg?.visualConfig?.autoScaleX || false,
    startAtZeroX: cfg?.visualConfig?.startAtZeroX ?? (cfg?.visualConfig?.autoScaleX ? false : true),
    loessBandwidth: cfg?.visualConfig?.loessBandwidth ?? 0.5,
    showCorrelationChip: cfg?.visualConfig?.showCorrelationChip || false,
    donutVariant: cfg?.visualConfig?.donutVariant || 'donut',
    groupOthers: cfg?.visualConfig?.groupOthers ?? true,
    binStrategy: cfg?.visualConfig?.binStrategy || 'auto',
    customBinMode: cfg?.visualConfig?.bucketSize !== undefined ? 'step' : 'count',
    binCount: cfg?.visualConfig?.binCount || 8,
    bucketSize: cfg?.visualConfig?.bucketSize || 5,
    histogramYMode: cfg?.visualConfig?.histogramYMode || 'frequency',
    showSummaryStats: cfg?.visualConfig?.showSummaryStats || false,
    showMedianMode: cfg?.visualConfig?.showMedianMode || false,
    showReferenceGuide: cfg?.visualConfig?.showReferenceGuide || false,
    xLabel: (cfg?.visualConfig?.xLabel || '').trim(),
    yLabel: (cfg?.visualConfig?.yLabel || '').trim(),
  };
}

export function useChartConfigForm(initialConfig?: SheetChartConfig) {
  // Primary configuration
  const [sheetUrl, setSheetUrl] = useState(() => initialConfig?.sheetUrl || '');
  const [tabName, setTabName] = useState(() => initialConfig?.tabName || '');
  const [sheetGid, setSheetGid] = useState(() => initialConfig?.sheetGid || '');
  const [range, setRange] = useState(() => initialConfig?.range || '');
  const [chartType, setChartType] = useState<ChartType>(() => initialConfig?.defaultType || 'bar');
  const [unit, setUnit] = useState(
    () => initialConfig?.unitOverride || initialConfig?.visualConfig?.unit || ''
  );
  const [titleOverride, setTitleOverride] = useState(() => initialConfig?.titleOverride || '');
  const [subtitleOverride, setSubtitleOverride] = useState(() => initialConfig?.subtitleOverride || '');
  const [xLabel, setXLabel] = useState(() => initialConfig?.visualConfig?.xLabel || '');
  const [yLabel, setYLabel] = useState(() => initialConfig?.visualConfig?.yLabel || '');
  const [excludeSummaryRows, setExcludeSummaryRows] = useState<boolean>(
    () => initialConfig?.visualConfig?.excludeSummaryRows ?? true
  );
  const [transpose, setTranspose] = useState<boolean>(
    () => initialConfig?.visualConfig?.transpose ?? false
  );

  // Progress milestone state (for Bar charts)
  const [barVariant, setBarVariant] = useState<'standard' | 'progress'>(
    () => initialConfig?.visualConfig?.barVariant || 'standard'
  );
  const [targetValue, setTargetValue] = useState<number | undefined>(
    () => initialConfig?.visualConfig?.targetValue
  );
  const [targetLabel, setTargetLabel] = useState<string>(
    () => initialConfig?.visualConfig?.targetLabel || 'Target'
  );

  // Column role mapping & Ordering state
  const [categoryColIndex, setCategoryColIndex] = useState<number>(
    () => initialConfig?.visualConfig?.categoryColIndex ?? 0
  );
  const [includedSeriesIndices, setIncludedSeriesIndices] = useState<number[] | undefined>(
    () => initialConfig?.visualConfig?.includedSeriesIndices
  );
  const [sortBy, setSortBy] = useState<'none' | 'asc' | 'desc' | 'category-asc' | 'category-desc'>(
    () => initialConfig?.visualConfig?.sortBy || 'none'
  );
  const [sortField, setSortField] = useState<string>(
    () =>
      initialConfig?.visualConfig?.sortField ||
      (initialConfig?.visualConfig?.sortBy?.startsWith('category') ? 'category' : 'sheet_order')
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    () =>
      initialConfig?.visualConfig?.sortDirection ||
      (initialConfig?.visualConfig?.sortBy?.includes('desc') ? 'desc' : 'asc')
  );
  const [barOrientation, setBarOrientation] = useState<'vertical' | 'horizontal'>(
    () => initialConfig?.visualConfig?.orientation || initialConfig?.visualConfig?.barOrientation || 'vertical'
  );
  const [stacked, setStacked] = useState<boolean>(
    () => initialConfig?.visualConfig?.stacked || false
  );
  const [showValues, setShowValues] = useState<boolean>(
    () => initialConfig?.visualConfig?.showValues || false
  );
  const [lastModifiedTime, setLastModifiedTime] = useState<string | undefined>(
    () => initialConfig?.visualConfig?.lastModifiedTime
  );

  // Line & Scatter visual state
  const [curveInterpolation, setCurveInterpolation] = useState<'smooth' | 'straight' | 'linear' | 'none' | 'polynomial'>(
    () => initialConfig?.visualConfig?.curveInterpolation || (initialConfig?.defaultType === 'scatter' ? 'none' : 'smooth')
  );
  const [showAreaFill, setShowAreaFill] = useState<boolean>(
    () => initialConfig?.visualConfig?.showAreaFill || false
  );
  const [markerSize, setMarkerSize] = useState<'compact' | 'regular' | 'prominent'>(
    () => initialConfig?.visualConfig?.markerSize || 'regular'
  );
  const [autoScaleY, setAutoScaleY] = useState<boolean>(
    () => initialConfig?.visualConfig?.autoScaleY || false
  );
  const [startAtZero, setStartAtZero] = useState<boolean>(() => {
    if (initialConfig?.visualConfig?.startAtZero !== undefined) return initialConfig.visualConfig.startAtZero;
    if (initialConfig?.visualConfig?.autoScaleY !== undefined) return !initialConfig.visualConfig.autoScaleY;
    return true;
  });

  // Scatter visual state
  const [scatterXColIndex, setScatterXColIndex] = useState<number | undefined>(
    () => initialConfig?.visualConfig?.scatterXColIndex
  );
  const [scatterYColIndex, setScatterYColIndex] = useState<number | undefined>(
    () => initialConfig?.visualConfig?.scatterYColIndex
  );
  const [scatterLabelColIndex, setScatterLabelColIndex] = useState<number | undefined>(
    () => initialConfig?.visualConfig?.scatterLabelColIndex
  );
  const [scatterGroupColIndex, setScatterGroupColIndex] = useState<number | undefined>(
    () => initialConfig?.visualConfig?.scatterGroupColIndex
  );
  const [autoScaleX, setAutoScaleX] = useState<boolean>(
    () => initialConfig?.visualConfig?.autoScaleX || false
  );
  const [startAtZeroX, setStartAtZeroX] = useState<boolean>(() => {
    if (initialConfig?.visualConfig?.startAtZeroX !== undefined) return initialConfig.visualConfig.startAtZeroX;
    if (initialConfig?.visualConfig?.autoScaleX !== undefined) return !initialConfig.visualConfig.autoScaleX;
    return true;
  });
  const [loessBandwidth, setLoessBandwidth] = useState<number>(
    () => initialConfig?.visualConfig?.loessBandwidth ?? 0.5
  );
  const [showCorrelationChip, setShowCorrelationChip] = useState<boolean>(
    () => initialConfig?.visualConfig?.showCorrelationChip || false
  );

  // Donut visual state
  const [donutVariant, setDonutVariant] = useState<'donut' | 'pie'>(
    () => initialConfig?.visualConfig?.donutVariant || 'donut'
  );
  const [groupOthers, setGroupOthers] = useState<boolean>(
    () => initialConfig?.visualConfig?.groupOthers ?? true
  );

  // Histogram visual state
  const [binStrategy, setBinStrategy] = useState<'auto' | 'custom'>(
    () => initialConfig?.visualConfig?.binStrategy || 'auto'
  );
  const [customBinMode, setCustomBinMode] = useState<'step' | 'count'>(
    () => (initialConfig?.visualConfig?.bucketSize !== undefined ? 'step' : 'count')
  );
  const [binCount, setBinCount] = useState<number | ''>(
    () => initialConfig?.visualConfig?.binCount || 8
  );
  const [bucketSize, setBucketSize] = useState<number | ''>(
    () => initialConfig?.visualConfig?.bucketSize || 5
  );
  const [histogramYMode, setHistogramYMode] = useState<'frequency' | 'relative'>(
    () => initialConfig?.visualConfig?.histogramYMode || 'frequency'
  );
  const [showSummaryStats, setShowSummaryStats] = useState<boolean>(
    () => initialConfig?.visualConfig?.showSummaryStats || false
  );
  const [showMedianMode, setShowMedianMode] = useState<boolean>(
    () => initialConfig?.visualConfig?.showMedianMode || false
  );
  const [showReferenceGuide, setShowReferenceGuide] = useState<boolean>(
    () => initialConfig?.visualConfig?.showReferenceGuide || false
  );

  // Snapshot for unsaved data detection
  const [savedSnapshot, setSavedSnapshot] = useState<FormSnapshot>(() =>
    createSnapshotFromConfig(initialConfig)
  );

  // Reset form to a specific configuration
  const resetForm = useCallback((cfg?: SheetChartConfig) => {
    const snapshot = createSnapshotFromConfig(cfg);
    setSavedSnapshot(snapshot);
    setSheetUrl(cfg?.sheetUrl || '');
    setTabName(cfg?.tabName || '');
    setSheetGid(cfg?.sheetGid || '');
    setRange(cfg?.range || '');
    setChartType(cfg?.defaultType || 'bar');
    setUnit(cfg?.unitOverride || cfg?.visualConfig?.unit || '');
    setTitleOverride(cfg?.titleOverride || '');
    setSubtitleOverride(cfg?.subtitleOverride || '');
    setXLabel(cfg?.visualConfig?.xLabel || '');
    setYLabel(cfg?.visualConfig?.yLabel || '');
    setBarVariant(cfg?.visualConfig?.barVariant || 'standard');
    setTargetValue(cfg?.visualConfig?.targetValue);
    setTargetLabel(cfg?.visualConfig?.targetLabel || 'Target');
    setCategoryColIndex(cfg?.visualConfig?.categoryColIndex ?? 0);
    setIncludedSeriesIndices(cfg?.visualConfig?.includedSeriesIndices);
    setSortBy(cfg?.visualConfig?.sortBy || 'none');
    setSortField(
      cfg?.visualConfig?.sortField ||
      (cfg?.visualConfig?.sortBy?.startsWith('category') ? 'category' : 'sheet_order')
    );
    setSortDirection(
      cfg?.visualConfig?.sortDirection ||
      (cfg?.visualConfig?.sortBy?.includes('desc') ? 'desc' : 'asc')
    );
    setBarOrientation(cfg?.visualConfig?.orientation || cfg?.visualConfig?.barOrientation || 'vertical');
    setStacked(cfg?.visualConfig?.stacked || false);
    setShowValues(cfg?.visualConfig?.showValues || false);
    setCurveInterpolation(cfg?.visualConfig?.curveInterpolation || (cfg?.defaultType === 'scatter' ? 'none' : 'smooth'));
    setShowAreaFill(cfg?.visualConfig?.showAreaFill || false);
    setMarkerSize(cfg?.visualConfig?.markerSize || 'regular');
    setAutoScaleY(cfg?.visualConfig?.autoScaleY || false);
    setStartAtZero(cfg?.visualConfig?.startAtZero ?? (cfg?.visualConfig?.autoScaleY ? false : true));
    setScatterXColIndex(cfg?.visualConfig?.scatterXColIndex);
    setScatterYColIndex(cfg?.visualConfig?.scatterYColIndex);
    setScatterLabelColIndex(cfg?.visualConfig?.scatterLabelColIndex);
    setScatterGroupColIndex(cfg?.visualConfig?.scatterGroupColIndex);
    setAutoScaleX(cfg?.visualConfig?.autoScaleX || false);
    setStartAtZeroX(cfg?.visualConfig?.startAtZeroX ?? (cfg?.visualConfig?.autoScaleX ? false : true));
    setLoessBandwidth(cfg?.visualConfig?.loessBandwidth ?? 0.5);
    setShowCorrelationChip(cfg?.visualConfig?.showCorrelationChip || false);
    setDonutVariant(cfg?.visualConfig?.donutVariant || 'donut');
    setGroupOthers(cfg?.visualConfig?.groupOthers ?? true);
    setBinStrategy(cfg?.visualConfig?.binStrategy || 'auto');
    setCustomBinMode(cfg?.visualConfig?.bucketSize !== undefined ? 'step' : 'count');
    setBinCount(cfg?.visualConfig?.binCount || 8);
    setBucketSize(cfg?.visualConfig?.bucketSize || 5);
    setHistogramYMode(cfg?.visualConfig?.histogramYMode || 'frequency');
    setShowSummaryStats(cfg?.visualConfig?.showSummaryStats || false);
    setShowMedianMode(cfg?.visualConfig?.showMedianMode || false);
    setShowReferenceGuide(cfg?.visualConfig?.showReferenceGuide || false);
    setLastModifiedTime(cfg?.visualConfig?.lastModifiedTime);
    setExcludeSummaryRows(cfg?.visualConfig?.excludeSummaryRows ?? true);
    setTranspose(cfg?.visualConfig?.transpose ?? false);
  }, []);

  // Update snapshot after successful save
  const markAsSaved = useCallback((cfg: SheetChartConfig) => {
    setSavedSnapshot(createSnapshotFromConfig(cfg));
  }, []);

  // Synchronous dirty state calculation
  const hasUnsavedChanges = useMemo(() => {
    const currentSheetUrl = sheetUrl.trim();
    const currentTabName = tabName.trim();
    const currentSheetGid = sheetGid.trim();
    const currentRange = range.trim();
    const currentUnit = unit.trim();
    const currentTitle = titleOverride.trim();
    const currentSubtitle = subtitleOverride.trim();
    const currentXLabel = xLabel.trim();
    const currentYLabel = yLabel.trim();
    const currentTargetLabel = targetLabel.trim();

    if (!savedSnapshot.sheetUrl && !currentSheetUrl) {
      return false;
    }

    return (
      currentSheetUrl !== savedSnapshot.sheetUrl ||
      currentTabName !== savedSnapshot.tabName ||
      currentSheetGid !== savedSnapshot.sheetGid ||
      currentRange !== savedSnapshot.range ||
      chartType !== savedSnapshot.chartType ||
      currentUnit !== savedSnapshot.unit ||
      currentTitle !== savedSnapshot.titleOverride ||
      currentSubtitle !== savedSnapshot.subtitleOverride ||
      currentXLabel !== savedSnapshot.xLabel ||
      currentYLabel !== savedSnapshot.yLabel ||
      barVariant !== savedSnapshot.barVariant ||
      targetValue !== savedSnapshot.targetValue ||
      currentTargetLabel !== savedSnapshot.targetLabel ||
      categoryColIndex !== savedSnapshot.categoryColIndex ||
      JSON.stringify(includedSeriesIndices) !== JSON.stringify(savedSnapshot.includedSeriesIndices) ||
      sortBy !== savedSnapshot.sortBy ||
      sortField !== savedSnapshot.sortField ||
      sortDirection !== savedSnapshot.sortDirection ||
      barOrientation !== savedSnapshot.barOrientation ||
      stacked !== savedSnapshot.stacked ||
      showValues !== savedSnapshot.showValues ||
      curveInterpolation !== savedSnapshot.curveInterpolation ||
      showAreaFill !== savedSnapshot.showAreaFill ||
      markerSize !== savedSnapshot.markerSize ||
      autoScaleY !== savedSnapshot.autoScaleY ||
      startAtZero !== savedSnapshot.startAtZero ||
      scatterXColIndex !== savedSnapshot.scatterXColIndex ||
      scatterYColIndex !== savedSnapshot.scatterYColIndex ||
      scatterLabelColIndex !== savedSnapshot.scatterLabelColIndex ||
      scatterGroupColIndex !== savedSnapshot.scatterGroupColIndex ||
      autoScaleX !== savedSnapshot.autoScaleX ||
      startAtZeroX !== savedSnapshot.startAtZeroX ||
      loessBandwidth !== savedSnapshot.loessBandwidth ||
      showCorrelationChip !== savedSnapshot.showCorrelationChip ||
      donutVariant !== savedSnapshot.donutVariant ||
      groupOthers !== savedSnapshot.groupOthers ||
      binStrategy !== savedSnapshot.binStrategy ||
      customBinMode !== savedSnapshot.customBinMode ||
      binCount !== savedSnapshot.binCount ||
      bucketSize !== savedSnapshot.bucketSize ||
      histogramYMode !== savedSnapshot.histogramYMode ||
      showSummaryStats !== savedSnapshot.showSummaryStats ||
      showMedianMode !== savedSnapshot.showMedianMode ||
      showReferenceGuide !== savedSnapshot.showReferenceGuide ||
      lastModifiedTime !== savedSnapshot.lastModifiedTime ||
      excludeSummaryRows !== savedSnapshot.excludeSummaryRows ||
      transpose !== savedSnapshot.transpose
    );
  }, [
    sheetUrl,
    tabName,
    sheetGid,
    range,
    chartType,
    unit,
    titleOverride,
    subtitleOverride,
    xLabel,
    yLabel,
    barVariant,
    targetValue,
    targetLabel,
    categoryColIndex,
    includedSeriesIndices,
    sortBy,
    sortField,
    sortDirection,
    barOrientation,
    stacked,
    showValues,
    curveInterpolation,
    showAreaFill,
    markerSize,
    autoScaleY,
    startAtZero,
    scatterXColIndex,
    scatterYColIndex,
    scatterLabelColIndex,
    scatterGroupColIndex,
    autoScaleX,
    startAtZeroX,
    loessBandwidth,
    showCorrelationChip,
    donutVariant,
    groupOthers,
    binStrategy,
    customBinMode,
    binCount,
    bucketSize,
    histogramYMode,
    showSummaryStats,
    showMedianMode,
    showReferenceGuide,
    lastModifiedTime,
    excludeSummaryRows,
    transpose,
    savedSnapshot,
  ]);

  // Construct complete payload matching data contracts
  const buildConfigPayload = useCallback(
    (
      chartId: string,
      nodeId: NodeCode,
      effectiveScatterX?: number,
      effectiveScatterY?: number,
      effectiveScatterLabel?: number
    ): SheetChartConfig => {
      return {
        chartId,
        nodeId,
        sheetUrl: sheetUrl.trim(),
        tabName: tabName.trim() || undefined,
        sheetGid: sheetGid.trim() || undefined,
        range: range.trim(),
        defaultType: chartType,
        titleOverride: titleOverride.trim() || undefined,
        subtitleOverride: subtitleOverride.trim() || undefined,
        unitOverride: unit.trim() || undefined,
        visualConfig: {
          unit: unit.trim() || undefined,
          xLabel: xLabel.trim() || undefined,
          yLabel: yLabel.trim() || undefined,
          range: range.trim(),
          tabName: tabName.trim() || undefined,
          sheetGid: sheetGid.trim() || undefined,
          excludeSummaryRows,
          transpose,
          barVariant: chartType === 'bar' ? barVariant : undefined,
          targetValue: chartType === 'bar' && barVariant === 'progress' ? targetValue : undefined,
          targetLabel: chartType === 'bar' && barVariant === 'progress' ? targetLabel : undefined,
          categoryColIndex,
          includedSeriesIndices,
          sortBy: chartType === 'donut' ? undefined : sortBy,
          sortField: chartType === 'donut' ? undefined : sortField,
          sortDirection: chartType === 'donut' ? undefined : sortDirection,
          orientation: chartType === 'bar' ? barOrientation : undefined,
          barOrientation: chartType === 'bar' ? barOrientation : undefined,
          stacked: chartType === 'bar' ? stacked : undefined,
          showValues: (chartType === 'bar' || chartType === 'line' || chartType === 'donut') ? showValues : undefined,
          curveInterpolation: (chartType === 'line' || chartType === 'histogram' || chartType === 'scatter') ? curveInterpolation : undefined,
          showAreaFill: (chartType === 'line' || chartType === 'scatter') ? showAreaFill : undefined,
          markerSize: (chartType === 'line' || chartType === 'scatter') ? markerSize : undefined,
          autoScaleY: (chartType === 'line' || chartType === 'bar' || chartType === 'scatter') ? autoScaleY : undefined,
          startAtZero: (chartType === 'line' || chartType === 'scatter') ? startAtZero : undefined,
          startAtZeroX: chartType === 'scatter' ? startAtZeroX : undefined,
          loessBandwidth: chartType === 'scatter' ? loessBandwidth : undefined,
          scatterXColIndex: chartType === 'scatter' ? (effectiveScatterX ?? scatterXColIndex) : undefined,
          scatterYColIndex: chartType === 'scatter' ? (effectiveScatterY ?? scatterYColIndex) : undefined,
          scatterLabelColIndex: chartType === 'scatter' ? (effectiveScatterLabel ?? scatterLabelColIndex) : undefined,
          scatterGroupColIndex: chartType === 'scatter' ? scatterGroupColIndex : undefined,
          autoScaleX: chartType === 'scatter' ? autoScaleX : undefined,
          showCorrelationChip: chartType === 'scatter' ? showCorrelationChip : undefined,
          donutVariant: chartType === 'donut' ? donutVariant : undefined,
          groupOthers: chartType === 'donut' ? groupOthers : undefined,
          binStrategy: chartType === 'histogram' ? binStrategy : undefined,
          binCount: chartType === 'histogram' ? (customBinMode === 'count' ? (typeof binCount === 'number' && binCount >= 2 ? Math.min(50, binCount) : 8) : undefined) : undefined,
          bucketSize: chartType === 'histogram' ? (customBinMode === 'step' ? (typeof bucketSize === 'number' && bucketSize >= 1 ? bucketSize : 5) : undefined) : undefined,
          histogramYMode: chartType === 'histogram' ? histogramYMode : undefined,
          showSummaryStats: chartType === 'histogram' ? showSummaryStats : undefined,
          showMedianMode: chartType === 'histogram' ? showMedianMode : undefined,
          showReferenceGuide: (chartType === 'histogram' || chartType === 'scatter') ? showReferenceGuide : undefined,
          lastModifiedTime,
        },
        updatedAt: new Date().toISOString(),
        updatedBy: 'coordinator',
      };
    },
    [
      sheetUrl,
      tabName,
      sheetGid,
      range,
      chartType,
      titleOverride,
      subtitleOverride,
      xLabel,
      yLabel,
      unit,
      excludeSummaryRows,
      transpose,
      barVariant,
      targetValue,
      targetLabel,
      categoryColIndex,
      includedSeriesIndices,
      sortBy,
      sortField,
      sortDirection,
      barOrientation,
      stacked,
      showValues,
      curveInterpolation,
      showAreaFill,
      markerSize,
      autoScaleY,
      startAtZero,
      startAtZeroX,
      loessBandwidth,
      scatterXColIndex,
      scatterYColIndex,
      scatterLabelColIndex,
      scatterGroupColIndex,
      autoScaleX,
      showCorrelationChip,
      donutVariant,
      groupOthers,
      binStrategy,
      customBinMode,
      binCount,
      bucketSize,
      histogramYMode,
      showSummaryStats,
      showMedianMode,
      showReferenceGuide,
      lastModifiedTime,
    ]
  );

  return {
    sheetUrl,
    setSheetUrl,
    tabName,
    setTabName,
    sheetGid,
    setSheetGid,
    range,
    setRange,
    chartType,
    setChartType,
    unit,
    setUnit,
    titleOverride,
    setTitleOverride,
    subtitleOverride,
    setSubtitleOverride,
    xLabel,
    setXLabel,
    yLabel,
    setYLabel,
    excludeSummaryRows,
    setExcludeSummaryRows,
    transpose,
    setTranspose,
    barVariant,
    setBarVariant,
    targetValue,
    setTargetValue,
    targetLabel,
    setTargetLabel,
    categoryColIndex,
    setCategoryColIndex,
    includedSeriesIndices,
    setIncludedSeriesIndices,
    sortBy,
    setSortBy,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    barOrientation,
    setBarOrientation,
    stacked,
    setStacked,
    showValues,
    setShowValues,
    lastModifiedTime,
    setLastModifiedTime,
    curveInterpolation,
    setCurveInterpolation,
    showAreaFill,
    setShowAreaFill,
    markerSize,
    setMarkerSize,
    autoScaleY,
    setAutoScaleY,
    startAtZero,
    setStartAtZero,
    scatterXColIndex,
    setScatterXColIndex,
    scatterYColIndex,
    setScatterYColIndex,
    scatterLabelColIndex,
    setScatterLabelColIndex,
    scatterGroupColIndex,
    setScatterGroupColIndex,
    autoScaleX,
    setAutoScaleX,
    startAtZeroX,
    setStartAtZeroX,
    loessBandwidth,
    setLoessBandwidth,
    showCorrelationChip,
    setShowCorrelationChip,
    donutVariant,
    setDonutVariant,
    groupOthers,
    setGroupOthers,
    binStrategy,
    setBinStrategy,
    customBinMode,
    setCustomBinMode,
    binCount,
    setBinCount,
    bucketSize,
    setBucketSize,
    histogramYMode,
    setHistogramYMode,
    showSummaryStats,
    setShowSummaryStats,
    showMedianMode,
    setShowMedianMode,
    showReferenceGuide,
    setShowReferenceGuide,
    savedSnapshot,
    setSavedSnapshot,
    hasUnsavedChanges,
    resetForm,
    markAsSaved,
    buildConfigPayload,
  };
}

export type ChartConfigFormReturn = ReturnType<typeof useChartConfigForm>;
