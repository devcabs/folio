import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { SheetChartConfig, ChartDataset } from '../../types/chart';
import type { NodeCode } from '../../types/node';
import { Drawer, type DrawerTabItem } from '../ui/Drawer';
import { Button } from '../ui';
import { Toast } from '../feedback/Toast';
import {
  saveChartConfigDetailed,
  setCachedChartConfig,
  formatSaveErrorMessage,
} from '../../services/chartSourceService';
import { parseTabularDataset, transposeMatrix } from '../../services/sheetsDataService';
import { parseRangeNotation } from '../../utils/chartSanitizer';
import { NODE_ACCENT_TOKENS } from '../../utils/chartColors';
import {
  useChartConfigForm,
  useSheetVerification,
  useLiveMatrixSync,
  Step1SourceRange,
  Step3ChartSetup,
} from './drawer';
import { RangePreviewMatrix } from './RangePreviewMatrix';
import { ChartCard } from './ChartCard';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt';
import styles from './ChartConfigDrawer.module.css';

export type WizardStep = 1 | 2;
export type ChartSetupSubTab = 'style' | 'data' | 'sorting';

export interface ChartConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chartId: string;
  nodeId: NodeCode;
  initialConfig?: SheetChartConfig;
  previewMatrix?: (string | number | null)[][];
  onDeployed?: (config: SheetChartConfig) => void;
  mode?: 'add' | 'edit';
}

