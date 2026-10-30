import React, { useState, useEffect, useCallback } from 'react';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import styles from './DevLockBlockedModal.module.css';

function formatSessionAge(isoDate?: string): string {
  if (!isoDate) return 'Just now';
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return 'Just now';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 10) return 'Just now';
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

export const DevLockBlockedModal: React.FC = () => {
  const {
    isLockBlocked,
    activeLockInfo,
    closeLockBlockedModal,
    refreshLockStatus,
  } = useDeveloperMode();

  const [secondsRemaining, setSecondsRemaining] = useState<number>(10);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  // 10-second auto-refresh countdown
  useEffect(() => {
    if (!isLockBlocked) {
      setSecondsRemaining(10);
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Trigger automatic status check
          refreshLockStatus();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLockBlocked, refreshLockStatus]);

  const handleManualCheck = useCallback(async () => {
    setIsChecking(true);
    try {
      await refreshLockStatus();
      setSecondsRemaining(10);
    } finally {
      setIsChecking(false);
    }
  }, [refreshLockStatus]);

  if (!isLockBlocked) {
    return null;
  }

  const sessionAge = formatSessionAge(activeLockInfo?.lockedAt);

  return (
    <Modal
      isOpen={isLockBlocked}
      onClose={closeLockBlockedModal}
      onConfirm={isChecking ? undefined : handleManualCheck}
      maxWidth="480px"
      ariaLabelledBy="dev-lock-title"
      ariaDescribedBy="dev-lock-desc"
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 id="dev-lock-title" className={styles.title}>
            Developer Mode is active elsewhere
          </h2>
          <p id="dev-lock-desc" className={styles.subtitle}>
            Another user is currently editing.
          </p>
        </div>

        {/* Hierarchical Session Metadata (No Card Box) */}
        <div className={styles.metaList}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Started</span>
            <span className={styles.metaValue}>{sessionAge}</span>
          </div>

          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Auto-refresh</span>
            <span className={styles.metaValueData}>{secondsRemaining}s</span>
          </div>
        </div>

        <p className={styles.noticeText}>
          Frees automatically after 1 minute of inactivity.
        </p>

        {/* Modal Actions */}
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={closeLockBlockedModal}
          >
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="button"
            disabled={isChecking}
            onClick={handleManualCheck}
          >
            {isChecking ? 'Checking...' : 'Check Status'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DevLockBlockedModal;
