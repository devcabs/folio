import React from 'react';
import type { ChartType } from '../../../../types/chart';
import {
  ColumnSelect,
  DraggableRows,
  AccordionSection,
} from '../../../ui';
import { resolveUniqueChartColors } from '../../../../utils/chartColors';
import { indexToColLetter } from '../../../../utils/chartSanitizer';
import styles from '../../ChartConfigDrawer.module.css';

interface ColumnItem {
  index: number;
  label: string;
}

interface StandardDataControlsProps {
  chartType: ChartType;
  categoryColIndex: number;
  setCategoryColIndex: (val: number) => void;
  detectedColumns: Array<{ index: number; label: string }>;
  includedSeriesIndices: number[] | undefined;
  setIncludedSeriesIndices: (val: number[] | undefined) => void;
  binStrategy: 'auto' | 'custom';
  setBinStrategy: (val: 'auto' | 'custom') => void;
  customBinMode: 'step' | 'count';
  setCustomBinMode: (val: 'step' | 'count') => void;
  bucketSize: number | '';
  setBucketSize: (val: number | '') => void;
  binCount: number | '';
  setBinCount: (val: number | '') => void;
  histogramYMode: 'frequency' | 'relative';
  setHistogramYMode: (val: 'frequency' | 'relative') => void;
  groupOthers: boolean;
  setGroupOthers: (val: boolean) => void;
  sortField: string;
  setSortField: (val: string) => void;
  accentColor: string;
  handleToggleSeries: (colIdx: number) => void;
}

