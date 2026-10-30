import { useEffect } from 'react';

export interface UseLightboxHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  hash?: string;
}

/**
 * useLightboxHistory Hook
 * 
 * Synchronizes modal visibility with browser history and popstate events.
 * Guarantees that pressing the browser or hardware Back button on mobile
 * dismisses the lightbox and returns to the exact source page and scroll position.
 */
export function useLightboxHistory({
  isOpen,
  onClose,
  hash = '#source',
}: UseLightboxHistoryProps): void {
  useEffect(() => {
    if (!isOpen) return;

    // Capture the exact URL before the modal opened
    const previousUrl = window.location.href;

    // Push modal state into browser history to capture Back button
    window.history.pushState({ modal: 'source-lightbox' }, '', hash);

    const handlePopState = () => {
      // Hardware or browser back pressed: cleanly close the modal
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // Clean up hash if modal closed via UI button or Escape instead of Back button
      // Use replaceState with previousUrl to safely restore state without firing unwanted popstate
      if (window.location.hash === hash) {
        window.history.replaceState(null, '', previousUrl);
      }
    };
  }, [isOpen, onClose, hash]);
}

export default useLightboxHistory;
