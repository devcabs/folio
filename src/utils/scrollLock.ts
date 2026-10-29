/**
 * scrollLock.ts
 * Universal scroll lock coordinator with reference-counting.
 * Safely coordinates scroll locking between stacked Modals, Drawers, and Overlays.
 * Automatically computes desktop scrollbar compensation to eliminate layout jitter.
 */

let activeLocks = 0;
let savedBodyOverflow = '';
let savedHtmlOverflow = '';
let savedPaddingRight = '';
let savedRootPointerEvents = '';

export function acquireScrollLock(): void {
  if (typeof document === 'undefined') return;

  if (activeLocks === 0) {
    savedBodyOverflow = document.body.style.overflow;
    savedHtmlOverflow = document.documentElement.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;

    // Compensate for scrollbar shift on desktop viewports
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Disable background content interactions
    const root = document.getElementById('root');
    if (root) {
      savedRootPointerEvents = root.style.pointerEvents;
      root.style.pointerEvents = 'none';
      root.setAttribute('inert', '');
      root.setAttribute('aria-hidden', 'true');
    }
  }
  activeLocks++;
}

export function releaseScrollLock(): void {
  if (typeof document === 'undefined') return;

  activeLocks = Math.max(0, activeLocks - 1);
  if (activeLocks === 0) {
    document.body.style.overflow = savedBodyOverflow;
    document.documentElement.style.overflow = savedHtmlOverflow;
    document.body.style.paddingRight = savedPaddingRight;

    // Restore background content interactions
    const root = document.getElementById('root');
    if (root) {
      root.style.pointerEvents = savedRootPointerEvents;
      root.removeAttribute('inert');
      root.removeAttribute('aria-hidden');
    }
  }
}
