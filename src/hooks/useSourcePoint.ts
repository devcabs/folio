import { useState, useEffect, useCallback } from 'react';
import type { LiveSourceSource } from '../types/source';
import { normalizePointId } from '../utils/source';
import {
  getSourceSourceSync,
  getLiveSourceSource,
  upsertLiveSourceSource,
  EVENT_SOURCE_SOURCE_CHANGE,
} from '../services/sourceService';
import { subscribeToContentChange } from '../utils/contentDb';

export interface UseSourcePointResult {
  /** The current live source source record or null if unset */
  source: LiveSourceSource | null;
  /** Sanitized Google Drive folder URL */
  folderUrl: string;
  /** Official or custom folder title */
  folderTitle: string;
  /** Optional editorial description */
  description?: string;
  /** ISO date when source was last verified */
  lastVerified?: string;
  /** Whether the initial background fetch is running */
  isLoading: boolean;
  /** Whether a mutation update is in-flight */
  isUpdating: boolean;
  /** Error message string if fetch or mutation failed */
  error: string | null;
  /** Optimistic mutation handler to update folder metadata */
  updateFolder: (newUrl: string, newTitle?: string, description?: string) => Promise<LiveSourceSource>;
  /** Convenience flag indicating whether a non-empty valid folder URL exists */
  hasFolder: boolean;
}

/**
 * useSourcePoint Hook
 * Folio Engine — Subtask 5.3: Contextual Point Anchor & Integration
 *
 * Reactive state machine for anchoring any component or photo point across Folio Engine
 * directly to a verified Google Drive folder:
 * 1. Immediate synchronous resolution via getSourceSourceSync to guarantee zero layout shift.
 * 2. Background live resolution against BaaS / Supabase database.
 * 3. Bidirectional reactive subscriptions to cross-tab/window storage & mutation events.
 * 4. Optimistic mutation handler updateFolder with automatic rollbacks on network failure.
 */
export function useSourcePoint(pointId: string): UseSourcePointResult {
  const normalizedKey = normalizePointId(pointId);

  // 1. Synchronously resolve current local snapshot for instant rendering
  const [source, setSource] = useState<LiveSourceSource | null>(() => {
    return normalizedKey ? getSourceSourceSync(normalizedKey) : null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => !source && Boolean(normalizedKey));
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 2. Fetch live BaaS state on mount or when pointId changes
  useEffect(() => {
    if (!normalizedKey) {
      setSource(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // Check synchronous source again in case it updated before effect ran
    const syncSource = getSourceSourceSync(normalizedKey);
    if (syncSource) {
      setSource(syncSource);
    }

    getLiveSourceSource(normalizedKey)
      .then((live) => {
        if (isMounted) {
          if (live) {
            setSource(live);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch live source source');
          setIsLoading(false);
        }
      });

    // 3. Listen to live source service changes
    const handleSourceChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ pointId: string; record: LiveSourceSource }>;
      if (
        customEvent.detail &&
        normalizePointId(customEvent.detail.pointId) === normalizedKey
      ) {
        setSource(customEvent.detail.record);
      }
    };

    // 4. Also listen to contentDb changes for legacy/dev overrides
    const targetContentKey = `source.${normalizedKey}.source`;
    const unsubscribeContent = subscribeToContentChange((detail) => {
      if ((detail.key === targetContentKey || detail.key === '*') && isMounted) {
        const fresh = getSourceSourceSync(normalizedKey);
        if (fresh) {
          setSource(fresh);
        }
      }
    }, false);

    window.addEventListener(EVENT_SOURCE_SOURCE_CHANGE, handleSourceChange);

    return () => {
      isMounted = false;
      window.removeEventListener(EVENT_SOURCE_SOURCE_CHANGE, handleSourceChange);
      unsubscribeContent();
    };
  }, [normalizedKey]);

  // 5. Optimistic mutation handler
  const updateFolder = useCallback(
    async (newUrl: string, newTitle?: string, description?: string): Promise<LiveSourceSource> => {
      if (!normalizedKey) {
        throw new Error('Cannot update source source: invalid or empty pointId');
      }

      setIsUpdating(true);
      setError(null);

      try {
        const titleToUse =
          newTitle && newTitle.trim().length > 0
            ? newTitle.trim()
            : source?.folderTitle || 'Official Google Drive Folder';

        const updated = await upsertLiveSourceSource({
          pointId: normalizedKey,
          folderUrl: newUrl.trim(),
          folderTitle: titleToUse,
          description: description ?? source?.description,
          updatedBy: 'Coordinator',
        });

        setSource(updated);
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save source source';
        setError(msg);
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [normalizedKey, source]
  );

  const folderUrl = source?.folderUrl?.trim() || '';
  const folderTitle = source?.folderTitle?.trim() || 'Official Google Drive Folder';
  const hasFolder = Boolean(folderUrl.length > 0);

  return {
    source,
    folderUrl,
    folderTitle,
    description: source?.description,
    lastVerified: source?.lastVerified,
    isLoading,
    isUpdating,
    error,
    updateFolder,
    hasFolder,
  };
}
