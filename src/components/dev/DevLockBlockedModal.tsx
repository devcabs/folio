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
      maxWidth="420px"
      ariaLabelledBy="dev-lock-title"
      ariaDescribedBy="dev-lock-desc"
    >
      <div className={styles.content}>
        <h2 id="dev-lock-title" className={styles.title}>
          Someone else is editing
        </h2>
        <p id="dev-lock-desc" className={styles.body}>
          Another session started {sessionAge.toLowerCase()}. It unlocks after 1 minute of inactivity — checking again in{' '}
          <span className={styles.countdown}>{secondsRemaining}s</span>.
        </p>

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
            {isChecking ? 'Checking...' : 'Check now'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DevLockBlockedModal;