export const StandardDataControls: React.FC<StandardDataControlsProps> = ({
  chartType,
  categoryColIndex,
  setCategoryColIndex,
  detectedColumns,
  includedSeriesIndices,
  setIncludedSeriesIndices,
  binStrategy,
  setBinStrategy,
  customBinMode,
  setCustomBinMode,
  bucketSize,
  setBucketSize,
  binCount,
  setBinCount,
  histogramYMode,
  setHistogramYMode,
  groupOthers,
  setGroupOthers,
  sortField,
  setSortField,
  accentColor,
  handleToggleSeries,
}) => {
  return (
    <>
      <AccordionSection
        name="chart-data"
        title={
          chartType === 'line'
            ? 'Category / Date (X-Axis)'
            : chartType === 'donut'
            ? 'Slice Categories'
            : chartType === 'histogram'
            ? 'Values to Group (X-Axis)'
            : 'Category (X-Axis)'
        }
        defaultOpen={true}
      >
        <ColumnSelect
          id="cfg-category-col"
          label="Source Column"
          value={categoryColIndex}
          onChange={(newCat: number) => {
            setCategoryColIndex(newCat);
            if (chartType === 'donut') {
              const remaining = detectedColumns.filter((c) => c.index !== newCat);
              if (includedSeriesIndices?.includes(newCat)) {
                setIncludedSeriesIndices(remaining.length > 0 ? [remaining[0].index] : []);
              }
            } else if (includedSeriesIndices?.includes(newCat)) {
              setIncludedSeriesIndices(includedSeriesIndices.filter((i) => i !== newCat));
            }
          }}
          columns={detectedColumns.map((c) => ({
            index: c.index,
            label: c.label,
            type: chartType === 'histogram' ? 'number' : 'text',
          }))}
        />
      </AccordionSection>

      {chartType === 'histogram' && (
        <AccordionSection name="chart-data" title="Binning & Distribution" defaultOpen={false}>
          {binStrategy === 'custom' ? (
            <div className={styles.twoColRow}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="cfg-bin-strategy">
                  <span>Grouping Method</span>
                </label>
                <select
                  id="cfg-bin-strategy"
                  className={styles.select}
                  value={binStrategy}
                  onChange={(e) => setBinStrategy(e.target.value as 'auto' | 'custom')}
                >
                  <option value="auto">Automatic Best Fit</option>
                  <option value="custom">Custom Ranges</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="cfg-custom-bin-mode">
                  <span>Custom Range By</span>
                </label>
                <select
                  id="cfg-custom-bin-mode"
                  className={styles.select}
                  value={customBinMode}
                  onChange={(e) => setCustomBinMode(e.target.value as 'step' | 'count')}
                >
                  <option value="step">Range Size</option>
                  <option value="count">Number of Groups</option>
                </select>
              </div>
            </div>
          ) : (
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cfg-bin-strategy">
                <span>Grouping Method</span>
              </label>
              <select
                id="cfg-bin-strategy"
                className={styles.select}
                value={binStrategy}
                onChange={(e) => setBinStrategy(e.target.value as 'auto' | 'custom')}
              >
                <option value="auto">Automatic Best Fit</option>
                <option value="custom">Custom Ranges</option>
              </select>
            </div>
          )}

          {binStrategy === 'custom' && (
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor={customBinMode === 'step' ? 'cfg-bucket-size' : 'cfg-bin-count'}>
                <span>{customBinMode === 'step' ? 'Range Size' : 'Number of Groups'}</span>
              </label>
              {customBinMode === 'step' ? (
                <input
                  id="cfg-bucket-size"
                  type="number"
                  className={styles.input}
                  min={1}
                  step={1}
                  value={bucketSize}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setBucketSize('');
                    } else {
                      const parsed = parseInt(val, 10);
                      setBucketSize(isNaN(parsed) ? '' : parsed);
                    }
                  }}
                  onBlur={() => {
                    if (bucketSize === '' || bucketSize < 1) {
                      setBucketSize(1);
                    }
                  }}
                />
              ) : (
                <input
                  id="cfg-bin-count"
                  type="number"
                  className={styles.input}
                  min={2}
                  max={50}
                  step={1}
                  value={binCount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setBinCount('');
                    } else {
                      const parsed = parseInt(val, 10);
                      setBinCount(isNaN(parsed) ? '' : parsed);
                    }
                  }}
                  onBlur={() => {
                    if (binCount === '' || binCount < 2) {
                      setBinCount(2);
                    } else if (binCount > 50) {
                      setBinCount(50);
                    }
                  }}
                />
              )}
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="cfg-histogram-ymode" className={styles.checkboxLabel}>
              <input
                id="cfg-histogram-ymode"
                type="checkbox"
                className={styles.checkbox}
                checked={histogramYMode === 'relative'}
                onChange={(e) => setHistogramYMode(e.target.checked ? 'relative' : 'frequency')}
              />
              <span>Show as Percentage instead of Count</span>
            </label>
          </div>
        </AccordionSection>
      )}

      {chartType === 'donut' ? (
        <AccordionSection name="chart-data" title="Slice Values" defaultOpen={false}>
          <ColumnSelect
            id="cfg-donut-metric-col"
            label="Slice Values (Metric)"
            value={
              (includedSeriesIndices && includedSeriesIndices.length > 0)
                ? includedSeriesIndices[0]
                : (detectedColumns.find((c) => c.index !== categoryColIndex)?.index ?? 1)
            }
            onChange={(newMetric: number) => {
              setIncludedSeriesIndices([newMetric]);
              const targetCol = detectedColumns.find((c) => c.index === newMetric);
              if (targetCol && sortField !== 'sheet' && sortField !== 'category') {
                setSortField(targetCol.label);
              }
            }}
            columns={detectedColumns
              .filter((c) => c.index !== categoryColIndex)
              .map((c) => ({
                index: c.index,
                label: c.label,
                type: 'number',
              }))}
          />

          <div className={styles.formGroup}>
            <label htmlFor="cfg-group-others" className={styles.checkboxLabel}>
              <input
                id="cfg-group-others"
                type="checkbox"
                className={styles.checkbox}
                checked={groupOthers}
                onChange={(e) => setGroupOthers(e.target.checked)}
              />
              <span>Group smaller slices into 'Other' (Top 5)</span>
            </label>
          </div>
        </AccordionSection>
      ) : (
        detectedColumns.filter((c) => c.index !== categoryColIndex).length > 0 && (() => {
          const candidateColumns = detectedColumns.filter((c) => c.index !== categoryColIndex);
          const defaultIncluded = candidateColumns.map((c) => c.index);
          const activeIncluded = includedSeriesIndices ?? defaultIncluded;

          const orderedCandidates = [...candidateColumns].sort((a, b) => {
            const aIdx = activeIncluded.indexOf(a.index);
            const bIdx = activeIncluded.indexOf(b.index);
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
            if (aIdx !== -1) return -1;
            if (bIdx !== -1) return 1;
            return a.index - b.index;
          });

          const candidateColors = resolveUniqueChartColors({
            count: candidateColumns.length,
            accentColor,
            tierMode: 'bright',
          });

          return (
            <AccordionSection
              name="chart-data"
              title={chartType === 'histogram' ? 'Subgroup Frequencies' : 'Metric Series (Y-Axis)'}
              defaultOpen={false}
              badge={
                <span className={styles.seriesCountBadge}>
                  {activeIncluded.length} / {candidateColumns.length}
                </span>
              }
            >
              <div className={styles.formGroup}>
                <DraggableRows<ColumnItem>
                  items={orderedCandidates}
                  keyExtractor={(col: ColumnItem) => col.index}
                  showMicroArrows={false}
                  onReorder={(reordered: ColumnItem[]) => {
                    const newIncluded = reordered
                      .filter((c: ColumnItem) => activeIncluded.includes(c.index))
                      .map((c: ColumnItem) => c.index);
                    setIncludedSeriesIndices(newIncluded);
                  }}
                  renderItem={(col: ColumnItem, meta: { index: number }) => {
                    const isChecked = activeIncluded.includes(col.index);
                    const color = candidateColors[meta.index] || 'var(--folio-primary)';

                    return (
                      <label className={styles.draggableRowLabel}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={isChecked}
                          onChange={() => handleToggleSeries(col.index)}
                        />
                        <span className={styles.seriesSwatch} style={{ backgroundColor: color }} />
                        <span className={styles.draggableRowText}>
                          {col.label}{' '}
                          <span className={styles.draggableColLetter}>
                            [{indexToColLetter(col.index)}]
                          </span>
                        </span>
                      </label>
                    );
                  }}
                />
              </div>
            </AccordionSection>
          );
        })()
      )}
    </>
  );

};


