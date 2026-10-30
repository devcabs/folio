import React, { memo, useState, useCallback } from 'react';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DevPublishModal } from './DevPublishModal';
import styles from './DevExitConfirmModal.module.css';

/**
 * DevExitConfirmModal Component
 * Folio Engine — Developer Mode Exit Safeguard
 *
 * Implements:
 * Case A (Clean State): 1-click confirmation "Exit Developer Mode"
 * Case B (Dirty State): "You have unpublished changes. Drafts will not be kept once you exit."
 *   - [Publish & Exit]
 *   - [Discard Draft & Exit]
 *   - [Keep Editing]
 */
export const DevExitConfirmModal: React.FC = memo(() => {
  const {
    isExitConfirmOpen,
    closeExitConfirmModal,
    confirmExitDevMode,
    hasUnpublishedChanges,
  } = useDeveloperMode();
  const { clearHistory } = useUndoRedo();
  const [isPublishAndExitOpen, setIsPublishAndExitOpen] = useState(false);

  const handleCleanExit = useCallback(() => {
    clearHistory();
    confirmExitDevMode({ discard: false });
  }, [clearHistory, confirmExitDevMode]);

  const handleDiscardAndExit = useCallback(() => {
    clearHistory();
    confirmExitDevMode({ discard: true });
  }, [clearHistory, confirmExitDevMode]);

  const handlePublishAndExitClick = useCallback(() => {
    closeExitConfirmModal();
    setIsPublishAndExitOpen(true);
  }, [closeExitConfirmModal]);

  const handlePublishedAndExit = useCallback(() => {
    setIsPublishAndExitOpen(false);
    clearHistory();
    confirmExitDevMode({ discard: false });
  }, [clearHistory, confirmExitDevMode]);

  if (!isExitConfirmOpen && !isPublishAndExitOpen) {
    return null;
  }

  const exitTitle = hasUnpublishedChanges ? 'Unpublished Changes' : 'Exit Developer Mode';
  const exitSubtitle = hasUnpublishedChanges
    ? 'You have unpublished changes. Drafts will not be kept once you exit.'
    : 'Active editing session will end and session history will be cleared.';

  return (
    <>
      {isExitConfirmOpen && (
        <Modal
          isOpen={isExitConfirmOpen}
          onClose={closeExitConfirmModal}
          onConfirm={hasUnpublishedChanges ? handlePublishAndExitClick : handleDiscardAndExit}
          maxWidth={hasUnpublishedChanges ? '500px' : '420px'}
          role="alertdialog"
          ariaLabelledBy="dev-exit-title"
          ariaDescribedBy="dev-exit-desc"
        >
          <div className={styles.content}>
            <div className={styles.header}>
              <h2 id="dev-exit-title" className={styles.title}>
                {exitTitle}
              </h2>
              <p id="dev-exit-desc" className={styles.subtitle}>
                {exitSubtitle}
              </p>
            </div>

            <div className={styles.actions}>
              {hasUnpublishedChanges ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={closeExitConfirmModal}
                  >
                    Keep Editing
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    className={styles.destructiveButton}
                    onClick={handleDiscardAndExit}
                  >
                    Discard Draft & Exit
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    onClick={handlePublishAndExitClick}
                  >
                    Publish & Exit
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={closeExitConfirmModal}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    onClick={handleCleanExit}
                  >
                    Exit
                  </Button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {isPublishAndExitOpen && (
        <DevPublishModal
          isOpen={isPublishAndExitOpen}
          onClose={() => setIsPublishAndExitOpen(false)}
          onPublished={handlePublishedAndExit}
        />
      )}
    </>
  );
});

DevExitConfirmModal.displayName = 'DevExitConfirmModal';

export default DevExitConfirmModal;
