import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import styles from './FAB.module.css';

export interface FABProps {
  label: string;
  isVisible: boolean;
  position?: 'left' | 'right';
  direction?: 'down' | 'up';
  revolving?: boolean;
  pulse?: boolean;
  onClick: (e?: React.MouseEvent) => void;
  className?: string;
  'aria-label'?: string;
}

/**
 * FAB Component (Floating Action Button) — Folio Engine
 *
 * All FABs are designed as a revolving variant of the button:
 * - Positioned at bottom-left or bottom-right with dynamic keyboard & visual viewport adjustment
 * - Conic gradient revolving outline border
 * - Attention-grabbing flick micro-motion & golden halo flash (every 1.5s)
 * - Directional motion cues: ↓ for advancing to next stage, ↑ for Previous or Back to Top
 * - Spring-interpolated entrance and exit animations
 */
export const FAB: React.FC<FABProps> = ({
  label,
  isVisible,
  position = 'right',
  direction = 'down',
  revolving = true,
  pulse,
  onClick,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const isUp = direction === 'up';
  const isLeft = position === 'left';
  const shouldPulse = pulse !== undefined ? pulse : !isLeft;
  const [keyboardOffset, setKeyboardOffset] = useState<number>(0);

  // Dynamic visual viewport adjustment:
  // Automatically lifts the FAB above mobile virtual keyboards or bottom accessory bars
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const offset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setKeyboardOffset(offset);
    };

    const vv = window.visualViewport;
    vv.addEventListener('resize', handleViewportChange);
    vv.addEventListener('scroll', handleViewportChange);

    return () => {
      vv.removeEventListener('resize', handleViewportChange);
      vv.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  const defaultAriaLabel = isLeft
    ? 'Return to the previous milestone'
    : isUp
      ? 'Scroll back to the top of the portal'
      : 'Advance to the next milestone';

  const arrowElement = (
    <span
      className={`${styles.fabArrow} ${
        isUp ? styles.fabArrowUp : styles.fabArrowDown
      }`}
      aria-hidden="true"
    >
      {isUp ? '↑' : '↓'}
    </span>
  );

  return (
    <div
      className={`${styles.fabContainer} ${
        isLeft ? styles.positionLeft : styles.positionRight
      } ${
        isVisible ? styles.visible : styles.hidden
      } ${className}`}
      style={{
        '--keyboard-offset': `${keyboardOffset}px`,
      } as React.CSSProperties}
      aria-hidden={!isVisible}
    >
      <Button
        variant="revolving-outline"
        outlineWidth={3}
        revolving={revolving}
        pulse={shouldPulse}
        onClick={onClick}
        className={styles.fabButton}
        aria-label={ariaLabel || defaultAriaLabel}
        tabIndex={isVisible ? 0 : -1}
      >
        {isLeft && arrowElement}
        <span className={styles.fabLabel}>{label}</span>
        {!isLeft && arrowElement}
      </Button>
    </div>
  );
};

export default FAB;
