import React from 'react';
import { Button } from '../../../ui';
import { RangePreviewMatrix } from '../../RangePreviewMatrix';
import styles from './Step2DataRange.module.css';

interface Step2DataRangeProps {
  range: string;
  setRange: (val: string) => void;
  isRangeValid: boolean;
  executeSync: () => void;
  isSyncing: boolean;
  excludeSummaryRows: boolean;
  setExcludeSummaryRows: (val: boolean) => void;
  transpose: boolean;
  setTranspose: (val: boolean) => void;
  liveMatrix: (string | number | null)[][];
}

export const Step2DataRange: React.FC<Step2DataRangeProps> = ({
  range,
  setRange,
  isRangeValid,
  executeSync,
  isSyncing,
  excludeSummaryRows,
  setExcludeSummaryRows,
  transpose,
  setTranspose,
  liveMatrix,
}) => {
  return (
    <div className={styles.stepPanel}>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="cfg-range">
          <span>Cell Range</span>
          <span className={styles.labelHint}>e.g. A1:D6, A1:D, or A:D</span>
        </label>
        <input
          id="cfg-range"
          type="text"
          className={`${styles.input} ${!isRangeValid && range ? styles.inputError : ''}`}
          placeholder="A1:D6 or A1:D"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        />
        {!isRangeValid && range && (
          <p className={styles.errorText}>Invalid range notation: use A1:D6, A1:D, or A:D</p>
        )}
        <div className={styles.rangeActions}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={executeSync}
            disabled={isSyncing || !isRangeValid}
            aria-label="Sync real-time data from Google Sheet"
          >
            <span
              className={`${styles.syncIcon} ${isSyncing ? styles.spinning : ''}`}
              aria-hidden="true"
            >
              ↻
            </span>
            <span>{isSyncing ? 'Syncing…' : 'Sync'}</span>
          </Button>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={excludeSummaryRows}
            onChange={(e) => setExcludeSummaryRows(e.target.checked)}
          />
          <span>Auto-exclude summary rows: Total, Grand Total, Average</span>
        </label>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={transpose}
            onChange={(e) => setTranspose(e.target.checked)}
          />
          <span>Transpose data: Swap rows and columns</span>
        </label>
      </div>

      <div className={styles.formGroup}>
        <RangePreviewMatrix
          matrix={liveMatrix}
          range={range}
          excludeSummaryRows={excludeSummaryRows}
        />
      </div>
    </div>
  );
};
