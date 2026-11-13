import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { useDrivePhotoSync } from '../../src/hooks/useDrivePhotoSync';
import type { UseDrivePhotoSyncResult } from '../../src/types/source';
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

  function renderHookHarness(nodeId: string) {
    let latestResult: UseDrivePhotoSyncResult | null = null;

    function Harness() {
      latestResult = useDrivePhotoSync(nodeId);
      return null;
    }

    const doc = (globalThis as any).document;
    const container = doc.createElement('div');
    container.ownerDocument.defaultView = (globalThis as any).window;
    const root = createRoot(container as any);

    React.act(() => {
      root.render(React.createElement(Harness));
    });

    return {
      getResult: () => latestResult!,
      rerender: () => {
        React.act(() => {
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

    const harness = renderHookHarness('node-sync-test');
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

    const harness = renderHookHarness('node-bg-test');

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

    const harness = renderHookHarness('node-cloud-obs');
    expect(harness.getResult().cloudSynced).toBeUndefined();

    await React.act(async () => {
      notifySyncStatus('node-cloud-obs', false, 'HTTP 403 Forbidden', true);
    });

    expect(harness.getResult().cloudSynced).toBe(false);
    expect(harness.getResult().backgroundError).toBe('HTTP 403 Forbidden');
    expect(harness.getResult().error).toBeNull(); // Still null for user UI!
  });
});
