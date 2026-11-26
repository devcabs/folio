import { useEffect, useRef, useState, type RefObject } from 'react';

export interface UseChartContainerWidthOptions<T extends HTMLElement = HTMLDivElement> {
  /** Fallback width when ResizeObserver is unavailable or element width is 0 (SSR / happy-dom). */
  defaultWidth?: number;
  /** Viewport/container width threshold below which compact mobile layout applies. */
  compactBreakpoint?: number;
  /** Optional external ref to observe instead of creating a new internal ref. */
  ref?: RefObject<T | null>;
}

export interface UseChartContainerWidthResult<T extends HTMLElement = HTMLDivElement> {
  containerRef: RefObject<T | null>;
  width: number;
  isCompact: boolean;
}

const DEFAULT_CHART_WIDTH = 800;
const COMPACT_BREAKPOINT_PX = 480;

/**
 * Measures a chart container's CSS width via ResizeObserver so SVG viewBox
 * coordinates can track rendered pixels 1:1 on mobile viewports.
 * Falls back gracefully in SSR / Node / happy-dom environments.
 */
export function useChartContainerWidth<T extends HTMLElement = HTMLDivElement>(
  options: UseChartContainerWidthOptions<T> = {}
): UseChartContainerWidthResult<T> {
  const defaultWidth = options.defaultWidth ?? DEFAULT_CHART_WIDTH;
  const compactBreakpoint = options.compactBreakpoint ?? COMPACT_BREAKPOINT_PX;

  const internalRef = useRef<T | null>(null);
  const containerRef = options.ref ?? internalRef;

  const [width, setWidth] = useState<number>(defaultWidth);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const applyWidth = (rawWidth: number) => {
      const rounded = Math.round(rawWidth);
      if (rounded <= 0) return;
      setWidth((prev) => (prev === rounded ? prev : rounded));
    };

    if (typeof element.getBoundingClientRect === 'function') {
      const initialWidth = element.getBoundingClientRect().width;
      if (initialWidth > 0) {
        applyWidth(initialWidth);
      }
    }

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const measured =
          entry.contentRect?.width ??
          (typeof element.getBoundingClientRect === 'function'
            ? element.getBoundingClientRect().width
            : 0);
        applyWidth(measured);
      }
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [containerRef]);

  return {
    containerRef,
    width,
    isCompact: width > 0 && width < compactBreakpoint,
  };
}
