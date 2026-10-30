import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import styles from './DevHelpTooltip.module.css';

export interface DevHelpTooltipProps {
  /** Explanatory help guidance shown on hover */
  text: string;
  /** Accessible concept name for screen readers */
  label?: string;
  /** Optional custom class for the trigger button */
  className?: string;
}

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export const DevHelpTooltip: React.FC<DevHelpTooltipProps> = React.memo(({
  text,
  label,
  className,
}) => {
  const { isDevMode } = useDeveloperMode();
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const bubbleEl = bubbleRef.current;
    const bubbleWidth = bubbleEl ? bubbleEl.offsetWidth : 220;
    const bubbleHeight = bubbleEl ? bubbleEl.offsetHeight : 44;

    // Center horizontally on the icon, clamped to viewport bounds
    let left = triggerRect.left + triggerRect.width / 2 - bubbleWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - bubbleWidth - 12));

    // Position above by default; flip below if tight on top
    let top = triggerRect.top - bubbleHeight - 6;
    if (top < 12) {
      top = triggerRect.bottom + 6;
    }

    setCoords({ top, left });
  }, []);

  // Re-calculate position when opened or after DOM measurement
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const rAF = requestAnimationFrame(updatePosition);
      return () => cancelAnimationFrame(rAF);
    } else {
      setCoords(null);
    }
  }, [isOpen, updatePosition]);

  // Handle dismiss on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Dev Mode guard: strictly zero DOM overhead for public visitors
  if (!isDevMode) {
    return null;
  }

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 150);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleBlur = () => {
    setIsOpen(false);
  };

  // Strictly non-clickable: prevent form submits, modal triggers, and event bubbling
  const handlePrevent = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        className={`${styles.trigger} ${className || ''}`}
        aria-label={label ? `Help for ${label}` : 'Help info'}
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handlePrevent}
        onMouseDown={handlePrevent}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <InfoIcon className={styles.icon} />
      </span>

      {isOpen &&
        createPortal(
          <div
            id={tooltipId}
            ref={bubbleRef}
            role="tooltip"
            className={styles.bubble}
            style={{
              top: coords ? `${coords.top}px` : '-9999px',
              left: coords ? `${coords.left}px` : '-9999px',
            }}
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
});

DevHelpTooltip.displayName = 'DevHelpTooltip';
export default DevHelpTooltip;
