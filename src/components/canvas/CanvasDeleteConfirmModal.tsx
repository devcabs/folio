import React, { memo } from 'react';
import type { CanvasElementType } from '../../types/canvas';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import styles from './CanvasControls.module.css';

export interface CanvasDeleteConfirmModalProps {
  isOpen: boolean;
  itemType: CanvasElementType;
  hasChildren?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function getItemTypeLabel(type: CanvasElementType): { title: string; noun: string } {
  switch (type) {
    case 'section':
      return { title: 'Delete Section', noun: 'section' };
    case 'subsection':
      return { title: 'Delete Subsection', noun: 'subsection' };
    case 'text':
      return { title: 'Delete Text Block', noun: 'text block' };
    case 'photo':
      return { title: 'Delete Photo', noun: 'photo' };
    case 'gallery':
      return { title: 'Delete Photo Gallery', noun: 'photo gallery' };
    case 'chart':
      return { title: 'Delete Chart', noun: 'chart' };
    default:
      return { title: 'Delete Item', noun: 'item' };
  }
}

/**
 * CanvasDeleteConfirmModal Component
 * Folio Engine — Task 8.9: Delete Confirmation Modal Safeguard
 *
 * Accessible confirmation dialog (role="alertdialog") preventing accidental content deletion:
 * - Direct consumption of canonical Modal primitive
 * - Clean academic editorial typography with token-driven styling
 * - Reassures coordinators that action can be reversed with Undo toast
 * - Adheres strictly to Universal Zero Outline Policy
 */
export const CanvasDeleteConfirmModal: React.FC<CanvasDeleteConfirmModalProps> = memo(({
  isOpen,
  itemType,
  hasChildren = false,
  onClose,
  onConfirm,
}) => {
  const { title, noun } = getItemTypeLabel(itemType);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      role="alertdialog"
      ariaLabel={title}
      title={title}
      maxWidth={440}
    >
      <div className={styles.modalBody}>
        <p className={styles.modalMessage}>
          Are you sure you want to delete this {noun}?
        </p>
        {hasChildren && (
          <p className={styles.modalWarning}>
            Warning: Everything inside this {noun} will also be deleted.
          </p>
        )}
        <div className={styles.modalActions}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="admin"
            size="sm"
            onClick={onConfirm}
            className={styles.modalDeleteButton}
          >
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
});

CanvasDeleteConfirmModal.displayName = 'CanvasDeleteConfirmModal';

export default CanvasDeleteConfirmModal;
