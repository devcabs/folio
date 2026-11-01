import React from 'react';
import styles from './ChartTooltip.module.css';

export interface ChartTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  title?: string;
  seriesName?: string;
  value: number | string | null;
  unit?: string;
  color?: string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  visible,
  x,
  y,
  title,
  seriesName,
  value,
  unit: _unit,
  color,
}) => {
  if (!visible || value === null || value === undefined) {
    return null;
  }

  const formattedValue =
    typeof value === 'number'
      ? Number.isInteger(value)
        ? value.toLocaleString()
        : value.toFixed(1)
      : value;

  return (
    <div
      className={styles.tooltipContainer}
      style={{ left: `${x}px`, top: `${y}px` }}
      role="tooltip"
      aria-hidden={!visible}
    >
      <div className={styles.tooltipCard}>
        {title && <div className={styles.title}>{title}</div>}
        <div className={styles.valueRow}>
          <span className={styles.value}>{formattedValue}</span>
        </div>
        {seriesName && (
          <div className={styles.seriesBadge}>
            {color && (
              <span
                className={styles.seriesDot}
                style={{ backgroundColor: color }}
              />
            )}
            <span>{seriesName}</span>
          </div>
        )}
      </div>
    </div>
  );
};
