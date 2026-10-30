import React, { memo } from 'react';
import { EditableText } from './EditableText';
import { useContent } from '../../hooks/useContent';
import styles from './SectionTitle.module.css';

export interface SectionTitleProps {
  /** The primary section title text */
  title: string;
  /** Content DB pointId for title */
  titlePointId?: string;
  /** Optional section numbering (e.g. "01", 1, or "Section 01") */
  number?: string | number | null;
  /** Optional default numbered status (defaults to true if number was specified) */
  defaultNumbered?: boolean;
  /** @deprecated Subtitles removed for sections: only the page title gets a subtitle */
  subtitle?: string;
  /** @deprecated Subtitles removed for sections: only the page title gets a subtitle */
  subtitlePointId?: string;
  /** Heading level tag to render (defaults to "h2") */
  as?: 'h2' | 'h3' | 'h4' | 'h5';
  /** Optional element ID for in-page anchor linking */
  id?: string;
  /** Optional accent color for visual branding */
  accentColor?: string;
  /** Optional custom CSS class */
  className?: string;
  /** Optional supplementary elements or action slots */
  children?: React.ReactNode;
  /** Optional deterministic trigger identifier for canvas controls targeting */
  editTriggerId?: string;
  /** Optional custom edit callback to delegate to parent coordinator */
  onEdit?: () => void;
}

/**
 * SectionTitle Component (Canonical Typography Primitive)
 *
 * Implements Modern Academic Editorial section titles:
 * - Uses the editorial serif font (Fraunces) for BOTH numbered and unnumbered sections
 * - Serif section numbering (italic or classical numeral)
 * - Configurable heading level (defaults to h2)
 * - Pure token-driven styling
 * - Integrated live editing via Content DB pointIds
 * - Subtitles removed: only the page title (PageTitle) gets a subtitle
 */
export const SectionTitle: React.FC<SectionTitleProps> = memo(({
  title,
  titlePointId,
  number,
  defaultNumbered,
  subtitle: _subtitle,
  subtitlePointId: _subtitlePointId,
  as: HeadingTag = 'h2',
  id,
  accentColor,
  className,
  children,
  editTriggerId,
  onEdit,
}) => {
  const Heading = HeadingTag as React.ElementType;
  const hasDefaultNumber = defaultNumbered !== undefined
    ? defaultNumbered
    : (number !== undefined && number !== null);
  const isNumberedKey = titlePointId ? `${titlePointId}.isNumbered` : '';
  const { text: isNumberedOverride } = useContent(
    isNumberedKey,
    hasDefaultNumber ? 'true' : 'false'
  );
  const isNumbered = isNumberedKey ? isNumberedOverride === 'true' : hasDefaultNumber;

  const sectionNum = number ?? 1;
  const formattedNumber = isNumbered
    ? typeof sectionNum === 'number'
      ? String(sectionNum).padStart(2, '0')
      : String(sectionNum)
    : null;

  return (
    <div
      className={`${styles.sectionHeader} ${className || ''}`}
      style={{ '--section-accent': accentColor } as React.CSSProperties}
    >
      {formattedNumber && (
        <span className={styles.sectionNumber}>
          Section {formattedNumber}
        </span>
      )}

      {titlePointId ? (
        <EditableText
          pointId={titlePointId}
          defaultText={title}
          as={Heading}
          className={styles.sectionTitle}
          ariaLabel={id}
          isSection={true}
          isNumbered={isNumbered}
          defaultNumbered={hasDefaultNumber}
          editTriggerId={editTriggerId}
          onEditText={onEdit}
        >
          {(resolvedTitle) => (
            <Heading id={id} className={styles.sectionTitle}>
              {resolvedTitle}
            </Heading>
          )}
        </EditableText>
      ) : (
        <Heading id={id} className={styles.sectionTitle}>
          {title}
        </Heading>
      )}

      {/* Subtitles removed for sections: only the page title (PageTitle) gets a subtitle */}

      {children && <div className={styles.extra}>{children}</div>}
    </div>
  );
});

SectionTitle.displayName = 'SectionTitle';

export default SectionTitle;
