import { useState, useCallback } from 'react';

export interface ChartTooltipState<T = unknown> {
  visible: boolean;
  x: number;
  y: number;
  title?: string;
  seriesName?: string;
  value: number | string | null;
  unit?: string;
  color?: string;
  extra?: T;
}

export interface UseChartTooltipOptions {
  clampX?: [number, number];
  clampY?: [number, number];
}

/**
 * Canonical Tooltip Hook & Boundary Clamping
 * Standardizes tooltip state management and coordinates across all charts.
 */
export function useChartTooltip<T = unknown>(options?: UseChartTooltipOptions) {
  const [tooltipState, setTooltipState] = useState<ChartTooltipState<T>>({
    visible: false,
    x: 0,
    y: 0,
    value: null,
  });

  const showTooltip = useCallback(
    (params: Omit<ChartTooltipState<T>, 'visible'>) => {
      let x = params.x;
      let y = params.y;

      if (options?.clampX) {
        x = Math.max(options.clampX[0], Math.min(options.clampX[1], x));
      }
      if (options?.clampY) {
        y = Math.max(options.clampY[0], Math.min(options.clampY[1], y));
      }

      setTooltipState({
        ...params,
        x,
        y,
        visible: true,
      });
    },
    [options?.clampX, options?.clampY]
  );

  const hideTooltip = useCallback(() => {
    setTooltipState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  return {
    tooltipState,
    setTooltipState,
    showTooltip,
    hideTooltip,
  };
}
