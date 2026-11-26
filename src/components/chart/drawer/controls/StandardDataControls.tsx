import React from 'react';
import type { ChartType } from '../../../../types/chart';
import {
  Button,
  Checkbox,
  ColumnSelect,
  DraggableRows,
  AccordionSection,
  FormField,
  Input,
  SegmentedControl,
  Select,
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
        <AccordionSection title="Binning & Distribution" defaultOpen={true}>
          {binStrategy === 'custom' ? (
            <div className={styles.twoColRow}>
              <FormField id="cfg-bin-strategy" label="Grouping Method">
                <Select
                  id="cfg-bin-strategy"
                  value={binStrategy}
                  onChange={(e) => setBinStrategy(e.target.value as 'auto' | 'custom')}
                >
                  <option value="auto">Automatic Best Fit</option>
                  <option value="custom">Custom Ranges</option>
                </Select>
              </FormField>

              <FormField id="cfg-custom-bin-mode" label="Custom Range By">
                <Select
                  id="cfg-custom-bin-mode"
                  value={customBinMode}
                  onChange={(e) => setCustomBinMode(e.target.value as 'step' | 'count')}
                >
                  <option value="step">Range Size</option>
                  <option value="count">Number of Groups</option>
                </Select>
              </FormField>
            </div>
          ) : (
            <FormField id="cfg-bin-strategy" label="Grouping Method">
              <Select
                id="cfg-bin-strategy"
                value={binStrategy}
                onChange={(e) => setBinStrategy(e.target.value as 'auto' | 'custom')}
              >
                <option value="auto">Automatic Best Fit</option>
                <option value="custom">Custom Ranges</option>
              </Select>
            </FormField>
          )}

          {binStrategy === 'custom' && (
            <FormField
              id={customBinMode === 'step' ? 'cfg-bucket-size' : 'cfg-bin-count'}
              label={customBinMode === 'step' ? 'Range Size' : 'Number of Groups'}
            >
              {customBinMode === 'step' ? (
                <Input
                  id="cfg-bucket-size"
                  type="number"
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
                <Input
                  id="cfg-bin-count"
                  type="number"
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
            </FormField>
          )}

          <div className={styles.formGroup}>
            <span className={styles.label}>Display Values As</span>
            <SegmentedControl<'frequency' | 'relative'>
              value={histogramYMode}
              onChange={setHistogramYMode}
              aria-label="Display Values As"
              size="sm"
              options={[
                { value: 'frequency', label: 'Count' },
                { value: 'relative', label: 'Percentage' },
              ]}
            />
          </div>
        </AccordionSection>
      )}

      {chartType === 'donut' ? (
        <AccordionSection title="Slice Values" defaultOpen={false}>
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

          <Checkbox
            id="cfg-group-others"
            checked={groupOthers}
            onChange={setGroupOthers}
            label="Group smaller slices into 'Other' (Top 5)"
          />
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
              title={chartType === 'histogram' ? 'Subgroup Frequencies' : 'Metric Series (Y-Axis)'}
              defaultOpen={false}
              badge={
                <span className={styles.seriesCountBadge}>
                  {activeIncluded.length} / {candidateColumns.length}
                </span>
              }
            >
              <div className={styles.formGroup}>
                {candidateColumns.length > 1 && (
                  <div className={styles.seriesActionsRow}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      className={styles.quickActionBtn}
                      disabled={activeIncluded.length === candidateColumns.length}
                      onClick={() => setIncludedSeriesIndices(candidateColumns.map((c) => c.index))}
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      className={styles.quickActionBtn}
                      disabled={
                        activeIncluded.length === 1 &&
                        activeIncluded[0] === candidateColumns[0].index
                      }
                      onClick={() => setIncludedSeriesIndices([candidateColumns[0].index])}
                    >
                      First
                    </Button>
                  </div>
                )}
                <DraggableRows<ColumnItem>
                  items={orderedCandidates}
                  keyExtractor={(col: ColumnItem) => col.index}
                  showMicroArrows={true}
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
                      <Checkbox
                        checked={isChecked}
                        onChange={() => handleToggleSeries(col.index)}
                        aria-label={col.label}
                        className={styles.draggableRowLabel}
                        label={
                          <span className={styles.draggableRowContent}>
                            <span className={styles.seriesSwatch} style={{ backgroundColor: color }} />
                            <span className={styles.draggableRowText}>
                              {col.label}{' '}
                              <span className={styles.draggableColLetter}>
                                [{indexToColLetter(col.index)}]
                              </span>
                            </span>
                          </span>
                        }
                      />
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


