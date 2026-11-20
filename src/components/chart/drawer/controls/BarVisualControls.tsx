import React from 'react';
import { FormField, Select } from '../../../ui';
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
      <FormField id="cfg-orientation" label="Orientation">
        <Select
          id="cfg-orientation"
          value={barOrientation}
          onChange={(e) => setBarOrientation(e.target.value as 'vertical' | 'horizontal')}
        >
          <option value="vertical">Vertical Columns</option>
          <option value="horizontal">Horizontal Bars</option>
        </Select>
      </FormField>

      <FormField id="cfg-series-mode" label="Grouping Mode">
        <Select
          id="cfg-series-mode"
          value={stacked ? 'stacked' : 'clustered'}
          onChange={(e) => setStacked(e.target.value === 'stacked')}
        >
          <option value="clustered">Clustered (Side by Side)</option>
          <option value="stacked">Stacked</option>
        </Select>
      </FormField>
    </div>
  );
};
