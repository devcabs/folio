import React, { memo } from 'react';
import type { TextElement } from '../../types/canvas';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { isAuthoringPlaceholder } from '../../utils/canvasDefaults';
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
 * - Sanitization gate: Suppresses factory placeholders in public mode (!isDevMode)
 * - Memoized with React.memo (Vercel Best Practice rerender-memo)
 * - Zero parentheses in UI and Universal Zero Outline Policy adherence
 */
export const CanvasText: React.FC<CanvasTextProps> = memo(({
  element,
  nodeId: _nodeId,
  accentColor,
  isDevMode: isDevProp,
  className,
  onEdit,
}) => {
  const { isDevMode: isDevContext, isDesktop } = useDeveloperMode();
  const isDevMode = isDevProp !== undefined ? isDevProp : Boolean(isDevContext && isDesktop);
  const isPlaceholder = isAuthoringPlaceholder(element.content);

  // In public mode, suppress text blocks that only contain authoring instructions or whitespace
  if (!isDevMode && isPlaceholder) {
    return null;
  }

  const isQuote = element.as === 'blockquote';
  const Component = isQuote ? 'blockquote' : 'p';

  const quoteStyle = isQuote && accentColor
    ? ({ borderLeftColor: accentColor, color: accentColor } as React.CSSProperties)
    : undefined;

  const textStyleClass = isQuote ? styles.quoteText : styles.content;

  return (
    <div
      className={isQuote ? `${styles.quoteWrapper} ${className || ''}`.trim() : `${styles.textWrapper} ${className || ''}`.trim()}
      style={quoteStyle}
      onClick={isDevMode && onEdit ? onEdit : undefined}
      role={isDevMode && onEdit ? 'button' : undefined}
      tabIndex={isDevMode && onEdit ? 0 : undefined}
      aria-label={isDevMode && isPlaceholder ? 'Click to edit narrative text' : undefined}
    >
      <Component
        className={`${textStyleClass} ${isPlaceholder ? styles.devPlaceholderText : ''}`.trim()}
      >
        {element.content}
      </Component>
    </div>
  );
});

CanvasText.displayName = 'CanvasText';

export default CanvasText;
