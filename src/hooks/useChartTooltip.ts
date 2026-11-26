import { useState, useCallback, useEffect, useRef, type RefObject } from 'react';
import type React from 'react';

export type ChartTooltipPlacement = 'above' | 'below';

export interface ChartTooltipState<T = unknown> {
  visible: boolean;
  x: number;
  y: number;
  placement: ChartTooltipPlacement;
  pinned: boolean;
  pinKey?: string | number;
  title?: string;
  seriesName?: string;
  value: number | string | null;
  unit?: string;
  color?: string;
  extra?: T;
}

export type ShowChartTooltipParams<T = unknown> = Omit<
  ChartTooltipState<T>,
  'visible' | 'placement' | 'pinned'
> & {
  placement?: ChartTooltipPlacement;
  pinned?: boolean;
};

export interface UseChartTooltipOptions {
  containerRef?: RefObject<HTMLElement | null>;
  containerWidth?: number;
  containerHeight?: number;
  tooltipWidth?: number;
  tooltipHeight?: number;
  edgePadding?: number;
  clampX?: [number, number];
  clampY?: [number, number];
  onDismiss?: () => void;
}

const DEFAULT_TOOLTIP_WIDTH = 220;
const DEFAULT_TOOLTIP_HEIGHT = 76;
const DEFAULT_EDGE_PADDING = 8;

/**
 * Projects raw SVG viewBox coordinates `(svgX, svgY)` into container-relative
 * CSS pixel coordinates `(x, y)` using `getBoundingClientRect()` and `viewBox`.
 */
export function projectSvgToContainer(
  svgElement: SVGSVGElement | null,
  containerElement: HTMLElement | null,
  svgX: number,
  svgY: number
): { x: number; y: number } {
  if (!svgElement || !containerElement) {
    return { x: svgX, y: svgY };
  }

  const svgRect = svgElement.getBoundingClientRect();
  const containerRect = containerElement.getBoundingClientRect();
  const viewBoxAttr = svgElement.getAttribute('viewBox') || '';
  const parts = viewBoxAttr.trim().split(/\s+/).map(Number);

  const offsetX = svgRect.left - containerRect.left;
  const offsetY = svgRect.top - containerRect.top;

  if (
    parts.length === 4 &&
    parts.every((n) => Number.isFinite(n)) &&
    parts[2] > 0 &&
    parts[3] > 0 &&
    svgRect.width > 0 &&
    svgRect.height > 0
  ) {
    const [vx, vy, vw, vh] = parts;
    return {
      x: offsetX + (svgX - vx) * (svgRect.width / vw),
      y: offsetY + (svgY - vy) * (svgRect.height / vh),
    };
  }

  return {
    x: offsetX + svgX,
    y: offsetY + svgY,
  };
}

/**
 * Canonical Tooltip Hook, Viewport Clamping & Unified Touch Lifecycle
 * Standardizes tooltip state, boundary clamping, placement flipping, SVG projection,
 * and tap-to-inspect / tap-outside-to-dismiss across all charts.
 */
