import React from 'react';
import styles from './ColumnTypeBadge.module.css';

export interface ColumnTypeBadgeProps {
  type: 'text' | 'number';
  className?: string;
}

export const ColumnTypeBadge: React.FC<ColumnTypeBadgeProps> = ({ type, className = '' }) => {
  const isNumber = type === 'number';
  const label = isNumber ? '123' : 'TEXT';
  const typeClass = isNumber ? styles.number : styles.text;

  return (
    <span
      className={`${styles.badge} ${typeClass} ${className}`.trim()}
      title={isNumber ? 'Numeric metric column' : 'Categorical text dimension'}
      aria-label={isNumber ? 'Numeric data' : 'Text data'}
    >
      {label}
    </span>
  );
};
