import React, { memo } from 'react';
import type { SubsectionElement } from '../../types/canvas';
import { SectionTitle } from '../ui/SectionTitle';
import styles from './CanvasContainers.module.css';

export interface CanvasSubsectionProps {
  subsection: SubsectionElement;
  nodeId: string;
  accentColor?: string;
  isDevMode?: boolean;
  className?: string;
  children?: React.ReactNode;
  onEdit?: () => void;
}

/**
 * CanvasSubsection Component
 * Folio Engine — Task 8.4.2: Canvas Sectioning & Nesting Containers
 *
 * Mid-level grouping container for nested initiatives on the Dynamic Canvas:
 * - Semantic <div role="region" id="subsec-${id}"> container
 * - Canonical SectionTitle (h3) for hierarchical document outline
 * - Pure spatial separation without horizontal dividing lines
 * - Memoized with React.memo for re-render efficiency
 */
export const CanvasSubsection: React.FC<CanvasSubsectionProps> = memo(({
  subsection,
  nodeId,
  accentColor,
  isDevMode: _isDevMode,
  className,
  children,
  onEdit,
}) => {
  const domId = subsection.id.startsWith('subsec-') ? subsection.id : `subsec-${subsection.id}`;
  const titlePointId = subsection.titlePointId || `node.${nodeId}.subsec.${subsection.id}.title`;

  return (
    <div
      id={domId}
      className={`${styles.subsection} ${className || ''}`.trim()}
      role="region"
      aria-label={subsection.title}
    >
      <SectionTitle
        title={subsection.title}
        titlePointId={titlePointId}
        as="h3"
        accentColor={accentColor}
        defaultNumbered={false}
        editTriggerId={subsection.id}
        onEdit={onEdit}
      />
      <div className={styles.subsectionBody}>
        {children}
      </div>
    </div>
  );
});

CanvasSubsection.displayName = 'CanvasSubsection';

export default CanvasSubsection;