export function useChartTooltip<T = unknown>(options?: UseChartTooltipOptions) {
  const [tooltipState, setTooltipState] = useState<ChartTooltipState<T>>({
    visible: false,
    x: 0,
    y: 0,
    placement: 'above',
    pinned: false,
    value: null,
  });

  const justPinnedThisTapRef = useRef(false);
  const onDismissRef = useRef(options?.onDismiss);
  onDismissRef.current = options?.onDismiss;

  const containerRef = options?.containerRef;
  const containerWidthOpt = options?.containerWidth;
  const containerHeightOpt = options?.containerHeight;
  const tooltipWidth = options?.tooltipWidth ?? DEFAULT_TOOLTIP_WIDTH;
  const tooltipHeight = options?.tooltipHeight ?? DEFAULT_TOOLTIP_HEIGHT;
  const edgePadding = options?.edgePadding ?? DEFAULT_EDGE_PADDING;
  const clampXOpt = options?.clampX;
  const clampYOpt = options?.clampY;

  const showTooltip = useCallback(
    (params: ShowChartTooltipParams<T>) => {
      let x = params.x;
      let y = params.y;

      const measuredRect =
        !containerWidthOpt || !containerHeightOpt
          ? containerRef?.current?.getBoundingClientRect()
          : undefined;
      const effectiveWidth =
        containerWidthOpt && containerWidthOpt > 0
          ? containerWidthOpt
          : measuredRect?.width ?? 0;
      const effectiveHeight =
        containerHeightOpt && containerHeightOpt > 0
          ? containerHeightOpt
          : measuredRect?.height ?? 0;

      if (clampXOpt) {
        x = Math.max(clampXOpt[0], Math.min(clampXOpt[1], x));
      } else if (effectiveWidth > 0) {
        const effectiveTooltipWidth = Math.min(
          tooltipWidth,
          Math.max(0, effectiveWidth - edgePadding * 2)
        );
        const halfWidth = effectiveTooltipWidth / 2;
        const minX = edgePadding + halfWidth;
        const maxX = effectiveWidth - edgePadding - halfWidth;
        x = minX <= maxX ? Math.max(minX, Math.min(maxX, x)) : effectiveWidth / 2;
      }

      const topFlipThreshold = tooltipHeight + edgePadding;
      const placement: ChartTooltipPlacement =
        params.placement ?? (y < topFlipThreshold ? 'below' : 'above');

      if (clampYOpt) {
        y = Math.max(clampYOpt[0], Math.min(clampYOpt[1], y));
      } else {
        const minY = edgePadding;
        const maxY =
          effectiveHeight > 0 ? Math.max(minY, effectiveHeight - edgePadding) : Infinity;
        y = Math.max(minY, Math.min(maxY, y));
      }

      setTooltipState({
        ...params,
        x,
        y,
        placement,
        pinned: Boolean(params.pinned),
        visible: true,
      });
    },
    [
      containerRef,
      containerWidthOpt,
      containerHeightOpt,
      tooltipWidth,
      tooltipHeight,
      edgePadding,
      clampXOpt,
      clampYOpt,
    ]
  );

  const hideTooltip = useCallback(() => {
    justPinnedThisTapRef.current = false;
    setTooltipState((prev) =>
      prev.visible || prev.pinned
        ? { ...prev, visible: false, pinned: false, pinKey: undefined }
        : prev
    );
  }, []);

  const dismissTooltip = useCallback(() => {
    hideTooltip();
    onDismissRef.current?.();
  }, [hideTooltip]);

  /**
   * Unified pointer-enter / pointer-move handler for chart marks.
   * Touch pointers pin the tooltip so it survives `pointerup` / `pointerleave`;
   * mouse pointers show unpinned hover tooltips.
   */
  const handleMarkPointerEnter = useCallback(
    (
      e: React.PointerEvent<Element>,
      params: Omit<ShowChartTooltipParams<T>, 'pinned'>,
      pinKey?: string | number
    ) => {
      const isTouch = e.pointerType === 'touch';
      if (isTouch) {
        const alreadyPinnedSame =
          tooltipState.visible &&
          tooltipState.pinned &&
          pinKey !== undefined &&
          tooltipState.pinKey === pinKey;
        if (!alreadyPinnedSame) {
          justPinnedThisTapRef.current = true;
        }
        showTooltip({ ...params, pinned: true, pinKey });
        return;
      }

      justPinnedThisTapRef.current = false;
      showTooltip({ ...params, pinned: false, pinKey });
    },
    [showTooltip, tooltipState.visible, tooltipState.pinned, tooltipState.pinKey]
  );

  /**
   * Unified pointer-leave handler for chart marks.
   * Guards against `pointerType === 'touch'` and pinned tooltips so touch taps
   * do not vanish immediately on `touchend` / `pointerleave`.
   */
  const handleMarkPointerLeave = useCallback(
    (e?: React.PointerEvent<Element>) => {
      if (e?.pointerType === 'touch' || tooltipState.pinned) {
        return;
      }
      dismissTooltip();
    },
    [tooltipState.pinned, dismissTooltip]
  );

  /**
   * Unified click/tap handler for chart marks.
   * Tapping the same pinned mark a second time toggles the tooltip off.
   * Returns `true` if the click toggled off an already-pinned tooltip.
   */
  const handleMarkClick = useCallback(
    (pinKey?: string | number): boolean => {
      if (justPinnedThisTapRef.current) {
        justPinnedThisTapRef.current = false;
        return false;
      }
      if (
        tooltipState.visible &&
        tooltipState.pinned &&
        (pinKey === undefined || tooltipState.pinKey === pinKey)
      ) {
        dismissTooltip();
        return true;
      }
      return false;
    },
    [tooltipState.visible, tooltipState.pinned, tooltipState.pinKey, dismissTooltip]
  );

  useEffect(() => {
    if (!tooltipState.visible) return;

    const handleOutsidePointerDown = (e: PointerEvent) => {
      const container = containerRef?.current;
      if (container && !container.contains(e.target as Node)) {
        dismissTooltip();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissTooltip();
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [tooltipState.visible, containerRef, dismissTooltip]);

  return {
    tooltipState,
    setTooltipState,
    showTooltip,
    hideTooltip,
    dismissTooltip,
    handleMarkPointerEnter,
    handleMarkPointerLeave,
    handleMarkClick,
    projectSvgToContainer,
  };
}
