import React from 'react';
import styles from './SeriesSelectToolbar.module.css';

export interface SeriesSelectToolbarProps {
  title?: string;
  selectedCount?: number;
  totalCount?: number;
  onSelectAll: () => void;
  onClear: () => void;
  className?: string;
}

export const SeriesSelectToolbar: React.FC<SeriesSelectToolbarProps> = ({
  title = 'Numbers to Show',
  selectedCount,
  totalCount,
  onSelectAll,
  onClear,
  className = '',
}) => {
  return (
    <div className={`${styles.toolbar} ${className}`.trim()}>
      <div className={styles.titleRow}>
        <span className={styles.title}>{title}</span>
        {selectedCount !== undefined && totalCount !== undefined && (
          <span className={styles.countBadge} title={`${selectedCount} of ${totalCount} series selected`}>
            {selectedCount}/{totalCount}
          </span>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onSelectAll}
          title="Select all columns with numbers"
        >
          Select All Numbers
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onClear}
          title="Deselect all series"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};
