/**
 * Folio Engine - History Hub Drawer
 * Location: src/components/history/HistoryHubModal.tsx
 * Specification: docs/tasks/plan_history_drawer_redesign.md
 * Aligned with: docs/00_WORKFLOW.md, docs/05_VISUAL_SPEC.md, docs/07_CODING_STANDARDS.md
 *
 * Implements:
 * 1. Canonical Drawer slide-out container (right position, size="md") with editorial kicker & refresh action.
 * 2. Vertical timeline ledger with distinct node markers for Live, Revision, and System Baseline states.
 * 3. Relative elapsed time format (4h, 3h, 5mo, 2d, 1y) paired with full timestamp and snapshot metrics.
 * 4. Canonical Button & StatusPill components for "Load as Draft", "Live", and footer actions.
 * 5. Skeleton loading placeholders, refined empty/error states, and confirmation modal callouts.
 * 6. Universal Zero Outline Policy and 100% design token purity.
 */

import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { Drawer } from '../ui/Drawer';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import { Toast } from '../feedback/Toast';
import type { PublishedSnapshot, SnapshotMetricsSummary, UnifiedPortalSnapshot } from '../../types/history';
import {
  subscribeToHistoryChange,
  fetchPublishedHistoryFromCloud,
  restoreSnapshotToDraft,
} from '../../services/historyService';
import { useDeveloperMode } from '../../context/DeveloperModeContext';
import styles from './HistoryHubModal.module.css';

export interface HistoryHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored?: (title: string) => void;
}

export type HistoryHubDrawerProps = HistoryHubModalProps;

/**
 * Strips parentheses and their enclosed content from text (e.g. "(Default)" -> "").
 */
export function stripParentheses(text?: string | null): string {
  if (!text) return '';
  return text.replace(/\s*\([^)]*\)/g, '').trim();
}

/**
 * Compact elapsed time formatter: 4h, 3h, 5mo, 2d, 1y.
 */
export function formatTimeElapsed(isoDate: string): string {
  try {
    const timestamp = new Date(isoDate).getTime();
    if (Number.isNaN(timestamp)) return 'Recently';

    const now = Date.now();
    const diffMs = Math.max(0, now - timestamp);
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 30) return `${diffDays}d`;
    if (diffMonths < 12) return `${diffMonths}mo`;
    return `${diffYears}y`;
  } catch {
    return 'Recently';
  }
}

/**
 * Full accessible date/time string.
 */
export function formatFullTimestamp(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'Recently';

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recently';
  }
}

/**
 * Formats compact snapshot metrics for scannable ledger metadata.
 */
