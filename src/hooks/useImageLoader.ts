import { useState, useEffect, useCallback } from 'react';
import type { ImageLoadingStatus, UseImageLoaderResult } from '../types/source';

/**
 * useImageLoader Hook
 * 
 * Fault-tolerant finite state machine governing image asset loading lifecycle.
 * - Handles 4 deterministic states: idle, loading, loaded, error
 * - Fast-path bypass for cached images to eliminate layout flicker
 * - Subscription flag cleanup to prevent memory leaks and state updates after unmount
 * - Stable retry callback for recovery from network interruptions
 */
export function useImageLoader(src?: string, fallbackSrc?: string): UseImageLoaderResult {
  const [activeSrc, setActiveSrc] = useState<string | undefined>(src);
  const [status, setStatus] = useState<ImageLoadingStatus>(src ? 'loading' : 'idle');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setActiveSrc(src);
  }, [src]);

  useEffect(() => {
    if (!activeSrc) {
      setStatus('idle');
      return;
    }

    let isSubscribed = true;
    setStatus('loading');

    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.src = activeSrc;

    // Fast-path for already-cached images to avoid layout flicker
    if (img.complete && img.naturalWidth > 0) {
      setStatus('loaded');
      return;
    }

    img.onload = () => {
      if (isSubscribed) {
        setStatus('loaded');
      }
    };

    img.onerror = () => {
      if (isSubscribed) {
        // Seamlessly fallback if fallbackSrc is available and different
        if (fallbackSrc && activeSrc !== fallbackSrc) {
          setActiveSrc(fallbackSrc);
        } else {
          setStatus('error');
        }
      }
    };

    return () => {
      isSubscribed = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [activeSrc, fallbackSrc, retryCount]);

  const retry = useCallback(() => {
    setActiveSrc(src);
    setRetryCount((c) => c + 1);
  }, [src]);

  return {
    status,
    isLoading: status === 'loading',
    isLoaded: status === 'loaded',
    isError: status === 'error',
    resolvedSrc: activeSrc,
    retry,
  };
}

export default useImageLoader;
