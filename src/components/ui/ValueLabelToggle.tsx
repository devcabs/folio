import React from 'react';
import styles from './ValueLabelToggle.module.css';

export interface ValueLabelToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  hint?: string;
  className?: string;
}

export const ValueLabelToggle: React.FC<ValueLabelToggleProps> = ({
  id = 'cfg-show-values',
  checked,
  onChange,
  label = 'Show values on bars',
  hint,
  className = '',
}) => {
  return (
    <div className={`${styles.container} ${className}`.trim()}>
      <label htmlFor={id} className={styles.label}>
        <input
          id={id}
          type="checkbox"
          className={styles.checkbox}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
};
