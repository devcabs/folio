import React from 'react';
import type { ChartType, ChartDataset } from '../../../../types/chart';
import { ChartRouter } from '../../ChartRouter';
import styles from './Step4Review.module.css';

interface Step4ReviewProps {
  isSyncing: boolean;
  previewDataset: ChartDataset | null;
  chartType: ChartType;
  accentColor: string;
  range: string;
}

export const Step4Review: React.FC<Step4ReviewProps> = ({
  isSyncing,
  previewDataset,
  chartType,
  accentColor,
  range,
}) => {
  return (
    <div className={styles.stepPanel}>
      <div className={styles.previewContainer}>
        {isSyncing && (!previewDataset || (previewDataset.categories?.length || 0) === 0) ? (
          <div className={styles.previewEmptyBox}>
            <span
              className={styles.spinner}
              style={{
                borderColor: 'var(--folio-primary)',
                borderTopColor: 'transparent',
              }}
              aria-hidden="true"
            />
            <span>Loading live chart…</span>
          </div>
        ) : previewDataset &&
          ((previewDataset.categories && previewDataset.categories.length > 0) ||
            (previewDataset.series && previewDataset.series.length > 0) ||
            (previewDataset.scatterPoints && previewDataset.scatterPoints.length > 0)) ? (
          <ChartRouter
            dataset={previewDataset}
            overrideType={chartType}
            accentColor={accentColor}
          />
        ) : (
          <div className={styles.previewEmptyBox}>
            <span>No data points found in range {range}.</span>
            <span>Check the Cell Range in Step 2 to ensure headers and values are captured.</span>
          </div>
        )}
      </div>
    </div>
  );
};
