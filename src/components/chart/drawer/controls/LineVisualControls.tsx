import React from 'react';
import styles from '../../ChartConfigDrawer.module.css';

interface LineVisualControlsProps {
  curveInterpolation: 'smooth' | 'straight' | 'linear' | 'none' | 'polynomial';
  setCurveInterpolation: (val: 'smooth' | 'straight' | 'linear' | 'none' | 'polynomial') => void;
  markerSize: 'compact' | 'regular' | 'prominent';
  setMarkerSize: (val: 'compact' | 'regular' | 'prominent') => void;
  showAreaFill: boolean;
  setShowAreaFill: (val: boolean) => void;
  startAtZero: boolean;
  setStartAtZero: (val: boolean) => void;
  setAutoScaleY: (val: boolean) => void;
}

export const LineVisualControls: React.FC<LineVisualControlsProps> = ({
  curveInterpolation,
  setCurveInterpolation,
  markerSize,
  setMarkerSize,
  showAreaFill,
  setShowAreaFill,
  startAtZero,
  setStartAtZero,
  setAutoScaleY,
}) => {
  return (
    <>
      <div className={styles.twoColRow}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="cfg-line-style">
            <span>Line Interpolation</span>
          </label>
          <select
            id="cfg-line-style"
            className={styles.select}
            value={curveInterpolation}
            onChange={(e) => setCurveInterpolation(e.target.value as 'smooth' | 'straight')}
          >
            <option value="smooth">Smooth Curve</option>
            <option value="straight">Straight Lines</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="cfg-marker-size">
            <span>Point Marker Size</span>
          </label>
          <select
            id="cfg-marker-size"
            className={styles.select}
            value={markerSize}
            onChange={(e) => setMarkerSize(e.target.value as 'compact' | 'regular' | 'prominent')}
          >
            <option value="compact">Small</option>
            <option value="regular">Medium</option>
            <option value="prominent">Large</option>
          </select>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="cfg-line-area-fill" className={styles.checkboxLabel}>
          <input
            id="cfg-line-area-fill"
            type="checkbox"
            className={styles.checkbox}
            checked={showAreaFill}
            onChange={(e) => setShowAreaFill(e.target.checked)}
          />
          <span>Shade area under line</span>
        </label>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="cfg-line-start-at-zero" className={styles.checkboxLabel}>
          <input
            id="cfg-line-start-at-zero"
            type="checkbox"
            className={styles.checkbox}
            checked={startAtZero}
            onChange={(e) => {
              const checked = e.target.checked;
              setStartAtZero(checked);
              setAutoScaleY(!checked);
            }}
          />
          <span>Start vertical axis at zero</span>
        </label>
      </div>
    </>
  );
};
