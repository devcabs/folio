import React, { memo } from 'react';
import { ParametricShape } from '../ui/ParametricShape';
import styles from './CanvasEmptyNotice.module.css';

export interface CanvasEmptyNoticeProps {
  nodeTitle: string;
  accentColor?: string;
  className?: string;
}

export const CanvasEmptyNotice: React.FC<CanvasEmptyNoticeProps> = memo(({
  nodeTitle,
  accentColor = 'var(--folio-primary)',
  className,
}) => {
  return (
    <section
      className={`${styles.container} ${className || ''}`.trim()}
      aria-label={`${nodeTitle} Documentation Notice`}
      tabIndex={-1}
      data-testid="canvas-empty-notice"
    >
      <div className={styles.innerWrapper}>
        <div className={styles.markWrapper}>
          <ParametricShape
            sides={8}
            waviness={0.12}
            radius={22}
            fill={accentColor}
          />
        </div>

        <div className={styles.kicker}>
          {`${nodeTitle} Domain Documentation`}
        </div>

        <h3 className={styles.title}>
          Initiatives in Preparation
        </h3>

        <p className={styles.description}>
          The designated institutional coordinators are actively curating verified milestones, 
          operational narratives, and metric records for this domain. Published evidence and verified 
          receipts will appear here as entries are ratified.
        </p>

        <div className={styles.badgeRow}>
          <span className={styles.statusBadge}>
            Status: Drafting in Progress
          </span>
        </div>
      </div>
    </section>
  );
});

CanvasEmptyNotice.displayName = 'CanvasEmptyNotice';
export default CanvasEmptyNotice;
