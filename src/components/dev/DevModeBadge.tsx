import React, { useState } from 'react';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { HistoryHubModal } from '../history/HistoryHubModal';
import { DevPublishModal } from './DevPublishModal';
import { Toast } from '../feedback/Toast';
import { DevHelpTooltip } from '../ui/DevHelpTooltip';
import styles from './DevModeBadge.module.css';

// Crisp bespoke SVG icons matching CanvasAddBar element palette style
const PublishIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);
const DevStatusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const UndoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

const RedoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const HistoryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ExitIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const DevModeBadge: React.FC = () => {
  const {
    isDevMode,
    isDesktop,
    sessionRemainingMinutes,
    requestExitDevMode,
    cloudSyncStatus,
  } = useDeveloperMode();
  const { canUndo, canRedo, lastActionDescription, nextRedoDescription, undo, redo } =
    useUndoRedo();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  if (!isDevMode || !isDesktop) {
    return null;
  }

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const undoShortcut = isMac ? '⌘Z' : 'Ctrl+Z';
  const redoShortcut = isMac ? '⇧⌘Z' : 'Ctrl+Shift+Z';

  const undoTitle = canUndo
    ? lastActionDescription
      ? `Undo: ${lastActionDescription} (${undoShortcut})`
      : `Undo (${undoShortcut})`
    : `Undo (${undoShortcut})`;

  const redoTitle = canRedo
    ? nextRedoDescription
      ? `Redo: ${nextRedoDescription} (${redoShortcut})`
      : `Redo (${redoShortcut})`
    : `Redo (${redoShortcut})`;

  return (
    <>
      <div
        className={styles.floatingCapsule}
        role="status"
        aria-live="polite"
        aria-label="Developer mode is active"
      >
        {/* Active Status Pill */}
        <div className={styles.statusPill}>
          <DevStatusIcon className={styles.statusIcon} />
          <span className={styles.statusTitle}>
            Dev Mode
            <DevHelpTooltip
              text="Lets you edit the page. Changes are saved as a private draft until you publish."
              label="Dev Mode"
            />
          </span>
          <span
            className={styles.sessionTime}
            title={`${sessionRemainingMinutes} minutes remaining in session`}
          >
            {sessionRemainingMinutes}m left
          </span>
          {cloudSyncStatus && (
            <span
              className={styles.cloudSyncIndicator}
              title={
                cloudSyncStatus === 'saving'
                  ? 'Saving draft changes to cloud...'
                  : cloudSyncStatus === 'saved'
                    ? 'All changes saved to cloud draft'
                    : cloudSyncStatus === 'offline'
                      ? 'Operating in local memory draft'
                      : 'Cloud sync error'
              }
            >
              {cloudSyncStatus === 'saving'
                ? '◌ Saving...'
                : cloudSyncStatus === 'error'
                  ? '⚠ Sync error'
                  : ''}
            </span>
          )}
        </div>

        {/* Undo Button */}
        <button
          type="button"
          className={`${styles.actionButton} ${!canUndo ? styles.buttonDisabled : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (canUndo) undo();
          }}
          disabled={!canUndo}
          aria-label="Undo last change"
          title={undoTitle}
        >
          <UndoIcon className={styles.actionIcon} />
          <span className={styles.actionLabel}>Undo</span>
        </button>

        {/* Redo Button */}
        <button
          type="button"
          className={`${styles.actionButton} ${!canRedo ? styles.buttonDisabled : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (canRedo) redo();
          }}
          disabled={!canRedo}
          aria-label="Redo last change"
          title={redoTitle}
        >
          <RedoIcon className={styles.actionIcon} />
          <span className={styles.actionLabel}>Redo</span>
        </button>

        {/* History Button */}
        <button
          type="button"
          className={styles.actionButton}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsHistoryOpen(true);
          }}
          aria-label="Open History"
          title="Revision history"
        >
          <HistoryIcon className={styles.actionIcon} />
          <span className={styles.actionLabel}>History</span>
        </button>

        {/* Publish Button (Placed immediately after History) */}
        <button
          type="button"
          className={styles.actionButton}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsPublishModalOpen(true);
          }}
          aria-label="Publish Changes"
          title="Publish changes live to portal"
        >
          <PublishIcon className={styles.actionIcon} />
          <span className={styles.actionLabel}>Publish</span>
        </button>

        {/* Exit Button */}
        <button
          type="button"
          className={styles.actionButton}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            requestExitDevMode();
          }}
          aria-label="Exit Developer Mode"
        >
          <ExitIcon className={styles.actionIcon} />
          <span className={styles.actionLabel}>Exit</span>
        </button>
      </div>

      <HistoryHubModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRestored={(title) => {
          const cleanTitle = title.replace(/\s*\([^)]*\)/g, '').trim();
          const message =
            cleanTitle === 'System Baseline'
              ? 'Loaded official factory baseline into draft preview. Review and click Publish to make live.'
              : `Loaded "${cleanTitle}" into draft preview. Review changes and click Publish to make live.`;
          setToastMessage(message);
          setToastType('success');
        }}
      />

      <DevPublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onPublished={(_snapshot, cloudSynced) => {
          if (cloudSynced === false) {
            setToastMessage('Published locally. Cloud sync pending reconnection.');
            setToastType('info');
          } else {
            setToastMessage('Published changes live to portal.');
            setToastType('success');
          }
        }}
      />

      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onDismiss={() => setToastMessage(null)}
        />
      )}
    </>
  );
};

export default DevModeBadge;
