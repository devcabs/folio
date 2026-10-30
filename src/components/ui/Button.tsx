import React from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'revolving-outline' | 'primary' | 'secondary' | 'ghost' | 'admin';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  outlineWidth?: number | string;
  revolving?: boolean;
  pulse?: boolean;
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
  'revolving-outline': styles.variantRevolvingOutline,
  primary: styles.variantPrimary,
  secondary: styles.variantSecondary,
  ghost: styles.variantGhost,
  admin: styles.variantAdmin,
};

const SIZE_CLASS_MAP: Record<ButtonSize, string> = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'revolving-outline',
  size = 'md',
  outlineWidth,
  revolving = true,
  pulse = false,
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
  const variantClass = VARIANT_CLASS_MAP[variant] || styles.variantRevolvingOutline;
  const sizeClass = SIZE_CLASS_MAP[size] || styles.sizeMd;
  const revolvingClass =
    variant === 'revolving-outline' && !revolving ? styles.revolvingStopped : '';
  const pulseClass = pulse ? styles.pulse : '';
  const combinedClassName =
    `${styles.btn} ${variantClass} ${sizeClass} ${revolvingClass} ${pulseClass} ${className || ''}`.trim();

  const inlineStyles: React.CSSProperties = {
    ...style,
    ...(outlineWidth !== undefined
      ? ({
          '--outline-width':
            typeof outlineWidth === 'number' ? `${outlineWidth}px` : outlineWidth,
        } as React.CSSProperties)
      : {}),
  };

  const dataRevolving = variant === 'revolving-outline' ? String(revolving) : undefined;

  if (isLink) {
    return (
      <a
        id={id}
        href={href}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={combinedClassName}
        style={inlineStyles}
        title={title}
        aria-label={ariaLabel}
        aria-disabled={disabled ? 'true' : undefined}
        target={target}
        rel={rel}
        tabIndex={tabIndex}
        aria-hidden={ariaHidden}
        data-revolving={dataRevolving}
        data-pulse={pulse ? 'true' : undefined}
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
      style={inlineStyles}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      tabIndex={tabIndex}
      aria-hidden={ariaHidden}
      data-revolving={dataRevolving}
      data-pulse={pulse ? 'true' : undefined}
      data-variant={variant}
      data-primary={variant === 'primary' || variant === 'admin' ? 'true' : undefined}
      {...restProps}
    >
      <span className={styles.btnContent}>{children}</span>
    </button>
  );
};

export default Button;
