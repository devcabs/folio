import React, { memo } from 'react';
import styles from './EditorialSection.module.css';

export interface EditorialSectionProps {
  /** Required unique anchor element ID */
  id: string;
  /** Section title displayed in Table of Contents */
  title?: string;
  /** Section number displayed in Table of Contents */
  number?: string | number;
  /** Custom semantic element tag (default: 'section') */
  as?: 'section' | 'article' | 'div';
  /** Optional custom CSS class */
  className?: string;
  /** Optional inline style */
  style?: React.CSSProperties;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * EditorialSection Component (Canonical Layout Primitive)
 *
 * Semantic wrapper for editorial content sections:
 * - Emits data-toc-title and data-toc-number for automated discovery by useAutoTableOfContents
 * - Enforces zero horizontal borders and spatial breathing room
 * - Accessible aria-label integration
 */
export const EditorialSection: React.FC<EditorialSectionProps> = memo(({
  id,
  title,
  number,
  as: Component = 'section',
  className,
  style,
  children,
}) => {
  const formattedNumber =
    number !== undefined && number !== null
      ? typeof number === 'number'
        ? String(number).padStart(2, '0')
        : String(number)
      : undefined;

  return (
    <Component
      id={id}
      data-toc-title={title}
      data-toc-number={formattedNumber}
      aria-label={title}
      className={`${styles.editorialSection} ${className || ''}`}
      style={style}
    >
      {children}
    </Component>
  );
});

EditorialSection.displayName = 'EditorialSection';

export default EditorialSection;
