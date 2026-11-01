import React, { memo } from 'react';
import styles from './ChartGhostWireframe.module.css';

export interface ChartGhostWireframeProps {
  className?: string;
}

/**
 * ChartGhostWireframe Component
 * Folio Engine — Task 8.10
 *
 * Universal calm, tokenized SVG wireframe skeleton:
 * - Subtle X/Y baseline axes
 * - Soft staggered vertical bar silhouettes
 * - Strictly decorative background (aria-hidden="true")
 * - Enforces Universal Zero Outline Policy and token purity
 */
export const ChartGhostWireframe: React.FC<ChartGhostWireframeProps> = memo(({ className }) => {
  return (
    <div
      className={`${styles.wireframeWrapper} ${className || ''}`.trim()}
      aria-hidden="true"
      tabIndex={-1}
    >
      <svg
        className={styles.wireframeSvg}
        viewBox="0 0 540 220"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Subtle Horizontal Grid Guidelines */}
        <line x1="45" y1="40" x2="515" y2="40" className={styles.gridLine} />
        <line x1="45" y1="90" x2="515" y2="90" className={styles.gridLine} />
        <line x1="45" y1="140" x2="515" y2="140" className={styles.gridLine} />

        {/* X and Y Baseline Axes */}
        <line x1="45" y1="20" x2="45" y2="190" className={styles.axisLine} />
        <line x1="45" y1="190" x2="515" y2="190" className={styles.axisLine} />

        {/* 5 Soft Staggered Ghost Bars */}
        {/* Bar 1 */}
        <rect
          x="75"
          y="100"
          width="48"
          height="90"
          rx="4"
          className={styles.ghostBar}
        />
        {/* Bar 2 */}
        <rect
          x="165"
          y="60"
          width="48"
          height="130"
          rx="4"
          className={styles.ghostBarAccent}
        />
        {/* Bar 3 */}
        <rect
          x="255"
          y="120"
          width="48"
          height="70"
          rx="4"
          className={styles.ghostBar}
        />
        {/* Bar 4 */}
        <rect
          x="345"
          y="45"
          width="48"
          height="145"
          rx="4"
          className={styles.ghostBarAccent}
        />
        {/* Bar 5 */}
        <rect
          x="435"
          y="85"
          width="48"
          height="105"
          rx="4"
          className={styles.ghostBar}
        />
      </svg>
    </div>
  );
});

ChartGhostWireframe.displayName = 'ChartGhostWireframe';

export default ChartGhostWireframe;
