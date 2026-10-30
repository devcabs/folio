import { useRef, useCallback } from 'react';

export interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
  disabled?: boolean;
}

export interface UseSwipeGestureResult {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: (e: React.TouchEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  wasSwipeJustTriggered: () => boolean;
}

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!target || !(target as HTMLElement).closest) return false;
  const el = target as HTMLElement;
  return Boolean(el.closest('button, a, input, select, textarea, [role="tablist"], [data-no-swipe]'));
}

/**
 * useSwipeGesture Hook
 * 
 * Captures mobile touch and pointer interactions for native photo gallery conventions:
 * - Horizontal swipe left/right for carousel navigation
 * - Vertical pull-down gesture to dismiss the modal
 * - Supports both Touch Events and Pointer Events with touchcancel/pointercancel resilience
 * - Prevents collision with interactive elements (photo strip, buttons, links)
 * - Exposes wasSwipeJustTriggered() to suppress synthetic click events after swiping
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeDown,
  minDistance = 45,
  disabled = false,
}: SwipeGestureOptions): UseSwipeGestureResult {
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const isTracking = useRef(false);
  const lastSwipeTimestamp = useRef(0);

  const startGesture = (clientX: number, clientY: number, target: EventTarget | null) => {
    if (disabled || isInteractiveElement(target)) {
      isTracking.current = false;
      return;
    }
    startX.current = clientX;
    startY.current = clientY;
    startTime.current = Date.now();
    isTracking.current = true;
  };

  const endGesture = (clientX: number, clientY: number) => {
    if (!isTracking.current || disabled) {
      isTracking.current = false;
      return;
    }
    isTracking.current = false;

    // Guard against duplicate triggers from paired pointer/touch event streams
    if (Date.now() - lastSwipeTimestamp.current < 350) {
      return;
    }

    const deltaX = clientX - startX.current;
    const deltaY = clientY - startY.current;
    const deltaTime = Date.now() - startTime.current;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Responsive flick recognition for quick gestures on mobile screens
    const isFlick = deltaTime < 280 && (absX > 28 || absY > 28);
    const effectiveThreshold = isFlick ? Math.min(minDistance, 30) : minDistance;

    // Vertical swipe down dismiss priority
    if (deltaY > effectiveThreshold && absY > absX * 1.3) {
      lastSwipeTimestamp.current = Date.now();
      onSwipeDown?.();
      return;
    }

    // Horizontal swipe navigation
    if (absX > effectiveThreshold && absX > absY) {
      lastSwipeTimestamp.current = Date.now();
      if (deltaX < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    }
  };

  const cancelGesture = () => {
    isTracking.current = false;
  };

  // Touch Event Listeners
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length > 0) {
        startGesture(e.touches[0].clientX, e.touches[0].clientY, e.target);
      }
    },
    [disabled]
  );

  const onTouchMove = useCallback((_e: React.TouchEvent) => {
    // Touch move tracking can be monitored or throttled
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.changedTouches.length > 0) {
        endGesture(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    },
    [disabled, minDistance, onSwipeDown, onSwipeLeft, onSwipeRight]
  );

  const onTouchCancel = useCallback(() => {
    cancelGesture();
  }, []);

  // Pointer Event Listeners
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore secondary mouse clicks
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startGesture(e.clientX, e.clientY, e.target);
    },
    [disabled]
  );

  const onPointerMove = useCallback((_e: React.PointerEvent) => {
    // Pointer move tracking
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      endGesture(e.clientX, e.clientY);
    },
    [disabled, minDistance, onSwipeDown, onSwipeLeft, onSwipeRight]
  );

  const onPointerCancel = useCallback(() => {
    cancelGesture();
  }, []);

  const wasSwipeJustTriggered = useCallback(() => {
    return Date.now() - lastSwipeTimestamp.current < 350;
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    wasSwipeJustTriggered,
  };
}

export default useSwipeGesture;

