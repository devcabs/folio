import React from 'react';
import type { ChartType } from '../../../../types/chart';
import { FormField, Select } from '../../../ui';
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
        <FormField id="cfg-donut-sort" label="Slice Order">
          <div className={styles.twoColRow}>
            <Select
              id="cfg-donut-sort"
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
            </Select>
            <Select
              id="cfg-donut-sort-dir"
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
            </Select>
          </div>
        </FormField>
      );
    }

    if (chartType === 'scatter') {
      return (
        <FormField id="cfg-scatter-sort" label="Sort Points By">
          <div className={styles.twoColRow}>
            <Select
              id="cfg-scatter-sort"
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
            </Select>
            <Select
              id="cfg-scatter-sort-dir"
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
            </Select>
          </div>
        </FormField>
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

  return <>{content}</>;
};

