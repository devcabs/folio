import React, { useId } from 'react';
import { DevHelpTooltip } from './DevHelpTooltip';
import styles from './Checkbox.module.css';

export interface CheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  tooltip?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * Canonical Checkbox primitive generalized from ValueLabelToggle.
 * Enforces design-token purity, 4-state matrix, and Universal Zero Outline Policy.
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  id,
  checked,
  onChange,
  label,
  hint,
  tooltip,
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
  ref,
}) => {
  const generatedId = useId();
  const resolvedId = id || generatedId;
  const labelText = typeof label === 'string' ? label : ariaLabel;

  return (
    <div
      className={`${styles.container} ${disabled ? styles.disabled : ''} ${className}`.trim()}
    >
      <label htmlFor={resolvedId} className={styles.label}>
        <input
          ref={ref}
          id={resolvedId}
          type="checkbox"
          className={styles.checkbox}
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(e) => {
            if (!disabled) {
              onChange(e.target.checked);
            }
          }}
        />
        <span className={styles.labelText}>{label}</span>
        {tooltip && <DevHelpTooltip text={tooltip} label={labelText} />}
      </label>
      {hint !== undefined && hint !== null && hint !== '' && (
        <span className={styles.hint}>{hint}</span>
      )}
    </div>
  );
};

export default Checkbox;
