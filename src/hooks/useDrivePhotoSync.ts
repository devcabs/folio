/**
 * Reactive SWR Google Drive Photo Sync Hook
 * Folio Engine
 * Subtask 7.8: Embedded AST Evidence Galleries & Google Drive Photo Sync SSOT
 *
 * Implements a non-blocking React 19 hook for Google Drive photo synchronization:
 * - Deterministic 5-State Coexistence Lifecycle:
 *     never_synced | syncing | synced_success | synced_empty | sync_error
 * - Reads syncedPhotos strictly from GalleryElement AST in NodeCanvasDocument
 * - Persists reconciled photos directly to GalleryElement AST via onPersistPhotos (PUT /api/draft)
 */

import { useState, useCallback, useTransition, useMemo, useEffect, useRef } from 'react';
import type {
  SyncedSourceItem,
  DriveReconciliationStats,
  SyncState,
  UseDrivePhotoSyncResult,
  DriveSyncOptions,
  UseDrivePhotoSyncOptions,
} from '../types/source';
import { syncFolderPhotos } from '../services/drivePhotoSyncService';

export function useDrivePhotoSync(
  nodeId: string,
  options?: UseDrivePhotoSyncOptions
): UseDrivePhotoSyncResult {
  const [isPending, startTransition] = useTransition();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [cloudSynced, setCloudSynced] = useState<boolean | undefined>(undefined);
  const [lastStats, setLastStats] = useState<DriveReconciliationStats | null>(null);

  const activeFolderUrl = (options?.folderUrl && options.folderUrl.trim()) || '';
  const syncedPhotos: SyncedSourceItem[] = options?.syncedPhotos ?? [];
  const hasEverSynced = options?.syncedPhotos !== undefined;

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
        const result = await syncFolderPhotos(nodeId, activeFolderUrl, syncedPhotos);

        if (options?.onPersistPhotos) {
          const persistResult = await options.onPersistPhotos(result.items, result.lastVerified);
          if (
            persistResult &&
            typeof persistResult === 'object' &&
            'ok' in persistResult &&
            !persistResult.ok
          ) {
            throw new Error(
              persistResult.error || 'Failed to persist synced photos to draft KV.'
            );
          }
        }

        startTransition(() => {
          setLastStats(result.stats);
          setCloudSynced(true);
        });

        return result.stats;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to sync photos from Google Drive.';
        setCloudSynced(false);
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
    [nodeId, activeFolderUrl, syncedPhotos, options]
  );

  // Auto-sync on mount when activeFolderUrl is present and photos have not yet been synced
  const hasAttemptedAutoSyncRef = useRef(false);
  const lastFolderUrlRef = useRef(activeFolderUrl);

  useEffect(() => {
    if (lastFolderUrlRef.current !== activeFolderUrl) {
      lastFolderUrlRef.current = activeFolderUrl;
      hasAttemptedAutoSyncRef.current = false;
    }
  }, [activeFolderUrl]);

  useEffect(() => {
    if (!options?.autoSync) return;
    if (hasAttemptedAutoSyncRef.current) return;
    if (!activeFolderUrl || hasEverSynced || isManualSyncing || isBackgroundSyncing) return;

    hasAttemptedAutoSyncRef.current = true;
    void syncPhotos({ isBackground: true }).catch(() => {
      // backgroundError is captured inside syncPhotos
    });
  }, [activeFolderUrl, hasEverSynced, isManualSyncing, isBackgroundSyncing, syncPhotos, options?.autoSync]);

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
