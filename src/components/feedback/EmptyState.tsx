import React from 'react';
import { Button } from '../ui/Button';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  actionLabel?: string;
  variant?: 'card' | 'dashed' | string;
  onAction?: () => void;
  className?: string;
  [key: string]: any;
}

/**
 * EmptyState Component
 * Folio Engine — Canonical Empty & Dignified State Feedback
 *
 * Implements token-pure empty card/dashed presentation with title,
 * descriptive context, and 4-state interactive action affordance.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No items found',
  description,
  actionText,
  actionLabel,
  variant,
  onAction,
  className = '',
}) => {
  const resolvedActionLabel = actionLabel || actionText;
  const isCard = variant === 'card';

  return (
    <div
      className={`${styles.emptyStateContainer} ${isCard ? styles.cardVariant : ''} ${className}`.trim()}
      role="region"
      aria-label={title}
    >
      {title && <h3 className={styles.title}>{title}</h3>}
      {description && <p className={styles.description}>{description}</p>}
      {resolvedActionLabel && onAction && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAction}
        >
          {resolvedActionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
