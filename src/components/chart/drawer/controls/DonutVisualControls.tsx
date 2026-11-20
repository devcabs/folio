import React from 'react';
import { FormField, Select } from '../../../ui';

interface DonutVisualControlsProps {
  donutVariant: 'donut' | 'pie';
  setDonutVariant: (val: 'donut' | 'pie') => void;
}

export const DonutVisualControls: React.FC<DonutVisualControlsProps> = ({
  donutVariant,
  setDonutVariant,
}) => {
  return (
    <FormField id="cfg-donut-variant" label="Display Variant">
      <Select
        id="cfg-donut-variant"
        value={donutVariant}
        onChange={(e) => setDonutVariant(e.target.value as 'donut' | 'pie')}
      >
        <option value="donut">Donut Ring</option>
        <option value="pie">Solid Pie</option>
      </Select>
    </FormField>
  );
};
