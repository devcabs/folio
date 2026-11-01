import React from 'react';
import styles from './ChartLegend.module.css';

export const CHART_DIMMED_OPACITY = 0.15;

export interface ChartLegendItem {
  id: string;
  name: string;
  color: string;
}

export interface ChartLegendProps {
  items: ChartLegendItem[];
  activeIndex?: number | null;
  onHover?: (index: number | null) => void;
  className?: string;
}

export const ChartLegend: React.FC<ChartLegendProps> = ({
  items,
  activeIndex = null,
  onHover,
  className = '',
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div
      className={`${styles.legend} ${className}`.trim()}
      role="list"
      aria-label="Chart legend"
      onMouseLeave={() => onHover?.(null)}
    >
      {items.map((item, idx) => {
        const isSelected = activeIndex !== null && activeIndex === idx;
        const isDimmed = activeIndex !== null && activeIndex !== idx;

        return (
          <button
            key={item.id || idx}
            type="button"
            role="listitem"
            className={`${styles.legendItem} ${isSelected ? styles.active : ''} ${isDimmed ? styles.dimmed : ''}`.trim()}
            onMouseEnter={() => onHover?.(idx)}
            onFocus={() => onHover?.(idx)}
            onBlur={() => onHover?.(null)}
            aria-pressed={isSelected}
          >
            <span
              className={styles.swatch}
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span>{item.name}</span>
          </button>
        );
      })}
    </div>
  );
};
