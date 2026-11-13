import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { useDrivePhotoSync } from '../../src/hooks/useDrivePhotoSync';
import type { UseDrivePhotoSyncResult, UseDrivePhotoSyncOptions } from '../../src/types/source';
import * as drivePhotoSyncService from '../../src/services/drivePhotoSyncService';
import {
  notifySyncStatus,
  resetSourceCache,
  upsertLiveSourceSource,
} from '../../src/services/sourceService';

function setupDomEnvironment() {
  class Element {}
  class HTMLElement extends Element {}
  class HTMLIFrameElement extends HTMLElement {}
  class Document {}

  (global as any).Element = (global as any).Element || Element;
  (global as any).HTMLElement = (global as any).HTMLElement || HTMLElement;
  (global as any).HTMLIFrameElement = (global as any).HTMLIFrameElement || HTMLIFrameElement;
  (global as any).Document = (global as any).Document || Document;
  (global as any).window = (global as any).window || global;

  (global as any).window.Element = (global as any).Element;
  (global as any).window.HTMLElement = (global as any).HTMLElement;
  (global as any).window.HTMLIFrameElement = (global as any).HTMLIFrameElement;
  (global as any).window.Document = (global as any).Document;

  const eventListeners: Record<string, ((e: any) => void)[]> = {};

  (global as any).window.addEventListener = (type: string, fn: any) => {
    eventListeners[type] = eventListeners[type] || [];
    eventListeners[type].push(fn);
  };
  (global as any).window.removeEventListener = (type: string, fn: any) => {
    if (eventListeners[type]) {
      eventListeners[type] = eventListeners[type].filter((f) => f !== fn);
    }
  };
  (global as any).window.dispatchEvent = (evt: any) => {
    const list = eventListeners[evt?.type] || [];
    for (const fn of [...list]) {
      fn(evt);
    }
    return true;
  };

  (global as any).addEventListener = (global as any).window.addEventListener;
  (global as any).removeEventListener = (global as any).window.removeEventListener;
  (global as any).dispatchEvent = (global as any).window.dispatchEvent;
  (global as any).IS_REACT_ACT_ENVIRONMENT = true;

  if (!(global as any).CustomEvent) {
    class CustomEvent<T = any> extends Event {
      detail: T;
      constructor(type: string, params?: { detail?: T }) {
        super(type);
        this.detail = params?.detail as T;
      }
    }
    (global as any).CustomEvent = CustomEvent;
  }

  (global as any).document = {
    nodeType: 9,
    activeElement: null,
    defaultView: (global as any).window,
    documentElement: { style: {} },
    createElement(tag: string) {
      const el = new HTMLElement();
      Object.assign(el, {
        nodeType: 1,
        tagName: tag.toUpperCase(),
        ownerDocument: (global as any).document,
        childNodes: [],
        style: {},
        setAttribute() {},
        removeAttribute() {},
        appendChild(c: any) {
          (this as any).childNodes.push(c);
        },
        removeChild() {},
        addEventListener() {},
        removeEventListener() {},
      });
      return el;
    },
    createTextNode(text: string) {
      return { nodeType: 3, textContent: text, style: {} };
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

describe('Subtask 2.3: useDrivePhotoSync Manual vs Background Observability', () => {
  beforeEach(() => {
    setupDomEnvironment();
    resetSourceCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetSourceCache();
    vi.restoreAllMocks();
  });

  async function renderHookHarness(nodeId: string, options?: UseDrivePhotoSyncOptions) {
    let latestResult: UseDrivePhotoSyncResult | null = null;

    function Harness() {
      latestResult = useDrivePhotoSync(nodeId, options);
      return null;
    }

    const doc = (globalThis as any).document;
    const container = doc.createElement('div');
    container.ownerDocument.defaultView = (globalThis as any).window;
    const root = createRoot(container as any);

    await React.act(async () => {
      root.render(React.createElement(Harness));
    });

    return {
      getResult: () => latestResult!,
      rerender: async () => {
        await React.act(async () => {
          root.render(React.createElement(Harness));
        });
      },
    };
  }

  it('manual sync sets error and rethrows when sync fails', async () => {
    // Node with linked folder but sync failure
    await upsertLiveSourceSource({
      pointId: 'node-sync-test',
      folderUrl: 'https://drive.google.com/drive/folders/valid-folder-12345',
      folderTitle: 'Sync Test Folder',
    });

    vi.spyOn(drivePhotoSyncService, 'syncFolderPhotos').mockRejectedValue(
      new Error('Google Drive API rate limit reached')
    );

    const harness = await renderHookHarness('node-sync-test');
    expect(harness.getResult().syncState).not.toBe('sync_error');

    let thrownError: Error | null = null;
    await React.act(async () => {
      try {
        await harness.getResult().syncPhotos(false); // Manual sync
      } catch (err) {
        thrownError = err as Error;
      }
    });

    expect(thrownError).not.toBeNull();
    expect((thrownError as Error | null)?.message).toBe('Google Drive API rate limit reached');
    expect(harness.getResult().error).toBe('Google Drive API rate limit reached');
    expect(harness.getResult().syncState).toBe('sync_error');
    expect(harness.getResult().backgroundError).toBeNull();
  });

  it('background sync does NOT throw, does NOT set error, and records backgroundError quietly', async () => {
    await upsertLiveSourceSource({
      pointId: 'node-bg-test',
      folderUrl: 'https://drive.google.com/drive/folders/valid-folder-12345',
      folderTitle: 'Background Test Folder',
    });

    vi.spyOn(drivePhotoSyncService, 'syncFolderPhotos').mockRejectedValue(
      new Error('Silent network timeout during background poll')
    );

    const harness = await renderHookHarness('node-bg-test');

    let thrownError: Error | null = null;
    let resultValue: any = undefined;

    await React.act(async () => {
      try {
        resultValue = await harness.getResult().syncPhotos(true); // Background sync
      } catch (err) {
        thrownError = err as Error;
      }
    });

    // 1. Must not throw
    expect(thrownError).toBeNull();
    expect(resultValue).toBeNull();

    // 2. Visible user error must remain null, syncState must not be sync_error
    expect(harness.getResult().error).toBeNull();
    expect(harness.getResult().syncState).not.toBe('sync_error');

    // 3. Background error must be quietly captured
    expect(harness.getResult().backgroundError).toBe('Silent network timeout during background poll');
  });

  it('observes cloud write failure via EVENT_SOURCE_SYNC_STATUS event quietly in background', async () => {
    await upsertLiveSourceSource({
      pointId: 'node-cloud-obs',
      folderUrl: 'https://drive.google.com/drive/folders/cloud-obs',
      folderTitle: 'Cloud Obs Folder',
    });

    const harness = await renderHookHarness('node-cloud-obs');
    expect(harness.getResult().cloudSynced).toBeUndefined();

    await React.act(async () => {
      notifySyncStatus('node-cloud-obs', false, 'HTTP 403 Forbidden', true);
    });

    expect(harness.getResult().cloudSynced).toBe(false);
    expect(harness.getResult().backgroundError).toBe('HTTP 403 Forbidden');
    expect(harness.getResult().error).toBeNull(); // Still null for user UI!
  });

  describe('Decoupled Gallery Element Ownership & Backward Compatibility', () => {
    it('throws error and refuses to fall back to parent node when gallery has no dedicated folder', async () => {
      // 1. Setup parent node with photos
      await upsertLiveSourceSource({
        pointId: 'parent-node-1',
        folderUrl: 'https://drive.google.com/drive/folders/parent-folder',
        folderTitle: 'Parent Folder',
        syncedPhotos: [
          {
            id: 'photo-p1',
            pointId: 'parent-node-1',
            driveFileId: 'drive-p1',
            originalFileName: 'p1.jpg',
            title: 'Parent Photo 1',
            isCustomTitle: false,
            orderIndex: 0,
            thumbnailUrl: 'https://thumb.p1',
            fullImageUrl: 'https://full.p1',
          },
        ],
      });

      // 2. Render element-level gallery with NO dedicated folder
      const harness = await renderHookHarness('gallery-leaf-101', {
        isElementLevel: true,
      });

      // Gallery element must NOT inherit parent node photos
      expect(harness.getResult().syncedPhotos).toHaveLength(0);
      expect(harness.getResult().syncState).toBe('never_synced');

      // Attempting to sync without dedicated folder MUST fail and throw error!
      let thrownErr: Error | null = null;
      await React.act(async () => {
        try {
          await harness.getResult().syncPhotos(false);
        } catch (err) {
          thrownErr = err as Error;
        }
      });

      expect(thrownErr).not.toBeNull();
      expect((thrownErr as any)?.message).toContain('No Google Drive folder linked to this gallery');
      expect(harness.getResult().syncState).toBe('sync_error');
    });

    it('isolates element-level photo sync when gallery has its own dedicated folderUrl', async () => {
      // 1. Setup parent node with its own photos
      await upsertLiveSourceSource({
        pointId: 'canvas-page-main',
        folderUrl: 'https://drive.google.com/drive/folders/canvas-parent-folder',
        folderTitle: 'Canvas Parent Folder',
        syncedPhotos: [
          {
            id: 'parent-only-photo',
            pointId: 'canvas-page-main',
            driveFileId: 'df-parent',
            originalFileName: 'parent.jpg',
            title: 'Parent Image',
            isCustomTitle: false,
            orderIndex: 0,
            thumbnailUrl: 'https://thumb.parent',
            fullImageUrl: 'https://full.parent',
          },
        ],
      });

      // 2. Mock Google Drive sync for the gallery's dedicated folder
      vi.spyOn(drivePhotoSyncService, 'syncFolderPhotos').mockImplementation(async (pointId, folderUrl) => {
        const synced = [
          {
            id: 'gallery-photo-1',
            pointId,
            driveFileId: 'df-gal-1',
            originalFileName: 'gal1.jpg',
            title: 'Gallery Image 1',
            isCustomTitle: false,
            orderIndex: 0,
            thumbnailUrl: 'https://thumb.gal1',
            fullImageUrl: 'https://full.gal1',
          },
        ];
        const updatedSource = await upsertLiveSourceSource({
          pointId,
          folderUrl,
          folderTitle: 'Gallery Folder',
          syncedPhotos: synced,
        });
        return {
          items: synced,
          stats: { added: 1, removed: 0, retained: 0, total: 1, hasChanged: true },
          source: updatedSource,
        };
      });

      // 3. Render gallery hook with dedicated folderUrl
      const harness = await renderHookHarness('gallery-elem-alpha', {
        folderUrl: 'https://drive.google.com/drive/folders/gallery-dedicated-folder',
        isElementLevel: true,
      });

      // Because it has its own dedicated folderUrl, it does NOT show parent photos
      expect(harness.getResult().syncedPhotos).toHaveLength(0);
      expect(harness.getResult().syncState).toBe('never_synced');

      // Trigger sync for this gallery
      await React.act(async () => {
        await harness.getResult().syncPhotos(false);
      });

      // Now it has its own photos under gallery-elem-alpha
      expect(harness.getResult().syncState).toBe('synced_success');
      expect(harness.getResult().syncedPhotos).toHaveLength(1);
      expect(harness.getResult().syncedPhotos[0].pointId).toBe('gallery-elem-alpha');
      expect(harness.getResult().syncedPhotos[0].title).toBe('Gallery Image 1');
    });

    it('allows two independent galleries on the same canvas without collision', async () => {
      // Gallery A in BaaS
      await upsertLiveSourceSource({
        pointId: 'gallery-slot-a',
        folderUrl: 'https://drive.google.com/drive/folders/folder-a',
        folderTitle: 'Folder A',
        syncedPhotos: [
          {
            id: 'photo-a',
            pointId: 'gallery-slot-a',
            driveFileId: 'df-a',
            originalFileName: 'a.jpg',
            title: 'Photo A',
            isCustomTitle: false,
            orderIndex: 0,
            thumbnailUrl: 'https://thumb.a',
            fullImageUrl: 'https://full.a',
          },
        ],
      });

      // Gallery B in BaaS
      await upsertLiveSourceSource({
        pointId: 'gallery-slot-b',
        folderUrl: 'https://drive.google.com/drive/folders/folder-b',
        folderTitle: 'Folder B',
        syncedPhotos: [
          {
            id: 'photo-b1',
            pointId: 'gallery-slot-b',
            driveFileId: 'df-b1',
            originalFileName: 'b1.jpg',
            title: 'Photo B1',
            isCustomTitle: false,
            orderIndex: 0,
            thumbnailUrl: 'https://thumb.b1',
            fullImageUrl: 'https://full.b1',
          },
          {
            id: 'photo-b2',
            pointId: 'gallery-slot-b',
            driveFileId: 'df-b2',
            originalFileName: 'b2.jpg',
            title: 'Photo B2',
            isCustomTitle: false,
            orderIndex: 1,
            thumbnailUrl: 'https://thumb.b2',
            fullImageUrl: 'https://full.b2',
          },
        ],
      });

      const harnessA = await renderHookHarness('gallery-slot-a', { isElementLevel: true });
      const harnessB = await renderHookHarness('gallery-slot-b', { isElementLevel: true });

      // Both galleries maintain separate sync state and streams
      expect(harnessA.getResult().syncedPhotos).toHaveLength(1);
      expect(harnessA.getResult().syncedPhotos[0].title).toBe('Photo A');

      expect(harnessB.getResult().syncedPhotos).toHaveLength(2);
      expect(harnessB.getResult().syncedPhotos[0].title).toBe('Photo B1');
      expect(harnessB.getResult().syncedPhotos[1].title).toBe('Photo B2');
    });
  });
});
