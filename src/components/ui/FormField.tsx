import React from 'react';
import { DevHelpTooltip } from './DevHelpTooltip';
import styles from './FormField.module.css';

export interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  tooltip?: string;
  labelAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Canonical FormField wrapper associating a semantic label, optional required
 * indicator, DevHelpTooltip, right-aligned labelAction slot, control slot,
 * hint text, and accessible role="alert" error banner with automatic
 * aria-describedby wiring.
 */
export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  required = false,
  hint,
  error,
  tooltip,
  labelAction,
  children,
  className,
}) => {
  const hasHint = hint !== undefined && hint !== null && hint !== '';
  const hasError = typeof error === 'string' && error.trim().length > 0;

  const hintId = hasHint ? `${id}-hint` : undefined;
  const errorId = hasError ? `${id}-error` : undefined;
  const generatedDescribedBy = [errorId, hintId].filter(Boolean).join(' ');

  let renderedControl = children;
  if (
    generatedDescribedBy &&
    React.isValidElement<{ 'aria-describedby'?: string }>(children) &&
    children.type !== React.Fragment
  ) {
    const existingDescribedBy = children.props['aria-describedby'];
    const mergedDescribedBy = [existingDescribedBy, generatedDescribedBy]
      .filter(Boolean)
      .join(' ');
    renderedControl = React.cloneElement(children, {
      'aria-describedby': mergedDescribedBy,
    });
  }

  return (
    <div className={`${styles.field} ${className || ''}`.trim()}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          <span>{label}</span>
          {required && (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          )}
          {tooltip && <DevHelpTooltip text={tooltip} label={label} />}
        </label>
        {labelAction && <div className={styles.labelAction}>{labelAction}</div>}
      </div>

      {renderedControl}

      {hasHint && (
        <div id={hintId} className={styles.hint}>
          {hint}
        </div>
      )}

      {hasError && (
        <div id={errorId} role="alert" className={styles.error}>
          {error}
        </div>
      )}
    </div>
  );
};

export default FormField;
