import React from 'react';
import styles from './Textarea.module.css';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  monospace?: boolean;
  ref?: React.Ref<HTMLTextAreaElement>;
}

/**
 * Canonical textarea primitive enforcing the 4-state interactive matrix,
 * Universal Zero Outline Policy, and design-token purity.
 */
export const Textarea: React.FC<TextareaProps> = ({
  invalid = false,
  monospace = false,
  className,
  'aria-invalid': ariaInvalid,
  ref,
  ...rest
}) => {
  const combinedClassName = [
    styles.textarea,
    monospace ? styles.monospace : '',
    invalid ? styles.invalid : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <textarea
      ref={ref}
      className={combinedClassName}
      aria-invalid={invalid ? 'true' : ariaInvalid}
      {...rest}
    />
  );
};

export default Textarea;
