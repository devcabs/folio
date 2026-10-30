import React, { memo } from 'react';
import type { TextElement } from '../../types/canvas';
import { EditableText } from '../ui/EditableText';
import styles from './CanvasLeaf.module.css';

export interface CanvasTextProps {
  element: TextElement;
  nodeId: string;
  accentColor?: string;
  isDevMode?: boolean;
  className?: string;
  onEdit?: () => void;
}

/**
 * CanvasText Component
 * Folio Engine — Task 8.3.1: Canvas Leaf Elements (Text)
 *
 * Renders editorial narrative paragraphs or pull-quotes on the Dynamic Canvas:
 * - Direct integration with canonical EditableText and Content DB
 * - Fraunces serif editorial quote when element.as === 'blockquote'
 * - Modern Academic Editorial body narrative when element.as === 'p' or default
 * - Memoized with React.memo (Vercel Best Practice rerender-memo)
 * - Zero parentheses in UI and Universal Zero Outline Policy adherence
 */
export const CanvasText: React.FC<CanvasTextProps> = memo(({
  element,
  accentColor,
  className,
  onEdit,
}) => {
  const isQuote = element.as === 'blockquote';

  const quoteStyle = isQuote && accentColor
    ? ({ borderLeftColor: accentColor, color: accentColor } as React.CSSProperties)
    : undefined;

  return (
    <div
      className={isQuote ? `${styles.quoteWrapper} ${className || ''}`.trim() : `${styles.textWrapper} ${className || ''}`.trim()}
      style={quoteStyle}
    >
      <EditableText
        pointId=""
        defaultText={element.content}
        as={isQuote ? 'blockquote' : 'p'}
        className={isQuote ? styles.quoteText : styles.bodyText}
        editTriggerId={element.id}
        onEditText={onEdit}
      />
    </div>
  );
});

CanvasText.displayName = 'CanvasText';

export default CanvasText;
