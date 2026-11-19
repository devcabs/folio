import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import type { SyncedDocumentItem } from '../../types/source';
import styles from './EditPhotoModal.module.css';

export interface EditDocumentModalProps {
  isOpen: boolean;
  documentItem?: SyncedDocumentItem | null;
  onClose: () => void;
  onSave: (
    documentId: string,
    newTitle: string,
    newDate?: string,
    newCaption?: string
  ) => Promise<void> | void;
}

/**
 * EditDocumentModal Component
 * Folio Engine — Subtask 11.5: Coordinator Document Metadata Editor
 *
 * Clean, token-styled modal allowing coordinators in Developer Mode to customize
 * an individual SyncedDocumentItem's title (isCustomTitle: true), date stamp,
 * and optional caption.
 */
export const EditDocumentModal: React.FC<EditDocumentModalProps> = ({
  isOpen,
  documentItem,
  onClose,
  onSave,
}) => {
  const { isDevMode, isDesktop, showToast } = useDeveloperMode();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [caption, setCaption] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && (!isDevMode || !isDesktop)) {
      onClose();
    }
  }, [isOpen, isDevMode, isDesktop, onClose]);

  useEffect(() => {
    if (isOpen && documentItem) {
      setTitle(documentItem.title || '');
      setDate(documentItem.date || documentItem.dateStamp || '');
      setCaption(documentItem.caption || '');
      setIsSaving(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, documentItem]);

  if (!isOpen || !documentItem) {
    return null;
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(
        documentItem.id,
        title.trim(),
        date.trim() || undefined,
        caption.trim() || undefined
      );
      showToast('Document details saved to draft successfully.', 'success');
      onClose();
    } catch (err) {
      console.error('Failed to save document details:', err);
      showToast('Failed to save document details.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={!isSaving && title.trim() ? () => { void handleSubmit(); } : undefined}
      title="Edit Document Details"
      maxWidth="540px"
    >
      <form onSubmit={handleSubmit} className={styles.modalBody}>
        {documentItem.originalFileName && (
          <div className={styles.photoPreviewBlock}>
            <div className={styles.previewMeta}>
              <span className={styles.previewLabel}>Google Drive PDF</span>
              <span
                className={styles.previewOriginalName}
                title={documentItem.originalFileName}
              >
                {documentItem.originalFileName}
              </span>
            </div>
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="edit-document-title" className={styles.fieldLabel}>
            Document Title
          </label>
          <input
            ref={inputRef}
            id="edit-document-title"
            type="text"
            className={styles.inputField}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Annual Accomplishment Report"
            disabled={isSaving}
            required
          />
          <p className={styles.fieldHint}>
            Custom titles are preserved across future Google Drive folder syncs.
          </p>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="edit-document-date" className={styles.fieldLabel}>
            Date Stamp (Optional)
          </label>
          <input
            id="edit-document-date"
            type="text"
            className={styles.inputField}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="e.g., 2026-10-09"
            disabled={isSaving}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="edit-document-caption" className={styles.fieldLabel}>
            Caption (Optional)
          </label>
          <input
            id="edit-document-caption"
            type="text"
            className={styles.inputField}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Brief editorial note for this document"
            disabled={isSaving}
          />
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
            {isSaving ? 'Saving...' : 'Save Details'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditDocumentModal;
