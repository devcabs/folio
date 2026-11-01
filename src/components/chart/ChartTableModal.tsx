import React from 'react';
import type { ChartDataset } from '../../types/chart';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import styles from './ChartTableModal.module.css';

export interface ChartTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: ChartDataset;
  title: string;
  asOfDate?: string;
  onDownloadCsv?: () => void;
}

/**
 * ChartTableModal Component
 * Folio Engine — Subtask 7.19
 *
 * Full-scale Large Editorial Modal displaying the pure tabular dataset
 * powering an indicator chart. Gives citizens, teachers, and administrators
 * immediate visual access to public data tables without downloading files.
 *
 * Adheres strictly to Modern Academic Editorial design standards:
 * - Large responsive dialog layout (max-width ~1000px, 85vh max-height)
 * - Sticky table headers and row indices for seamless vertical/horizontal touch scroll
 * - Right-aligned monospace numbers (`var(--font-mono)`)
 * - Universal Zero Outline Policy (`outline: none;`)
 * - Polymorphic support for Bar, Line, Donut, Scatter, and Histogram charts
 */
export const ChartTableModal: React.FC<ChartTableModalProps> = ({
  isOpen,
  onClose,
  dataset,
  title,
  asOfDate,
  onDownloadCsv,
}) => {
  if (!isOpen) return null;

  const isScatter = dataset.chartType === 'scatter' && dataset.scatterPoints && dataset.scatterPoints.length > 0;
  const isHistogram = dataset.chartType === 'histogram' && dataset.bins && dataset.bins.length > 0;
  const hasStandardSeries = Boolean(dataset.categories && dataset.categories.length > 0 && dataset.series && dataset.series.length > 0);

  const renderTableContent = () => {
    // 1. Scatter Plot Table
    if (isScatter && dataset.scatterPoints) {
      const xLabel = dataset.visualConfig?.xLabel || 'X';
      const yLabel = dataset.visualConfig?.yLabel || 'Y';
      const hasGroups = dataset.scatterPoints.some((pt) => Boolean(pt.group));
      const colCount = hasGroups ? 4 : 3;
      const labelWidthPct = hasGroups ? 34 : 40;
      const metricColPct = (100 - labelWidthPct) / (colCount - 1);
      const minTableWidth = 48 + 160 + (colCount - 1) * 130;

      return (
        <table
          className={styles.table}
          style={{ minWidth: `${minTableWidth}px` }}
          aria-label={`Tabular data for ${title}`}
        >
          <colgroup>
            <col style={{ width: '48px' }} />
            <col style={{ width: `${labelWidthPct}%` }} />
            <col style={{ width: `${metricColPct}%` }} />
            <col style={{ width: `${metricColPct}%` }} />
            {hasGroups && <col style={{ width: `${metricColPct}%` }} />}
          </colgroup>
          <thead>
            <tr>
              <th className={`${styles.headerCell} ${styles.indexColHeader}`} scope="col">#</th>
              <th className={styles.headerCell} scope="col">Label</th>
              <th className={`${styles.headerCell} ${styles.headerNumCell}`} scope="col">{xLabel}</th>
              <th className={`${styles.headerCell} ${styles.headerNumCell}`} scope="col">{yLabel}</th>
              {hasGroups && <th className={styles.headerCell} scope="col">Group</th>}
            </tr>
          </thead>
          <tbody>
            {dataset.scatterPoints.map((pt, idx) => (
              <tr key={idx} className={styles.tableRow}>
                <td className={styles.indexCell}>{idx + 1}</td>
                <td className={styles.categoryCell} title={pt.label || ''}>{pt.label || '—'}</td>
                <td className={`${styles.dataCell} ${styles.numCell}`}>
                  {Number.isFinite(pt.x) ? pt.x : '—'}
                </td>
                <td className={`${styles.dataCell} ${styles.numCell}`}>
                  {Number.isFinite(pt.y) ? pt.y : '—'}
                </td>
                {hasGroups && <td className={styles.dataCell}>{pt.group || '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // 2. Histogram Bins Table
    if (isHistogram && dataset.bins) {
      const minTableWidth = 48 + 200 + 150;
      return (
        <table
          className={styles.table}
          style={{ minWidth: `${minTableWidth}px` }}
          aria-label={`Tabular data for ${title}`}
        >
          <colgroup>
            <col style={{ width: '48px' }} />
            <col style={{ width: '55%' }} />
            <col style={{ width: '45%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className={`${styles.headerCell} ${styles.indexColHeader}`} scope="col">#</th>
              <th className={styles.headerCell} scope="col">Range (Bins)</th>
              <th className={`${styles.headerCell} ${styles.headerNumCell}`} scope="col">Frequency Count</th>
            </tr>
          </thead>
          <tbody>
            {dataset.bins.map((bin, idx) => (
              <tr key={idx} className={styles.tableRow}>
                <td className={styles.indexCell}>{idx + 1}</td>
                <td className={styles.categoryCell}>{`${bin.x0} – ${bin.x1}`}</td>
                <td className={`${styles.dataCell} ${styles.numCell}`}>{bin.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // 3. Standard Series Table (Bar, Line, Donut)
    if (hasStandardSeries && dataset.categories && dataset.series) {
      const categories = dataset.categories;
      const series = dataset.series;
      const seriesCount = series.length;

      // Equal width split: Category gets balanced proportional width,
      // and all sibling metric series divide remaining width with exact equality.
      const categoryWidthPct = seriesCount <= 2 ? 34 : seriesCount <= 4 ? 26 : 20;
      const dataColWidthPct = (100 - categoryWidthPct) / seriesCount;
      const minTableWidth = 48 + 160 + seriesCount * 130;

      return (
        <table
          className={styles.table}
          style={{ minWidth: `${minTableWidth}px` }}
          aria-label={`Tabular data for ${title}`}
        >
          <colgroup>
            <col style={{ width: '48px' }} />
            <col style={{ width: `${categoryWidthPct}%` }} />
            {series.map((_, sIdx) => (
              <col key={sIdx} style={{ width: `${dataColWidthPct}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={`${styles.headerCell} ${styles.indexColHeader}`} scope="col">#</th>
              <th className={styles.headerCell} scope="col">Category</th>
              {series.map((s, sIdx) => (
                <th
                  key={sIdx}
                  className={`${styles.headerCell} ${styles.headerNumCell}`}
                  scope="col"
                  title={s.name || `Series ${sIdx + 1}`}
                >
                  {s.name || `Series ${sIdx + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, rIdx) => (
              <tr key={rIdx} className={styles.tableRow}>
                <td className={styles.indexCell}>{rIdx + 1}</td>
                <td className={styles.categoryCell} title={cat || ''}>{cat || '—'}</td>
                {series.map((s, cIdx) => {
                  const val = s.data[rIdx];
                  const hasVal = val !== null && val !== undefined && Number.isFinite(val);
                  return (
                    <td
                      key={cIdx}
                      className={`${styles.dataCell} ${styles.numCell}`}
                    >
                      {hasVal ? (
                        <span>{val}</span>
                      ) : (
                        <span className={styles.nullCell}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // 4. Empty State Fallback
    return (
      <div className={styles.emptyState}>
        <p>No tabular data available for this chart visualization.</p>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      cardClassName={styles.modalCard}
      showCloseButton={false}
      ariaLabel={`Data table for ${title}`}
    >
      {/* Editorial Header */}
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.subtitleRow}>
            {asOfDate && (
              <span className={styles.asOfCaption}>
                As of {asOfDate}
              </span>
            )}
          </div>
        </div>

        <div className={styles.headerActions}>
          {onDownloadCsv && (
            <Button
              variant="secondary"
              size="xs"
              onClick={onDownloadCsv}
              aria-label={`Download CSV data for ${title}`}
            >
              <span>Download Data (CSV)</span>
            </Button>
          )}

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close data table modal"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Responsive Table Body with Sticky Headers */}
      <div className={styles.tableWrapper} tabIndex={-1}>
        {renderTableContent()}
      </div>
    </Modal>
  );
};
