import type { NodeCode, SourceItem } from './node';

export interface SourceSource {
  pointId: NodeCode | string;
  folderUrl: string;
  folderTitle: string;
  description?: string;
  lastVerified?: string;
}

export type SourceSourceRegistry = Record<string, SourceSource>;

export interface DrivePhotoFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webContentLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

/**
 * SyncedSourceItem
 * Contract Unification: Directly extends Canonical SourceItem so all existing
 * gallery, card, and lightbox components accept it without mapping overhead.
 */
export interface SyncedSourceItem extends SourceItem {
  pointId?: string;
  driveFileId: string;
  originalFileName: string;
  thumbnailUrl: string;
  fullImageUrl: string;
  isCustomTitle?: boolean;
  orderIndex: number;
  category?: string;
  date?: string;
}

export interface DriveReconciliationStats {
  added: number;
  removed: number;
  retained: number;
  total: number;
  hasChanged: boolean;
}

export interface DriveReconciliationResult {
  items: SyncedSourceItem[];
  stats: DriveReconciliationStats;
}

export type SyncState =
  | 'never_synced'
  | 'syncing'
  | 'synced_success'
  | 'synced_empty'
  | 'sync_error';

export interface SyncFolderPhotosResult {
  items: SyncedSourceItem[];
  stats: DriveReconciliationStats;
  source: LiveSourceSource;
}

export interface UseDrivePhotoSyncResult {
  syncedPhotos: SyncedSourceItem[];
  syncState: SyncState;
  hasSynced: boolean;
  isSyncing: boolean;
  error: string | null;
  lastStats: DriveReconciliationStats | null;
  syncPhotos: () => Promise<DriveReconciliationStats | null>;
}

export interface LiveSourceSource {
  pointId: NodeCode | string;
  folderUrl: string;
  folderTitle: string;
  description?: string;
  updatedBy: string;
  lastVerified: string;
  createdAt: string;
  syncedPhotos?: SyncedSourceItem[];
}

export type LiveSourceRegistry = Record<string, LiveSourceSource>;

export interface UpsertSourcePayload {
  pointId: string;
  folderUrl: string;
  folderTitle: string;
  description?: string;
  updatedBy?: string;
  syncedPhotos?: SyncedSourceItem[];
}

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface UseImageLoaderResult {
  status: ImageLoadingStatus;
  isLoading: boolean;
  isLoaded: boolean;
  isError: boolean;
  resolvedSrc?: string;
  retry: () => void;
}
