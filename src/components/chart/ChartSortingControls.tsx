import React from 'react';
import { FormField, Select } from '../ui';
import styles from './ChartSortingControls.module.css';

export interface ChartSortingSeriesOption {
  id: string;
  name: string;
}

export interface ChartSortingControlsProps {
  sortField: string;
  sortDirection: 'asc' | 'desc';
  categoryLabel?: string;
  seriesOptions?: ChartSortingSeriesOption[];
  onSortFieldChange: (field: string) => void;
  onSortDirectionChange: (direction: 'asc' | 'desc') => void;
  className?: string;
}

export const ChartSortingControls: React.FC<ChartSortingControlsProps> = ({
  sortField,
  sortDirection,
  categoryLabel = 'Category Name',
  seriesOptions = [],
  onSortFieldChange,
  onSortDirectionChange,
  className = '',
}) => {
  return (
    <div className={`${styles.sortingGrid} ${className}`.trim()}>
      <FormField id="cfg-sort-field" label="Sort By">
        <Select
          id="cfg-sort-field"
          value={sortField}
          onChange={(e) => onSortFieldChange(e.target.value)}
        >
          <option value="sheet">Original Sheet Order</option>
          <option value="category">{categoryLabel}</option>
          {seriesOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField id="cfg-sort-dir" label="Sort Order">
        <Select
          id="cfg-sort-dir"
          value={sortDirection}
          onChange={(e) => onSortDirectionChange(e.target.value as 'asc' | 'desc')}
        >
          <option value="asc">Lowest to Highest</option>
          <option value="desc">Highest to Lowest</option>
        </Select>
      </FormField>
    </div>
  );
};
