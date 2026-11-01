import React from 'react';
import styles from '../../ChartConfigDrawer.module.css';

interface HistogramVisualControlsProps {
  curveInterpolation: 'smooth' | 'straight' | 'linear' | 'none' | 'polynomial';
  setCurveInterpolation: (val: 'smooth' | 'straight' | 'linear' | 'none' | 'polynomial') => void;
  showReferenceGuide: boolean;
  setShowReferenceGuide: (val: boolean) => void;
  showSummaryStats: boolean;
  setShowSummaryStats: (val: boolean) => void;
  showMedianMode: boolean;
  setShowMedianMode: (val: boolean) => void;
}

export const HistogramVisualControls: React.FC<HistogramVisualControlsProps> = ({
  curveInterpolation,
  setCurveInterpolation,
  showReferenceGuide,
  setShowReferenceGuide,
  showSummaryStats,
  setShowSummaryStats,
  showMedianMode,
  setShowMedianMode,
}) => {
  return (
    <>
      <div className={styles.twoColRow}>
        <div className={styles.formGroup}>
          <label htmlFor="cfg-histogram-curve" className={styles.checkboxLabel}>
            <input
              id="cfg-histogram-curve"
              type="checkbox"
              className={styles.checkbox}
              checked={curveInterpolation === 'smooth'}
              onChange={(e) => setCurveInterpolation(e.target.checked ? 'smooth' : 'none')}
            />
            <span>Overlay Smooth Distribution Curve</span>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="cfg-show-reference-guide" className={styles.checkboxLabel}>
            <input
              id="cfg-show-reference-guide"
              type="checkbox"
              className={styles.checkbox}
              checked={showReferenceGuide}
              onChange={(e) => setShowReferenceGuide(e.target.checked)}
            />
            <span>Show Mean (Average) Reference Line</span>
          </label>
        </div>
      </div>

      <div className={styles.twoColRow}>
        <div className={styles.formGroup}>
          <label htmlFor="cfg-show-summary-stats" className={styles.checkboxLabel}>
            <input
              id="cfg-show-summary-stats"
              type="checkbox"
              className={styles.checkbox}
              checked={showSummaryStats}
              onChange={(e) => setShowSummaryStats(e.target.checked)}
            />
            <span>Show Summary Statistics Card</span>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="cfg-show-median-mode" className={styles.checkboxLabel}>
            <input
              id="cfg-show-median-mode"
              type="checkbox"
              className={styles.checkbox}
              checked={showMedianMode}
              onChange={(e) => setShowMedianMode(e.target.checked)}
            />
            <span>Include Median & Mode</span>
          </label>
        </div>
      </div>
    </>
  );
};
