import React from 'react';
import { SegmentedControl } from '../../../ui';
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
  return (
    <div className={styles.formGroup}>
      <span className={styles.label}>{label}</span>
      <SegmentedControl<'auto' | 'zero'>
        value={startAtZero ? 'zero' : 'auto'}
        onChange={(val) => onChange(val === 'zero')}
        aria-label={label}
        size="sm"
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'zero', label: 'Zero' },
        ]}
      />
    </div>
  );
};
