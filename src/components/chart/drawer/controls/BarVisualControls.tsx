import React from 'react';
import styles from '../../ChartConfigDrawer.module.css';

interface BarVisualControlsProps {
  barOrientation: 'vertical' | 'horizontal';
  setBarOrientation: (val: 'vertical' | 'horizontal') => void;
  stacked: boolean;
  setStacked: (val: boolean) => void;
}

export const BarVisualControls: React.FC<BarVisualControlsProps> = ({
  barOrientation,
  setBarOrientation,
  stacked,
  setStacked,
}) => {
  return (
    <div className={styles.twoColRow}>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="cfg-orientation">
          <span>Orientation</span>
        </label>
        <select
          id="cfg-orientation"
          className={styles.select}
          value={barOrientation}
          onChange={(e) => setBarOrientation(e.target.value as 'vertical' | 'horizontal')}
        >
          <option value="vertical">Vertical Columns</option>
          <option value="horizontal">Horizontal Bars</option>
        </select>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="cfg-series-mode">
          <span>Grouping Mode</span>
        </label>
        <select
          id="cfg-series-mode"
          className={styles.select}
          value={stacked ? 'stacked' : 'clustered'}
          onChange={(e) => setStacked(e.target.value === 'stacked')}
        >
          <option value="clustered">Clustered (Side by Side)</option>
          <option value="stacked">Stacked</option>
        </select>
      </div>
    </div>
  );
};
