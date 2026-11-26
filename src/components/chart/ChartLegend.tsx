import React, { useState } from 'react';
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
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);

  if (!items || items.length === 0) return null;

  const effectiveActiveIndex =
    activeIndex !== null && activeIndex !== undefined ? activeIndex : pinnedIndex;

  const handleTogglePin = (idx: number) => {
    if (pinnedIndex === idx) {
      setPinnedIndex(null);
      onHover?.(null);
    } else {
      setPinnedIndex(idx);
      onHover?.(idx);
    }
  };

  return (
    <div
      className={`${styles.legend} ${className}`.trim()}
      role="list"
      aria-label="Chart legend"
      onMouseLeave={() => {
        if (pinnedIndex === null) {
          onHover?.(null);
        } else {
          onHover?.(pinnedIndex);
        }
      }}
    >
      {items.map((item, idx) => {
        const isSelected = effectiveActiveIndex !== null && effectiveActiveIndex === idx;
        const isDimmed = effectiveActiveIndex !== null && effectiveActiveIndex !== idx;

        return (
          <button
            key={item.id || idx}
            type="button"
            role="listitem"
            className={`${styles.legendItem} ${isSelected ? styles.active : ''} ${isDimmed ? styles.dimmed : ''}`.trim()}
            onClick={() => handleTogglePin(idx)}
            onMouseEnter={() => {
              if (pinnedIndex === null) onHover?.(idx);
            }}
            onFocus={() => {
              if (pinnedIndex === null) onHover?.(idx);
            }}
            onBlur={() => {
              if (pinnedIndex === null) {
                onHover?.(null);
              } else {
                onHover?.(pinnedIndex);
              }
            }}
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
