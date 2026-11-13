import React, { memo } from 'react';
import styles from './CanvasGhostWireframe.module.css';

export interface CanvasGhostWireframeProps {
  nodeId?: string;
  className?: string;
}

/**
 * CanvasGhostWireframe Component
 * Folio Engine — Subtask 2.8: Cold Boot Skeleton Wireframe (Zero Flash-of-Baseline)
 *
 * Renders a token-styled editorial ghost wireframe during edge document hydration.
 * Ensures zero content flashing and eliminates Cumulative Layout Shift (CLS) on cold boot.
 */
export const CanvasGhostWireframe: React.FC<CanvasGhostWireframeProps> = memo(({
  nodeId: _nodeId,
  className,
}) => {
  return (
    <div
      className={`${styles.wireframeWrapper} ${className || ''}`.trim()}
      role="region"
      aria-busy="true"
      aria-label="Loading node content"
      data-testid="canvas-ghost-wireframe"
    >
      <div className={styles.sectionSkeleton}>
        {/* Editorial Section Title Skeleton */}
        <div
          className={styles.titleSkeleton}
          data-skeleton-part="section-title"
          aria-hidden="true"
        />

        {/* Editorial Section Subtitle Skeleton */}
        <div
          className={styles.subtitleSkeleton}
          data-skeleton-part="section-subtitle"
          aria-hidden="true"
        />

        {/* 3-Line Paragraph Block Skeleton */}
        <div
          className={styles.paragraphBlock}
          data-skeleton-part="paragraph"
          aria-hidden="true"
        >
          <div
            className={styles.paragraphLine}
            data-skeleton-part="paragraph-line-1"
          />
          <div
            className={styles.paragraphLine}
            data-skeleton-part="paragraph-line-2"
          />
          <div
            className={styles.paragraphLine}
            data-skeleton-part="paragraph-line-3"
          />
        </div>

        {/* 16:9 Media / Photo Box Skeleton */}
        <div
          className={styles.photoSkeleton}
          data-skeleton-part="photo-box"
          aria-hidden="true"
        />
      </div>
    </div>
  );
});

CanvasGhostWireframe.displayName = 'CanvasGhostWireframe';

export default CanvasGhostWireframe;

