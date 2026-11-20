import React from 'react';
import { Checkbox } from '../../../ui';
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
        <Checkbox
          id="cfg-histogram-curve"
          checked={curveInterpolation === 'smooth'}
          onChange={(checked) => setCurveInterpolation(checked ? 'smooth' : 'none')}
          label="Overlay Smooth Distribution Curve"
        />

        <Checkbox
          id="cfg-show-reference-guide"
          checked={showReferenceGuide}
          onChange={setShowReferenceGuide}
          label="Show Mean (Average) Reference Line"
        />
      </div>

      <div className={styles.formGroup}>
        <Checkbox
          id="cfg-show-summary-stats"
          checked={showSummaryStats}
          onChange={setShowSummaryStats}
          label="Show Summary Statistics Card"
        />

        {showSummaryStats && (
          <div className={styles.nestedControl}>
            <Checkbox
              id="cfg-show-median-mode"
              checked={showMedianMode}
              onChange={setShowMedianMode}
              label="Include Median & Mode"
            />
          </div>
        )}
      </div>
    </>
  );
};
