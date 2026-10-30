import { useEffect, useRef, useCallback } from 'react';
import type { RoadmapScrollZone } from '../components/roadmap/RoadmapSection';

export interface UseDiscreteStepNavigationOptions {
  enabled: boolean;
  activeStage: number; // 1 to 5
  scrollZone: RoadmapScrollZone; // 'above' | 'inside' | 'below'
  onNextStage: () => void;
  onPrevStage: () => void;
  onScrollToTop: () => void;
  onScrollToFooter: () => void;
  onDirectStage: (stage: number) => void;
  /** Cooldown buffer in ms after transition completes before accepting new gestures. Defaults to 200ms. */
  cooldownMs?: number;
}

export interface DiscreteStepNavigationHandle {
  isTransitioning: boolean;
  lockTransition: (estimatedDurationMs?: number) => void;
  unlockTransition: () => void;
}

const WHEEL_THRESHOLD_PX = 35;
const TOUCH_SWIPE_THRESHOLD_PX = 45;
const WHEEL_DECAY_TIMEOUT_MS = 180;

/**
 * useDiscreteStepNavigation (Task 4.2.1b / Approach B)
 *
 * Disables continuous manual document scrolling on the landing page across
 * desktop mouse wheels, trackpads, and mobile touch devices. Converts gestures
 * into discrete, debounced milestone-to-milestone transitions with transition locking.
 */
