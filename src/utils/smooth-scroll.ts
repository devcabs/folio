/**
 * smooth-scroll.ts
 * Precision cinematic smooth scrolling engine — Folio Engine
 *
 * Replaces the browser's jarring, high-velocity default smooth scroll (~300ms)
 * with a stately, leisurely editorial motion curve (~1000ms - 1200ms) that allows
 * visitors to comfortably appreciate the illuminated serpentine conduit path and
 * milestone transitions.
 */

let activeScrollRaf: number | null = null;
let isScrollInterruptible = true;

// Cancel ongoing programmatic scroll if user intervenes with mousewheel or touch
if (typeof window !== 'undefined') {
  const cancel = (e: Event) => {
    if (!isScrollInterruptible) {
      return;
    }
    // Ignore touchstart if originated from an interactive navigation control
    if ((e.target as HTMLElement)?.closest('button, a, [role="button"]')) {
      return;
    }
    cancelCinematicScroll();
  };

  window.addEventListener('wheel', cancel, { passive: true });
  window.addEventListener('touchstart', cancel, { passive: true });
}

/**
 * Aborts any ongoing cinematic smooth scroll immediately.
 */
export function cancelCinematicScroll(): void {
  if (activeScrollRaf !== null) {
    cancelAnimationFrame(activeScrollRaf);
    activeScrollRaf = null;
    isScrollInterruptible = true;
  }
}

/**
 * Fast-start ease-out cubic curve:
 * Launches immediately with high initial velocity on the very first frame (fast on start),
 * then smoothly and visibly decelerates over an extended, luxurious ease-out glide into the target node.
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface SmoothScrollOptions {
  /** Target vertical scroll position in pixels */
  top: number;
  /** Duration in milliseconds. Defaults to dynamic calculation based on distance (~2300ms–2600ms per fold) */
  duration?: number;
  /** Callback fired when scroll completes */
  onComplete?: () => void;
  /** Whether user wheel/touch events can cancel this scroll. Defaults to true. */
  interruptible?: boolean;
}

export function cinematicScrollTo({ top, duration, onComplete, interruptible = true }: SmoothScrollOptions): void {
  if (typeof window === 'undefined') return;

  isScrollInterruptible = interruptible;

  // Guarantee that native CSS smooth scrolling does not conflict with our frame-by-frame rAF animation
  if (document.documentElement.style.scrollBehavior !== 'auto') {
    document.documentElement.style.scrollBehavior = 'auto';
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    window.scrollTo(0, top);
    isScrollInterruptible = true;
    onComplete?.();
    return;
  }

  // Cancel any prior running scroll
  if (activeScrollRaf !== null) {
    cancelAnimationFrame(activeScrollRaf);
    activeScrollRaf = null;
  }

  const startY = window.scrollY || window.pageYOffset;
  const distance = top - startY;

  // If already at destination, exit early
  if (Math.abs(distance) < 2) {
    isScrollInterruptible = true;
    onComplete?.();
    return;
  }

  // Fast on start, extended slow ease-out: ~2300ms–2600ms for 1 full page fold (~800-1000px),
  // capped between 1600ms and 3000ms.
  // Delivers an instant snappy launch on frame 1, followed by a wide, sustained, leisurely ease-out deceleration.
  const calculatedDuration =
    duration ?? Math.min(3000, Math.max(1600, Math.round(1500 + Math.sqrt(Math.abs(distance)) * 32)));
  const startTime = performance.now();

  const step = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / calculatedDuration, 1);
    const easedProgress = easeOutCubic(progress);

    window.scrollTo(0, Math.round(startY + distance * easedProgress));

    if (progress < 1) {
      activeScrollRaf = requestAnimationFrame(step);
    } else {
      activeScrollRaf = null;
      isScrollInterruptible = true;
      onComplete?.();
    }
  };

  activeScrollRaf = requestAnimationFrame(step);
}
