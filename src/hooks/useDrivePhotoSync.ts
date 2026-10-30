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
} from '../types/source';
import { syncFolderPhotos } from '../services/drivePhotoSyncService';
import { useSourcePoint } from './useSourcePoint';
import { STORAGE_KEY_SOURCE_CACHE, getSourceSourceSync } from '../services/sourceService';
import { normalizePointId } from '../utils/source';

export function useDrivePhotoSync(nodeId: string): UseDrivePhotoSyncResult {
  const { source, folderUrl } = useSourcePoint(nodeId);
  const [isPending, startTransition] = useTransition();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastStats, setLastStats] = useState<DriveReconciliationStats | null>(null);
  const [crossTabPhotos, setCrossTabPhotos] = useState<SyncedSourceItem[] | null>(null);

  const normalizedKey = normalizePointId(nodeId);

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

  // Reset cross-tab override whenever canonical source updates
  useEffect(() => {
    setCrossTabPhotos(null);
  }, [source]);

  const syncedPhotos = crossTabPhotos ?? source?.syncedPhotos ?? [];
  const hasEverSynced = crossTabPhotos !== null || source?.syncedPhotos !== undefined;

  const syncState: SyncState = useMemo(() => {
    if (isManualSyncing || isPending) return 'syncing';
    if (error) return 'sync_error';
    if (!hasEverSynced) return 'never_synced';
    return syncedPhotos.length > 0 ? 'synced_success' : 'synced_empty';
  }, [isManualSyncing, isPending, error, hasEverSynced, syncedPhotos.length]);

  const syncPhotos = useCallback(async (): Promise<DriveReconciliationStats | null> => {
    if (!folderUrl) {
      setError('No Google Drive folder linked to this node.');
      return null;
    }

    setIsManualSyncing(true);
    setError(null);

    try {
      const result = await syncFolderPhotos(nodeId, folderUrl, syncedPhotos);

      startTransition(() => {
        setLastStats(result.stats);
      });

      return result.stats;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to sync photos from Google Drive.';
      setError(message);
      throw err;
    } finally {
      setIsManualSyncing(false);
    }
  }, [nodeId, folderUrl, syncedPhotos]);

  return {
    syncedPhotos,
    syncState,
    hasSynced: hasEverSynced,
    isSyncing: isManualSyncing || isPending,
    error,
    lastStats,
    syncPhotos,
  };
}

export default useDrivePhotoSync;
