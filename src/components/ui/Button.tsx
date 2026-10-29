import React from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'action';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  as?: 'button' | 'a';
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  'aria-label'?: string;
  title?: string;
  disabled?: boolean;
  target?: string;
  rel?: string;
  id?: string;
  tabIndex?: number;
  'aria-hidden'?: boolean | 'true' | 'false';
  ref?: React.Ref<HTMLButtonElement>;
  [key: `data-${string}`]: unknown;
}

const VARIANT_CLASS_MAP: Record<ButtonVariant, string> = {
  primary: styles.variantPrimary,
  secondary: styles.variantSecondary,
  ghost: styles.variantGhost,
  outline: styles.variantOutline,
  action: styles.variantAction,
};

const SIZE_CLASS_MAP: Record<ButtonSize, string> = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  as,
  href,
  type = 'button',
  onClick,
  onMouseEnter,
  onMouseLeave,
  className,
  style,
  children,
  'aria-label': ariaLabel,
  title,
  disabled = false,
  target,
  rel,
  id,
  tabIndex,
  'aria-hidden': ariaHidden,
  ref,
  ...restProps
}) => {
  const isLink = as === 'a' || (href !== undefined && as !== 'button');
  const variantClass = VARIANT_CLASS_MAP[variant] || styles.variantPrimary;
  const sizeClass = SIZE_CLASS_MAP[size] || styles.sizeMd;
  const combinedClassName = `${styles.btn} ${variantClass} ${sizeClass} ${className || ''}`.trim();

  if (isLink) {
    return (
      <a
        id={id}
        href={href}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={combinedClassName}
        style={style}
        title={title}
        aria-label={ariaLabel}
        aria-disabled={disabled ? 'true' : undefined}
        target={target}
        rel={rel}
        tabIndex={tabIndex}
        aria-hidden={ariaHidden}
        data-variant={variant}
        {...restProps}
      >
        <span className={styles.btnContent}>{children}</span>
      </a>
    );
  }

  return (
    <button
      ref={ref}
      id={id}
      type={type}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={combinedClassName}
      style={style}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      tabIndex={tabIndex}
      aria-hidden={ariaHidden}
      data-variant={variant}
      data-primary={variant === 'primary' || variant === 'action' ? 'true' : undefined}
      {...restProps}
    >
      <span className={styles.btnContent}>{children}</span>
    </button>
  );
};

export default Button;
