import React from 'react';
import styles from './StatusPill.module.css';

export type StatusPillVariant =
  | 'white'
  | 'primary'
  | 'accent'
  | 'green'
  | 'blue'
  | 'amber'
  | 'neutral'
  | 'mono'
  | 'link'
  | 'interactive';

export type StatusPillSize = 'sm' | 'md';

export interface StatusPillProps {
  label: React.ReactNode;
  variant?: StatusPillVariant;
  size?: StatusPillSize;
  icon?: React.ReactNode;
  pulse?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  className?: string;
  ariaLabel?: string;
  title?: string;
  showExternalIcon?: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  variant = 'neutral',
  size,
  icon,
  pulse: _pulse = false,
  href,
  target,
  rel,
  type = 'button',
  onClick,
  className = '',
  ariaLabel,
  title,
  showExternalIcon = variant === 'link',
}) => {
  const content = (
    <>
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      <span className={styles.label}>{label}</span>
      {showExternalIcon && <span className={styles.externalIcon} aria-hidden="true">↗</span>}
    </>
  );

  const sizeClass = size === 'sm' ? styles.sizeSm : size === 'md' ? styles.sizeMd : '';
  const combinedClassName = `${styles.pill} ${styles[variant]} ${sizeClass} ${className}`.trim();

  if (href) {
    return (
      <a
        href={href}
        target={target || (variant === 'link' ? '_blank' : undefined)}
        rel={rel || (variant === 'link' ? 'noopener noreferrer' : undefined)}
        className={combinedClassName}
        onClick={onClick}
        aria-label={ariaLabel}
        title={title}
      >
        {content}
      </a>
    );
  }

  if (onClick || variant === 'interactive') {
    return (
      <button
        type={type}
        className={combinedClassName}
        onClick={onClick}
        aria-label={ariaLabel}
        title={title}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={combinedClassName} role="status" aria-label={ariaLabel} title={title}>
      {content}
    </span>
  );
};

export default StatusPill;
