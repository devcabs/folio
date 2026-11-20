import React, { memo, useState, useEffect } from 'react';
import type { CanvasElementType } from '../../types/canvas';
import { Modal, ModalActions } from '../ui/Modal';
import { Button } from '../ui/Button';
import { InlineAlert } from '../ui/InlineAlert';
import { FormField } from '../ui/FormField';
import { Input } from '../ui/Input';
import styles from './CanvasControls.module.css';

export const BRANCH_DELETE_CONFIRM_PHRASE = 'DELETE ALL SUBPAGES';

export interface CanvasDeleteConfirmModalProps {
  isOpen: boolean;
  itemType: CanvasElementType;
  hasChildren?: boolean;
  /** Title of the target page when itemType === 'page-link' */
  targetPageTitle?: string;
  /** Exact count of nested descendant subpages (or total affected subpages for containers) */
  descendantPageCount?: number;
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
    case 'pdf':
      return { title: 'Delete PDF Document', noun: 'PDF document' };
    case 'documents':
      return { title: 'Delete Document Folder', noun: 'document folder' };
    case 'chart':
      return { title: 'Delete Chart', noun: 'chart' };
    case 'page-link':
      return { title: 'Delete Subpage', noun: 'subpage' };
    default:
      return { title: 'Delete Item', noun: 'item' };
  }
}

/**
 * CanvasDeleteConfirmModal Component
 * Folio Engine — Task 8.9 & 13.15: Guarded Delete Confirmation Modal Safeguard
 *
 * Accessible confirmation dialog (role="alertdialog") preventing accidental content deletion:
 * - Direct consumption of canonical Modal, ModalActions, Button, InlineAlert, FormField, and Input
 * - Leaf subpage deletion: standard confirmation with Undo reassurance
 * - Branch / container-with-subpages deletion: exact count InlineAlert + typed phrase gate
 * - Adheres strictly to Universal Zero Outline Policy
 */
export const CanvasDeleteConfirmModal: React.FC<CanvasDeleteConfirmModalProps> = memo(({
  isOpen,
  itemType,
  hasChildren = false,
  targetPageTitle,
  descendantPageCount = 0,
  onClose,
  onConfirm,
}) => {
  const { title, noun } = getItemTypeLabel(itemType);
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    setConfirmInput('');
  }, [isOpen]);

  const requiresTypedConfirmation =
    (itemType === 'page-link' || descendantPageCount > 0) && descendantPageCount > 0;
  const isConfirmEnabled =
    !requiresTypedConfirmation || confirmInput.trim() === BRANCH_DELETE_CONFIRM_PHRASE;

  const isLeafSubpage = itemType === 'page-link' && descendantPageCount === 0;
  const isBranchSubpage = itemType === 'page-link' && descendantPageCount > 0;
  const isContainerWithSubpages = itemType !== 'page-link' && descendantPageCount > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={isConfirmEnabled ? onConfirm : undefined}
      role="alertdialog"
      ariaLabel={title}
      title={title}
      maxWidth={440}
      footer={
        <ModalActions className={styles.modalActions}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!isConfirmEnabled}
            onClick={onConfirm}
          >
            Delete
          </Button>
        </ModalActions>
      }
    >
      <div className={styles.modalBody}>
        {isLeafSubpage ? (
          <>
            <p className={styles.modalMessage}>
              {`Delete subpage "${targetPageTitle || 'Untitled'}" and its contents?`}
            </p>
            <p className={styles.modalMessage}>
              You can reverse this action with Undo during your active session.
            </p>
          </>
        ) : isBranchSubpage ? (
          <p className={styles.modalMessage}>
            {`Delete subpage "${targetPageTitle || 'Untitled'}" and its nested subpages?`}
          </p>
        ) : isContainerWithSubpages ? (
          <p className={styles.modalMessage}>
            Delete this {noun} and its linked subpages?
          </p>
        ) : (
          <p className={styles.modalMessage}>
            Are you sure you want to delete this {noun}?
          </p>
        )}

        {isBranchSubpage && (
          <InlineAlert variant="error">
            This will delete {descendantPageCount} nested{' '}
            {descendantPageCount === 1 ? 'subpage' : 'subpages'} and all of their contents.
          </InlineAlert>
        )}

        {isContainerWithSubpages && (
          <InlineAlert variant="error">
            This will delete {descendantPageCount}{' '}
            {descendantPageCount === 1 ? 'subpage' : 'subpages'} and all of their contents.
          </InlineAlert>
        )}

        {!requiresTypedConfirmation && hasChildren && (
          <InlineAlert variant="warning">
            Warning: Everything inside this {noun} will also be deleted.
          </InlineAlert>
        )}

        {requiresTypedConfirmation && (
          <FormField
            id="confirm-branch-delete"
            label={`Type ${BRANCH_DELETE_CONFIRM_PHRASE} to confirm`}
            required
          >
            <Input
              id="confirm-branch-delete"
              monospace
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={BRANCH_DELETE_CONFIRM_PHRASE}
              autoComplete="off"
            />
          </FormField>
        )}
      </div>
    </Modal>
  );
});

CanvasDeleteConfirmModal.displayName = 'CanvasDeleteConfirmModal';

export default CanvasDeleteConfirmModal;
