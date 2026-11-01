import React from 'react';
import type { ChartType } from '../../../../types/chart';
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
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="cfg-title">
          <span>Chart Title</span>
        </label>
        <input
          id="cfg-title"
          type="text"
          className={styles.input}
          placeholder="Leave blank to use default sheet title"
          value={titleOverride}
          onChange={(e) => setTitleOverride(e.target.value)}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="cfg-subtitle">
          <span>Subtitle / Description</span>
        </label>
        <input
          id="cfg-subtitle"
          type="text"
          className={styles.input}
          placeholder="Summary of metrics, timeline, or scope"
          value={subtitleOverride}
          onChange={(e) => setSubtitleOverride(e.target.value)}
        />
      </div>

      {showAxes && setXLabel && setYLabel && (
        <div className={styles.twoColRow}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="cfg-xlabel">
              <span>X-Axis Label (Horizontal)</span>
            </label>
            <input
              id="cfg-xlabel"
              type="text"
              className={styles.input}
              placeholder="e.g. Period, Category"
              value={xLabel}
              onChange={(e) => setXLabel(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="cfg-ylabel">
              <span>Y-Axis Label (Vertical)</span>
            </label>
            <input
              id="cfg-ylabel"
              type="text"
              className={styles.input}
              placeholder="e.g. Enrolled Learners, %"
              value={yLabel}
              onChange={(e) => setYLabel(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};


