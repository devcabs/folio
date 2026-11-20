import React, { useState, useEffect, useRef } from 'react';
import { Modal, ModalActions } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Input } from '../ui/Input';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import type { SyncedDocumentItem } from '../../types/source';
import styles from './EditDocumentModal.module.css';

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
          <div className={styles.documentPreviewBlock}>
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

        <FormField
          id="edit-document-title"
          label="Document Title"
          required
          hint="Custom titles are preserved across future Google Drive folder syncs."
        >
          <Input
            ref={inputRef}
            id="edit-document-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Annual Accomplishment Report"
            disabled={isSaving}
            required
          />
        </FormField>

        <FormField id="edit-document-date" label="Date Stamp (Optional)">
          <Input
            id="edit-document-date"
            type="text"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="e.g., 2026-10-09"
            disabled={isSaving}
          />
        </FormField>

        <FormField id="edit-document-caption" label="Caption (Optional)">
          <Input
            id="edit-document-caption"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Brief editorial note for this document"
            disabled={isSaving}
          />
        </FormField>

        <ModalActions className={styles.actionRow}>
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
        </ModalActions>
      </form>
    </Modal>
  );
};

export default EditDocumentModal;
