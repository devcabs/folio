import React from 'react';
import { Button, Checkbox, FormField, Input } from '../../../ui';
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
        <FormField
          id="cfg-range"
          label="Cell Range"
          hint="e.g. A1:D6, A1:D, or A:D"
          error={!isRangeValid && range ? 'Invalid range notation: use A1:D6, A1:D, or A:D' : undefined}
        >
          <Input
            id="cfg-range"
            type="text"
            invalid={Boolean(!isRangeValid && range)}
            placeholder="A1:D6 or A1:D"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          />
        </FormField>
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

      <Checkbox
        checked={excludeSummaryRows}
        onChange={setExcludeSummaryRows}
        label="Auto-exclude summary rows: Total, Grand Total, Average"
      />

      <Checkbox
        checked={transpose}
        onChange={setTranspose}
        label="Transpose data: Swap rows and columns"
      />

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
