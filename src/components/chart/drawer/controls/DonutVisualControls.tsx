import React from 'react';
import styles from '../../ChartConfigDrawer.module.css';

interface DonutVisualControlsProps {
  donutVariant: 'donut' | 'pie';
  setDonutVariant: (val: 'donut' | 'pie') => void;
}

export const DonutVisualControls: React.FC<DonutVisualControlsProps> = ({
  donutVariant,
  setDonutVariant,
}) => {
  return (
    <div className={styles.formGroup}>
      <label className={styles.label} htmlFor="cfg-donut-variant">
        <span>Display Variant</span>
      </label>
      <select
        id="cfg-donut-variant"
        className={styles.select}
        value={donutVariant}
        onChange={(e) => setDonutVariant(e.target.value as 'donut' | 'pie')}
      >
        <option value="donut">Donut Ring</option>
        <option value="pie">Solid Pie</option>
      </select>
    </div>
  );
};
