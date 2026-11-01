import React, { useState, useCallback } from 'react';
import styles from './DraggableRows.module.css';

export interface DraggableRowItemMeta {
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  moveUp: () => void;
  moveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export interface DraggableRowsProps<T> {
  items: T[];
  keyExtractor: (item: T, index: number) => string | number;
  onReorder: (newItems: T[]) => void;
  renderItem: (item: T, meta: DraggableRowItemMeta) => React.ReactNode;
  showMicroArrows?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function DraggableRows<T>({
  items,
  keyExtractor,
  onReorder,
  renderItem,
  showMicroArrows = true,
  className = '',
  ariaLabel = 'Draggable list',
}: DraggableRowsProps<T>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }, [dragOverIndex]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDraggedIndex(null);
        setDragOverIndex(null);
        return;
      }

      const updated = [...items];
      const [removed] = updated.splice(draggedIndex, 1);
      updated.splice(dropIndex, 0, removed);

      onReorder(updated);
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, items, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const moveItem = useCallback(
    (fromIndex: number, direction: 'up' | 'down') => {
      const targetIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (targetIndex < 0 || targetIndex >= items.length) return;

      const updated = [...items];
      const temp = updated[fromIndex];
      updated[fromIndex] = updated[targetIndex];
      updated[targetIndex] = temp;

      onReorder(updated);
    },
    [items, onReorder]
  );

  return (
    <div
      className={`${styles.container} ${className}`.trim()}
      role="list"
      aria-label={ariaLabel}
    >
      {items.map((item, index) => {
        const key = keyExtractor(item, index);
        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index && draggedIndex !== index;
        const canMoveUp = index > 0;
        const canMoveDown = index < items.length - 1;

        const meta: DraggableRowItemMeta = {
          index,
          isDragging,
          isDragOver,
          moveUp: () => moveItem(index, 'up'),
          moveDown: () => moveItem(index, 'down'),
          canMoveUp,
          canMoveDown,
        };

        return (
          <div
            key={key}
            className={`${styles.row} ${isDragging ? styles.rowDragging : ''} ${isDragOver ? styles.rowDragOver : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            role="listitem"
            tabIndex={0}
          >
            {/* Visual Grip Handle */}
            <span
              className={styles.dragHandle}
              title="Drag to reorder"
              aria-label="Drag handle"
            >
              ⋮⋮
            </span>

            {/* Row Content */}
            <div className={styles.content}>
              {renderItem(item, meta)}
            </div>

            {/* Accessible Micro-Arrows */}
            {showMicroArrows && (
              <div className={styles.microControls}>
                <button
                  type="button"
                  className={styles.microBtn}
                  disabled={!canMoveUp}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveItem(index, 'up');
                  }}
                  aria-label="Move item up"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.microBtn}
                  disabled={!canMoveDown}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveItem(index, 'down');
                  }}
                  aria-label="Move item down"
                  title="Move down"
                >
                  ↓
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default DraggableRows;