export function useDiscreteStepNavigation({
  enabled,
  activeStage,
  scrollZone,
  onNextStage,
  onPrevStage,
  onScrollToTop,
  onScrollToFooter,
  onDirectStage,
  cooldownMs = 200,
}: UseDiscreteStepNavigationOptions): DiscreteStepNavigationHandle {
  const isTransitioningRef = useRef<boolean>(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gesture tracking refs
  const wheelAccumulatorRef = useRef<number>(0);
  const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartYRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);
  const touchActiveRef = useRef<boolean>(false);

  // Synchronized state refs for event listeners
  const activeStageRef = useRef<number>(activeStage);
  activeStageRef.current = activeStage;

  const scrollZoneRef = useRef<RoadmapScrollZone>(scrollZone);
  scrollZoneRef.current = scrollZone;

  const callbacksRef = useRef({
    onNextStage,
    onPrevStage,
    onScrollToTop,
    onScrollToFooter,
    onDirectStage,
  });
  callbacksRef.current = {
    onNextStage,
    onPrevStage,
    onScrollToTop,
    onScrollToFooter,
    onDirectStage,
  };

  const lockTransition = useCallback((estimatedDurationMs = 1200) => {
    isTransitioningRef.current = true;
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
    }
    lockTimerRef.current = setTimeout(() => {
      isTransitioningRef.current = false;
      lockTimerRef.current = null;
    }, estimatedDurationMs + cooldownMs);
  }, [cooldownMs]);

  const unlockTransition = useCallback(() => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    lockTimerRef.current = setTimeout(() => {
      isTransitioningRef.current = false;
      lockTimerRef.current = null;
    }, cooldownMs);
  }, [cooldownMs]);

  // Execute directional discrete transition
  const triggerForward = useCallback(() => {
    if (isTransitioningRef.current) return;
    lockTransition();

    const zone = scrollZoneRef.current;
    const stage = activeStageRef.current;

    if (zone === 'above') {
      callbacksRef.current.onDirectStage(1);
    } else if (zone === 'inside') {
      if (stage < 5) {
        callbacksRef.current.onNextStage();
      } else {
        callbacksRef.current.onScrollToFooter();
      }
    }
    // If zone === 'below', already at the bottom, no-op
  }, [lockTransition]);

  const triggerBackward = useCallback(() => {
    if (isTransitioningRef.current) return;
    lockTransition();

    const zone = scrollZoneRef.current;
    const stage = activeStageRef.current;

    if (zone === 'below') {
      callbacksRef.current.onDirectStage(5);
    } else if (zone === 'inside') {
      if (stage > 1) {
        callbacksRef.current.onPrevStage();
      } else {
        callbacksRef.current.onScrollToTop();
      }
    }
    // If zone === 'above', already at the top, no-op
  }, [lockTransition]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Apply scroll lock styles to html/body
    const rootEl = document.documentElement;
    const bodyEl = document.body;
    rootEl.classList.add('landing-scroll-locked');
    bodyEl.classList.add('landing-scroll-locked');

    const isInteractiveInput = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
    };

    // 1. Mousewheel / Trackpad Gesture Handler
    const handleWheel = (e: WheelEvent) => {
      if (isInteractiveInput(e.target)) return;

      // Strictly prevent browser's default document scrolling
      e.preventDefault();

      if (isTransitioningRef.current) {
        wheelAccumulatorRef.current = 0;
        return;
      }

      wheelAccumulatorRef.current += e.deltaY;

      if (wheelResetTimerRef.current) {
        clearTimeout(wheelResetTimerRef.current);
      }
      wheelResetTimerRef.current = setTimeout(() => {
        wheelAccumulatorRef.current = 0;
      }, WHEEL_DECAY_TIMEOUT_MS);

      if (Math.abs(wheelAccumulatorRef.current) >= WHEEL_THRESHOLD_PX) {
        const delta = wheelAccumulatorRef.current;
        wheelAccumulatorRef.current = 0;
        if (delta > 0) {
          triggerForward();
        } else {
          triggerBackward();
        }
      }
    };

    // 2. Mobile Touch Swipe Handlers
    const handleTouchStart = (e: TouchEvent) => {
      if (isInteractiveInput(e.target)) return;
      if (e.touches.length === 1) {
        touchStartYRef.current = e.touches[0].clientY;
        touchStartXRef.current = e.touches[0].clientX;
        touchActiveRef.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isInteractiveInput(e.target)) return;
      // Prevent browser's native pull-to-refresh, rubber-band, or momentum scroll
      e.preventDefault();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchActiveRef.current) return;
      touchActiveRef.current = false;

      if (isTransitioningRef.current) return;
      if (e.changedTouches.length === 0) return;

      const deltaY = touchStartYRef.current - e.changedTouches[0].clientY;
      const deltaX = touchStartXRef.current - e.changedTouches[0].clientX;

      // Only respond if vertical swipe dominates over horizontal motion
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) >= TOUCH_SWIPE_THRESHOLD_PX) {
        if (deltaY > 0) {
          // Swipe UP (finger moves upward -> pull content down to next stage)
          triggerForward();
        } else {
          // Swipe DOWN (finger moves downward -> return to previous stage)
          triggerBackward();
        }
      }
    };

    // 3. Keyboard Page Navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInteractiveInput(e.target)) return;

      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        triggerForward();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        triggerBackward();
      } else if (e.key === 'Home') {
        e.preventDefault();
        if (!isTransitioningRef.current) {
          lockTransition();
          callbacksRef.current.onScrollToTop();
        }
      } else if (e.key === 'End') {
        e.preventDefault();
        if (!isTransitioningRef.current) {
          lockTransition();
          callbacksRef.current.onScrollToFooter();
        }
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const stage = parseInt(e.key, 10);
        if (!isTransitioningRef.current) {
          lockTransition();
          callbacksRef.current.onDirectStage(stage);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('keydown', handleKeyDown, { passive: false });

    return () => {
      rootEl.classList.remove('landing-scroll-locked');
      bodyEl.classList.remove('landing-scroll-locked');

      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);

      if (lockTimerRef.current) {
        clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
      if (wheelResetTimerRef.current) {
        clearTimeout(wheelResetTimerRef.current);
        wheelResetTimerRef.current = null;
      }
    };
  }, [enabled, triggerForward, triggerBackward, lockTransition]);

  return {
    isTransitioning: isTransitioningRef.current,
    lockTransition,
    unlockTransition,
  };
}
