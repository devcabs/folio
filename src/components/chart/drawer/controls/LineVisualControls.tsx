import React from 'react';
import { Checkbox, FormField, Select } from '../../../ui';
import { AxisBaselineToggle } from './AxisBaselineToggle';
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
        <FormField id="cfg-line-style" label="Line Interpolation">
          <Select
            id="cfg-line-style"
            value={curveInterpolation}
            onChange={(e) => setCurveInterpolation(e.target.value as 'smooth' | 'straight')}
          >
            <option value="smooth">Smooth Curve</option>
            <option value="straight">Straight Lines</option>
          </Select>
        </FormField>

        <FormField id="cfg-marker-size" label="Point Marker Size">
          <Select
            id="cfg-marker-size"
            value={markerSize}
            onChange={(e) => setMarkerSize(e.target.value as 'compact' | 'regular' | 'prominent')}
          >
            <option value="compact">Small</option>
            <option value="regular">Medium</option>
            <option value="prominent">Large</option>
          </Select>
        </FormField>
      </div>

      <Checkbox
        id="cfg-line-area-fill"
        checked={showAreaFill}
        onChange={setShowAreaFill}
        label="Shade area under line"
      />

      <AxisBaselineToggle
        label="Vertical (Y) Axis Baseline"
        startAtZero={startAtZero}
        onChange={(nextStartAtZero) => {
          setStartAtZero(nextStartAtZero);
          setAutoScaleY(!nextStartAtZero);
        }}
      />
    </>
  );
};
