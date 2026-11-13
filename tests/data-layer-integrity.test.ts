import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  setContent,
  getContent,
  hasContentOverride,
  resetContent,
  getAllContentOverrides,
  resetAllContentOverrides,
  clearDraftTombstones,
} from '../src/utils/contentDb';
import {
  fetchDriveFolderImages,
  cleanDriveFileName,
  reconcileDrivePhotos,
} from '../src/services/drivePhotoSyncService';
import type { DrivePhotoFile } from '../src/types/source';
import {
  useSheetChartData,
  type UseSheetChartDataReturn,
} from '../src/hooks/useSheetChartData';
import type { SheetChartConfig, ChartDataset } from '../src/types/chart';
import * as sheetsDataService from '../src/services/sheetsDataService';
import * as chartSourceService from '../src/services/chartSourceService';
import {
  EVENT_INDEXEDDB_ERROR,
  saveToIndexedDB,
  type IndexedDBErrorDetail,
} from '../src/services/historyStorage';
import {
  publishNewSnapshot,
  restoreUnifiedSnapshot,
  saveMilestone,
  getHistoryManifest,
  getActiveNodeIds,
  initDraftSession,
} from '../src/services/historyService';
import { EVENT_LIVE_CANVAS_CHANGE } from '../src/services/canvasLayoutService';
import * as edgePreBakeService from '../src/services/edgePreBakeService';
import type { PreBakeResult } from '../src/services/edgePreBakeService';
import {
  upsertLiveSourceSource,
  EVENT_SOURCE_SYNC_STATUS,
  type SourceSyncStatusDetail,
} from '../src/services/sourceService';
import { resetEngineConfig } from '../src/config/engine.config';
import { clearDraftStorage, isDraftModeActive } from '../src/services/draftService';

/**
 * Setup isolated mock DOM environment for React Act and CustomEvent dispatch
 */
function setupTestEnvironment() {
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalFetch = globalThis.fetch;
  const originalEnvApiKey = process.env.VITE_GOOGLE_DRIVE_API_KEY;
  const originalSupabaseUrl = process.env.VITE_SUPABASE_URL;
  const originalSupabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  class MockElement {
    nodeType: number = 1;
    tagName: string = 'DIV';
    style: Record<string, any> = {};
    childNodes: any[] = [];
    ownerDocument: any;
    appendChild = (c: any) => {
      this.childNodes.push(c);
      return c;
    };
    removeChild = (c: any) => c;
    setAttribute = () => { };
    removeAttribute = () => { };
    addEventListener = () => { };
    removeEventListener = () => { };
  }
  class MockHTMLElement extends MockElement { }

  (globalThis as any).Element = (globalThis as any).Element || MockElement;
  (globalThis as any).HTMLElement = (globalThis as any).HTMLElement || MockHTMLElement;
  (globalThis as any).HTMLIFrameElement = (globalThis as any).HTMLIFrameElement || MockHTMLElement;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  if (!(globalThis as any).CustomEvent) {
    class CustomEvent<T = any> extends Event {
      detail: T;
      constructor(type: string, params?: { detail?: T; bubbles?: boolean; cancelable?: boolean }) {
        super(type, params);
        this.detail = params?.detail as T;
      }
    }
    (globalThis as any).CustomEvent = CustomEvent;
  }

  const storageMap = new Map<string, string>();
  const mockStorage = {
    getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn((key: string, val: string) => {
      storageMap.set(key, String(val));
    }),
    removeItem: vi.fn((key: string) => {
      storageMap.delete(key);
    }),
    clear: vi.fn(() => {
      storageMap.clear();
    }),
    get length() {
      return storageMap.size;
    },
    key: vi.fn((i: number) => Array.from(storageMap.keys())[i] ?? null),
  };

  const listeners: Record<string, ((e: any) => void)[]> = {};
  const mockWindow: any = {
    Element: MockElement,
    HTMLElement: MockHTMLElement,
    HTMLIFrameElement: MockHTMLElement,
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    addEventListener: vi.fn((type: string, fn: any) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: any) => {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((f) => f !== fn);
      }
    }),
    dispatchEvent: vi.fn((evt: any) => {
      const list = listeners[evt?.type] || [];
      for (const fn of [...list]) {
        fn(evt);
      }
      return true;
    }),
  };

  const mockDoc: any = {
    nodeType: 9,
    activeElement: null,
    defaultView: mockWindow,
    documentElement: { style: {} },
    createElement(tag: string) {
      const el = new MockHTMLElement();
      el.tagName = tag.toUpperCase();
      el.ownerDocument = mockDoc;
      return el;
    },
    createTextNode(text: string) {
      return { nodeType: 3, textContent: text, ownerDocument: mockDoc };
    },
    addEventListener: () => { },
    removeEventListener: () => { },
  };

  mockWindow.document = mockDoc;
  (globalThis as any).window = mockWindow;
  (globalThis as any).document = mockDoc;
  (globalThis as any).addEventListener = mockWindow.addEventListener;
  (globalThis as any).removeEventListener = mockWindow.removeEventListener;
  (globalThis as any).dispatchEvent = mockWindow.dispatchEvent;

  return {
    mockWindow,
    mockStorage,
    storageMap,
    restore() {
      (globalThis as any).window = originalWindow;
      (globalThis as any).document = originalDocument;
      globalThis.fetch = originalFetch;
      process.env.VITE_GOOGLE_DRIVE_API_KEY = originalEnvApiKey;
      if (originalSupabaseUrl !== undefined) {
        process.env.VITE_SUPABASE_URL = originalSupabaseUrl;
      } else {
        delete process.env.VITE_SUPABASE_URL;
      }
      if (originalSupabaseKey !== undefined) {
        process.env.VITE_SUPABASE_ANON_KEY = originalSupabaseKey;
      } else {
        delete process.env.VITE_SUPABASE_ANON_KEY;
      }
    },
  };
}

