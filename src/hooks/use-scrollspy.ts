import { useState, useEffect, useRef } from 'react';

export interface UseScrollspyOptions {
  /** Reading reference line distance in px from top of viewport. Defaults to 140px (clearing AppHeader) */
  offsetPx?: number;
  /** Fallback active ID when no monitored element is found */
  defaultActiveId?: string;
}

/**
 * useScrollspy Hook
 * 
 * High-performance, passive scroll tracking hook for editorial long-form layouts.
 * Uses document-order threshold detection to determine the active reading section.
 * Perfectly handles short sections sharing the viewport without skipping or getting stuck.
 * 
 * @param itemIds Array of element DOM IDs (without '#') to monitor
 * @param options Configuration for offsetPx and defaultActiveId
 * @returns The active element ID currently in the reading viewport zone
 */
export function useScrollspy(
  itemIds: string[],
  options: UseScrollspyOptions = {}
): string {
  const {
    offsetPx = 140,
    defaultActiveId = itemIds[0] || '',
  } = options;

  const [activeId, setActiveId] = useState<string>(defaultActiveId);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || itemIds.length === 0) {
      return;
    }

    const computeActive = () => {
      // 1. If at the very top of the page, first element is active
      const scrollY = window.scrollY || window.pageYOffset;
      if (scrollY <= 50) {
        setActiveId(itemIds[0]);
        return;
      }

      // 2. Collect existing DOM elements in document order
      const elements: HTMLElement[] = [];
      for (const id of itemIds) {
        const el = document.getElementById(id);
        if (el) {
          elements.push(el);
        }
      }

      if (elements.length === 0) return;

      // 3. Find the last element in document order whose top has reached or passed offsetPx
      let currentActiveId = elements[0].id;
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= offsetPx) {
          currentActiveId = el.id;
        } else {
          // Since elements are in document order, once rect.top > offsetPx,
          // all subsequent elements are also below offsetPx.
          break;
        }
      }

      setActiveId(currentActiveId);
    };

    const handleScrollOrResize = () => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        computeActive();
        rafIdRef.current = null;
      });
    };

    // Initial check
    computeActive();

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [itemIds, offsetPx]);

  return activeId;
}

export default useScrollspy;
