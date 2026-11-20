import React from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  valid?: boolean;
  monospace?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * Canonical text input primitive enforcing the 4-state interactive matrix,
 * Universal Zero Outline Policy, and design-token purity.
 */
export const Input: React.FC<InputProps> = ({
  invalid = false,
  valid = false,
  monospace = false,
  className,
  'aria-invalid': ariaInvalid,
  ref,
  ...rest
}) => {
  const combinedClassName = [
    styles.input,
    monospace ? styles.monospace : '',
    invalid ? styles.invalid : valid ? styles.valid : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <input
      ref={ref}
      className={combinedClassName}
      aria-invalid={invalid ? 'true' : ariaInvalid}
      {...rest}
    />
  );
};

export default Input;
