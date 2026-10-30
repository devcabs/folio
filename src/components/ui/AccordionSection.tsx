import React, { useState, useEffect, useId } from 'react';
import styles from './AccordionSection.module.css';

export interface AccordionSectionProps {
  id?: string;
  name?: string;
  title: string;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
  badge?: React.ReactNode;
  caption?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * AccordionSection Component
 * Canonical UI primitive for collapsible drawer sections with indented subordinate controls.
 * Supports exclusive single-open groups via the `name` prop.
 * Strictly adheres to tokens.css, Universal Zero Outline Policy, and Ban on Dividing Lines.
 */
export const AccordionSection: React.FC<AccordionSectionProps> = ({
  id,
  name,
  title,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle,
  badge,
  caption,
  children,
  className = '',
}) => {
  const autoId = useId();
  const effectiveId = id || autoId;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = typeof controlledIsOpen === 'boolean';
  const open = isControlled ? controlledIsOpen : internalOpen;

  useEffect(() => {
    if (!name || isControlled) return;

    const handleGlobalAccordionOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ name: string; id: string }>;
      if (customEvent.detail?.name === name && customEvent.detail?.id !== effectiveId) {
        setInternalOpen(false);
      }
    };

    window.addEventListener('accordion-open', handleGlobalAccordionOpen);
    return () => {
      window.removeEventListener('accordion-open', handleGlobalAccordionOpen);
    };
  }, [name, effectiveId, isControlled]);

  const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const nextState = e.currentTarget.open;
    if (!isControlled) {
      setInternalOpen(nextState);
    }
    if (name && nextState) {
      window.dispatchEvent(
        new CustomEvent('accordion-open', {
          detail: { name, id: effectiveId },
        })
      );
    }
    onToggle?.(nextState);
  };

  return (
    <details
      id={effectiveId}
      name={name}
      className={`${styles.accordionSection} ${className}`.trim()}
      open={open}
      onToggle={handleToggle}
    >
      <summary className={styles.summary}>
        <div className={styles.summaryLeft}>
          <span className={styles.chevron} aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
          <span className={styles.title}>{title}</span>
        </div>
        {badge && <div className={styles.badgeWrapper}>{badge}</div>}
      </summary>
      {caption && <p className={styles.caption}>{caption}</p>}
      <div className={styles.content}>{children}</div>
    </details>
  );
};

export default AccordionSection;

