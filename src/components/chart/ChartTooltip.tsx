import React from 'react';
import type { ChartTooltipPlacement } from '../../hooks/useChartTooltip';
import styles from './ChartTooltip.module.css';

export interface ChartTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  placement?: ChartTooltipPlacement;
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
  placement = 'above',
  title,
  seriesName,
  value,
  unit,
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

  const trimmedUnit = unit?.trim();
  const formattedStr = String(formattedValue).trim();
  const shouldRenderUnit =
    Boolean(trimmedUnit) && !formattedStr.endsWith(trimmedUnit as string);

  const containerClassName =
    placement === 'below'
      ? `${styles.tooltipContainer} ${styles.placementBelow}`
      : styles.tooltipContainer;

  return (
    <div
      className={containerClassName}
      style={{ left: `${x}px`, top: `${y}px` }}
      role="tooltip"
      data-placement={placement}
      aria-hidden={!visible}
    >
      <div className={styles.tooltipCard}>
        {title && <div className={styles.title}>{title}</div>}
        <div className={styles.valueRow}>
          <span className={styles.value}>{formattedValue}</span>
          {shouldRenderUnit && <span className={styles.unit}>{trimmedUnit}</span>}
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
