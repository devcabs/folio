import React, { useState, useCallback, useMemo } from 'react';
import type { ChartDataset, SheetChartConfig } from '../../types/chart';
import type { NodeCode } from '../../types/node';
import { ChartRouter } from './ChartRouter';
import { DataPendingCard } from './DataPendingCard';
import { ChartConfigDrawer } from './ChartConfigDrawer';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import {
  generatePublicCsv,
  generateCsvDownloadFilename,
  parseRangeNotation,
} from '../../utils/chartSanitizer';
import { formatSheetModifiedTime } from '../../services/sheetsVerificationService';
import { fetchLiveSheetMatrix } from '../../services/sheetsDataService';
import { saveChartConfigDetailed, notifyChartChange } from '../../services/chartSourceService';
import { Button } from '../ui/Button';
import { Toast } from '../feedback/Toast';
import { ChartTableModal } from './ChartTableModal';
import styles from './ChartCard.module.css';

export interface ChartCardProps {
  chartId: string;
  dataset?: ChartDataset | null;
  config?: SheetChartConfig | null;
  nodeId?: NodeCode;
  nodeTitle?: string;
  accentColor?: string;
  status?: import('../../types/chart').ChartSyncStatus;
  errorMessage?: string;
  onConfigUpdated?: (config: SheetChartConfig) => void;
  onSync?: () => Promise<unknown> | void;
  isSyncing?: boolean;
  className?: string;
  editTriggerId?: string;
  hideEditButton?: boolean;
}

/**
 * ChartCard Component
 * Folio Engine — Subtask 7.4.4, 7.7, 7.19 & Task 8.10
 *
 * Editorial Bento Card shell for indicator charts.
 * Adheres to Modern Academic Editorial design standards:
 * - Minimal header only when data is missing; full header with As of Date when valid
 * - Uniform Administrative Edit Button ("✎ Edit") in Developer Mode
 * - 1-Click "View Table" modal & "Download Data (CSV)" public data receipts button (zero URL leaks)
 * - Dignified fallback with background ghost wireframe (DataPendingCard) when data is pending or problematic
 * - Suppressed footer when hasData is false (Law of Subtraction)
 * - Mobile caption purge on screens <= 640px
 */
