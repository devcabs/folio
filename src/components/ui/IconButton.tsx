import React from 'react';
import styles from './IconButton.module.css';

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary' | 'danger';
export type IconButtonSize = 'xs' | 'sm' | 'md';
export type IconButtonShape = 'circle' | 'square';

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  'aria-label': string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  shape?: IconButtonShape;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

const VARIANT_CLASS_MAP: Record<IconButtonVariant, string> = {
  ghost: styles.variantGhost,
  secondary: styles.variantSecondary,
  primary: styles.variantPrimary,
  danger: styles.variantDanger,
};

const SIZE_CLASS_MAP: Record<IconButtonSize, string> = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  md: styles.sizeMd,
};

const SHAPE_CLASS_MAP: Record<IconButtonShape, string> = {
  circle: styles.shapeCircle,
  square: styles.shapeSquare,
};

/**
 * IconButton Component
 * Folio Engine — Canonical compact icon-only trigger with explicit square/circular geometry,
 * mandatory aria-label, 4-state interactive matrix, and Universal Zero Outline Policy.
 */
export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'ghost',
  size = 'sm',
  shape = 'circle',
  type = 'button',
  className,
  children,
  disabled = false,
  ref,
  ...restProps
}) => {
  const combinedClassName = [
    styles.iconBtn,
    VARIANT_CLASS_MAP[variant] || styles.variantGhost,
    SIZE_CLASS_MAP[size] || styles.sizeSm,
    SHAPE_CLASS_MAP[shape] || styles.shapeCircle,
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={combinedClassName}
      data-variant={variant}
      {...restProps}
    >
      {children}
    </button>
  );
};

export default IconButton;
