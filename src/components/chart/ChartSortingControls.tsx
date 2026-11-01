import React from 'react';
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
      <div className={styles.formGroup}>
        <label htmlFor="cfg-sort-field" className={styles.label}>
          Sort By
        </label>
        <div className={styles.selectWrapper}>
          <select
            id="cfg-sort-field"
            className={styles.select}
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
          </select>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="cfg-sort-dir" className={styles.label}>
          Sort Order
        </label>
        <div className={styles.selectWrapper}>
          <select
            id="cfg-sort-dir"
            className={styles.select}
            value={sortDirection}
            onChange={(e) => onSortDirectionChange(e.target.value as 'asc' | 'desc')}
          >
            <option value="asc">Lowest to Highest</option>
            <option value="desc">Highest to Lowest</option>
          </select>
        </div>
      </div>
    </div>
  );
};
