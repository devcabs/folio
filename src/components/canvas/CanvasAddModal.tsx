import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { CanvasElementType } from '../../types/canvas';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt';
import {
  CanvasElementFields,
  type CanvasElementFieldsValue,
} from './CanvasElementFields';
import styles from './CanvasAddModal.module.css';

export type AddModalElementType = CanvasElementType | 'gallery';

export interface CanvasAddElementPayload {
  title?: string;
  isNumbered?: boolean;
  content?: string;
  as?: 'p' | 'blockquote';
  src?: string;
  alt?: string;
  caption?: string;
  showCaption?: boolean;
  driveUrl?: string;
  subtitle?: string;
}

export interface CanvasAddModalProps {
  isOpen: boolean;
  type: AddModalElementType | null;
  nodeId: string;
  targetSectionId?: string;
  targetIndex?: number;
  targetSubsectionId?: string;
  onClose: () => void;
  onConfirmAdd: (
    type: AddModalElementType,
    payload: CanvasAddElementPayload,
    targetSectionId?: string,
    targetIndex?: number,
    targetSubsectionId?: string
  ) => void;
}

const INITIAL_DRAFT: CanvasElementFieldsValue = {
  title: '',
  isNumbered: true,
  content: '',
  as: 'p',
  src: '',
  alt: '',
  caption: '',
  showCaption: false,
  driveUrl: '',
  subtitle: '',
};

/**
 * CanvasAddModal Component
 * Folio Engine — Task 8.11: Required Form Fill Before Adding Elements
 *
 * Thin state/validation/submit shell delegating element form fields to
 * canonical CanvasElementFields.
 */
export const CanvasAddModal: React.FC<CanvasAddModalProps> = ({
  isOpen,
  type,
  nodeId: _nodeId,
  targetSectionId,
  targetIndex,
  targetSubsectionId,
  onClose,
  onConfirmAdd,
}) => {
  const { showToast } = useDeveloperMode();
  const [draft, setDraft] = useState<CanvasElementFieldsValue>(INITIAL_DRAFT);
  const initialFocusRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Reset drafts whenever modal opens or element type changes
  useEffect(() => {
    if (isOpen) {
      setDraft(INITIAL_DRAFT);

      const timer = setTimeout(() => {
        initialFocusRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, type]);

  // Synchronous dirty state calculation for beforeunload reload protection
  const isFormDirty = useMemo(() => {
    if (!isOpen) return false;
    return Boolean(
      draft.title?.trim() ||
      draft.content?.trim() ||
      draft.src?.trim() ||
      draft.alt?.trim() ||
      draft.caption?.trim() ||
      draft.driveUrl?.trim() ||
      draft.subtitle?.trim()
    );
  }, [isOpen, draft]);

  // Prevent accidental reload or navigation when element form has unsaved entries
  useUnsavedChangesPrompt(isOpen && isFormDirty, 'canvas-add-modal');

  if (!isOpen || !type) return null;

  // Validation rules: require each element to be filled out before enabling Add
  let canSubmit = false;
  let modalTitle = 'Add Element';
  let submitLabel = 'Add Element';

  switch (type) {
    case 'section':
      canSubmit = Boolean(draft.title?.trim());
      modalTitle = 'Add Section';
      submitLabel = 'Add Section';
      break;
    case 'subsection':
      canSubmit = Boolean(draft.title?.trim());
      modalTitle = 'Add Subsection';
      submitLabel = 'Add Subsection';
      break;
    case 'text':
      canSubmit = Boolean(draft.content?.trim());
      modalTitle = 'Add Narrative Text';
      submitLabel = 'Add Text';
      break;
    case 'photo':
      canSubmit = Boolean(draft.src?.trim()) && Boolean(draft.alt?.trim());
      modalTitle = 'Add Photo Evidence';
      submitLabel = 'Add Photo';
      break;
    case 'gallery':
      canSubmit = Boolean(draft.title?.trim());
      modalTitle = 'Add Photo Gallery';
      submitLabel = 'Add Gallery';
      break;
    case 'chart':
      canSubmit = Boolean(draft.title?.trim());
      modalTitle = 'Add Indicator Chart';
      submitLabel = 'Add Chart';
      break;
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;

    const payload: CanvasAddElementPayload = {
      title: (draft.title || '').trim(),
      isNumbered: draft.isNumbered !== false,
      content: (draft.content || '').trim(),
      as: draft.as || 'p',
      src: (draft.src || '').trim(),
      alt: (draft.alt || '').trim(),
      caption: (draft.caption || '').trim(),
      showCaption: Boolean(draft.showCaption),
      driveUrl: (draft.driveUrl || '').trim(),
      subtitle: (draft.subtitle || '').trim(),
    };

    onConfirmAdd(type, payload, targetSectionId, targetIndex, targetSubsectionId);
    showToast('Element added to canvas.', 'success');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={canSubmit ? handleSubmit : undefined}
      title={modalTitle}
      maxWidth="500px"
      ariaLabel={modalTitle}
    >
      <form onSubmit={handleSubmit} className={styles.container}>
        <CanvasElementFields
          elementType={type}
          value={draft}
          onChange={setDraft}
          initialFocusRef={initialFocusRef}
          requirePhotoAlt
        />

        {/* Action Controls */}
        <div className={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

CanvasAddModal.displayName = 'CanvasAddModal';

export default CanvasAddModal;
