import React from 'react';
import styles from './TieredSlider.module.css';

export interface TieredSliderTier {
  value: number;
  label: string;
  sublabel?: string;
}

export interface TieredSliderProps {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  tiers?: TieredSliderTier[];
  badgeFormatter?: (val: number) => string;
  onChange: (val: number) => void;
  disabled?: boolean;
}

export const TieredSlider: React.FC<TieredSliderProps> = ({
  id,
  label,
  value,
  min = 0.2,
  max = 0.8,
  step = 0.05,
  tiers = [],
  badgeFormatter,
  onChange,
  disabled = false,
}) => {
  // Determine closest tier for visual active state
  const activeTier = tiers.reduce<TieredSliderTier | null>((closest, tier) => {
    if (!closest) return tier;
    return Math.abs(tier.value - value) < Math.abs(closest.value - value)
      ? tier
      : closest;
  }, null);

  const displayValue = badgeFormatter
    ? badgeFormatter(value)
    : `${Math.round(value * 100)}%`;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <span className={styles.valueText} aria-live="polite">
          {displayValue}
        </span>
      </div>

      <div className={styles.trackWrapper}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={styles.rangeInput}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={displayValue}
        />
      </div>

      {tiers.length > 0 && (
        <div className={styles.tiersRow}>
          {tiers.map((tier) => {
            const isClosest =
              activeTier && Math.abs(activeTier.value - tier.value) < 0.01;
            return (
              <button
                key={`tier-${tier.value}`}
                type="button"
                onClick={() => onChange(tier.value)}
                disabled={disabled}
                className={`${styles.tierBtn} ${isClosest ? styles.tierBtnActive : ''}`}
                title={`Snap to ${tier.label} (${Math.round(tier.value * 100)}%)`}
              >
                <span
                  className={`${styles.tierNotch} ${isClosest ? styles.tierNotchActive : ''}`}
                />
                <span>{tier.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
