import React from 'react';
import type { ChartType } from '../../../../types/chart';
import { FormField, Input } from '../../../ui';
import styles from '../../ChartConfigDrawer.module.css';

interface ChartTitlesSectionProps {
  titleOverride: string;
  setTitleOverride: (val: string) => void;
  subtitleOverride: string;
  setSubtitleOverride: (val: string) => void;
  xLabel?: string;
  setXLabel?: (val: string) => void;
  yLabel?: string;
  setYLabel?: (val: string) => void;
  chartType?: ChartType;
}

export const ChartTitlesSection: React.FC<ChartTitlesSectionProps> = ({
  titleOverride,
  setTitleOverride,
  subtitleOverride,
  setSubtitleOverride,
  xLabel = '',
  setXLabel,
  yLabel = '',
  setYLabel,
  chartType,
}) => {
  const showAxes = chartType !== 'donut';

  return (
    <div className={styles.titlesSection}>
      <FormField id="cfg-title" label="Chart Title">
        <Input
          id="cfg-title"
          type="text"
          placeholder="Leave blank to use default sheet title"
          value={titleOverride}
          onChange={(e) => setTitleOverride(e.target.value)}
        />
      </FormField>

      <FormField id="cfg-subtitle" label="Subtitle / Description">
        <Input
          id="cfg-subtitle"
          type="text"
          placeholder="Summary of metrics, timeline, or scope"
          value={subtitleOverride}
          onChange={(e) => setSubtitleOverride(e.target.value)}
        />
      </FormField>

      {showAxes && setXLabel && setYLabel && (
        <div className={styles.twoColRow}>
          <FormField id="cfg-xlabel" label="X-Axis Label (Horizontal)">
            <Input
              id="cfg-xlabel"
              type="text"
              placeholder="e.g. Period, Category"
              value={xLabel}
              onChange={(e) => setXLabel(e.target.value)}
            />
          </FormField>

          <FormField id="cfg-ylabel" label="Y-Axis Label (Vertical)">
            <Input
              id="cfg-ylabel"
              type="text"
              placeholder="e.g. Enrolled Learners, %"
              value={yLabel}
              onChange={(e) => setYLabel(e.target.value)}
            />
          </FormField>
        </div>
      )}
    </div>
  );
};


