/**
 * Reactive SWR Google Drive Photo Sync Hook
 * Folio Engine
 * Subtask 6.2: Zero-Quota Public Cache & Persistence Layer
 *
 * Implements a non-blocking React 19 SWR hook for Google Drive photo synchronization:
 * - Deterministic 5-State Coexistence Lifecycle:
 *     never_synced | syncing | synced_success | synced_empty | sync_error
 * - React 19 useTransition wrapper to eliminate UI render blocking
 * - Synchronous local storage reading for zero layout shift (CLS = 0)
 * - Cross-tab / multi-window synchronization via storage events
 */

import { useState, useCallback, useTransition, useMemo, useEffect } from 'react';
import type {
  SyncedSourceItem,
  DriveReconciliationStats,
  SyncState,
  UseDrivePhotoSyncResult,
  DriveSyncOptions,
  UseDrivePhotoSyncOptions,
} from '../types/source';
import { syncFolderPhotos } from '../services/drivePhotoSyncService';
import { useSourcePoint } from './useSourcePoint';
import {
  STORAGE_KEY_SOURCE_CACHE,
  getSourceSourceSync,
  EVENT_SOURCE_SYNC_STATUS,
  type SourceSyncStatusDetail,
} from '../services/sourceService';
import { normalizePointId } from '../utils/source';

export function useDrivePhotoSync(
  nodeId: string,
  options?: UseDrivePhotoSyncOptions
): UseDrivePhotoSyncResult {
  const normalizedKey = normalizePointId(nodeId);
  const { source, folderUrl: pointFolderUrl } = useSourcePoint(nodeId);

  const [isPending, startTransition] = useTransition();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [cloudSynced, setCloudSynced] = useState<boolean | undefined>(undefined);
  const [lastStats, setLastStats] = useState<DriveReconciliationStats | null>(null);
  const [crossTabPhotos, setCrossTabPhotos] = useState<SyncedSourceItem[] | null>(null);

  // Cross-tab / multi-window storage event listener
  useEffect(() => {
    if (typeof window === 'undefined' || !normalizedKey) return;

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_SOURCE_CACHE) {
        const fresh = getSourceSourceSync(normalizedKey);
        if (fresh && fresh.syncedPhotos !== undefined) {
          setCrossTabPhotos(fresh.syncedPhotos);
        }
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [normalizedKey]);

  // Cloud sync observability status listener
  useEffect(() => {
    if (typeof window === 'undefined' || !normalizedKey) return;

    const handleSyncStatus = (e: Event) => {
      const detail = (e as CustomEvent<SourceSyncStatusDetail>).detail;
      if (!detail) return;
      if (normalizePointId(detail.pointId) === normalizedKey) {
        setCloudSynced(detail.cloudSynced);
        if (!detail.cloudSynced && detail.error) {
          if (detail.isBackground) {
            setBackgroundError(detail.error);
          }
        }
      }
    };

    window.addEventListener(EVENT_SOURCE_SYNC_STATUS, handleSyncStatus);
    return () => {
      window.removeEventListener(EVENT_SOURCE_SYNC_STATUS, handleSyncStatus);
    };
  }, [normalizedKey]);

  // Reset cross-tab override whenever canonical source updates
  useEffect(() => {
    setCrossTabPhotos(null);
  }, [source]);

  const activeFolderUrl = (options?.folderUrl && options.folderUrl.trim()) || pointFolderUrl || '';
  const syncedPhotos = crossTabPhotos ?? source?.syncedPhotos ?? [];
  const hasEverSynced = crossTabPhotos !== null || source?.syncedPhotos !== undefined;

  const syncState: SyncState = useMemo(() => {
    if (isManualSyncing || isPending) return 'syncing';
    if (error) return 'sync_error';
    if (!hasEverSynced) return 'never_synced';
    return syncedPhotos.length > 0 ? 'synced_success' : 'synced_empty';
  }, [isManualSyncing, isPending, error, hasEverSynced, syncedPhotos.length]);

  const syncPhotos = useCallback(
    async (syncOptions?: boolean | DriveSyncOptions): Promise<DriveReconciliationStats | null> => {
      const isBackground =
        typeof syncOptions === 'boolean' ? syncOptions : Boolean(syncOptions?.isBackground);
      const authToken =
        typeof syncOptions === 'object' ? syncOptions?.authToken : undefined;

      if (!activeFolderUrl) {
        const msg = options?.isElementLevel
          ? 'No Google Drive folder linked to this gallery. Attach a Drive folder before syncing.'
          : 'No Google Drive folder linked to this node.';
        if (!isBackground) {
          setError(msg);
          throw new Error(msg);
        } else {
          setBackgroundError(msg);
          return null;
        }
      }

      if (isBackground) {
        setIsBackgroundSyncing(true);
      } else {
        setIsManualSyncing(true);
        setError(null);
      }

      try {
        const result = await syncFolderPhotos(
          nodeId,
          activeFolderUrl,
          syncedPhotos,
          authToken,
          { isBackground, authToken }
        );

        startTransition(() => {
          setLastStats(result.stats);
          if (result.cloudSynced !== undefined) {
            setCloudSynced(result.cloudSynced);
          }
        });

        if (result.cloudSynced === false && result.cloudError) {
          if (isBackground) {
            setBackgroundError(result.cloudError);
          }
        }

        return result.stats;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to sync photos from Google Drive.';
        if (isBackground) {
          setBackgroundError(message);
          return null;
        } else {
          setError(message);
          throw err;
        }
      } finally {
        if (isBackground) {
          setIsBackgroundSyncing(false);
        } else {
          setIsManualSyncing(false);
        }
      }
    },
    [nodeId, activeFolderUrl, syncedPhotos, options?.isElementLevel]
  );

  return {
    syncedPhotos,
    syncState,
    hasSynced: hasEverSynced,
    isSyncing: isManualSyncing || isBackgroundSyncing || isPending,
    isManualSyncing,
    isBackgroundSyncing,
    error,
    backgroundError,
    cloudSynced,
    lastStats,
    syncPhotos,
  };
}

export default useDrivePhotoSync;
export type { UseDrivePhotoSyncOptions };
