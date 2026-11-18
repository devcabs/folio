import React from 'react';
import styles from '../../ChartConfigDrawer.module.css';

interface AxisBaselineToggleProps {
  label: string;
  startAtZero: boolean;
  onChange: (startAtZero: boolean) => void;
}

/**
 * Compact Auto | Zero segmented baseline toggle for chart axis scales.
 */
export const AxisBaselineToggle: React.FC<AxisBaselineToggleProps> = ({
  label,
  startAtZero,
  onChange,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(!startAtZero);
    }
  };

  return (
    <div className={styles.formGroup}>
      <span className={styles.label}>{label}</span>
      <div
        className={styles.segmentedControl}
        role="radiogroup"
        aria-label={label}
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          role="radio"
          aria-checked={!startAtZero}
          tabIndex={!startAtZero ? 0 : -1}
          className={`${styles.segmentBtn} ${!startAtZero ? styles.segmentBtnActive : ''}`}
          onClick={() => onChange(false)}
        >
          Auto
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={startAtZero}
          tabIndex={startAtZero ? 0 : -1}
          className={`${styles.segmentBtn} ${startAtZero ? styles.segmentBtnActive : ''}`}
          onClick={() => onChange(true)}
        >
          Zero
        </button>
      </div>
    </div>
  );
};
