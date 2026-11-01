import React from 'react';
import type { ChartType } from '../../../../types/chart';
import { ChartSortingControls } from '../../ChartSortingControls';
import { indexToColLetter } from '../../../../utils/chartSanitizer';
import styles from '../../ChartConfigDrawer.module.css';

interface SortingAndOrderControlsProps {
  chartType: ChartType;
  sortBy: 'none' | 'asc' | 'desc' | 'category-asc' | 'category-desc';
  setSortBy: (val: 'none' | 'asc' | 'desc' | 'category-asc' | 'category-desc') => void;
  sortField: string;
  setSortField: (val: string) => void;
  sortDirection: 'asc' | 'desc';
  setSortDirection: (val: 'asc' | 'desc') => void;
  categoryColIndex: number;
  detectedColumns: Array<{ index: number; label: string }>;
}

export const SortingAndOrderControls: React.FC<SortingAndOrderControlsProps> = ({
  chartType,
  sortBy,
  setSortBy,
  sortField,
  setSortField,
  sortDirection,
  setSortDirection,
  categoryColIndex,
  detectedColumns,
}) => {
  const content = (() => {
    if (chartType === 'donut') {
      return (
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="cfg-donut-sort">
            <span>Slice Order</span>
          </label>
          <div className={styles.twoColRow}>
            <select
              id="cfg-donut-sort"
              className={styles.select}
              value={sortBy === 'none' ? 'sheet' : 'value'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'sheet') {
                  setSortBy('none');
                  setSortField('sheet');
                } else {
                  setSortBy(sortDirection === 'desc' ? 'desc' : 'asc');
                  setSortField('value');
                }
              }}
            >
              <option value="value">Largest Slices First (Clockwise)</option>
              <option value="sheet">Original Sheet Order</option>
            </select>
            <select
              id="cfg-donut-sort-dir"
              className={styles.select}
              value={sortDirection}
              onChange={(e) => {
                const val = e.target.value as 'asc' | 'desc';
                setSortDirection(val);
                if (sortBy !== 'none') {
                  setSortBy(val === 'desc' ? 'desc' : 'asc');
                }
              }}
              disabled={sortBy === 'none'}
            >
              <option value="desc">Highest to Lowest</option>
              <option value="asc">Lowest to Highest</option>
            </select>
          </div>
        </div>
      );
    }

    if (chartType === 'scatter') {
      return (
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="cfg-scatter-sort">
            <span>Sort Points By</span>
          </label>
          <div className={styles.twoColRow}>
            <select
              id="cfg-scatter-sort"
              className={styles.select}
              value={sortField}
              onChange={(e) => {
                const val = e.target.value;
                setSortField(val);
                if (val === 'sheet') {
                  setSortBy('none');
                } else {
                  setSortBy(sortDirection === 'desc' ? 'desc' : 'asc');
                }
              }}
            >
              <option value="sheet">Original Sheet Order</option>
              <option value="x">Horizontal Axis (X)</option>
              <option value="y">Vertical Axis (Y)</option>
            </select>
            <select
              id="cfg-scatter-sort-dir"
              className={styles.select}
              value={sortDirection}
              onChange={(e) => {
                const val = e.target.value as 'asc' | 'desc';
                setSortDirection(val);
                if (sortField !== 'sheet') {
                  setSortBy(val === 'desc' ? 'desc' : 'asc');
                }
              }}
              disabled={sortField === 'sheet'}
            >
              <option value="asc">Lowest to Highest</option>
              <option value="desc">Highest to Lowest</option>
            </select>
          </div>
        </div>
      );
    }

    return (
      <ChartSortingControls
        sortField={sortField}
        sortDirection={sortDirection}
        categoryLabel={chartType === 'histogram' ? 'Range Interval' : 'Category Name'}
        seriesOptions={
          chartType === 'histogram'
            ? [{ id: 'frequency', name: 'Group Count' }]
            : detectedColumns
                .filter((c) => c.index !== categoryColIndex)
                .map((col) => ({
                  id: col.label,
                  name: `${col.label} [${indexToColLetter(col.index)}]`,
                }))
        }
        onSortFieldChange={(newField: string) => {
          setSortField(newField);
          if (newField === 'category') {
            setSortBy(sortDirection === 'desc' ? 'category-desc' : 'category-asc');
          } else if (newField === 'sheet_order' || newField === 'sheet') {
            setSortBy('none');
          } else {
            setSortBy(sortDirection === 'desc' ? 'desc' : 'asc');
          }
        }}
        onSortDirectionChange={(newDir: 'asc' | 'desc') => {
          setSortDirection(newDir);
          if (sortField === 'category') {
            setSortBy(newDir === 'desc' ? 'category-desc' : 'category-asc');
          } else if (sortField === 'sheet_order' || sortField === 'sheet') {
            setSortBy('none');
          } else {
            setSortBy(newDir === 'desc' ? 'desc' : 'asc');
          }
        }}
      />
    );
  })();

  return (
    <div className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionEyebrow}>Data Order & Direction</span>
      </div>
      {content}
    </div>
  );
};

