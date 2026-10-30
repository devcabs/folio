import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseScrollOptions {
  target?: React.RefObject<HTMLElement | null>;
}

export interface ScrollValues {
  scrollY: number;
  scrollProgress: number; // Normalized 0.0 to 1.0
}

/**
 * useScroll Hook
 *
 * Tracks scroll position and normalized scroll progress (0 to 1)
 * relative to the window or a designated container element.
 *
 * Provides:
 * - Reactive state: `scrollProgress` and `scrollY`
 * - High-performance subscription: `subscribeScroll` (for zero-rerender direct DOM manipulation)
 */
export const useScroll = (options?: UseScrollOptions) => {
  const targetRef = options?.target;
  const [scrollValues, setScrollValues] = useState<ScrollValues>({
    scrollY: 0,
    scrollProgress: 0,
  });

  const listenersRef = useRef<Set<(values: ScrollValues) => void>>(new Set());
  const rafIdRef = useRef<number | null>(null);
  const latestValuesRef = useRef<ScrollValues>({ scrollY: 0, scrollProgress: 0 });

  const computeValues = useCallback((): ScrollValues => {
    const scrollY = typeof window !== 'undefined' ? (window.scrollY || window.pageYOffset || 0) : 0;

    if (!targetRef?.current) {
      const docHeight =
        typeof document !== 'undefined'
          ? Math.max(
              document.documentElement.scrollHeight,
              document.body.scrollHeight,
              window.innerHeight
            )
          : window.innerHeight;
      const travel = Math.max(docHeight - window.innerHeight, 1);
      const progress = Math.min(Math.max(scrollY / travel, 0), 1);
      return { scrollY, scrollProgress: progress };
    }

    const element = targetRef.current;
    const rect = element.getBoundingClientRect();
    const trackTop = rect.top + scrollY;
    const trackHeight = rect.height;
    const viewportHeight =
      typeof document !== 'undefined'
        ? document.documentElement.clientHeight || window.innerHeight
        : window.innerHeight;

    const scrollTravel = trackHeight - viewportHeight;
    const relativeY = scrollY - trackTop;

    if (scrollTravel <= 0) {
      return { scrollY, scrollProgress: 0 };
    }

    const progress = Math.min(Math.max(relativeY / scrollTravel, 0), 1);
    return { scrollY, scrollProgress: progress };
  }, [targetRef]);

  const subscribeScroll = useCallback((callback: (values: ScrollValues) => void) => {
    listenersRef.current.add(callback);
    callback(latestValuesRef.current);
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (rafIdRef.current !== null) return;

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const current = computeValues();
        latestValuesRef.current = current;

        // Notify subscribers directly (hot-path DOM manipulation)
        listenersRef.current.forEach((listener) => listener(current));

        // Update React state for components needing reactive bindings
        setScrollValues(current);
      });
    };

    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    window.addEventListener('orientationchange', handleScroll, { passive: true });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('orientationchange', handleScroll);
    };
  }, [computeValues]);

  return {
    ...scrollValues,
    subscribeScroll,
  };
};
