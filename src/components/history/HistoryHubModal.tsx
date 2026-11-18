/**
 * Folio Engine - History Hub Drawer
 * Location: src/components/history/HistoryHubModal.tsx
 */

import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { Drawer } from '../ui/Drawer';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import { Toast } from '../feedback/Toast';
import type { PublishedSnapshot, UnifiedPortalSnapshot } from '../../types/history';
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
  const mainText = getItemPrimaryText(snapshot);

  return (
    <li className={`${styles.historyItem} ${isCurrentLive ? styles.historyItemLive : ''}`}>
      <div className={styles.itemMain}>
        <div className={styles.itemTitleRow}>
          <span className={styles.itemTitle}>{mainText}</span>
          {isCurrentLive ? <StatusPill label="Live" variant="primary" size="sm" /> : null}
        </div>
        <div className={styles.itemMeta}>
          <span>{formatTimeElapsed(snapshot.createdAt)}</span>
          <span className={styles.metaDot} aria-hidden="true">
            ·
          </span>
          <time dateTime={snapshot.createdAt}>{formatFullTimestamp(snapshot.createdAt)}</time>
        </div>
      </div>

      {!isCurrentLive && (
        <div className={styles.itemAction}>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onRequestRestore(snapshot)}
            aria-label={`Restore "${mainText}" to Draft`}
          >
            Load as Draft
          </Button>
        </div>
      )}
    </li>
  );
});

HistoryTimelineRow.displayName = 'HistoryTimelineRow';

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

  const [pendingRestoreSnapshot, setPendingRestoreSnapshot] =
    useState<PublishedSnapshot | UnifiedPortalSnapshot | null>(null);
  const [isConfirmDefaultOpen, setIsConfirmDefaultOpen] = useState(false);

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
      const msg = err instanceof Error ? err.message : 'Failed to load revision history.';
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

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        position="right"
        size="md"
        title="History"
        showCloseButton={true}
        ariaLabel="Revision history"
        ariaLabelledBy="history-drawer-title"
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
          {isLoading && snapshots.length === 0 ? (
            <div className={styles.loadingState} aria-label="Loading history" aria-busy="true">
              <div className={styles.skeletonRow} />
              <div className={styles.skeletonRow} />
              <div className={styles.skeletonRow} />
            </div>
          ) : loadError ? (
            <div className={styles.errorState} role="alert">
              <p className={styles.errorText}>{loadError}</p>
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
            <div className={styles.emptyState}>No revisions yet.</div>
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
      </Drawer>

      {pendingRestoreSnapshot && (
        <Modal
          isOpen={Boolean(pendingRestoreSnapshot)}
          onClose={() => setPendingRestoreSnapshot(null)}
          maxWidth={440}
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
                Load <strong>"{getItemPrimaryText(pendingRestoreSnapshot)}"</strong> into
                Developer Mode? Your live portal remains unchanged until you publish.
              </p>
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

      {isConfirmDefaultOpen && (
        <Modal
          isOpen={isConfirmDefaultOpen}
          onClose={() => setIsConfirmDefaultOpen(false)}
          maxWidth={440}
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
                Reset your Developer Mode draft to the original baseline? Your live portal remains unchanged until you publish.
              </p>
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
