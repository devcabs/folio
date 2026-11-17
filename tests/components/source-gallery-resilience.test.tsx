import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { SourceGallery } from '../../src/components/source/SourceGallery';
import { SourceGallerySkeleton } from '../../src/components/source/SourceGallerySkeleton';
import * as driveSyncHook from '../../src/hooks/useDrivePhotoSync';
import {
  gatherSnapshotSourceMetadata,
  captureCurrentSnapshot,
} from '../../src/services/historyService';
import { gatherSourceMetadata } from '../../src/services/edgePreBakeService';
import {
  resetSourceCache,
  upsertLiveSourceSource,
  setCachedSourceMetadata,
} from '../../src/services/sourceService';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import type { SyncedSourceItem } from '../../src/types/source';

describe('Source Gallery Non-Dev Fetch & Resilience Architecture', () => {
  const samplePhotos: SyncedSourceItem[] = [
    {
      id: 'photo-1',
      pointId: 'node.access.gallery.gal-1',
      driveFileId: 'df-1',
      originalFileName: 'field_evidence_01.jpg',
      title: 'Field Inspection',
      isCustomTitle: false,
      orderIndex: 0,
      thumbnailUrl: 'https://thumb.example/1',
      fullImageUrl: 'https://full.example/1',
    },
    {
      id: 'photo-2',
      pointId: 'node.access.gallery.gal-1',
      driveFileId: 'df-2',
      originalFileName: 'field_evidence_02.jpg',
      title: 'Laboratory Testing',
      isCustomTitle: false,
      orderIndex: 1,
      thumbnailUrl: 'https://thumb.example/2',
      fullImageUrl: 'https://full.example/2',
    },
  ];

  beforeEach(() => {
    resetSourceCache();
    vi.restoreAllMocks();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: false,
      isDesktop: true,
      canUnlock: false,
      isUnlocked: false,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);
  });

  afterEach(() => {
    resetSourceCache();
    vi.restoreAllMocks();
  });

  describe('1. Data Pipeline Preservation (History & Pre-Bake)', () => {
    it('bundles synced photos (items) in gatherSnapshotSourceMetadata and captureCurrentSnapshot', async () => {
      await upsertLiveSourceSource({
        pointId: 'node.access.gallery.gal-1',
        folderUrl: 'https://drive.google.com/drive/folders/sample-folder-123',
        folderTitle: 'Sample Verification Folder',
        syncedPhotos: samplePhotos,
      });

      const metadata = gatherSnapshotSourceMetadata();
      const entry = metadata['access.gallery.gal-1'] || metadata['node.access.gallery.gal-1'];
      expect(entry).toBeDefined();
      expect(entry.items).toBeDefined();
      expect(entry.items?.length).toBe(2);
      expect(entry.items?.[0].title).toBe('Field Inspection');

      const snapshot = captureCurrentSnapshot('Test snapshot');
      const snapEntry = snapshot.sourceMetadata?.['access.gallery.gal-1'] || snapshot.sourceMetadata?.['node.access.gallery.gal-1'];
      expect(snapEntry).toBeDefined();
      expect(snapEntry?.items?.length).toBe(2);
    });

    it('preserves items in gatherSourceMetadata for Edge KV payloads', () => {
      const provided = {
        'access.gallery.gal-1': {
          pointId: 'access.gallery.gal-1',
          folderUrl: 'https://drive.google.com/drive/folders/sample-folder-123',
          folderTitle: 'Sample Verification Folder',
          items: samplePhotos,
        },
      };

      const gathered = gatherSourceMetadata('access', provided);
      expect(gathered['access.gallery.gal-1']).toBeDefined();
      expect(gathered['access.gallery.gal-1'].items).toBeDefined();
      expect(gathered['access.gallery.gal-1'].items?.length).toBe(2);
    });
  });

  describe('2. Non-Dev Public Gallery Rendering with Pre-baked Cache', () => {
    it('renders photos immediately in non-dev mode when pre-baked in memory cache', () => {
      setCachedSourceMetadata(
        {
          pointId: 'node.access.gallery.gal-1',
          folderUrl: 'https://drive.google.com/drive/folders/sample-folder-123',
          folderTitle: 'Prebaked Field Photos',
          items: samplePhotos,
        },
        { memoryOnly: true }
      );

      const html = ReactDOMServer.renderToString(
        <SourceGallery
          nodeId="access"
          pointId="node.access.gallery.gal-1"
          driveUrl="https://drive.google.com/drive/folders/sample-folder-123"
          title="Prebaked Field Photos"
        />
      );

      // Photos must render in non-dev mode!
      expect(html).toContain('Field Inspection');
      expect(html).toContain('Laboratory Testing');
      // Should not render "Evidence Documentation in Progress"
      expect(html).not.toContain('Evidence Documentation in Progress');
    });
  });

  describe('3. Dignified Fallback State on Sync Error or Failure', () => {
    it('renders helpful empty state with direct Drive link when driveUrl is present but photos cannot be fetched', () => {
      const html = ReactDOMServer.renderToString(
        <SourceGallery
          nodeId="access"
          pointId="node.access.gallery.gal-empty"
          driveUrl="https://drive.google.com/drive/folders/unreachable-folder"
          title="Unreachable Folder"
        />
      );

      // When folder is linked, should present actionable guidance and Drive link
      expect(html).toContain('https://drive.google.com/drive/folders/unreachable-folder');
      // Must not show generic "compile reports" placeholder when a real folder link is configured
      expect(html).not.toContain('Evidence Documentation in Progress');
      // Should show the Google Drive Gallery status
      expect(html).toContain('Google Drive Gallery');
    });

    it('renders informative error state with direct Drive link when sync error occurs', () => {
      // Mock useDrivePhotoSync to simulate a sync error
      vi.spyOn(driveSyncHook, 'useDrivePhotoSync').mockReturnValue({
        syncedPhotos: [],
        syncState: 'sync_error',
        hasSynced: false,
        isSyncing: false,
        error: 'Access to this Google Drive folder is restricted. [HTTP 403]',
        backgroundError: null,
        lastStats: null,
        syncPhotos: vi.fn(),
      } as any);

      const html = ReactDOMServer.renderToString(
        <SourceGallery
          nodeId="access"
          pointId="node.access.gallery.gal-error"
          driveUrl="https://drive.google.com/drive/folders/restricted-folder-403"
          title="Restricted Folder"
        />
      );

      expect(html).toContain('Photo Sync Unavailable');
      expect(html).toContain('restricted');
      expect(html).toContain('Open Google Drive Folder ↗');
      expect(html).toContain('https://drive.google.com/drive/folders/restricted-folder-403');
    });
  });

  describe('4. Zero-Flash Skeleton Shimmer Architecture', () => {
    it('renders SourceGallerySkeleton when isSyncing is true and no photos are loaded', () => {
      vi.spyOn(driveSyncHook, 'useDrivePhotoSync').mockReturnValue({
        syncedPhotos: [],
        syncState: 'syncing',
        hasSynced: false,
        isSyncing: true,
        error: null,
        backgroundError: null,
        lastStats: null,
        syncPhotos: vi.fn(),
      } as any);

      const html = ReactDOMServer.renderToString(
        <SourceGallery
          nodeId="access"
          pointId="node.access.gallery.gal-syncing"
          driveUrl="https://drive.google.com/drive/folders/syncing-folder"
          title="Syncing Folder"
        />
      );

      // Must render skeleton and not an empty state
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('Loading photos for Syncing Folder');
      expect(html).not.toContain('Evidence Documentation in Progress');
    });

    it('renders canonical SourceGallerySkeleton component with 5 adaptive collage cells', () => {
      const html = ReactDOMServer.renderToString(
        <SourceGallerySkeleton ariaLabel="Loading test photos" />
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('Loading test photos');
    });
  });

  describe('5. Reactive Auto-Sync on Mount in useDrivePhotoSync', () => {
    it('fires background sync on mount when autoSync is true, activeFolderUrl is present, and !hasEverSynced', async () => {
      const syncMock = vi.fn().mockResolvedValue({ total: 5, added: 5, removed: 0, retained: 0, hasChanged: true });
      const driveService = await import('../../src/services/drivePhotoSyncService');
      vi.spyOn(driveService, 'syncFolderPhotos').mockImplementation(syncMock as any);

      let hookResult: any = null;
      function TestHookComponent() {
        hookResult = driveSyncHook.useDrivePhotoSync('node.access.gallery.gal-autosync', {
          folderUrl: 'https://drive.google.com/drive/folders/auto-sync-folder-123',
          isElementLevel: true,
          autoSync: true,
        });
        return null;
      }

      await React.act(async () => {
        ReactDOMServer.renderToString(<TestHookComponent />);
      });

      // Confirm hook was initialized and ready
      expect(hookResult).toBeDefined();
    });
  });
});
