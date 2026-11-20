import React from 'react';
import { Button } from '../ui/Button';
import styles from './SourceFolderActionBar.module.css';

export interface SourceFolderActionBarProps {
  onEdit: () => void;
  onSync: () => void;
  isSyncing?: boolean;
  editTriggerId?: string;
  editTitle: string;
  syncTitle: string;
  onHighlightChange?: (highlighted: boolean) => void;
}

/**
 * Shared Developer Mode side action bar ('✎ Edit' + '↻ Sync')
 * for Google Drive showcase components (SourceGallery & SourceDocuments).
 */
export const SourceFolderActionBar: React.FC<SourceFolderActionBarProps> = ({
  onEdit,
  onSync,
  isSyncing = false,
  editTriggerId,
  editTitle,
  syncTitle,
  onHighlightChange,
}) => {
  return (
    <div className={styles.sideEditWrapper}>
      <Button
        type="button"
        variant="admin"
        size="xs"
        data-dev-edit-trigger="true"
        data-canvas-edit-trigger={editTriggerId}
        onClick={onEdit}
        onMouseEnter={() => onHighlightChange?.(true)}
        onMouseLeave={() => onHighlightChange?.(false)}
        className={styles.sideEditBtn}
        title={editTitle}
        aria-label={editTitle}
      >
        ✎ Edit
      </Button>
      <Button
        type="button"
        variant="admin"
        size="xs"
        onClick={onSync}
        onMouseEnter={() => onHighlightChange?.(true)}
        onMouseLeave={() => onHighlightChange?.(false)}
        disabled={isSyncing}
        className={styles.sideSyncBtn}
        title={syncTitle}
        aria-label={syncTitle}
      >
        <span
          className={`${styles.syncIcon} ${isSyncing ? styles.spinning : ''}`.trim()}
          aria-hidden="true"
        >
          ↻
        </span>
        <span>{isSyncing ? 'Syncing…' : 'Sync'}</span>
      </Button>
    </div>
  );
};

export default SourceFolderActionBar;
