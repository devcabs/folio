import React, { memo } from 'react';
import { createPortal } from 'react-dom';
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 4.41 11.59 1.5 8 1.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M8 5V8.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="8" cy="11" r="0.75" fill="currentColor" />
            </svg>
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
            <button
              type="button"
              className={styles.retryButton}
              onClick={onRetry}
              aria-label="Retry loading domain data"
            >
              Retry
            </button>
          )}

          {onDismiss && (
            <button
              type="button"
              className={styles.dismissButton}
              onClick={onDismiss}
              aria-label="Dismiss error notice"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );

  return createPortal(content, document.body);
});

TopErrorBanner.displayName = 'TopErrorBanner';
export default TopErrorBanner;