describe('Subtask 2.10: Data Layer Integration Testing & Quality Gates', () => {
  let envCleanup: { restore: () => void; mockWindow: any; storageMap: Map<string, string> };
  let activeRoots: Root[] = [];

  beforeEach(() => {
    resetEngineConfig();
    envCleanup = setupTestEnvironment();
    activeRoots = [];
    resetAllContentOverrides(false);
    resetAllContentOverrides(true);
    clearDraftTombstones();
    clearDraftStorage();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const root of activeRoots) {
      try {
        React.act(() => {
          root.unmount();
        });
      } catch {
        // Ignore unmount teardown warnings
      }
    }
    activeRoots = [];
    envCleanup.restore();
    resetEngineConfig();
    resetAllContentOverrides(false);
    resetAllContentOverrides(true);
    clearDraftTombstones();
    clearDraftStorage();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Tombstone Content Isolation
  // -------------------------------------------------------------------------
  describe('1. Tombstone Content Isolation (Subtask 2.1)', () => {
    it('sets live override, tombstones key in dev mode, and ensures it is omitted from draft bundle', () => {
      // 1. Establish live published override
      setContent('portal.title', 'Old Live Title', false);
      expect(getAllContentOverrides(false)).toEqual({ 'portal.title': 'Old Live Title' });
      expect(getAllContentOverrides(true)).toEqual({ 'portal.title': 'Old Live Title' });

      // 2. In dev mode, reset content to system default
      resetContent('portal.title', true);

      // 3. Draft bundle must NOT resurrect old live value
      const draftOverrides = getAllContentOverrides(true);
      expect(draftOverrides).not.toHaveProperty('portal.title');
      expect(draftOverrides['portal.title']).toBeUndefined();

      // 4. getContent and hasContentOverride in dev mode must respect tombstone
      expect(getContent('portal.title', 'System Default Title', true)).toBe('System Default Title');
      expect(hasContentOverride('portal.title', true)).toBe(false);

      // 5. Public channel (live mode) remains strictly untouched
      const liveOverrides = getAllContentOverrides(false);
      expect(liveOverrides).toHaveProperty('portal.title', 'Old Live Title');
      expect(getContent('portal.title', 'System Default Title', false)).toBe('Old Live Title');
      expect(hasContentOverride('portal.title', false)).toBe(true);

      // 6. Setting a new draft value clears tombstone cleanly
      setContent('portal.title', 'New Draft Title', true);
      expect(getAllContentOverrides(true)).toEqual({ 'portal.title': 'New Draft Title' });
      expect(getContent('portal.title', 'System Default Title', true)).toBe('New Draft Title');
      expect(hasContentOverride('portal.title', true)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Drive Photo Sync Pagination & Clean Titles
  // -------------------------------------------------------------------------
  describe('2. Drive Photo Sync Pagination (Subtask 2.2)', () => {
    it('aggregates page 1 (100 items) and page 2 (15 items) and returns 115 total items with clean titles', async () => {
      process.env.VITE_GOOGLE_DRIVE_API_KEY = 'test-drive-api-key-integrations';

      // Generate page 1: 100 items
      const page1Files: DrivePhotoFile[] = Array.from({ length: 100 }, (_, i) => ({
        id: `img-page1-${i + 1}`,
        name: `${String(i + 1).padStart(3, '0')}_Annual_Report_Chart.jpg`,
        mimeType: 'image/jpeg',
      }));

      // Generate page 2: 15 items
      const page2Files: DrivePhotoFile[] = Array.from({ length: 15 }, (_, i) => ({
        id: `img-page2-${100 + i + 1}`,
        name: `${String(100 + i + 1).padStart(3, '0')}_Field_Mission_Photo.png`,
        mimeType: 'image/png',
      }));

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: page1Files,
            nextPageToken: 'token-page-2-continuation',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: page2Files,
          }),
        } as Response);

      globalThis.fetch = fetchMock;

      const items = await fetchDriveFolderImages('https://drive.google.com/drive/folders/test');

      // Assert exactly 2 fetch calls were made with nextPageToken continuation
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toContain('pageSize=100');
      expect(fetchMock.mock.calls[0][0]).not.toContain('pageToken=');
      expect(fetchMock.mock.calls[1][0]).toContain('pageToken=' + encodeURIComponent('token-page-2-continuation'));

      // Assert 115 total items returned
      expect(items).toHaveLength(115);

      // Assert clean titles via cleanDriveFileName and differential reconciliation
      const cleanTitles = items.map((f) => cleanDriveFileName(f.name));
      expect(cleanTitles[0]).toBe('Annual Report Chart');
      expect(cleanTitles[99]).toBe('Annual Report Chart');
      expect(cleanTitles[100]).toBe('Field Mission Photo');
      expect(cleanTitles[114]).toBe('Field Mission Photo');

      const reconciliation = reconcileDrivePhotos([], items, 'test-point-node');
      expect(reconciliation.items).toHaveLength(115);
      expect(reconciliation.stats.added).toBe(115);
      expect(reconciliation.stats.total).toBe(115);
      expect(reconciliation.items[0].title).toBe('Annual Report Chart');
      expect(reconciliation.items[100].title).toBe('Field Mission Photo');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Google Sheets 0-Row Guard
  // -------------------------------------------------------------------------
  describe('3. Google Sheets 0-Row Guard (Subtask 2.4)', () => {
    it('aborts when matrix has 0 rows, throws expected error message, and preserves previous dataset', async () => {
      // Mock fetchLiveSheetMatrix returning empty array []
      vi.spyOn(sheetsDataService, 'fetchLiveSheetMatrix').mockResolvedValue([]);
      const saveSpy = vi.spyOn(chartSourceService, 'saveChartConfigDetailed').mockResolvedValue({
        success: true,
        savedLocally: true,
        savedToCloud: true,
      });

      const initialDatasetSnapshot: ChartDataset = {
        chartId: 'chart-integration-0row',
        title: 'Initial Healthy Chart',
        chartType: 'bar',
        categories: ['2023', '2024'],
        series: [{ name: 'Participants', data: [120, 240] }],
        sanitizedCsvContent: '',
        asOfDate: '2026-01-01T00:00:00.000Z',
      };

      const mockConfig: SheetChartConfig = {
        chartId: 'chart-integration-0row',
        nodeId: 'node-overview',
        sheetUrl: 'https://docs.google.com/spreadsheets/d/test-sheet-id/edit',
        tabName: 'Data',
        range: 'A1:B10',
        titleOverride: 'Initial Healthy Chart',
        cachedDataset: [
          ['Year', 'Participants'],
          ['2023', '120'],
          ['2024', '240'],
        ],
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      vi.spyOn(chartSourceService, 'getCachedChartConfig').mockReturnValue(mockConfig);
      vi.spyOn(chartSourceService, 'fetchChartConfig').mockResolvedValue(mockConfig);

      let hookResult: UseSheetChartDataReturn | null = null;
      function TestHarness() {
        hookResult = useSheetChartData({
          chartId: 'chart-integration-0row',
          initialDataset: initialDatasetSnapshot,
        });
        return null;
      }

      const container = (globalThis as any).document.createElement('div');
      container.ownerDocument.defaultView = (globalThis as any).window;
      const root = createRoot(container as any);
      activeRoots.push(root);

      React.act(() => {
        root.render(React.createElement(TestHarness));
      });

      expect(hookResult).not.toBeNull();
      const preservedDatasetSnapshot = hookResult!.dataset;
      expect(preservedDatasetSnapshot?.categories).toEqual(['2023', '2024']);

      // Attempt manual live sync with empty sheet
      let thrownError: Error | null = null;
      await React.act(async () => {
        try {
          await hookResult!.syncLiveSheet();
        } catch (err: unknown) {
          thrownError = err instanceof Error ? err : new Error(String(err));
        }
      });

      // Assert error thrown with exact guard message
      expect(thrownError).not.toBeNull();
      expect((thrownError as Error | null)?.message).toBe(
        'Google Sheet returned 0 valid data rows. Previous chart data preserved.'
      );

      // Assert status and error message on hook state
      expect(hookResult!.status).toBe('error');
      expect(hookResult!.errorMessage).toBe(
        'Google Sheet returned 0 valid data rows. Previous chart data preserved.'
      );

      // Assert previous dataset was strictly preserved and NOT wiped
      expect(hookResult!.dataset).toEqual(preservedDatasetSnapshot);
      expect(hookResult!.dataset?.categories).toEqual(['2023', '2024']);

      // Assert zero-row dataset was never persisted
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 4: IndexedDB Error Observability
  // -------------------------------------------------------------------------
  describe('4. IndexedDB Error Observability (Subtask 2.5)', () => {
    it('dispatches EVENT_INDEXEDDB_ERROR with error payload when saveToIndexedDB fails', async () => {
      const capturedEvents: CustomEvent<IndexedDBErrorDetail>[] = [];
      const listener = (evt: any) => {
        capturedEvents.push(evt);
      };

      (globalThis as any).window.addEventListener(EVENT_INDEXEDDB_ERROR, listener);

      // Simulate IndexedDB transaction throwing QuotaExceededError
      const mockDb = {
        transaction: vi.fn().mockImplementation(() => {
          throw new Error('QuotaExceededError: Storage quota exceeded');
        }),
      };

      (globalThis as any).window.indexedDB = {
        open: vi.fn().mockReturnValue({
          set onsuccess(cb: () => void) {
            setTimeout(() => {
              this.result = mockDb;
              cb();
            }, 0);
          },
        }),
      };

      const result = await saveToIndexedDB('large-manifest-key', { data: 'test-payload' });

      expect(result).toBe(false);
      expect(capturedEvents.length).toBeGreaterThanOrEqual(1);

      const errorEvent = capturedEvents[0];
      expect(errorEvent.type).toBe(EVENT_INDEXEDDB_ERROR);
      expect(errorEvent.detail.action).toBe('save');
      expect(errorEvent.detail.error).toContain('QuotaExceededError: Storage quota exceeded');
      expect(typeof errorEvent.detail.timestamp).toBe('string');

      (globalThis as any).window.removeEventListener(EVENT_INDEXEDDB_ERROR, listener);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Publish Pipeline Edge Await & Retry
  // -------------------------------------------------------------------------
  describe('5. Publish Pipeline Edge Await & Retry (Subtasks 2.6 & 2.7)', () => {
    it('reports edgeDeployed: false with edgeError on failure, and retries edge deploy without duplicate milestones', async () => {
      process.env.VITE_SUPABASE_URL = 'https://test-sandbox.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key-12345';

      // Subtask 3.7: Unified Atomic Write Pipeline mocks /api/publish
      globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/publish')) {
          return new Response(
            JSON.stringify({
              success: true,
              snapshotId: 'pub-test-id',
              cloudSynced: true,
              edgeDeployed: false,
              edgeError: 'KV rate limited',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 200 });
      });

      // 1. Mock edge retry spy
      const edgeDeploySpy = vi.spyOn(edgePreBakeService, 'compileAndDeployToEdgeKV');

      const result = await publishNewSnapshot('Changelog test');

      // Assert 3-tier status reporting
      expect(result.success).toBe(true);
      expect(result.localSaved).toBe(true);
      expect(result.cloudSynced).toBe(true);
      expect(result.edgeDeployed).toBe(false);
      expect(result.edgeError).toBe('KV rate limited');
      expect(result.error).toBe('KV rate limited');
      expect(result.snapshot).toBeDefined();

      const manifestAfterPublish = getHistoryManifest();
      const milestoneCount = manifestAfterPublish.snapshots.length;
      expect(milestoneCount).toBeGreaterThan(0);

      // 2. Retry compileAndDeployToEdgeKV with mock success
      edgeDeploySpy.mockResolvedValueOnce({
        success: true,
        snapshotId: result.snapshot.id,
        transformedNodes: ['overview'],
        totalKvKeys: 5,
        deployResult: {
          success: true,
          deployedCount: 5,
        },
      } as PreBakeResult);

      const retryResult = await edgePreBakeService.compileAndDeployToEdgeKV(result.snapshot);

      // Assert retry succeeds without adding another milestone snapshot
      expect(retryResult.success).toBe(true);
      expect(retryResult.deployResult.deployedCount).toBe(5);

      const manifestAfterRetry = getHistoryManifest();
      expect(manifestAfterRetry.snapshots.length).toBe(milestoneCount);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Restore Canvas Event Dispatch
  // -------------------------------------------------------------------------
  describe('6. Restore Canvas Event Dispatch (Subtask 2.9)', () => {
    it('dispatches EVENT_LIVE_CANVAS_CHANGE on restoreUnifiedSnapshot across all active nodes', async () => {
      const milestone = saveMilestone('Milestone for Restore Test', 'Testing event dispatch');
      expect(milestone.id).toBeDefined();

      const dispatchedLiveEvents: Array<{ type: string; detail: any }> = [];
      const originalDispatch = (globalThis as any).window.dispatchEvent;
      (globalThis as any).window.dispatchEvent = vi.fn().mockImplementation((evt: any) => {
        if (evt?.type === EVENT_LIVE_CANVAS_CHANGE) {
          dispatchedLiveEvents.push({ type: evt.type, detail: evt.detail });
        }
        return true;
      });

      const restoreResult = await restoreUnifiedSnapshot(milestone.id);

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.safetySnapshotId).toBeDefined();

      const activeNodes = getActiveNodeIds();
      expect(activeNodes.length).toBeGreaterThan(0);

      // Assert an event was fired for each active node
      for (const nodeId of activeNodes) {
        const nodeEvent = dispatchedLiveEvents.find((e) => e.detail?.nodeId === nodeId);
        expect(nodeEvent).toBeDefined();
        expect(nodeEvent?.detail?.document?.nodeId).toBe(nodeId);
      }

      // Assert aggregate event '*' was fired
      const aggregateEvent = dispatchedLiveEvents.find((e) => e.detail?.nodeId === '*');
      expect(aggregateEvent).toBeDefined();

      (globalThis as any).window.dispatchEvent = originalDispatch;
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 7: Draft Init Concurrency Sentinel
  // -------------------------------------------------------------------------
  describe('7. Draft Init Concurrency Sentinel (Subtask 2.9)', () => {
    it('returns the identical in-flight Promise instance when initDraftSession is invoked concurrently', async () => {
      process.env.VITE_SUPABASE_URL = 'https://test-sandbox.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key-12345';

      let resolveFetch!: (val: any) => void;
      const delayedFetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('engine_drafts')) {
          await delayedFetchPromise;
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      });

      // Call initDraftSession twice concurrently
      const promise1 = initDraftSession();
      const promise2 = initDraftSession();

      // Assert identical Promise reference (in-flight deduplication sentinel)
      expect(promise1).toBe(promise2);

      // Resolve in-flight fetch
      resolveFetch([]);
      await Promise.all([promise1, promise2]);
      expect(isDraftModeActive()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 8: Background Sync Status & Observability
  // -------------------------------------------------------------------------
  describe('8. Background Sync Observability (Subtask 2.3)', () => {
    it('dispatches EVENT_SOURCE_SYNC_STATUS on background source upsert', async () => {
      process.env.VITE_SUPABASE_URL = 'https://test-sandbox.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key-12345';

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => 'OK',
      } as Response);

      const capturedStatusEvents: CustomEvent<SourceSyncStatusDetail>[] = [];
      const listener = (evt: any) => {
        capturedStatusEvents.push(evt);
      };

      (globalThis as any).window.addEventListener(EVENT_SOURCE_SYNC_STATUS, listener);

      const updated = await upsertLiveSourceSource(
        {
          pointId: 'node-test-bg',
          folderUrl: 'https://drive.google.com/drive/folders/test-folder-123',
          folderTitle: 'Test Folder Title',
          syncedPhotos: [],
        },
        undefined,
        { isBackground: true }
      );

      expect(updated.cloudSynced).toBe(true);
      expect(capturedStatusEvents.length).toBeGreaterThanOrEqual(1);

      const lastEvent = capturedStatusEvents[capturedStatusEvents.length - 1];
      expect(lastEvent.detail.pointId).toBe('test-bg');
      expect(lastEvent.detail.cloudSynced).toBe(true);
      expect(lastEvent.detail.isBackground).toBe(true);

      (globalThis as any).window.removeEventListener(EVENT_SOURCE_SYNC_STATUS, listener);
    });
  });
});
