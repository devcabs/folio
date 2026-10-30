/**
 * Folio Engine - History Hub Drawer
 * Location: src/components/history/HistoryHubModal.tsx
 * Specification: docs/tasks/plan_history_drawer_redesign.md
 * Aligned with: docs/00_WORKFLOW.md, docs/05_VISUAL_SPEC.md, docs/07_CODING_STANDARDS.md
 *
 * Implements:
 * 1. Canonical Drawer slide-out container (right position, size="md").
 * 2. Relative elapsed time format (4h, 3h, 5mo, 2d, 1y) paired with full timestamp.
 * 3. Canonical Button component for "Restore to Draft" and footer actions.
 * 4. User changelog description promoted to primary main text.
 * 5. Elimination of generic "Published Revision" placeholder text.
 * 6. Stripping parentheses such as "(Default)" from displayed titles.
 * 7. Removal of verbose baseline description ("Original baseline...").
 * 8. Confirmation modals for draft restore and factory baseline reset safeguards.
 * 9. Universal Zero Outline Policy and 100% design token purity.
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
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
  hydrateHistoryFromIndexedDB,
  getDefaultSystemBaselineSnapshot,
  getLocalFallbackSnapshots,
  getActivePublishedId,
} from '../../services/historyService';
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
  const isBaseline =
    snapshot.id === 'snap-system-baseline' ||
    Boolean(snapshot.title && snapshot.title.toLowerCase().includes('baseline'));

  const rawDescription =
    'description' in snapshot && snapshot.description
      ? snapshot.description
      : 'notes' in snapshot && snapshot.notes
        ? snapshot.notes
        : '';

  const cleanDescription = stripParentheses(rawDescription);
  const cleanTitle = stripParentheses(snapshot.title);

  let mainText = '';

  if (isBaseline) {
    mainText = cleanTitle || 'System Baseline';
  } else {
    if (cleanDescription) {
      mainText = cleanDescription;
    } else {
      mainText =
        cleanTitle &&
          !cleanTitle.toLowerCase().includes('published revision') &&
          !cleanTitle.toLowerCase().includes('published version')
          ? cleanTitle
          : 'Revision';
    }
  }

  return (
    <li className={styles.historyItem}>
      <div className={styles.itemMain}>
        <div className={styles.itemTitleRow}>
          <span className={styles.itemTitle}>{mainText}</span>
          {isCurrentLive ? (
            <StatusPill label="Live" variant="primary" size="sm" />
          ) : null}
        </div>
        <div className={styles.itemMeta}>
          <span className={styles.metaInterval}>
            {formatTimeElapsed(snapshot.createdAt)}
          </span>
          <span className={styles.metaDot} aria-hidden="true">
            •
          </span>
          <time
            className={styles.metaTimestamp}
            dateTime={snapshot.createdAt}
          >
            {formatFullTimestamp(snapshot.createdAt)}
          </time>
        </div>
      </div>

      {!isCurrentLive && (
        <div className={styles.itemAction}>
          <Button
            variant="secondary"
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
  const [snapshots, setSnapshots] = useState<Array<PublishedSnapshot | UnifiedPortalSnapshot>>([]);
  const [activeLiveId, setActiveLiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  // Confirmation dialog states
  const [pendingRestoreSnapshot, setPendingRestoreSnapshot] =
    useState<PublishedSnapshot | UnifiedPortalSnapshot | null>(null);
  const [isConfirmDefaultOpen, setIsConfirmDefaultOpen] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      await hydrateHistoryFromIndexedDB().catch(() => { });
      const cloudSnapshots = await fetchPublishedHistoryFromCloud();
      if (cloudSnapshots.length > 0) {
        setSnapshots(cloudSnapshots);
        const active = cloudSnapshots.find((s) => s.isActive);
        if (active) {
          setActiveLiveId(active.id);
        } else {
          setActiveLiveId(getActivePublishedId());
        }
      } else {
        const fallbacks = getLocalFallbackSnapshots();
        setSnapshots(fallbacks);
        const active = fallbacks.find((s) => s.isActive);
        if (active) {
          setActiveLiveId(active.id);
        } else {
          setActiveLiveId(getActivePublishedId());
        }
      }
    } catch {
      const fallbacks = getLocalFallbackSnapshots();
      setSnapshots(fallbacks);
      const active = fallbacks.find((s) => s.isActive);
      if (active) {
        setActiveLiveId(active.id);
      } else {
        setActiveLiveId(getActivePublishedId());
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    loadHistory();
    const unsubscribe = subscribeToHistoryChange(() => {
      loadHistory();
    });

    return unsubscribe;
  }, [isOpen, loadHistory]);

  const handleRequestRestore = useCallback(
    (item: PublishedSnapshot | UnifiedPortalSnapshot) => {
      setPendingRestoreSnapshot(item);
    },
    []
  );

  const handleConfirmRestore = useCallback(() => {
    if (!pendingRestoreSnapshot) return;
    const target = pendingRestoreSnapshot;
    setPendingRestoreSnapshot(null);

    const success = restoreSnapshotToDraft(target);
    const itemTitle = getItemPrimaryText(target);

    if (success) {
      onRestored?.(itemTitle);
      onClose();
    } else {
      setToastMessage('Failed to restore draft.');
      setToastType('error');
    }
  }, [pendingRestoreSnapshot, onRestored, onClose]);

  const handleConfirmRestoreDefault = useCallback(() => {
    setIsConfirmDefaultOpen(false);
    const baseline = getDefaultSystemBaselineSnapshot(false);
    const success = restoreSnapshotToDraft(baseline);

    if (success) {
      onRestored?.('System Baseline');
      onClose();
    } else {
      setToastMessage('Failed to restore default baseline.');
      setToastType('error');
    }
  }, [onRestored, onClose]);

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
        ariaLabel="Revision history and published configurations"
        ariaLabelledBy="history-drawer-title"
        ariaDescribedBy="history-drawer-desc"
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
          <p id="history-drawer-desc" className={styles.subtitle}>
            Revision history and published configurations.
          </p>

          <div className={styles.timelineList}>
            {isLoading && snapshots.length === 0 ? (
              <div className={styles.emptyState}>Loading history...</div>
            ) : snapshots.length === 0 ? (
              <div className={styles.emptyState}>No saved configurations yet.</div>
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
              <p className={styles.confirmNotice}>
                Your live public portal will remain unchanged until you review and publish.
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
              <p className={styles.confirmNotice}>
                All unpublished draft changes across all 5 nodes will be reset to the original baseline. Your live portal remains untouched until you publish.
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
