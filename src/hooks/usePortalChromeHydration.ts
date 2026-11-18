/**
 * Folio Engine — Portal Chrome Hydration Hook
 * Location: src/hooks/usePortalChromeHydration.ts
 * Specification: docs/task/7.2-content-db-and-portal-chrome-ssot.md
 *
 * Implements:
 * 1. Consumes PortalChromeContext when inside PortalChromeProvider.
 * 2. Falls back to local React state hydration when used standalone (zero module-level singletons).
 * 3. Strict fail-stop: surfaces error / hydrationError and retry() on non-2xx or network failure.
 * 4. Re-hydrates from /api/public/manifest whenever isDevMode transitions back to false.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDeveloperMode } from './useDeveloperMode';
import { usePortalChrome } from '../context/PortalChromeContext';
import {
  fetchPublicManifestOverrides,
  fetchDraftWorkspaceOverrides,
} from '../utils/contentDb';

export interface UsePortalChromeHydrationReturn {
  isHydrating: boolean;
  error: string | null;
  hydrationError: string | null;
  retry: () => void;
  isStandalone?: boolean;
}

export function resetPortalChromeHydrationForTesting(): void {
  // No-op: module-level hydration singleton removed in Epic 7.2
}

export function usePortalChromeHydration(): UsePortalChromeHydrationReturn {
  const portalChrome = usePortalChrome();
  const { isDevMode, lockToken } = useDeveloperMode();

  const [standaloneHydrating, setStandaloneHydrating] = useState<boolean>(() => {
    if (portalChrome) return false;
    if (typeof window === 'undefined' || typeof fetch !== 'function') return false;
    return true;
  });
  const [standaloneError, setStandaloneError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  const standaloneRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (portalChrome) return;
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
      setStandaloneHydrating(false);
      return;
    }

    let isCancelled = false;
    setStandaloneHydrating(true);
    setStandaloneError(null);

    const hydrate = async () => {
      try {
        if (isDevMode) {
          await fetchDraftWorkspaceOverrides(lockToken ?? null);
        } else {
          await fetchPublicManifestOverrides();
        }
        if (!isCancelled) {
          setStandaloneError(null);
        }
      } catch (err) {
        if (!isCancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load portal chrome from KV.';
          setStandaloneError(message);
        }
      } finally {
        if (!isCancelled) {
          setStandaloneHydrating(false);
        }
      }
    };

    hydrate();

    return () => {
      isCancelled = true;
    };
  }, [portalChrome, isDevMode, lockToken, retryCount]);

  if (portalChrome) {
    return {
      isHydrating: portalChrome.isHydrating,
      error: portalChrome.hydrationError,
      hydrationError: portalChrome.hydrationError,
      retry: portalChrome.retry,
      isStandalone: false,
    };
  }

  return {
    isHydrating: standaloneHydrating,
    error: standaloneError,
    hydrationError: standaloneError,
    retry: standaloneRetry,
    isStandalone: true,
  };
}
