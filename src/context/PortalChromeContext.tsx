/**
 * Folio Engine — Portal Chrome Context (SSOT)
 * Location: src/context/PortalChromeContext.tsx
 * Specification: docs/task/7.2-content-db-and-portal-chrome-ssot.md
 *
 * Holds active portal chrome contentOverrides in React state hydrated directly from:
 * - Public Mode (isDevMode = false): GET /api/public/manifest (portal:manifest)
 * - Dev Mode (isDevMode = true): GET /api/draft (draft:workspace)
 *
 * Zero module-level caches, zero localStorage, strict fail-stop with <TopErrorBanner />.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useDeveloperMode } from '../hooks/useDeveloperMode';
import {
  readInjectedPortalManifest,
  fetchPublicManifestChrome,
  fetchDraftWorkspaceChrome,
  updateDraftContentOverride,
  removeDraftContentOverride,
  EVENT_DRAFT_CONTENT_CHANGE,
  EVENT_LIVE_CONTENT_CHANGE,
} from '../utils/contentDb';
import {
  EVENT_DRAFT_UPDATED_AT_SYNC,
  EVENT_DRAFT_PAGES_CHANGE,
  dispatchDraftUpdatedAtSync,
  enqueueDraftMutation,
  commitDraftWorkspaceTransaction,
  getLastKnownDraftUpdatedAt,
  setLastKnownDraftUpdatedAt,
} from '../services/draftService';
import type { NodeCanvasDocument } from '../types/canvas';
import type { DraftWorkspacePayload, PublicPortalManifestPayload } from '../types/edge';
import type { PageRegistry } from '../types/page';
import { TopErrorBanner } from '../components/feedback/TopErrorBanner';

const HYDRATION_BACKOFF_SCHEDULE_MS = [2000, 4000, 8000, 15000] as const;

export interface PortalChromeContextValue {
  contentOverrides: Record<string, string>;
  pages: PageRegistry;
  publishedPages: PageRegistry;
  isHydrating: boolean;
  hasHydrated: boolean;
  hydrationError: string | null;
  error: string | null;
  draftUpdatedAt: string | null;
  retry: () => void;
  updateOverride: (key: string, value: string) => Promise<void>;
  removeOverride: (key: string) => Promise<void>;
  commitWorkspaceMutation: (mutation: {
    canvases?: Record<string, NodeCanvasDocument>;
    pages?: PageRegistry;
    contentOverrides?: Record<string, string>;
    deletedPageIds?: string[];
  }) => Promise<DraftWorkspacePayload>;
}

export const PortalChromeContext = createContext<PortalChromeContextValue | null>(null);

export interface PortalChromeProviderProps {
  children?: React.ReactNode;
  /** Optional override for isolated testing */
  isDevModeOverride?: boolean;
  /** Optional lockToken override for isolated testing */
  lockTokenOverride?: string | null;
}