function formatSnapshotMetrics(summary?: SnapshotMetricsSummary): string | null {
  if (!summary) return null;
  const parts: string[] = [];

  if (summary.totalSections > 0) {
    parts.push(`${summary.totalSections} ${summary.totalSections === 1 ? 'section' : 'sections'}`);
  }
  if (summary.totalLeafElements > 0) {
    parts.push(`${summary.totalLeafElements} ${summary.totalLeafElements === 1 ? 'block' : 'blocks'}`);
  }
  if (summary.totalTextOverrides > 0) {
    parts.push(`${summary.totalTextOverrides} ${summary.totalTextOverrides === 1 ? 'edit' : 'edits'}`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Extracts the user-meaningful primary text for an item, stripping parentheses and placeholder labels.
 */
export function getItemPrimaryText(snapshot: PublishedSnapshot | UnifiedPortalSnapshot): string {
  const isBaseline =
    snapshot.id === 'snap-system-baseline' ||
    Boolean(snapshot.title && snapshot.title.toLowerCase().includes('baseline'));

  if (isBaseline) {
    return stripParentheses(snapshot.title) || 'System Baseline';
  }

  const rawDescription =
    'description' in snapshot && snapshot.description
      ? snapshot.description
      : 'notes' in snapshot && snapshot.notes
        ? snapshot.notes
        : '';

  const cleanDescription = stripParentheses(rawDescription);
  if (cleanDescription) {
    return cleanDescription;
  }

  const cleanTitle = stripParentheses(snapshot.title);
  if (
    cleanTitle &&
    !cleanTitle.toLowerCase().includes('published revision') &&
    !cleanTitle.toLowerCase().includes('published version')
  ) {
    return cleanTitle;
  }

  return 'Revision';
}

const RefreshIcon: React.FC<{ isSpinning?: boolean }> = ({ isSpinning }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={isSpinning ? styles.spinningIcon : undefined}
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const RestoreArrowIcon: React.FC = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const ClockLedgerIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 14" />
  </svg>
);

const AlertCircleIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

interface HistoryTimelineRowProps {
  snapshot: PublishedSnapshot | UnifiedPortalSnapshot;
  isCurrentLive: boolean;
  onRequestRestore: (snapshot: PublishedSnapshot | UnifiedPortalSnapshot) => void;
}

const HistoryTimelineRow = memo<HistoryTimelineRowProps>(({
  snapshot,
  isCurrentLive,
  onRequestRestore,
}) => {
  const isBaseline =
    snapshot.id === 'snap-system-baseline' ||
    Boolean(snapshot.title && snapshot.title.toLowerCase().includes('baseline'));

  const mainText = getItemPrimaryText(snapshot);
  const metricsText = formatSnapshotMetrics(snapshot.summary);

  const rowClassName = [
    styles.historyItem,
    isCurrentLive ? styles.historyItemLive : '',
    isBaseline && !isCurrentLive ? styles.historyItemBaseline : '',
  ]
    .filter(Boolean)
    .join(' ');

  const nodeMarkerClassName = [
    styles.nodeMarker,
    isCurrentLive ? styles.nodeMarkerLive : '',
    isBaseline && !isCurrentLive ? styles.nodeMarkerBaseline : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={rowClassName}>
      <div className={styles.nodeColumn} aria-hidden="true">
        <span className={styles.railTop} />
        <span className={nodeMarkerClassName} />
        <span className={styles.railBottom} />
      </div>

      <div className={styles.historyCard}>
        <div className={styles.itemMain}>
          <div className={styles.itemTitleRow}>
            <span className={styles.itemTitle}>{mainText}</span>
            {isCurrentLive ? (
              <StatusPill label="Live" variant="green" size="sm" pulse />
            ) : isBaseline ? (
              <StatusPill label="Baseline" variant="neutral" size="sm" />
            ) : null}
          </div>

          <div className={styles.itemMeta}>
            <span className={styles.metaInterval}>
              {formatTimeElapsed(snapshot.createdAt)}
            </span>
            <time
              className={styles.metaTimestamp}
              dateTime={snapshot.createdAt}
            >
              {formatFullTimestamp(snapshot.createdAt)}
            </time>
            {metricsText ? (
              <>
                <span className={styles.metaDot} aria-hidden="true">
                  •
                </span>
                <span className={styles.metaMetrics}>{metricsText}</span>
              </>
            ) : null}
          </div>
        </div>

        {!isCurrentLive && (
          <div className={styles.itemAction}>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              className={styles.restoreButton}
              onClick={() => onRequestRestore(snapshot)}
              aria-label={`Restore "${mainText}" to Draft`}
            >
              <RestoreArrowIcon />
              <span>Load as Draft</span>
            </Button>
          </div>
        )}
      </div>
    </li>
  );
});

HistoryTimelineRow.displayName = 'HistoryTimelineRow';

const HistoryLoadingSkeleton: React.FC = () => (
  <ul className={styles.historyList} aria-label="Loading revision history" aria-busy="true">
    {[0, 1, 2].map((idx) => (
      <li key={idx} className={styles.historyItem}>
        <div className={styles.nodeColumn} aria-hidden="true">
          <span className={styles.railTop} />
          <span className={`${styles.nodeMarker} ${styles.nodeMarkerSkeleton}`} />
          <span className={styles.railBottom} />
        </div>
        <div className={`${styles.historyCard} ${styles.skeletonCard}`}>
          <div className={styles.skeletonLines}>
            <div className={styles.skeletonTitle} />
            <div className={styles.skeletonMeta} />
          </div>
          <div className={styles.skeletonAction} />
        </div>
      </li>
    ))}
  </ul>
);

export const HistoryHubDrawer: React.FC<HistoryHubDrawerProps> = ({
  isOpen,
  onClose,
  onRestored,
}) => {
  const { lockToken } = useDeveloperMode();
  const [snapshots, setSnapshots] = useState<Array<PublishedSnapshot | UnifiedPortalSnapshot>>([]);
  const [activeLiveId, setActiveLiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  // Confirmation dialog states
  const [pendingRestoreSnapshot, setPendingRestoreSnapshot] =
    useState<PublishedSnapshot | UnifiedPortalSnapshot | null>(null);
  const [isConfirmDefaultOpen, setIsConfirmDefaultOpen] = useState(false);

  // In-flight guard to eliminate overlapping fetches and render flickering
  const inFlightRef = useRef(false);

  const loadHistory = useCallback(async (isInitial = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (isInitial) {
      setIsLoading(true);
    }
    setLoadError(null);

    try {
      const cloudSnapshots = await fetchPublishedHistoryFromCloud();
      setSnapshots(cloudSnapshots);
      const active = cloudSnapshots.find((s) => s.isActive);
      setActiveLiveId(active ? active.id : null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load revision history from Cloudflare KV.';
      setLoadError(msg);
      setSnapshots([]);
      setActiveLiveId(null);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    loadHistory(true);
    const unsubscribe = subscribeToHistoryChange(() => {
      loadHistory(false);
    });

    return unsubscribe;
  }, [isOpen, loadHistory]);

  const handleRequestRestore = useCallback(
    (item: PublishedSnapshot | UnifiedPortalSnapshot) => {
      setPendingRestoreSnapshot(item);
    },
    []
  );

  const handleConfirmRestore = useCallback(async () => {
    if (!pendingRestoreSnapshot) return;
    const target = pendingRestoreSnapshot;
    setPendingRestoreSnapshot(null);

    try {
      await restoreSnapshotToDraft(target.id, undefined, lockToken);
      const itemTitle = getItemPrimaryText(target);
      onRestored?.(itemTitle);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to restore draft.';
      setToastMessage(msg);
      setToastType('error');
    }
  }, [pendingRestoreSnapshot, lockToken, onRestored, onClose]);

  const handleConfirmRestoreDefault = useCallback(async () => {
    setIsConfirmDefaultOpen(false);
    try {
      await restoreSnapshotToDraft('snap-system-baseline', undefined, lockToken);
      onRestored?.('System Baseline');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to restore default baseline.';
      setToastMessage(msg);
      setToastType('error');
    }
  }, [lockToken, onRestored, onClose]);

  if (!isOpen) return null;

  const snapshotCountLabel =
    snapshots.length === 1 ? '1 revision' : `${snapshots.length} revisions`;

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        position="right"
        size="md"
        kicker="Portal Ledger"
        title="Revision History"
        showCloseButton={true}
        ariaLabel="Revision history and published configurations"
        ariaLabelledBy="history-drawer-title"
        ariaDescribedBy="history-drawer-desc"
        headerActions={
          <button
            type="button"
            className={styles.refreshIconBtn}
            onClick={() => loadHistory(true)}
            disabled={isLoading}
            aria-label="Refresh revision history"
            title="Refresh revision history"
          >
            <RefreshIcon isSpinning={isLoading} />
          </button>
        }
        footerLeft={
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setIsConfirmDefaultOpen(true)}
            title="Restore workspace back to official factory default baseline"
          >
            Restore to default
          </Button>
        }
        footerRight={
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={onClose}
          >
            Close
          </Button>
        }
      >
        <div className={styles.container}>
          <div className={styles.overviewBar}>
            <p id="history-drawer-desc" className={styles.subtitle}>
              Published snapshots and configuration checkpoints.
            </p>
            {snapshots.length > 0 && !loadError && (
              <span className={styles.countBadge}>{snapshotCountLabel}</span>
            )}
          </div>

          <div className={styles.timelineList}>
            {isLoading && snapshots.length === 0 ? (
              <HistoryLoadingSkeleton />
            ) : loadError ? (
              <div className={styles.errorState} role="alert">
                <div className={styles.stateIconBadge}>
                  <AlertCircleIcon />
                </div>
                <div className={styles.stateCopy}>
                  <p className={styles.stateTitle}>Unable to load history</p>
                  <p className={styles.errorText}>{loadError}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => loadHistory(true)}
                >
                  Retry
                </Button>
              </div>
            ) : snapshots.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.stateIconBadge}>
                  <ClockLedgerIcon />
                </div>
                <div className={styles.stateCopy}>
                  <p className={styles.stateTitle}>No saved configurations yet</p>
                  <p className={styles.stateSubtext}>
                    Published revisions will appear here as a chronological ledger.
                  </p>
                </div>
              </div>
            ) : (
              <ul className={styles.historyList}>
                {snapshots.map((snap) => (
                  <HistoryTimelineRow
                    key={snap.id}
                    snapshot={snap}
                    isCurrentLive={
                      activeLiveId
                        ? snap.id === activeLiveId
                        : Boolean('isActive' in snap && snap.isActive)
                    }
                    onRequestRestore={handleRequestRestore}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </Drawer>

      {/* Row-Level "Load as Draft" Confirmation Modal */}
      {pendingRestoreSnapshot && (
        <Modal
          isOpen={Boolean(pendingRestoreSnapshot)}
          onClose={() => setPendingRestoreSnapshot(null)}
          maxWidth={460}
          role="alertdialog"
          ariaLabelledBy="preview-confirm-title"
          ariaDescribedBy="preview-confirm-desc"
        >
          <div className={styles.confirmModalContent}>
            <div className={styles.confirmHeader}>
              <h3 id="preview-confirm-title" className={styles.confirmTitle}>
                Load as Draft?
              </h3>
              <p id="preview-confirm-desc" className={styles.confirmDesc}>
                Are you sure you want to load{' '}
                <strong>"{getItemPrimaryText(pendingRestoreSnapshot)}"</strong> into
                your Developer Mode draft to preview and edit?
              </p>
              <div className={styles.confirmNoticeBox}>
                <p className={styles.confirmNotice}>
                  Your live public portal will remain unchanged until you review and publish.
                </p>
              </div>
            </div>
            <div className={styles.confirmActions}>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setPendingRestoreSnapshot(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                onClick={handleConfirmRestore}
              >
                Load as Draft
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Footer "Restore to default" Confirmation Modal */}
      {isConfirmDefaultOpen && (
        <Modal
          isOpen={isConfirmDefaultOpen}
          onClose={() => setIsConfirmDefaultOpen(false)}
          maxWidth={460}
          role="alertdialog"
          ariaLabelledBy="restore-default-title"
          ariaDescribedBy="restore-default-desc"
        >
          <div className={styles.confirmModalContent}>
            <div className={styles.confirmHeader}>
              <h3 id="restore-default-title" className={styles.confirmTitle}>
                Restore System Baseline?
              </h3>
              <p id="restore-default-desc" className={styles.confirmDesc}>
                Are you sure you want to reset your Developer Mode draft back to the official baseline?
              </p>
              <div className={styles.confirmNoticeBox}>
                <p className={styles.confirmNotice}>
                  All unpublished draft changes across all 5 nodes will be reset to the original baseline. Your live portal remains untouched until you publish.
                </p>
              </div>
            </div>
            <div className={styles.confirmActions}>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setIsConfirmDefaultOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                onClick={handleConfirmRestoreDefault}
              >
                Restore Baseline
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {toastMessage ? (
        <Toast
          message={toastMessage}
          type={toastType}
          onDismiss={() => setToastMessage(null)}
        />
      ) : null}
    </>
  );
};

export const HistoryHubModal = HistoryHubDrawer;
export default HistoryHubDrawer;
