import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import type { SourceItem } from '../../types/node';
import type { SyncedSourceItem } from '../../types/source';
import styles from './EditPhotoModal.module.css';

export interface EditPhotoModalProps {
  isOpen: boolean;
  item?: SourceItem | null;
  photoItem?: SourceItem | null;
  onClose: () => void;
  onSave: (photoId: string, newTitle: string, newDate?: string, newCaption?: string) => Promise<void> | void;
}

/**
 * EditPhotoModal Component
 *
 * Editorial modal for coordinator in Developer Mode to edit the narrative
 * title/caption of synced Google Drive MOV source photos.
 *
 * Requirements:
 * - Consumes canonical Modal component
 * - Checks useDeveloperMode and auto-closes if Developer Mode is deactivated
 * - Enforces Universal Zero Outline Policy across all inputs and buttons
 * - Emits onSave with photoId and cleaned title
 */
export const EditPhotoModal: React.FC<EditPhotoModalProps> = ({
  isOpen,
  item,
  photoItem,
  onClose,
  onSave,
}) => {
  const activeItem = item ?? photoItem ?? null;
  const { isDevMode, isDesktop, showToast } = useDeveloperMode();
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Automatically close if developer mode is exited
  useEffect(() => {
    if (isOpen && (!isDevMode || !isDesktop)) {
      onClose();
    }
  }, [isOpen, isDevMode, isDesktop, onClose]);

  // Sync title when item changes
  useEffect(() => {
    if (isOpen && activeItem) {
      const hasImage = Boolean(activeItem.photo?.src || activeItem.imageSrc);
      const rawTitle = activeItem.title || activeItem.photo?.caption || '';
      const isDefaultPlaceholder =
        rawTitle === 'Evidence photograph' ||
        rawTitle === 'Evidence documentation photo' ||
        rawTitle === 'Photographic proof for this strategic milestone.' ||
        rawTitle === 'Photo Caption';

      setTitle(!hasImage || isDefaultPlaceholder ? '' : rawTitle);
      setIsSaving(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeItem]);

  if (!isOpen || !activeItem) {
    return null;
  }

  const syncedItem = activeItem as Partial<SyncedSourceItem>;
  const previewSrc = activeItem.photo?.src || activeItem.imageSrc || syncedItem.thumbnailUrl || '';
  const originalFileName = syncedItem.originalFileName;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(activeItem.id, title.trim());
      showToast('Photo title saved to draft successfully.', 'success');
      onClose();
    } catch (err) {
      console.error('Failed to save photo title:', err);
      showToast('Failed to save photo title.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={!isSaving && title.trim() ? () => { void handleSubmit(); } : undefined}
      title="Edit Photo Title"
      maxWidth="540px"
    >
      <form onSubmit={handleSubmit} className={styles.modalBody}>
        {previewSrc && (
          <div className={styles.photoPreviewBlock}>
            <img
              src={previewSrc}
              alt={activeItem.title}
              className={styles.previewThumbnail}
              referrerPolicy="no-referrer"
            />
            <div className={styles.previewMeta}>
              <span className={styles.previewLabel}>Google Drive Asset</span>
              {originalFileName && (
                <span className={styles.previewOriginalName} title={originalFileName}>
                  {originalFileName}
                </span>
              )}
            </div>
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="edit-photo-title" className={styles.fieldLabel}>
            Title / Caption
          </label>
          <input
            ref={inputRef}
            id="edit-photo-title"
            type="text"
            className={styles.inputField}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Community Stakeholders Assembly"
            disabled={isSaving}
            required
          />
          <p className={styles.fieldHint}>
            This title will be preserved across future Google Drive folder syncs.
          </p>
        </div>

        <div className={styles.actionRow}>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={isSaving || !title.trim()}
          >
            {isSaving ? 'Saving...' : 'Save Title'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
