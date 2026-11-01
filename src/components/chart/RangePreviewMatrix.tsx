import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { indexToColLetter, parseRangeNotation } from '../../utils/chartSanitizer';
import styles from './RangePreviewMatrix.module.css';

export interface RangePreviewMatrixProps {
  matrix: (string | number | null)[][];
  range?: string;
  isSelecting?: boolean;
  onRangeSelect?: (newRange: string) => void;
  excludeSummaryRows?: boolean;
  className?: string;
}

interface CellCoord {
  r: number;
  c: number;
}

/**
 * RangePreviewMatrix Component
 * Folio Engine — Task 13.1: Full-Viewport Edge-to-Edge Spreadsheet Grid
 *
 * Renders the entire Google Sheet without artificial card frames or embellishments.
 * Supports interactive click-and-drag and two-click highlighting to define
 * cell bounding box ranges (e.g. A1:D6) in real time.
 */
export const RangePreviewMatrix: React.FC<RangePreviewMatrixProps> = ({
  matrix,
  range,
  isSelecting = false,
  onRangeSelect,
  className,
}) => {
  const [dragStart, setDragStart] = useState<CellCoord | null>(null);
  const [dragCurrent, setDragCurrent] = useState<CellCoord | null>(null);
  const [clickAnchor, setClickAnchor] = useState<CellCoord | null>(null);

  // Maximum column count across all rows
  const maxCols = useMemo(() => {
    if (!matrix || matrix.length === 0) return 0;
    return Math.max(...matrix.map((row) => (row ? row.length : 0)), 1);
  }, [matrix]);

  // Parsed saved range bounds
  const parsedRange = useMemo(() => {
    if (!range) return null;
    return parseRangeNotation(range);
  }, [range]);

  // Active drag bounds
  const activeDragBounds = useMemo(() => {
    if (!dragStart || !dragCurrent) return null;
    return {
      minR: Math.min(dragStart.r, dragCurrent.r),
      maxR: Math.max(dragStart.r, dragCurrent.r),
      minC: Math.min(dragStart.c, dragCurrent.c),
      maxC: Math.max(dragStart.c, dragCurrent.c),
    };
  }, [dragStart, dragCurrent]);

  // Global mouseup handler to finalize drag selection anywhere in window
  const handleMouseUp = useCallback(() => {
    if (dragStart && dragCurrent) {
      const minR = Math.min(dragStart.r, dragCurrent.r);
      const maxR = Math.max(dragStart.r, dragCurrent.r);
      const minC = Math.min(dragStart.c, dragCurrent.c);
      const maxC = Math.max(dragStart.c, dragCurrent.c);

      const startCoord = `${indexToColLetter(minC)}${minR + 1}`;
      const endCoord = `${indexToColLetter(maxC)}${maxR + 1}`;
      const computedRange = `${startCoord}:${endCoord}`;

      onRangeSelect?.(computedRange);
      setDragStart(null);
      setDragCurrent(null);
      setClickAnchor(null);
    }
  }, [dragStart, dragCurrent, onRangeSelect]);

  useEffect(() => {
    if (dragStart) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [dragStart, handleMouseUp]);

  const handleCellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    // Only primary mouse button
    if (e.button !== 0) return;
    e.preventDefault();

    // If clickAnchor was set previously, complete two-click selection
    if (clickAnchor && !dragStart) {
      const minR = Math.min(clickAnchor.r, r);
      const maxR = Math.max(clickAnchor.r, r);
      const minC = Math.min(clickAnchor.c, c);
      const maxC = Math.max(clickAnchor.c, c);

      const computedRange = `${indexToColLetter(minC)}${minR + 1}:${indexToColLetter(maxC)}${maxR + 1}`;
      onRangeSelect?.(computedRange);
      setClickAnchor(null);
      return;
    }

    // Immediately start active selection at (r, c)
    setDragStart({ r, c });
    setDragCurrent({ r, c });
    setClickAnchor({ r, c });

    // Immediately deselect the old range and highlight this single cell on first click
    const singleCoord = `${indexToColLetter(c)}${r + 1}`;
    const singleCellRange = `${singleCoord}:${singleCoord}`;
    onRangeSelect?.(singleCellRange);
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    if (dragStart) {
      setDragCurrent({ r, c });
    }
  };

  if (!matrix || matrix.length === 0) {
    return (
      <div className={`${styles.emptySheet} ${className || ''}`}>
        <span>No sheet data loaded. Link a Google Sheet in the drawer.</span>
      </div>
    );
  }

  // Pre-generate column labels A..Z..AA..
  const colLetters = Array.from({ length: maxCols }, (_, idx) => indexToColLetter(idx));
  const isDragging = dragStart !== null;

  return (
    <div className={`${styles.container} ${className || ''}`} tabIndex={-1}>
      {isSelecting && (
        <div className={styles.selectionHintBar}>
          <div className={styles.selectionHintChip}>
            <span>🎯 Click and drag across the sheet to highlight your cell range</span>
          </div>
        </div>
      )}

      <table className={styles.table} aria-label="Full Google Sheet Spreadsheet Grid">
        <thead>
          <tr>
            <th className={styles.cornerCell} aria-label="Row / Column Index" />
            {colLetters.map((letter, colIdx) => (
              <th key={colIdx} className={styles.headerCell} scope="col">
                {letter}
              </th>
            ))}
            {/* Blank grey buffer column to signify sheet end (Google Sheets UX) */}
            <th className={styles.bufferColumnHeader} aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, rIdx) => {
            return (
              <tr key={rIdx}>
                <th className={styles.rowNumberCell} scope="row">
                  {rIdx + 1}
                </th>
                {colLetters.map((_, cIdx) => {
                  const cell = row ? row[cIdx] : undefined;

                  // Check if cell is in saved range (suppressed immediately when dragging/selecting)
                  let isSelected = false;
                  let isTopEdge = false;
                  let isBottomEdge = false;
                  let isLeftEdge = false;
                  let isRightEdge = false;

                  if (!isDragging && parsedRange) {
                    const { startCol, startRow, endCol, endRow } = parsedRange;
                    const effectiveEndRow = typeof endRow === 'number' ? endRow : matrix.length - 1;
                    const minR = Math.min(startRow, effectiveEndRow);
                    const maxR = Math.max(startRow, effectiveEndRow);
                    const minC = Math.min(startCol, endCol);
                    const maxC = Math.max(startCol, endCol);

                    if (rIdx >= minR && rIdx <= maxR && cIdx >= minC && cIdx <= maxC) {
                      isSelected = true;
                      isTopEdge = rIdx === minR;
                      isBottomEdge = rIdx === maxR;
                      isLeftEdge = cIdx === minC;
                      isRightEdge = cIdx === maxC;
                    }
                  }

                  // Check if cell is in active drag range
                  let isDragSelected = false;
                  let isDragTop = false;
                  let isDragBottom = false;
                  let isDragLeft = false;
                  let isDragRight = false;

                  if (activeDragBounds) {
                    const { minR, maxR, minC, maxC } = activeDragBounds;
                    if (rIdx >= minR && rIdx <= maxR && cIdx >= minC && cIdx <= maxC) {
                      isDragSelected = true;
                      isDragTop = rIdx === minR;
                      isDragBottom = rIdx === maxR;
                      isDragLeft = cIdx === minC;
                      isDragRight = cIdx === maxC;
                    }
                  }

                  const cellClasses = [
                    styles.dataCell,
                    isSelecting ? styles.dataCellSelecting : '',
                    isSelected && !isDragSelected ? styles.cellSelected : '',
                    isSelected && isTopEdge && !isDragSelected ? styles.cellBorderTop : '',
                    isSelected && isBottomEdge && !isDragSelected ? styles.cellBorderBottom : '',
                    isSelected && isLeftEdge && !isDragSelected ? styles.cellBorderLeft : '',
                    isSelected && isRightEdge && !isDragSelected ? styles.cellBorderRight : '',
                    isDragSelected ? styles.cellActiveDrag : '',
                    isDragTop ? styles.cellActiveDragBorderTop : '',
                    isDragBottom ? styles.cellActiveDragBorderBottom : '',
                    isDragLeft ? styles.cellActiveDragBorderLeft : '',
                    isDragRight ? styles.cellActiveDragBorderRight : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <td
                      key={cIdx}
                      className={cellClasses}
                      onMouseDown={(e) => handleCellMouseDown(rIdx, cIdx, e)}
                      onMouseEnter={() => handleCellMouseEnter(rIdx, cIdx)}
                      title={`Cell ${indexToColLetter(cIdx)}${rIdx + 1}`}
                    >
                      {cell === null || cell === undefined || cell === '' ? (
                        <span className={styles.nullCell}>—</span>
                      ) : (
                        String(cell)
                      )}
                    </td>
                  );
                })}
                {/* Blank grey buffer column cell */}
                <td className={styles.bufferColumnCell} aria-hidden="true" />
              </tr>
            );
          })}
          {/* Blank grey buffer row to signify sheet end (Google Sheets UX) */}
          <tr className={styles.bufferRow}>
            <th className={styles.bufferRowHeader} aria-hidden="true" />
            <td
              colSpan={colLetters.length + 1}
              className={styles.bufferRowCell}
              aria-hidden="true"
            />
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default RangePreviewMatrix;
