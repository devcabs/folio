import React from 'react';
import { TieredSlider } from '../../../ui';
import styles from '../../ChartConfigDrawer.module.css';

interface ScatterVisualControlsProps {
  curveInterpolation: 'smooth' | 'straight' | 'linear' | 'none' | 'polynomial';
  setCurveInterpolation: (val: 'smooth' | 'straight' | 'linear' | 'none' | 'polynomial') => void;
  markerSize: 'compact' | 'regular' | 'prominent';
  setMarkerSize: (val: 'compact' | 'regular' | 'prominent') => void;
  loessBandwidth: number;
  setLoessBandwidth: (val: number) => void;
  showAreaFill: boolean;
  setShowAreaFill: (val: boolean) => void;
  showCorrelationChip: boolean;
  setShowCorrelationChip: (val: boolean) => void;
  showReferenceGuide: boolean;
  setShowReferenceGuide: (val: boolean) => void;
  startAtZero: boolean;
  setStartAtZero: (val: boolean) => void;
  setAutoScaleY: (val: boolean) => void;
  startAtZeroX: boolean;
  setStartAtZeroX: (val: boolean) => void;
  setAutoScaleX: (val: boolean) => void;
}

export const ScatterVisualControls: React.FC<ScatterVisualControlsProps> = ({
  curveInterpolation,
  setCurveInterpolation,
  markerSize,
  setMarkerSize,
  loessBandwidth,
  setLoessBandwidth,
  showAreaFill,
  setShowAreaFill,
  showCorrelationChip,
  setShowCorrelationChip,
  showReferenceGuide,
  setShowReferenceGuide,
  startAtZero,
  setStartAtZero,
  setAutoScaleY,
  startAtZeroX,
  setStartAtZeroX,
  setAutoScaleX,
}) => {
  return (
    <>
      <div className={styles.twoColRow}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="cfg-scatter-trendline">
            <span>Trendline (Regression)</span>
          </label>
          <select
            id="cfg-scatter-trendline"
            className={styles.select}
            value={curveInterpolation}
            onChange={(e) =>
              setCurveInterpolation(
                e.target.value as 'none' | 'linear' | 'smooth' | 'polynomial'
              )
            }
          >
            <option value="none">None (Points Only)</option>
            <option value="linear">Linear Trendline</option>
            <option value="smooth">Smooth LOESS Curve</option>
            <option value="polynomial">Polynomial Curve</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="cfg-scatter-marker-size">
            <span>Point Marker Size</span>
          </label>
          <select
            id="cfg-scatter-marker-size"
            className={styles.select}
            value={markerSize}
            onChange={(e) =>
              setMarkerSize(e.target.value as 'compact' | 'regular' | 'prominent')
            }
          >
            <option value="compact">Small</option>
            <option value="regular">Medium</option>
            <option value="prominent">Large</option>
          </select>
        </div>
      </div>

      {/* Tiered Grab Handle for LOESS Curve Smoothness */}
      {curveInterpolation === 'smooth' && (
        <div>
          <TieredSlider
            id="cfg-loess-bandwidth"
            label="LOESS Curve Smoothness"
            value={loessBandwidth}
            min={0.2}
            max={0.8}
            step={0.05}
            tiers={[
              { value: 0.25, label: 'Responsive', sublabel: 'Local dips and bumps' },
              { value: 0.5, label: 'Balanced', sublabel: 'Editorial balance' },
              { value: 0.75, label: 'Broad', sublabel: 'Sweeping macro trend' },
            ]}
            onChange={(val: number) => setLoessBandwidth(val)}
          />
        </div>
      )}

      <div className={styles.twoColRow}>
        {(curveInterpolation === 'linear' ||
          curveInterpolation === 'smooth' ||
          curveInterpolation === 'polynomial') && (
          <div className={styles.formGroup}>
            <label htmlFor="cfg-scatter-confidence" className={styles.checkboxLabel}>
              <input
                id="cfg-scatter-confidence"
                type="checkbox"
                className={styles.checkbox}
                checked={showAreaFill}
                onChange={(e) => setShowAreaFill(e.target.checked)}
              />
              <span>Show Confidence Band (Shaded)</span>
            </label>
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="cfg-scatter-correlation" className={styles.checkboxLabel}>
            <input
              id="cfg-scatter-correlation"
              type="checkbox"
              className={styles.checkbox}
              checked={showCorrelationChip}
              onChange={(e) => setShowCorrelationChip(e.target.checked)}
            />
            <span>Show Correlation (r) Badge</span>
          </label>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="cfg-scatter-crosshairs" className={styles.checkboxLabel}>
          <input
            id="cfg-scatter-crosshairs"
            type="checkbox"
            className={styles.checkbox}
            checked={showReferenceGuide}
            onChange={(e) => setShowReferenceGuide(e.target.checked)}
          />
          <span>Show Mean Quadrant Crosshairs</span>
        </label>
      </div>

      <div className={styles.twoColRow}>
        <div className={styles.formGroup}>
          <label htmlFor="cfg-scatter-start-at-zero-y" className={styles.checkboxLabel}>
            <input
              id="cfg-scatter-start-at-zero-y"
              type="checkbox"
              className={styles.checkbox}
              checked={startAtZero}
              onChange={(e) => {
                const checked = e.target.checked;
                setStartAtZero(checked);
                setAutoScaleY(!checked);
              }}
            />
            <span>Start Vertical (Y) Axis at Zero</span>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="cfg-scatter-start-at-zero-x" className={styles.checkboxLabel}>
            <input
              id="cfg-scatter-start-at-zero-x"
              type="checkbox"
              className={styles.checkbox}
              checked={startAtZeroX}
              onChange={(e) => {
                const checked = e.target.checked;
                setStartAtZeroX(checked);
                setAutoScaleX(!checked);
              }}
            />
            <span>Start Horizontal (X) Axis at Zero</span>
          </label>
        </div>
      </div>

    </>
  );
};
