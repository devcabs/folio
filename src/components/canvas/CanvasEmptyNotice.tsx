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
      aria-label={`${nodeTitle} Draft`}
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
          {nodeTitle}
        </div>

        <h3 className={styles.title}>
          Draft
        </h3>

        <p className={styles.description}>
          This section is currently in draft.
        </p>
      </div>
    </section>
  );
});

CanvasEmptyNotice.displayName = 'CanvasEmptyNotice';
export default CanvasEmptyNotice;
