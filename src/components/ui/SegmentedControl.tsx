import React from 'react';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  'aria-label': string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Canonical accessible SegmentedControl (`role="radiogroup"` + `role="radio"`)
 * unifying segmented selectors across CanvasAddModal, UniversalEditModal, and drawers.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  disabled = false,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>): React.ReactElement {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (disabled) return;

    const isNext = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const isPrev = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    if (!isNext && !isPrev) return;

    e.preventDefault();
    const step = isNext ? 1 : -1;
    const count = options.length;
    for (let offset = 1; offset <= count; offset++) {
      const nextIndex = (currentIndex + step * offset + count) % count;
      const candidate = options[nextIndex];
      if (candidate && !candidate.disabled) {
        onChange(candidate.value);
        break;
      }
    }
  };

  return (
    <div
      className={`${styles.group} ${size === 'sm' ? styles.sizeSm : styles.sizeMd} ${className}`.trim()}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const isDisabled = disabled || Boolean(option.disabled);

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isDisabled}
            className={`${styles.segment} ${isSelected ? styles.segmentActive : ''}`.trim()}
            onClick={() => {
              if (!isDisabled) {
                onChange(option.value);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