export const ChartCard: React.FC<ChartCardProps> = ({
  chartId,
  dataset,
  config,
  nodeId = 'access',
  nodeTitle,
  accentColor,
  status,
  errorMessage,
  onConfigUpdated,
  onSync,
  isSyncing: isSyncingProp = false,
  className,
  editTriggerId,
  hideEditButton = false,
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();
  const canEdit = isDevMode && isDesktop && !hideEditButton;

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [internalSyncing, setInternalSyncing] = useState(false);
  const isSyncing = isSyncingProp || status === 'syncing' || internalSyncing;
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    if (!config?.sheetUrl) {
      setToast({
        message: 'No Google Sheet linked yet. Opening drawer to configure...',
        type: 'info',
      });
      setIsDrawerOpen(true);
      return;
    }

    setInternalSyncing(true);
    try {
      if (onSync) {
        await onSync();
        setToast({
          message: 'Chart synced successfully from Google Sheet.',
          type: 'success',
        });
      } else {
        const matrix = await fetchLiveSheetMatrix({
          sheetUrl: config.sheetUrl,
          tabName: config.tabName,
          sheetGid: config.sheetGid,
          range: config.range,
          timeoutMs: 8000,
        });

        if (matrix && matrix.length > 0) {
          const updatedConfig: SheetChartConfig = {
            ...config,
            cachedDataset: matrix,
            updatedAt: new Date().toISOString(),
          };
          await saveChartConfigDetailed(updatedConfig);
          notifyChartChange(chartId, updatedConfig);
          onConfigUpdated?.(updatedConfig);
          setToast({
            message: 'Chart synced successfully from Google Sheet.',
            type: 'success',
          });
        } else {
          setToast({
            message: 'Synced from Google Sheet, but no rows were found.',
            type: 'info',
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to sync chart from Google Sheet.';
      setToast({
        message: msg,
        type: 'error',
      });
    } finally {
      setInternalSyncing(false);
    }
  }, [isSyncing, config, onSync, chartId, onConfigUpdated]);

  // Derive display values from dataset or config (strictly unopinionated: vacant means nothing rendered)
  const title = config?.titleOverride || dataset?.title || '';
  const subtitle = config?.subtitleOverride || dataset?.subtitle;
  const lastModifiedFormatted =
    formatSheetModifiedTime(config?.visualConfig?.lastModifiedTime) ||
    formatSheetModifiedTime(dataset?.visualConfig?.lastModifiedTime);
  const asOfDate = lastModifiedFormatted || dataset?.asOfDate || 'Current SY';
  const unit = config?.unitOverride || dataset?.unit || dataset?.visualConfig?.unit;

  // Determine if valid data exists to display
  const hasData = useMemo(() => {
    if (!dataset) return false;
    if (dataset.categories && dataset.categories.length > 0) return true;
    if (dataset.series && dataset.series.length > 0) return true;
    if (dataset.scatterPoints && dataset.scatterPoints.length > 0) return true;
    if (dataset.rawValues && dataset.rawValues.length > 0) return true;
    return false;
  }, [dataset]);

  // Derive diagnostic category for empty / problematic state
  const problemCategory = useMemo<import('../../types/chart').ChartProblemCategory>(() => {
    if (hasData) return 'none';
    if (status === 'error' || Boolean(errorMessage)) return 'connection_error';
    if (!config?.sheetUrl) return 'unlinked';
    return 'data_format';
  }, [hasData, status, errorMessage, config?.sheetUrl]);

  // Public CSV download handler
  const handleDownloadCsv = useCallback(() => {
    let csvContent = dataset?.sanitizedCsvContent;

    if (!csvContent && dataset?.categories && dataset?.series) {
      csvContent = generatePublicCsv(
        dataset.categories,
        dataset.series,
        title,
        unit
      );
    }

    if (!csvContent) return;

    const sheetName =
      config?.tabName ||
      config?.visualConfig?.tabName ||
      dataset?.visualConfig?.tabName ||
      (config?.range ? parseRangeNotation(config.range)?.sheetName : undefined);

    const filename = generateCsvDownloadFilename({
      title,
      sheetName,
      chartId,
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [dataset, title, unit, chartId, config]);

  const [isEditHovered, setIsEditHovered] = useState(false);

  return (
    <>
      <div className={styles.cardOuterWrapper}>
        <article
          className={`${styles.card} ${isEditHovered ? styles.highlightedCard : ''} ${className || ''}`}
          aria-labelledby={`chart-title-${chartId}`}
          tabIndex={-1}
        >
          {/* Header */}
          <header className={styles.header}>
            {title && (
              <h3 id={`chart-title-${chartId}`} className={styles.title}>
                {title}
              </h3>
            )}

            {subtitle && (
              <p className={styles.subtitle}>
                {subtitle}
              </p>
            )}
          </header>

        {/* Content Body */}
        <div className={styles.contentWrapper}>
          {hasData && dataset ? (
            <ChartRouter
              dataset={dataset}
              accentColor={accentColor}
            />
          ) : (
            <DataPendingCard
              chartId={chartId}
              nodeTitle={nodeTitle}
              category={problemCategory}
              errorMessage={errorMessage}
              hasSheetUrl={Boolean(config?.sheetUrl)}
              onEdit={() => setIsDrawerOpen(true)}
            />
          )}
        </div>

        {/* Footer & Public Data Receipts (suppressed when no data) */}
        {hasData && (
          <footer className={styles.footer}>
            {asOfDate && (
              <span className={styles.asOfCaption}>
                As of {asOfDate}
              </span>
            )}

            <div className={styles.footerActions}>
              <Button
                variant="secondary"
                size="xs"
                className={styles.viewTableAction}
                onClick={() => setIsTableModalOpen(true)}
                aria-label={`View data table for ${title}`}
              >
                <span>View Table</span>
              </Button>

              <Button
                variant="secondary"
                size="xs"
                className={styles.downloadAction}
                onClick={handleDownloadCsv}
                aria-label={`Download CSV data for ${title}`}
              >
                <span>Download Data (CSV)</span>
              </Button>
            </div>
          </footer>
        )}
        </article>

        {canEdit && (
          <div className={styles.sideEditWrapper}>
            <Button
              type="button"
              variant="admin"
              size="xs"
              data-dev-edit-trigger="true"
              data-canvas-edit-trigger={editTriggerId}
              onClick={() => setIsDrawerOpen(true)}
              onMouseEnter={() => setIsEditHovered(true)}
              onMouseLeave={() => setIsEditHovered(false)}
              aria-label={`Edit chart ${chartId}`}
              title={`Edit chart ${chartId}`}
              className={styles.sideEditBtn}
            >
              ✎ Edit
            </Button>
            <Button
              type="button"
              variant="admin"
              size="xs"
              onClick={handleSync}
              onMouseEnter={() => setIsEditHovered(true)}
              onMouseLeave={() => setIsEditHovered(false)}
              disabled={isSyncing}
              className={styles.sideSyncBtn}
              title="Sync chart data from Google Sheet"
              aria-label={`Sync chart data for ${chartId}`}
            >
              <span className={`${styles.syncIcon} ${isSyncing ? styles.spinning : ''}`} aria-hidden="true">↻</span>
              <span>{isSyncing ? 'Syncing…' : 'Sync'}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Slide-Out Administrative Drawer */}
      {canEdit && (
        <ChartConfigDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          chartId={chartId}
          nodeId={nodeId}
          initialConfig={config || undefined}
          onDeployed={(updatedConfig) => {
            onConfigUpdated?.(updatedConfig);
          }}
        />
      )}
      {/* Full-Scale Tabular View Modal */}
      {hasData && dataset && (
        <ChartTableModal
          isOpen={isTableModalOpen}
          onClose={() => setIsTableModalOpen(false)}
          dataset={dataset}
          title={title}
          asOfDate={asOfDate}
          onDownloadCsv={handleDownloadCsv}
        />
      )}

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