export const PortalChromeProvider: React.FC<PortalChromeProviderProps> = ({
  children,
  isDevModeOverride,
  lockTokenOverride,
}) => {
  const { isDevMode: contextDevMode, lockToken: contextLockToken } = useDeveloperMode();
  const isDevMode = isDevModeOverride ?? contextDevMode;
  const lockToken = lockTokenOverride !== undefined ? lockTokenOverride : (contextLockToken ?? null);

  const [initialManifest] = useState<PublicPortalManifestPayload | null>(() =>
    !isDevMode ? readInjectedPortalManifest() : null
  );

  const [contentOverrides, setContentOverrides] = useState<Record<string, string>>(() =>
    initialManifest?.contentOverrides ? { ...initialManifest.contentOverrides } : {}
  );
  const [pages, setPages] = useState<PageRegistry>(() =>
    initialManifest?.pages ? { ...initialManifest.pages } : {}
  );
  const [publishedPages, setPublishedPages] = useState<PageRegistry>(() =>
    initialManifest?.pages ? { ...initialManifest.pages } : {}
  );
  const [isHydrating, setIsHydrating] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
      return false;
    }
    if (!isDevMode && initialManifest) {
      return false;
    }
    return true;
  });
  const [hasHydrated, setHasHydrated] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
      return true;
    }
    if (!isDevMode && initialManifest) {
      return true;
    }
    return false;
  });
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  const overridesRef = useRef(contentOverrides);
  overridesRef.current = contentOverrides;
  const draftUpdatedAtRef = useRef(draftUpdatedAt);
  draftUpdatedAtRef.current = draftUpdatedAt;
  const backoffAttemptRef = useRef<number>(0);
  const hasSkippedInitialFetchRef = useRef<boolean>(false);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    backoffAttemptRef.current = 0;
  }, [isDevMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || hasHydrated || !hydrationError || isHydrating) {
      return;
    }
    const attempt = backoffAttemptRef.current;
    const delayMs =
      HYDRATION_BACKOFF_SCHEDULE_MS[
        Math.min(attempt, HYDRATION_BACKOFF_SCHEDULE_MS.length - 1)
      ];
    backoffAttemptRef.current = attempt + 1;
    const timerId = setTimeout(() => {
      retry();
    }, delayMs);
    return () => {
      clearTimeout(timerId);
    };
  }, [hasHydrated, hydrationError, isHydrating, retry]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }
    const eventName = isDevMode ? EVENT_DRAFT_CONTENT_CHANGE : EVENT_LIVE_CONTENT_CHANGE;
    const handleExternalSync = (e: Event) => {
      if (isDevMode) {
        const detail = (e as CustomEvent<{ pages?: PageRegistry }>).detail;
        if (detail?.pages) {
          setPages(detail.pages);
          return;
        }
      }
      retry();
    };
    const handlePagesSync = (e: Event) => {
      const detail = (e as CustomEvent<{ pages?: PageRegistry }>).detail;
      if (detail?.pages) {
        setPages(detail.pages);
      }
    };
    const handleUpdatedAtSync = (e: Event) => {
      const detail = (e as CustomEvent<{ updatedAt?: string }>).detail;
      if (typeof detail?.updatedAt === 'string' && detail.updatedAt) {
        draftUpdatedAtRef.current = detail.updatedAt;
        setDraftUpdatedAt(detail.updatedAt);
      }
    };
    window.addEventListener(eventName, handleExternalSync);
    if (isDevMode) {
      window.addEventListener(EVENT_DRAFT_PAGES_CHANGE, handlePagesSync);
      window.addEventListener(EVENT_DRAFT_UPDATED_AT_SYNC, handleUpdatedAtSync);
    }
    return () => {
      window.removeEventListener(eventName, handleExternalSync);
      if (isDevMode) {
        window.removeEventListener(EVENT_DRAFT_PAGES_CHANGE, handlePagesSync);
        window.removeEventListener(EVENT_DRAFT_UPDATED_AT_SYNC, handleUpdatedAtSync);
      }
    };
  }, [isDevMode, retry]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
      setIsHydrating(false);
      setHasHydrated(true);
      return;
    }

    if (!isDevMode && initialManifest && retryCount === 0 && !hasSkippedInitialFetchRef.current) {
      hasSkippedInitialFetchRef.current = true;
      return;
    }
    hasSkippedInitialFetchRef.current = true;

    let isCancelled = false;
    setIsHydrating(true);
    setHydrationError(null);

    const hydrate = async () => {
      try {
        if (isDevMode) {
          const result = await fetchDraftWorkspaceChrome(lockToken);
          if (isCancelled) return;
          setContentOverrides(result.contentOverrides);
          setPages(result.pages);
          draftUpdatedAtRef.current = result.updatedAt;
          setDraftUpdatedAt(result.updatedAt);
          if (result.updatedAt) {
            setLastKnownDraftUpdatedAt(result.updatedAt);
          }
        } else {
          const chrome = await fetchPublicManifestChrome();
          if (isCancelled) return;
          setContentOverrides(chrome.contentOverrides);
          setPages(chrome.pages);
          setPublishedPages(chrome.pages);
          setDraftUpdatedAt(null);
        }
        backoffAttemptRef.current = 0;
        setHydrationError(null);
        setHasHydrated(true);
      } catch (err) {
        if (isCancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load portal chrome from KV.';
        setHydrationError(message);
      } finally {
        if (!isCancelled) {
          setIsHydrating(false);
        }
      }
    };

    hydrate();

    return () => {
      isCancelled = true;
    };
  }, [isDevMode, lockToken, retryCount, initialManifest]);

  const updateOverride = useCallback(
    async (key: string, value: string): Promise<void> => {
      if (!isDevMode) {
        throw new Error('Cannot mutate content overrides in Public Mode.');
      }
      await enqueueDraftMutation(async () => {
        const result = await updateDraftContentOverride(key, value, overridesRef.current, {
          lockToken,
          expectedUpdatedAt: getLastKnownDraftUpdatedAt() ?? draftUpdatedAtRef.current,
        });
        overridesRef.current = result.contentOverrides;
        setContentOverrides(result.contentOverrides);
        if (result.updatedAt !== null) {
          draftUpdatedAtRef.current = result.updatedAt;
          setDraftUpdatedAt(result.updatedAt);
          dispatchDraftUpdatedAtSync(result.updatedAt);
        }
      });
    },
    [isDevMode, lockToken]
  );

  const removeOverride = useCallback(
    async (key: string): Promise<void> => {
      if (!isDevMode) {
        throw new Error('Cannot reset content overrides in Public Mode.');
      }
      await enqueueDraftMutation(async () => {
        const result = await removeDraftContentOverride(key, overridesRef.current, {
          lockToken,
          expectedUpdatedAt: getLastKnownDraftUpdatedAt() ?? draftUpdatedAtRef.current,
        });
        overridesRef.current = result.contentOverrides;
        setContentOverrides(result.contentOverrides);
        if (result.updatedAt !== null) {
          draftUpdatedAtRef.current = result.updatedAt;
          setDraftUpdatedAt(result.updatedAt);
          dispatchDraftUpdatedAtSync(result.updatedAt);
        }
      });
    },
    [isDevMode, lockToken]
  );

  const commitWorkspaceMutation = useCallback(
    async (mutation: {
      canvases?: Record<string, NodeCanvasDocument>;
      pages?: PageRegistry;
      contentOverrides?: Record<string, string>;
      deletedPageIds?: string[];
    }): Promise<DraftWorkspacePayload> => {
      if (!isDevMode) {
        throw new Error('Cannot commit workspace mutations in Public Mode.');
      }
      const updated = await commitDraftWorkspaceTransaction(mutation, {
        lockToken,
      });
      if (updated.pages) {
        setPages(updated.pages);
      }
      if (updated.contentOverrides) {
        overridesRef.current = updated.contentOverrides;
        setContentOverrides(updated.contentOverrides);
      }
      if (updated.updatedAt) {
        draftUpdatedAtRef.current = updated.updatedAt;
        setDraftUpdatedAt(updated.updatedAt);
      }
      return updated;
    },
    [isDevMode, lockToken]
  );

  const value: PortalChromeContextValue = {
    contentOverrides,
    pages,
    publishedPages,
    isHydrating,
    hasHydrated,
    hydrationError,
    error: hydrationError,
    draftUpdatedAt,
    retry,
    updateOverride,
    removeOverride,
    commitWorkspaceMutation,
  };

  return (
    <PortalChromeContext.Provider value={value}>
      {hydrationError && (
        <TopErrorBanner
          message={hydrationError}
          onRetry={retry}
        />
      )}
      {children}
    </PortalChromeContext.Provider>
  );
};

export function usePortalChrome(): PortalChromeContextValue | null {
  return useContext(PortalChromeContext);
}
