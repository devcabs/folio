import React from 'react';
import styles from './Select.module.css';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  ref?: React.Ref<HTMLSelectElement>;
}

/**
 * Canonical native select primitive with consistent chevron/padding,
 * 4-state interactive matrix, and Universal Zero Outline Policy.
 */
export const Select: React.FC<SelectProps> = ({
  invalid = false,
  className,
  'aria-invalid': ariaInvalid,
  children,
  ref,
  ...rest
}) => {
  const combinedClassName = [
    styles.select,
    invalid ? styles.invalid : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.wrapper}>
      <select
        ref={ref}
        className={combinedClassName}
        aria-invalid={invalid ? 'true' : ariaInvalid}
        {...rest}
      >
        {children}
      </select>
      <svg
        className={styles.chevron}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
};

export default Select;
