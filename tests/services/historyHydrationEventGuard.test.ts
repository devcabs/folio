import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as historyService from '../../src/services/historyService';
import * as historyStorage from '../../src/services/historyStorage';
import type { HistoryManifest } from '../../src/types/history';

describe('History Hydration Event Guard & Anti-Flicker Tests', () => {
  let mockWindow: any;
  let originalWindow: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalWindow = (global as any).window;

    class MockWindow extends EventTarget {
      localStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      };
    }

    mockWindow = new MockWindow();
    (global as any).window = mockWindow;
    (global as any).CustomEvent = class CustomEvent extends Event {
      detail: any;
      constructor(type: string, options?: any) {
        super(type);
        this.detail = options?.detail;
      }
    };
  });

  afterEach(() => {
    (global as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  it('hydrateHistoryFromIndexedDB loads snapshots without dispatching EVENT_HISTORY_CHANGE', async () => {
    const mockManifest: HistoryManifest = {
      updatedAt: '2026-01-01T00:00:00.000Z',
      snapshots: [
        {
          id: 'snap-1',
          schemaVersion: 1,
          authorSessionId: 'sess-1',
          title: 'Initial Baseline',
          createdAt: '2026-01-01T00:00:00.000Z',
          type: 'milestone',
          canvases: {},
          contentOverrides: {},
          summary: {
            totalSections: 0,
            totalSubsections: 0,
            totalLeafElements: 0,
            totalTextOverrides: 0,
          },
        },
      ],
    };

    vi.spyOn(historyStorage, 'loadFromIndexedDB').mockResolvedValue(mockManifest);
    const saveIdbSpy = vi.spyOn(historyStorage, 'saveToIndexedDB').mockResolvedValue(true);

    let eventChangeFired = 0;
    const unsubscribe = historyService.subscribeToHistoryChange(() => {
      eventChangeFired++;
    });

    try {
      const hydrated = await historyService.hydrateHistoryFromIndexedDB();
      expect(hydrated).toBeDefined();
      expect(hydrated.snapshots.length).toBe(1);

      // Crucial: Hydration must NOT dispatch EVENT_HISTORY_CHANGE
      expect(eventChangeFired).toBe(0);

      // Hydration must NOT redundantly re-save to IndexedDB
      expect(saveIdbSpy).not.toHaveBeenCalled();

      // Hydration MUST mirror lightweight metadata into localStorage
      expect(mockWindow.localStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('_history_manifest'),
        expect.any(String)
      );
    } finally {
      unsubscribe();
    }
  });

  it('saveHistoryManifest dispatches EVENT_HISTORY_CHANGE on genuine mutations', async () => {
    vi.spyOn(historyStorage, 'saveToIndexedDB').mockResolvedValue(true);

    let changeEventReceived = false;
    const unsubscribe = historyService.subscribeToHistoryChange(() => {
      changeEventReceived = true;
    });

    try {
      historyService.saveHistoryManifest({
        updatedAt: '2026-01-02T00:00:00.000Z',
        snapshots: [],
      });

      expect(changeEventReceived).toBe(true);
    } finally {
      unsubscribe();
    }
  });

  it('guarantees loadHistory and hydrateHistoryFromIndexedDB loop never recurses', async () => {
    const mockManifest: HistoryManifest = {
      updatedAt: '2026-01-01T00:00:00.000Z',
      snapshots: [
        {
          id: 'snap-1',
          schemaVersion: 1,
          authorSessionId: 'sess-1',
          title: 'Initial Baseline',
          createdAt: '2026-01-01T00:00:00.000Z',
          type: 'milestone',
          canvases: {},
          contentOverrides: {},
          summary: {
            totalSections: 0,
            totalSubsections: 0,
            totalLeafElements: 0,
            totalTextOverrides: 0,
          },
        },
      ],
    };

    vi.spyOn(historyStorage, 'loadFromIndexedDB').mockResolvedValue(mockManifest);
    vi.spyOn(historyStorage, 'saveToIndexedDB').mockResolvedValue(true);

    let loadHistoryCalls = 0;
    const loadHistorySim = async () => {
      loadHistoryCalls++;
      if (loadHistoryCalls > 5) {
        throw new Error('Infinite loop detected in loadHistory!');
      }
      await historyService.hydrateHistoryFromIndexedDB();
    };

    const unsubscribe = historyService.subscribeToHistoryChange(() => {
      loadHistorySim();
    });

    try {
      await loadHistorySim();
      await new Promise((r) => setTimeout(r, 50));
      // Exactly 1 call because hydration emits no change events
      expect(loadHistoryCalls).toBe(1);
    } finally {
      unsubscribe();
    }
  });
});
