import React, { memo, useState, useCallback, useRef } from 'react';
import type { CanvasElementType } from '../../types/canvas';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { CanvasDeleteConfirmModal } from './CanvasDeleteConfirmModal';
import styles from './CanvasControls.module.css';

export interface CanvasItemControlsProps {
  itemId: string;
  itemType: CanvasElementType;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  children: React.ReactNode;
  className?: string;
  suppressHover?: boolean;
  sourceParentId?: string;
  sourceIndex?: number;
  hasChildren?: boolean;
  onDropItem?: (sourceItemId: string, targetContainerId: string, targetIndex?: number) => void;
}

/**
 * CanvasItemControls Component
 * Folio Engine — Task 8.9: Centered Controls, Drag-and-Drop Reordering & Delete Modal
 *
 * Authoring controls for canvas elements in Developer Mode:
 * - HTML5 drag-and-drop grab handle alongside accessible tactile Move Up / Move Down buttons
 * - Centered vertical & horizontal positioning eliminating collision with top-right edit buttons
 * - Dedicated SVG trash can icon replacing ambiguous 'X' string
 * - Accessible CanvasDeleteConfirmModal before executing item deletion
 * - When Developer Mode is OFF: Only renders children with zero DOM wrapper overhead
 * - Universal Zero Outline Policy on all controls
 */
export const CanvasItemControls: React.FC<CanvasItemControlsProps> = memo(({
  itemId,
  itemType,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
  onEdit,
  children,
  className,
  suppressHover = false,
  sourceParentId,
  sourceIndex,
  hasChildren = false,
  onDropItem,
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleConfirmDelete = useCallback(() => {
    setIsDeleteModalOpen(false);
    onDelete();
  }, [onDelete]);

  // In public mode or non-desktop viewports, return children cleanly with zero wrapper overhead
  if (!isDevMode || !isDesktop) {
    return <>{children}</>;
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ itemId, itemType, sourceParentId, sourceIndex })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!onDropItem) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!onDropItem) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.itemId && data.itemId !== itemId) {
          onDropItem(data.itemId, sourceParentId || itemId, sourceIndex);
        }
      }
    } catch {
      // Ignore malformed drag payload
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleteModalOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit();
    }
  };

  const floatingBarClass = itemType === 'section'
    ? `${styles.itemControlsFloatingBar} ${styles.sectionFloatingBar}`
    : styles.itemControlsFloatingBar;

  const isHoverSuppressed = suppressHover || isDeleteModalOpen;

  return (
    <>
      <div
        ref={wrapperRef}
        className={`${styles.itemControlsWrapper} ${isHoverSuppressed ? styles.suppressHover : ''} ${isDragOver ? styles.dropTargetHighlight : ''} ${isDragging ? styles.isDragging : ''} ${className || ''}`.trim()}
        data-canvas-item-id={itemId}
        data-canvas-item-type={itemType}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className={floatingBarClass}
          role="toolbar"
          aria-label="Item authoring controls"
        >
          <span
            className={styles.dragHandle}
            title="Drag to reorder"
            aria-label="Drag to reorder"
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            role="button"
            tabIndex={0}
          >
            ⋮⋮
          </span>
          <button
            type="button"
            className={styles.controlButton}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={!canMoveUp}
            title={canMoveUp ? 'Move Up' : 'First element in canvas — cannot move up further'}
            aria-label="Move Up"
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.controlButton}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={!canMoveDown}
            title={canMoveDown ? 'Move Down' : 'Last element in canvas — cannot move down further'}
            aria-label="Move Down"
          >
            ↓
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${styles.editButton}`}
            onClick={handleEditClick}
            title="Edit"
            aria-label="Edit"
          >
            <svg
              className={styles.editIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${styles.deleteButton}`}
            onClick={handleDeleteClick}
            title="Delete"
            aria-label="Delete"
          >
            <svg
              className={styles.deleteIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
        {children}
      </div>

      {isDeleteModalOpen && (
        <CanvasDeleteConfirmModal
          isOpen={isDeleteModalOpen}
          itemType={itemType}
          hasChildren={hasChildren}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
});

CanvasItemControls.displayName = 'CanvasItemControls';

export default CanvasItemControls;
