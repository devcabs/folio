import React from 'react';
import styles from './InlineAlert.module.css';

export type InlineAlertVariant = 'error' | 'warning' | 'info' | 'success';

export interface InlineAlertProps {
  variant?: InlineAlertVariant;
  title?: React.ReactNode;
  children: React.ReactNode;
  role?: 'alert' | 'status';
  className?: string;
  id?: string;
}

const VARIANT_CLASS_MAP: Record<InlineAlertVariant, string> = {
  error: styles.variantError,
  warning: styles.variantWarning,
  info: styles.variantInfo,
  success: styles.variantSuccess,
};

/**
 * InlineAlert Component
 * Folio Engine — Canonical inline feedback box for error, warning, info, and success states.
 * Defaults to role="alert" for error/warning and role="status" for info/success.
 */
export const InlineAlert: React.FC<InlineAlertProps> = ({
  variant = 'info',
  title,
  children,
  role,
  className,
  id,
}) => {
  const resolvedRole = role ?? (variant === 'error' || variant === 'warning' ? 'alert' : 'status');
  const variantClass = VARIANT_CLASS_MAP[variant] || styles.variantInfo;

  return (
    <div
      id={id}
      role={resolvedRole}
      className={`${styles.alert} ${variantClass} ${className || ''}`.trim()}
      data-variant={variant}
    >
      {title && <div className={styles.title}>{title}</div>}
      <div className={styles.body}>{children}</div>
    </div>
  );
};

export default InlineAlert;
