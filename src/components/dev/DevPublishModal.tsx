import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { publishNewSnapshot } from '../../services/historyService';
import { checkDraftStaleness, discardDraftSession } from '../../services/draftService';
import type { PublishedSnapshot } from '../../types/history';
import styles from './DevPublishModal.module.css';

export interface DevPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished?: (snapshot: PublishedSnapshot, cloudSynced?: boolean) => void;
}

export const DevPublishModal: React.FC<DevPublishModalProps> = ({
  isOpen,
  onClose,
  onPublished,
}) => {
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forcePublish, setForcePublish] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDescription('');
      setIsSubmitting(false);
      setErrorMessage(null);
      setForcePublish(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const staleness = checkDraftStaleness();

  if (staleness.isStale && !forcePublish) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={isSubmitting ? () => {} : onClose}
        closeOnEscape={!isSubmitting}
        title="Published Version Changed"
        maxWidth="440px"
        role="dialog"
      >
        <div className={styles.staleContent}>
          <p className={styles.staleMessage}>
            A newer snapshot ({staleness.currentActiveId}) was published by another session. Publishing now will overwrite it.
          </p>

          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => {
                discardDraftSession();
                onClose();
              }}
            >
              Discard Draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              className={styles.btnDanger}
              onClick={() => setForcePublish(true)}
            >
              Publish Anyway
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  const cleanDesc = description.trim();
  const isValid = cleanDesc.length > 3;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await publishNewSnapshot(cleanDesc, undefined, undefined, { forcePublish: true });
      if (result.success) {
        onPublished?.(result.snapshot, result.cloudSynced);
        onClose();
      } else {
        setErrorMessage(result.error || 'Failed to publish version.');
      }
    } catch {
      setErrorMessage('Unexpected error during publishing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && isSubmitting) {
      e.preventDefault();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (isValid && !isSubmitting) {
        handleSubmit();
      }
    }
  };

  const isMac = typeof navigator !== 'undefined' && (
    /Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
    /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      closeOnEscape={!isSubmitting}
      title="Publish Changes"
      maxWidth="440px"
      role="dialog"
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fieldGroup}>
          <textarea
            id="publish-changelog"
            className={styles.textarea}
            placeholder="What changed in this version?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            maxLength={400}
            autoFocus
            disabled={isSubmitting}
            aria-label="Describe what changed in this version"
            required
          />
        </div>

        {errorMessage && (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}

        <div className={styles.footer}>
          <div className={styles.meta}>
            <span
              className={styles.shortcutHint}
              title={isMac ? 'Press ⌘+Enter to publish' : 'Press Ctrl+Enter to publish'}
              aria-label={isMac ? 'Press Command plus Enter to publish' : 'Press Control plus Enter to publish'}
            >
              <kbd className={styles.kbd}>{isMac ? '⌘↵' : 'Ctrl+↵'}</kbd>
            </span>
            {cleanDesc.length > 0 && cleanDesc.length < 4 && (
              <span className={styles.charCounter} aria-live="polite">
                Min 4 characters
              </span>
            )}
            {description.length >= 300 && (
              <span
                className={`${styles.charCounter} ${description.length >= 400 ? styles.charCounterLimit : ''}`}
                aria-live="polite"
              >
                {description.length}/400
              </span>
            )}
          </div>

          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? 'Publishing...' : 'Publish'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default DevPublishModal;
