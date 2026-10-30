import React, { memo } from 'react';
import type { SectionElement } from '../../types/canvas';
import { SectionTitle } from '../ui/SectionTitle';
import styles from './CanvasContainers.module.css';

export interface CanvasSectionProps {
  section: SectionElement;
  nodeId: string;
  nodeTitle?: string;
  accentColor?: string;
  isDevMode?: boolean;
  className?: string;
  computedNumber?: string | null;
  children?: React.ReactNode;
  onEdit?: () => void;
}

/**
 * CanvasSection Component
 * Folio Engine — Task 8.4.1: Canvas Sectioning & Nesting Containers
 *
 * Top-level structural section container for the Dynamic Canvas:
 * - Renders semantic HTML5 <section id="sec-${id}">
 * - Exposes data-toc-title, data-toc-number, and data-toc-numbered for automated discovery by useAutoTableOfContents
 * - Canonical SectionTitle (h2) with toggleable numbering support
 * - Unnumbered sections cleanly omit data-toc-number and set data-toc-numbered="false"
 * - Pure spatial separation with zero horizontal divider lines
 * - Memoized with React.memo for re-render efficiency
 */
export const CanvasSection: React.FC<CanvasSectionProps> = memo(({
  section,
  nodeId,
  nodeTitle: _nodeTitle,
  accentColor,
  isDevMode: _isDevMode,
  className,
  computedNumber,
  children,
  onEdit,
}) => {
  const domId = section.id.startsWith('sec-') ? section.id : `sec-${section.id}`;
  const titlePointId = section.titlePointId || `node.${nodeId}.section.${section.id}.title`;

  const defaultNumbered = computedNumber !== undefined
    ? computedNumber !== null
    : (section.isNumbered !== undefined
      ? section.isNumbered
      : (section.number !== undefined && section.number !== null));

  const isNumbered = section.isNumbered !== undefined ? section.isNumbered : defaultNumbered;

  const effectiveNumber = isNumbered
    ? (computedNumber !== undefined ? computedNumber : section.number)
    : null;

  const resolvedTitle = section.title;

  return (
    <section
      id={domId}
      className={`${styles.section} ${className || ''}`.trim()}
      aria-label={resolvedTitle}
      data-toc-title={resolvedTitle}
      data-toc-number={effectiveNumber || undefined}
      data-toc-numbered={isNumbered ? 'true' : 'false'}
    >
      <SectionTitle
        number={effectiveNumber}
        defaultNumbered={isNumbered}
        title={resolvedTitle}
        titlePointId={titlePointId}
        as="h2"
        accentColor={accentColor}
        editTriggerId={section.id}
        onEdit={onEdit}
      />
      <div className={styles.sectionBody}>
        {children}
      </div>
    </section>
  );
});

CanvasSection.displayName = 'CanvasSection';

export default CanvasSection;
