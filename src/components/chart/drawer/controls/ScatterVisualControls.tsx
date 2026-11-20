import React from 'react';
import { Checkbox, FormField, Select, TieredSlider } from '../../../ui';
import { AxisBaselineToggle } from './AxisBaselineToggle';
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
}) => {
  return (
    <>
      <div className={styles.twoColRow}>
        <FormField id="cfg-scatter-trendline" label="Trendline (Regression)">
          <Select
            id="cfg-scatter-trendline"
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
          </Select>
        </FormField>

        <FormField id="cfg-scatter-marker-size" label="Point Marker Size">
          <Select
            id="cfg-scatter-marker-size"
            value={markerSize}
            onChange={(e) =>
              setMarkerSize(e.target.value as 'compact' | 'regular' | 'prominent')
            }
          >
            <option value="compact">Small</option>
            <option value="regular">Medium</option>
            <option value="prominent">Large</option>
          </Select>
        </FormField>
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
            <Checkbox
              id="cfg-scatter-confidence"
              checked={showAreaFill}
              onChange={setShowAreaFill}
              label="Show Confidence Band (Shaded)"
            />
          )}

        <Checkbox
          id="cfg-scatter-correlation"
          checked={showCorrelationChip}
          onChange={setShowCorrelationChip}
          label="Show Correlation (r) Badge"
        />
      </div>

      <Checkbox
        id="cfg-scatter-crosshairs"
        checked={showReferenceGuide}
        onChange={setShowReferenceGuide}
        label="Show Mean Quadrant Crosshairs"
      />
    </>
  );
};

interface ScatterScaleControlsProps {
  startAtZero: boolean;
  setStartAtZero: (val: boolean) => void;
  setAutoScaleY: (val: boolean) => void;
  startAtZeroX: boolean;
  setStartAtZeroX: (val: boolean) => void;
  setAutoScaleX: (val: boolean) => void;
}

export const ScatterScaleControls: React.FC<ScatterScaleControlsProps> = ({
  startAtZero,
  setStartAtZero,
  setAutoScaleY,
  startAtZeroX,
  setStartAtZeroX,
  setAutoScaleX,
}) => {
  return (
    <div className={styles.twoColRow}>
      <AxisBaselineToggle
        label="Vertical (Y) Axis Baseline"
        startAtZero={startAtZero}
        onChange={(nextStartAtZero) => {
          setStartAtZero(nextStartAtZero);
          setAutoScaleY(!nextStartAtZero);
        }}
      />

      <AxisBaselineToggle
        label="Horizontal (X) Axis Baseline"
        startAtZero={startAtZeroX}
        onChange={(nextStartAtZeroX) => {
          setStartAtZeroX(nextStartAtZeroX);
          setAutoScaleX(!nextStartAtZeroX);
        }}
      />
    </div>
  );
};
