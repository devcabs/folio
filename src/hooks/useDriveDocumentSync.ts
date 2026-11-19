/**
 * Reactive SWR Google Drive PDF Document Sync Hook
 * Folio Engine
 * Subtask 11.4: Google Drive PDF Folder Sync Service & useDriveDocumentSync Hook
 *
 * Implements a non-blocking React 19 hook for Google Drive PDF synchronization:
 * - Deterministic 5-State Coexistence Lifecycle:
 *     never_synced | syncing | synced_success | synced_empty | sync_error
 * - Reads syncedDocuments strictly from DocumentsElement AST in NodeCanvasDocument
 * - Persists reconciled documents directly to DocumentsElement AST via onPersistDocuments (PUT /api/draft)
 */

import { useState, useCallback, useTransition, useMemo, useEffect, useRef } from 'react';
import type {
  SyncedDocumentItem,
  DriveReconciliationStats,
  SyncState,
  UseDriveDocumentSyncResult,
  DriveSyncOptions,
  UseDriveDocumentSyncOptions,
} from '../types/source';
import { syncFolderDocuments } from '../services/driveDocumentSyncService';

export function useDriveDocumentSync(
  nodeId: string,
  options?: UseDriveDocumentSyncOptions
): UseDriveDocumentSyncResult {
  const [isPending, startTransition] = useTransition();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [cloudSynced, setCloudSynced] = useState<boolean | undefined>(undefined);
  const [lastStats, setLastStats] = useState<DriveReconciliationStats | null>(null);

  const activeFolderUrl = (options?.folderUrl && options.folderUrl.trim()) || '';
  const syncedDocuments: SyncedDocumentItem[] = options?.syncedDocuments ?? [];
  const hasEverSynced = options?.syncedDocuments !== undefined;

  const syncState: SyncState = useMemo(() => {
    if (isManualSyncing || isPending) return 'syncing';
    if (error) return 'sync_error';
    if (!hasEverSynced) return 'never_synced';
    return syncedDocuments.length > 0 ? 'synced_success' : 'synced_empty';
  }, [isManualSyncing, isPending, error, hasEverSynced, syncedDocuments.length]);

  const syncDocuments = useCallback(
    async (syncOptions?: boolean | DriveSyncOptions): Promise<DriveReconciliationStats | null> => {
      const isBackground =
        typeof syncOptions === 'boolean' ? syncOptions : Boolean(syncOptions?.isBackground);

      if (!activeFolderUrl) {
        const msg = options?.isElementLevel
          ? 'No Google Drive folder linked to this document list. Attach a Drive folder before syncing.'
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
        const result = await syncFolderDocuments(nodeId, activeFolderUrl, syncedDocuments);

        if (options?.onPersistDocuments) {
          const persistResult = await options.onPersistDocuments(
            result.items,
            result.lastVerified
          );
          if (
            persistResult &&
            typeof persistResult === 'object' &&
            'ok' in persistResult &&
            !persistResult.ok
          ) {
            throw new Error(
              persistResult.error || 'Failed to persist synced documents to draft KV.'
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
          err instanceof Error ? err.message : 'Failed to sync PDFs from Google Drive.';
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
    [nodeId, activeFolderUrl, syncedDocuments, options]
  );

  // Auto-sync on mount when activeFolderUrl is present and documents have not yet been synced
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
    void syncDocuments({ isBackground: true }).catch(() => {
      // backgroundError is captured inside syncDocuments
    });
  }, [
    activeFolderUrl,
    hasEverSynced,
    isManualSyncing,
    isBackgroundSyncing,
    syncDocuments,
    options?.autoSync,
  ]);

  return {
    syncedDocuments,
    syncState,
    hasSynced: hasEverSynced,
    isSyncing: isManualSyncing || isBackgroundSyncing || isPending,
    isManualSyncing,
    isBackgroundSyncing,
    error,
    backgroundError,
    cloudSynced,
    lastStats,
    syncDocuments,
  };
}

export default useDriveDocumentSync;
export type { UseDriveDocumentSyncOptions };
