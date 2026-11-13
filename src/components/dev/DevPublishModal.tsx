import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { publishNewSnapshot } from '../../services/historyService';
import { compileAndDeployToEdgeKV } from '../../services/edgePreBakeService';
import { checkDraftStaleness, discardDraftSession } from '../../services/draftService';
import { useDeveloperMode } from '../../context/DeveloperModeContext';
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
  const [publishStep, setPublishStep] = useState<'idle' | 'publishing' | 'edge_failed' | 'complete'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forcePublish, setForcePublish] = useState(false);
  const [tierStatus, setTierStatus] = useState({ local: false, cloud: false, edge: false });
  const [tierErrors, setTierErrors] = useState<{ cloud?: string; edge?: string }>({});
  const activePublishedSnapshotRef = useRef<PublishedSnapshot | null>(null);

  const { showToast } = useDeveloperMode();

  useEffect(() => {
    if (!isOpen) {
      setDescription('');
      setIsSubmitting(false);
      setErrorMessage(null);
      setForcePublish(false);
      setPublishStep('idle');
      setTierStatus({ local: false, cloud: false, edge: false });
      setTierErrors({});
      activePublishedSnapshotRef.current = null;
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
        onClose={isSubmitting ? () => { } : onClose}
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
    setPublishStep('publishing');
    setErrorMessage(null);

    try {
      const result = await publishNewSnapshot(cleanDesc, undefined, undefined, { forcePublish: true });
      if (!result.success) {
        setErrorMessage(result.error || 'Failed to publish version.');
        setPublishStep('idle');
        return;
      }

      activePublishedSnapshotRef.current = result.snapshot;
      setTierStatus({
        local: result.localSaved,
        cloud: result.cloudSynced,
        edge: result.edgeDeployed,
      });
      setTierErrors({ cloud: result.cloudError, edge: result.edgeError });

      if (!result.edgeDeployed) {
        setPublishStep('edge_failed');
        // DO NOT close modal! Allow user to inspect and retry
      } else {
        setPublishStep('complete');
        showToast('Published to all channels successfully.', 'success');
        onPublished?.(result.snapshot, result.cloudSynced);
        onClose();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unexpected error during publishing.');
      setPublishStep('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryEdgeDeploy = async () => {
    if (!activePublishedSnapshotRef.current || isSubmitting) return;

    setIsSubmitting(true);
    setPublishStep('publishing');
    try {
      const retryRes = await compileAndDeployToEdgeKV(activePublishedSnapshotRef.current);
      if (retryRes.success) {
        setTierStatus((prev) => ({ ...prev, edge: true }));
        setTierErrors((prev) => ({ ...prev, edge: undefined }));
        setPublishStep('complete');
        showToast('Edge deployment succeeded on retry.', 'success');
        onPublished?.(activePublishedSnapshotRef.current, tierStatus.cloud);
        onClose();
      } else {
        const errorMsg = retryRes.deployResult?.error || 'Edge deploy failed';
        setTierStatus((prev) => ({ ...prev, edge: false }));
        setTierErrors((prev) => ({ ...prev, edge: errorMsg }));
        setPublishStep('edge_failed');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      setTierStatus((prev) => ({ ...prev, edge: false }));
      setTierErrors((prev) => ({ ...prev, edge: errorMsg }));
      setPublishStep('edge_failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseAnyway = () => {
    if (activePublishedSnapshotRef.current) {
      onPublished?.(activePublishedSnapshotRef.current, tierStatus.cloud);
    }
    onClose();
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

  const isShowingChecklist =
    publishStep === 'edge_failed' ||
    (publishStep === 'publishing' && activePublishedSnapshotRef.current !== null);

  const modalTitle =
    publishStep === 'edge_failed'
      ? 'Publish Status'
      : isShowingChecklist
        ? 'Deploying to Edge...'
        : 'Publish Changes';

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => { } : (publishStep === 'edge_failed' ? handleCloseAnyway : onClose)}
      closeOnEscape={!isSubmitting}
      title={modalTitle}
      maxWidth="440px"
      role="dialog"
    >
      {isShowingChecklist ? (
        <div className={styles.statusContainer}>
          <div className={styles.checklist} role="status" aria-live="polite">
            <div className={styles.checkItem}>
              <span className={styles.itemTitle}>Local Snapshot</span>
              <span className={`${styles.statusPill} ${styles.statusSuccess}`}>
                ✔ Saved
              </span>
            </div>

            <div className={styles.checkItem}>
              <span className={styles.itemTitle}>Supabase Cloud</span>
              {tierStatus.cloud ? (
                <span className={`${styles.statusPill} ${styles.statusSuccess}`}>
                  ✔ Synced
                </span>
              ) : (
                <span
                  className={`${styles.statusPill} ${styles.statusWarning}`}
                  title={tierErrors.cloud}
                >
                  ⚠ {tierErrors.cloud ? `Failed: ${tierErrors.cloud}` : 'Skipped (Offline)'}
                </span>
              )}
            </div>

            <div className={styles.checkItem}>
              <span className={styles.itemTitle}>Cloudflare KV Edge</span>
              {tierStatus.edge ? (
                <span className={`${styles.statusPill} ${styles.statusSuccess}`}>
                  ✔ Deployed
                </span>
              ) : publishStep === 'publishing' ? (
                <span className={`${styles.statusPill} ${styles.statusPending}`}>
                  ⏳ Deploying...
                </span>
              ) : (
                <span
                  className={`${styles.statusPill} ${styles.statusError}`}
                  title={tierErrors.edge}
                >
                  ❌ Failed: {tierErrors.edge || 'Edge deploy failed'}
                </span>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={handleCloseAnyway}
              disabled={isSubmitting}
            >
              Close Anyway
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={handleRetryEdgeDeploy}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Retrying...' : 'Retry Edge Deploy'}
            </Button>
          </div>
        </div>
      ) : (
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
      )}
    </Modal>
  );
};

export default DevPublishModal;
