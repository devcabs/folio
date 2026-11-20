import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { AlertCircleIcon, CloseIcon } from '../ui/Icons';
import styles from './TopErrorBanner.module.css';

export interface TopErrorBannerProps {
  message: string;
  details?: string;
  nodeTitle?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * TopErrorBanner Component
 * Folio Engine — Error notification anchored directly to the top of the viewport.
 * Rendered when Edge fetch fails, preventing fetch errors from being masked as empty canvas states.
 */
export const TopErrorBanner: React.FC<TopErrorBannerProps> = memo(({
  message,
  details,
  nodeTitle,
  onRetry,
  onDismiss,
  className,
}) => {
  if (typeof document === 'undefined') {
    return null;
  }

  const content = (
    <aside
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`${styles.banner} ${className || ''}`.trim()}
      data-testid="top-error-banner"
    >
      <div className={styles.contentWrapper}>
        <div className={styles.messageGroup}>
          <span className={styles.iconWrapper} aria-hidden="true">
            <AlertCircleIcon size={14} />
          </span>

          <span className={styles.badge}>Edge Error</span>

          {nodeTitle && (
            <span className={styles.nodeTitle}>{nodeTitle}:</span>
          )}

          <span className={styles.message}>{message}</span>

          {details && (
            <span className={styles.details}>({details})</span>
          )}
        </div>

        <div className={styles.actionGroup}>
          {onRetry && (
            <Button
              variant="secondary"
              size="xs"
              className={styles.retryButton}
              onClick={onRetry}
              aria-label="Retry loading domain data"
            >
              Retry
            </Button>
          )}

          {onDismiss && (
            <IconButton
              variant="ghost"
              size="xs"
              className={styles.dismissButton}
              onClick={onDismiss}
              aria-label="Dismiss error notice"
            >
              <CloseIcon size={12} />
            </IconButton>
          )}
        </div>
      </div>
    </aside>
  );

  return createPortal(content, document.body);
});

TopErrorBanner.displayName = 'TopErrorBanner';
export default TopErrorBanner;