export const ChartConfigDrawer: React.FC<ChartConfigDrawerProps> = ({
  isOpen,
  onClose,
  chartId,
  nodeId,
  initialConfig,
  previewMatrix,
  onDeployed,
  mode = 'edit',
}) => {
  const [activeStep, setActiveStep] = useState<WizardStep>(1);
  const [setupSubTab, setSetupSubTab] = useState<ChartSetupSubTab>('data');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const { showToast } = useDeveloperMode();

  const prevIsOpenRef = useRef(false);
  const prevChartIdRef = useRef<string | null>(null);

  // Core Form State
  const form = useChartConfigForm(initialConfig);

  // Prevent accidental reload or navigation when chart form has unsaved configurations
  useUnsavedChangesPrompt(isOpen && form.hasUnsavedChanges, `chart-config-${chartId}`);

  // Network Access Verification
  const verification = useSheetVerification({
    sheetUrl: form.sheetUrl,
    tabName: form.tabName,
    sheetGid: form.sheetGid,
    initialConfig,
    setTabName: form.setTabName,
    setSheetGid: form.setSheetGid,
    setLastModifiedTime: form.setLastModifiedTime,
    onAutoSelectTab: (tabTitle, gid) => {
      form.setSavedSnapshot((prev) =>
        prev.sheetUrl === form.sheetUrl.trim() && !prev.tabName
          ? { ...prev, tabName: tabTitle, sheetGid: gid }
          : prev
      );
    },
  });

  // Live Sheet Data Matrix Sync
  const matrixSync = useLiveMatrixSync({
    sheetUrl: form.sheetUrl,
    tabName: form.tabName,
    sheetGid: form.sheetGid,
    range: form.range,
    previewMatrix: previewMatrix || initialConfig?.cachedDataset || undefined,
  });

  // Reset/sync form when opening drawer or changing target chart
  useEffect(() => {
    const isJustOpening = isOpen && (!prevIsOpenRef.current || prevChartIdRef.current !== chartId);

    if (isJustOpening) {
      setActiveStep(1);
      setSetupSubTab('data');
      form.resetForm(initialConfig);
      verification.resetVerification(
        initialConfig?.sheetUrl,
        initialConfig?.tabName,
        initialConfig?.sheetGid
      );
    }

    prevIsOpenRef.current = isOpen;
    prevChartIdRef.current = chartId;
  }, [isOpen, chartId, initialConfig, form, verification]);

  // Track tab changes and manual range selections
  const prevTabNameRef = useRef(form.tabName);
  const userManuallySelectedRangeRef = useRef(false);

  // When tab changes, reset manual range selection flag
  useEffect(() => {
    if (form.tabName !== prevTabNameRef.current) {
      prevTabNameRef.current = form.tabName;
      userManuallySelectedRangeRef.current = false;
    }
  }, [form.tabName]);

  // Dynamically set default range based on sheet content (using bounding filled cells)
  useEffect(() => {
    if (!matrixSync.detectedRange) return;

    const hasInitialCustomRange = Boolean(
      initialConfig?.range &&
      initialConfig.range.trim() !== '' &&
      initialConfig.range.trim() !== 'A1:D6' &&
      (!initialConfig.tabName || initialConfig.tabName === form.tabName)
    );

    if (!userManuallySelectedRangeRef.current) {
      if (!hasInitialCustomRange || mode === 'add' || form.tabName !== initialConfig?.tabName) {
        form.setRange(matrixSync.detectedRange);
      }
    }
  }, [matrixSync.detectedRange, initialConfig, form, mode]);

  // Sub-Tab Keyboard Navigation
  const handleSubTabKeyDown = (e: React.KeyboardEvent) => {
    const tabs: ChartSetupSubTab[] = ['data', 'style'];
    const currentIndex = tabs.indexOf(setupSubTab);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextTab = tabs[(currentIndex + 1) % tabs.length];
      setSetupSubTab(nextTab);
      document.getElementById(`setup-tab-${nextTab}`)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
      setSetupSubTab(prevTab);
      document.getElementById(`setup-tab-${prevTab}`)?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSetupSubTab('data');
      document.getElementById('setup-tab-data')?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setSetupSubTab('style');
      document.getElementById('setup-tab-style')?.focus();
    }
  };


  // Effective matrix considering live transposition toggle
  const effectiveMatrix = useMemo(() => {
    if (!matrixSync.liveMatrix || matrixSync.liveMatrix.length === 0) return matrixSync.liveMatrix;
    return form.transpose ? transposeMatrix(matrixSync.liveMatrix) : matrixSync.liveMatrix;
  }, [matrixSync.liveMatrix, form.transpose]);

  // Derived detected columns honoring transposition
  const effectiveDetectedColumns = useMemo(() => {
    const active = effectiveMatrix.length > 0 ? effectiveMatrix : previewMatrix || [];
    const headerRow = active[0] || [];
    return headerRow.map((col, idx) => ({
      index: idx,
      label:
        col !== null && col !== undefined && String(col).trim() !== ''
          ? String(col).trim()
          : `Col ${idx + 1}`,
    }));
  }, [effectiveMatrix, previewMatrix]);

  // Series selection helpers
  const handleToggleSeries = useCallback(
    (colIdx: number) => {
      const defaultIncluded = effectiveDetectedColumns
        .filter((c) => c.index !== form.categoryColIndex)
        .map((c) => c.index);
      const current = form.includedSeriesIndices ?? defaultIncluded;

      if (current.includes(colIdx)) {
        if (current.length > 1) {
          form.setIncludedSeriesIndices(current.filter((i) => i !== colIdx));
        }
      } else {
        form.setIncludedSeriesIndices([...current, colIdx]);
      }
    },
    [effectiveDetectedColumns, form]
  );

  // Range validation
  const parsedRange = useMemo(() => parseRangeNotation(form.range), [form.range]);
  const isRangeValid = Boolean(parsedRange);

  // Stepper accessibility
  const isStepAccessible = useCallback(
    (step: WizardStep) => {
      if (step === 1) return true;
      if (step === 2) return verification.isStep1Valid && isRangeValid;
      return false;
    },
    [verification.isStep1Valid, isRangeValid]
  );

  const accentColor = NODE_ACCENT_TOKENS[nodeId] || 'var(--folio-primary)';

  const effectiveScatterX =
    typeof form.scatterXColIndex === 'number'
      ? form.scatterXColIndex
      : effectiveDetectedColumns.length > 1
        ? 1
        : 0;

  const effectiveScatterY =
    typeof form.scatterYColIndex === 'number'
      ? form.scatterYColIndex
      : effectiveDetectedColumns.length > 2
        ? 2
        : effectiveDetectedColumns.length > 1
          ? 1
          : 0;

  const effectiveScatterLabel =
    typeof form.scatterLabelColIndex === 'number' ? form.scatterLabelColIndex : 0;

  // Real-time parsed dataset for Step 4 Preview Tab
  const previewDataset = useMemo<ChartDataset | null>(() => {
    if (!matrixSync.liveMatrix || matrixSync.liveMatrix.length === 0) return null;

    try {
      const stringMatrix: string[][] = matrixSync.liveMatrix.map((row) =>
        row.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
      );

      const cfg = form.buildConfigPayload(
        chartId,
        nodeId,
        effectiveScatterX,
        effectiveScatterY,
        effectiveScatterLabel
      );

      return parseTabularDataset({
        chartId,
        title: form.titleOverride.trim() || '',
        subtitle: form.subtitleOverride.trim() || undefined,
        unit: form.unit.trim() || undefined,
        chartType: form.chartType,
        nodeId,
        visualConfig: cfg.visualConfig,
        rawMatrix: stringMatrix,
      });
    } catch {
      return null;
    }
  }, [
    matrixSync.liveMatrix,
    form,
    chartId,
    nodeId,
    effectiveScatterX,
    effectiveScatterY,
    effectiveScatterLabel,
  ]);

  // Resync Source and tabs directly from Step 1
  const handleResyncSource = useCallback(async () => {
    if (!form.sheetUrl.trim()) {
      setToast({ message: 'Please enter a Google Sheet URL first.', type: 'error' });
      return;
    }

    try {
      await verification.executeVerification(form.sheetUrl);
      matrixSync.executeSync();
      userManuallySelectedRangeRef.current = false;
      setToast({ message: 'Google Sheet source and tabs resynced.', type: 'info' });
    } catch {
      setToast({ message: 'Failed to resync Google Sheet source.', type: 'error' });
    }
  }, [form.sheetUrl, verification, matrixSync]);

  // Save chart configuration directly without advancing or closing
  const handleSave = useCallback(async () => {
    if (!form.sheetUrl.trim()) {
      setToast({ message: 'Google Sheet URL is required.', type: 'error' });
      return;
    }

    if (!isRangeValid) {
      setToast({ message: 'Please provide a valid cell range such as A1:D6.', type: 'error' });
      return;
    }

    setIsSaving(true);
    const baseConfig = form.buildConfigPayload(
      chartId,
      nodeId,
      effectiveScatterX,
      effectiveScatterY,
      effectiveScatterLabel
    );
    const config: SheetChartConfig = {
      ...baseConfig,
      cachedDataset:
        matrixSync.liveMatrix && matrixSync.liveMatrix.length > 0
          ? matrixSync.liveMatrix
          : matrixSync.fetchedMatrix && matrixSync.fetchedMatrix.length > 0
            ? matrixSync.fetchedMatrix
            : initialConfig?.cachedDataset,
    };

    try {
      const result = await saveChartConfigDetailed(config);
      if (result.savedToCloud) {
        setCachedChartConfig(config);
        form.markAsSaved(config);
        setToast({ message: 'Chart configuration saved.', type: 'success' });
        onDeployed?.(config);
      } else if (result.savedLocally) {
        setCachedChartConfig(config);
        form.markAsSaved(config);
        onDeployed?.(config);
        setToast({
          message: formatSaveErrorMessage(result, 'save'),
          type: result.error ? 'error' : 'info',
        });
      } else {
        setToast({
          message: formatSaveErrorMessage(result, 'save'),
          type: 'error',
        });
      }
    } catch (err) {
      setToast({
        message: formatSaveErrorMessage(err, 'save'),
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    form,
    chartId,
    nodeId,
    isRangeValid,
    effectiveScatterX,
    effectiveScatterY,
    effectiveScatterLabel,
    matrixSync.liveMatrix,
    matrixSync.fetchedMatrix,
    initialConfig?.cachedDataset,
    onDeployed,
  ]);

  // Deploy to Supabase action
  const handleDeploy = useCallback(async () => {
    if (!form.sheetUrl.trim()) {
      setToast({ message: 'Google Sheet URL is required.', type: 'error' });
      return;
    }

    if (!isRangeValid) {
      setToast({ message: 'Please provide a valid cell range such as A5:D12.', type: 'error' });
      return;
    }

    setIsDeploying(true);
    const baseConfig = form.buildConfigPayload(
      chartId,
      nodeId,
      effectiveScatterX,
      effectiveScatterY,
      effectiveScatterLabel
    );
    const config: SheetChartConfig = {
      ...baseConfig,
      cachedDataset:
        matrixSync.liveMatrix && matrixSync.liveMatrix.length > 0
          ? matrixSync.liveMatrix
          : matrixSync.fetchedMatrix && matrixSync.fetchedMatrix.length > 0
            ? matrixSync.fetchedMatrix
            : initialConfig?.cachedDataset,
    };

    try {
      const result = await saveChartConfigDetailed(config);
      if (result.savedToCloud) {
        setCachedChartConfig(config);
        form.markAsSaved(config);
        const successMsg = mode === 'add' ? 'Chart added to canvas and saved to draft.' : 'Chart saved to draft successfully.';
        setToast({ message: successMsg, type: 'success' });
        showToast(successMsg, 'success');
        onDeployed?.(config);
        onClose();
      } else {
        if (result.savedLocally) {
          setCachedChartConfig(config);
          form.markAsSaved(config);
          onDeployed?.(config);
          onClose();
        }
        setToast({
          message: formatSaveErrorMessage(result, 'deploy'),
          type: 'error',
        });
      }
    } catch (err) {
      setToast({
        message: formatSaveErrorMessage(err, 'deploy'),
        type: 'error',
      });
    } finally {
      setIsDeploying(false);
    }
  }, [
    form,
    chartId,
    nodeId,
    isRangeValid,
    effectiveScatterX,
    effectiveScatterY,
    effectiveScatterLabel,
    matrixSync.liveMatrix,
    matrixSync.fetchedMatrix,
    initialConfig?.cachedDataset,
    mode,
    onDeployed,
    onClose,
    showToast,
  ]);

  const previewConfig = useMemo(() => {
    return {
      ...form.buildConfigPayload(
        chartId,
        nodeId,
        effectiveScatterX,
        effectiveScatterY,
        effectiveScatterLabel
      ),
      cachedDataset:
        matrixSync.liveMatrix && matrixSync.liveMatrix.length > 0
          ? matrixSync.liveMatrix
          : initialConfig?.cachedDataset,
    };
  }, [
    form,
    chartId,
    nodeId,
    effectiveScatterX,
    effectiveScatterY,
    effectiveScatterLabel,
    matrixSync.liveMatrix,
    initialConfig?.cachedDataset,
  ]);

  const drawerTabs: DrawerTabItem[] = useMemo(
    () => [
      {
        id: 1,
        label: 'Source & Range',
        badge: verification.isStep1Valid && isRangeValid && activeStep !== 1 ? '✓' : '1',
        completed: verification.isStep1Valid && isRangeValid,
      },
      {
        id: 2,
        label: 'Chart Setup',
        badge: '2',
        disabled: !isStepAccessible(2),
      },
    ],
    [activeStep, verification.isStep1Valid, isRangeValid, isStepAccessible]
  );

  const companionContent = useMemo(() => {
    if (activeStep === 1) {
      const activeSheetMatrix =
        matrixSync.fullMatrix && matrixSync.fullMatrix.length > 0
          ? matrixSync.fullMatrix
          : effectiveMatrix;

      return (
        <RangePreviewMatrix
          matrix={activeSheetMatrix}
          range={form.range}
          isSelecting={isSelectingRange}
          onRangeSelect={(newRange) => {
            userManuallySelectedRangeRef.current = true;
            form.setRange(newRange);
          }}
        />
      );
    }

    if (activeStep === 2) {
      return (
        <div className={styles.companionChartViewport}>
          <div>
            <ChartCard
              chartId={chartId}
              dataset={previewDataset}
              config={previewConfig}
              nodeId={nodeId}
              accentColor={accentColor}
              editTriggerId={chartId}
              hideEditButton={true}
              status={matrixSync.isSyncing ? 'syncing' : previewDataset ? 'success' : 'pending_data'}
            />
          </div>
        </div>
      );
    }

    return null;
  }, [
    activeStep,
    matrixSync.fullMatrix,
    effectiveMatrix,
    form.range,
    form.setRange,
    isSelectingRange,
    chartId,
    previewDataset,
    previewConfig,
    nodeId,
    accentColor,
    matrixSync.isSyncing,
  ]);

  const drawerFooterLeft = (
    <>
      {activeStep === 1 ? (
        <Button variant="secondary" size="sm" type="button" onClick={onClose}>
          Cancel
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => setActiveStep(1)}
        >
          ← Back
        </Button>
      )}
    </>
  );

  const drawerFooterRight = (
    <>
      {activeStep === 1 && (
        <>
          {form.hasUnsavedChanges && (
            <Button
              variant="secondary"
              size="sm"
              type="button"
              className={styles.saveButton}
              onClick={handleSave}
              disabled={isSaving || !verification.isStep1Valid || !isRangeValid}
            >
              {isSaving ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save'
              )}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            type="button"
            disabled={!verification.isStep1Valid || !isRangeValid}
            onClick={() => setActiveStep(2)}
          >
            Next: Chart Setup →
          </Button>
        </>
      )}

      {activeStep === 2 && (
        <>
          {form.hasUnsavedChanges && (
            <Button
              variant="secondary"
              size="sm"
              type="button"
              className={styles.saveButton}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save Draft'
              )}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            type="button"
            disabled={isDeploying || !verification.isStep1Valid || !isRangeValid}
            onClick={handleDeploy}
          >
            {isDeploying ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                <span>Deploying…</span>
              </>
            ) : mode === 'add' ? (
              'Add to Canvas & Save '
            ) : (
              'Save in Draft'
            )}
          </Button>
        </>
      )}
    </>
  );

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title="Chart Setup"
        tabs={drawerTabs}
        activeTab={activeStep}
        onTabChange={(tabId) => {
          if (isStepAccessible(tabId as WizardStep)) {
            setActiveStep(tabId as WizardStep);
          }
        }}
        footerLeft={drawerFooterLeft}
        footerRight={drawerFooterRight}
        closeOnOutsideClick={false}
        companionContent={companionContent}
      >
        {activeStep === 1 && (
          <Step1SourceRange
            sheetUrl={form.sheetUrl}
            setSheetUrl={form.setSheetUrl}
            accessStatus={verification.accessStatus}
            statusMessage={verification.statusMessage}
            discoveredTabs={verification.discoveredTabs}
            tabName={form.tabName}
            sheetGid={form.sheetGid}
            setTabName={form.setTabName}
            executeVerification={verification.executeVerification}
            handleTabChange={verification.handleTabChange}
            onResync={handleResyncSource}
            isSyncing={matrixSync.isSyncing}
            range={form.range}
            isRangeValid={isRangeValid}
            isSelectingRange={isSelectingRange}
            setIsSelectingRange={setIsSelectingRange}
            executeSync={matrixSync.executeSync}
          />
        )}

        {activeStep === 2 && (
          <Step3ChartSetup
            form={form}
            detectedColumns={effectiveDetectedColumns}
            accentColor={accentColor}
            setupSubTab={setupSubTab}
            setSetupSubTab={setSetupSubTab}
            handleSubTabKeyDown={handleSubTabKeyDown}
            handleToggleSeries={handleToggleSeries}
          />
        )}
      </Drawer>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          durationMs={toast.type === 'error' ? 5500 : 3500}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
};
