import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  restoreSnapshotToDraft,
  computeMetricsSummary,
  saveHistoryManifest,
  getHistoryManifestKey,
  getActiveNodeIds,
} from '../../src/services/historyService';
import {
  getNodeCanvas,
  EVENT_DRAFT_CANVAS_CHANGE,
  type CanvasChangeEventDetail,
} from '../../src/services/canvasLayoutService';
import {
  isDraftModeActive,
  isDraftDirty,
  getDraftContentKey,
  getInMemoryDraftCanvas,
  clearDraftStorage,
} from '../../src/services/draftService';
import { getContent, setContent, resetContent, hasContentOverride } from '../../src/utils/contentDb';
import { createDefaultCanvasDocument } from '../../src/utils/canvasDefaults';
import { resetEngineConfig } from '../../src/config/engine.config';
import type { NodeCanvasDocument, TextElement } from '../../src/types/canvas';
import type { UnifiedPortalSnapshot, HistoryManifest } from '../../src/types/history';

describe('Subtask 3.9: Revision History Ledger & Pure AST Rollback Pipeline', () => {
  let storageMap: Map<string, string>;
  let listeners: Map<string, Array<(event: any) => void>>;

  beforeEach(() => {
    resetEngineConfig();
    clearDraftStorage();
    storageMap = new Map<string, string>();
    listeners = new Map();

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

    class MockCustomEvent {
      type: string;
      detail: any;
      constructor(type: string, params?: { detail?: any }) {
        this.type = type;
        this.detail = params?.detail;
      }
    }

    const mockWindow = {
      localStorage: mockStorage,
      addEventListener: vi.fn((type: string, callback: any) => {
        const list = listeners.get(type) || [];
        list.push(callback);
        listeners.set(type, list);
      }),
      removeEventListener: vi.fn((type: string, callback: any) => {
        const list = listeners.get(type) || [];
        listeners.set(
          type,
          list.filter((cb) => cb !== callback)
        );
      }),
      dispatchEvent: vi.fn((evt: any) => {
        const list = listeners.get(evt.type) || [];
        for (const cb of list) {
          cb(evt);
        }
        return true;
      }),
    };

    (global as any).window = mockWindow;
    (global as any).CustomEvent = MockCustomEvent;
  });

  afterEach(() => {
    clearDraftStorage();
    vi.restoreAllMocks();
  });

  describe('Pure AST Rollback Pipeline (restoreSnapshotToDraft)', () => {
    it('restores snapshot canvases directly into in-memory draft sandbox across all active nodes', () => {
      const activeNodes = getActiveNodeIds();
      expect(activeNodes.length).toBeGreaterThan(0);

      const mockCanvases: Record<string, NodeCanvasDocument> = {};
      for (const nodeId of activeNodes) {
        const doc = createDefaultCanvasDocument(nodeId);
        doc.sections = [
          {
            id: `sec-${nodeId}-1`,
            type: 'section',
            title: `Restored Section for ${nodeId}`,
            elements: [
              {
                id: `txt-${nodeId}-1`,
                pointId: `p-${nodeId}-1`,
                type: 'text',
                content: `Restored Content for ${nodeId}`,
              },
            ],
          },
        ];
        mockCanvases[nodeId] = doc;
      }

      const snapshot: UnifiedPortalSnapshot = {
        id: 'snap-pure-ast-test',
        schemaVersion: 1,
        type: 'milestone',
        title: 'Milestone 1',
        createdAt: '2026-01-01T00:00:00.000Z',
        authorSessionId: 'sess-test',
        canvases: mockCanvases,
        contentOverrides: {
          'legacy_dead_key': 'this should not pollute draft',
        },
        summary: {
          totalSections: activeNodes.length,
          totalSubsections: 0,
          totalLeafElements: activeNodes.length,
          totalTextOverrides: activeNodes.length,
        },
      };

      const result = restoreSnapshotToDraft(snapshot);
      expect(result).toBe(true);

      // Verify draft mode is active and dirty
      expect(isDraftModeActive()).toBe(true);
      expect(isDraftDirty()).toBe(true);

      // Verify in-memory sandbox updated for each node
      for (const nodeId of activeNodes) {
        const inMem = getInMemoryDraftCanvas(nodeId);
        expect(inMem).toBeDefined();
        expect(inMem?.sections[0].title).toBe(`Restored Section for ${nodeId}`);
        expect(inMem?.sections[0].number).toBe('01'); // Renumbered sequential numbering
        expect((inMem?.sections[0].elements[0] as TextElement).content).toBe(
          `Restored Content for ${nodeId}`
        );

        // Verify getNodeCanvas(nodeId, true) reads the draft canvas
        const activeDraftDoc = getNodeCanvas(nodeId, true);
        expect(activeDraftDoc.sections[0].title).toBe(`Restored Section for ${nodeId}`);
      }
    });

    it('does NOT write or pollute _draft_content_overrides during rollback', () => {
      const activeNodes = getActiveNodeIds();
      const mockCanvases: Record<string, NodeCanvasDocument> = {};
      for (const nodeId of activeNodes) {
        mockCanvases[nodeId] = createDefaultCanvasDocument(nodeId);
      }

      const snapshot: UnifiedPortalSnapshot = {
        id: 'snap-no-overrides',
        schemaVersion: 1,
        type: 'milestone',
        title: 'Pure AST Milestone',
        createdAt: '2026-01-01T00:00:00.000Z',
        authorSessionId: 'sess-test',
        canvases: mockCanvases,
        contentOverrides: {
          dead_key_1: 'val1',
          dead_key_2: 'val2',
        },
        summary: {
          totalSections: 0,
          totalSubsections: 0,
          totalLeafElements: 0,
          totalTextOverrides: 0,
        },
      };

      restoreSnapshotToDraft(snapshot);

      // Verify no keys were written to the draft content overrides storage key
      const draftContentKey = getDraftContentKey();
      const rawDraftContent = storageMap.get(draftContentKey);
      expect(rawDraftContent).toBeUndefined();

      // Verify contentDb returns no overrides for those legacy keys in draft mode
      expect(hasContentOverride('dead_key_1', true)).toBe(false);
      expect(hasContentOverride('dead_key_2', true)).toBe(false);
      expect(getContent('dead_key_1', 'fallback', true)).toBe('fallback');
      expect(getContent('dead_key_2', 'fallback', true)).toBe('fallback');
    });

    it('clears lingering draft tombstones during snapshot restoration', () => {
      // Simulate live content with a draft tombstone
      setContent('tombstone_test_key', 'live_val', false);
      resetContent('tombstone_test_key', true);
      // When tombstoned in draft, getContent returns the fallback default
      expect(getContent('tombstone_test_key', 'fallback_default', true)).toBe('fallback_default');

      const snapshot: UnifiedPortalSnapshot = {
        id: 'snap-clear-tombstones',
        schemaVersion: 1,
        type: 'milestone',
        title: 'Restore Snapshot',
        createdAt: '2026-01-01T00:00:00.000Z',
        authorSessionId: 'sess-test',
        canvases: {},
        contentOverrides: {},
        summary: {
          totalSections: 0,
          totalSubsections: 0,
          totalLeafElements: 0,
          totalTextOverrides: 0,
        },
      };

      restoreSnapshotToDraft(snapshot);

      // Verify tombstone is cleared, so live value shines through
      expect(getContent('tombstone_test_key', 'fallback_default', true)).toBe('live_val');
    });

    it('dispatches EVENT_DRAFT_CANVAS_CHANGE events for each active node', () => {
      const dispatchedNodes: string[] = [];
      const handler = (e: any) => {
        const detail = e.detail as CanvasChangeEventDetail;
        if (detail?.nodeId) {
          dispatchedNodes.push(detail.nodeId);
        }
      };

      window.addEventListener(EVENT_DRAFT_CANVAS_CHANGE, handler);

      const snapshot: UnifiedPortalSnapshot = {
        id: 'snap-events-test',
        schemaVersion: 1,
        type: 'autosave',
        title: 'Autosave',
        createdAt: '2026-01-01T00:00:00.000Z',
        authorSessionId: 'sess-test',
        canvases: {},
        contentOverrides: {},
        summary: {
          totalSections: 0,
          totalSubsections: 0,
          totalLeafElements: 0,
          totalTextOverrides: 0,
        },
      };

      restoreSnapshotToDraft(snapshot);
      window.removeEventListener(EVENT_DRAFT_CANVAS_CHANGE, handler);

      const activeNodes = getActiveNodeIds();
      expect(dispatchedNodes).toEqual(expect.arrayContaining(activeNodes));
    });
  });

  describe('Pure AST Diffing & Metrics Calculation (computeMetricsSummary)', () => {
    it('calculates metrics strictly against Canvas AST hierarchy and ignores legacy flat overrides', () => {
      const doc1 = createDefaultCanvasDocument('node_env');
      doc1.sections = [
        {
          id: 'sec-1',
          type: 'section',
          title: 'Section 1',
          elements: [
            { id: 'txt-1', pointId: 'p-1', type: 'text', content: 'Text 1' },
            { id: 'photo-1', pointId: 'p-2', type: 'photo', src: '/img1.jpg', caption: 'Photo 1' },
            {
              id: 'sub-1',
              type: 'subsection',
              title: 'Subsection 1',
              elements: [
                { id: 'txt-2', pointId: 'p-3', type: 'text', content: 'Text 2' },
                { id: 'chart-1', chartId: 'c-1', type: 'chart', title: 'Chart 1' },
              ],
            },
          ],
        },
      ];

      const doc2 = createDefaultCanvasDocument('node_tech');
      doc2.sections = [
        {
          id: 'sec-2',
          type: 'section',
          title: 'Section 2',
          elements: [
            { id: 'txt-3', pointId: 'p-5', type: 'text', content: 'Text 3' },
          ],
        },
      ];

      const canvases = {
        node_env: doc1,
        node_tech: doc2,
      };

      // Pass 100 legacy flat keys — these MUST be ignored
      const legacyFlatOverrides: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        legacyFlatOverrides[`dead_key_${i}`] = `value_${i}`;
      }

      const summary = computeMetricsSummary(canvases, legacyFlatOverrides);

      expect(summary.totalSections).toBe(2);
      expect(summary.totalSubsections).toBe(1);
      // Total leaf elements:
      // doc1 sec-1: txt-1 (1), photo-1 (1), sub-1 leaves: txt-2 (1), chart-1 (1) = 4
      // doc2 sec-2: txt-3 (1) = 1
      // Total leaves = 5
      expect(summary.totalLeafElements).toBe(5);
      // Total text elements: txt-1, txt-2, txt-3 = 3
      expect(summary.totalTextOverrides).toBe(3);
    });

    it('handles empty canvases and missing sections gracefully', () => {
      const summary = computeMetricsSummary({});
      expect(summary.totalSections).toBe(0);
      expect(summary.totalSubsections).toBe(0);
      expect(summary.totalLeafElements).toBe(0);
      expect(summary.totalTextOverrides).toBe(0);
    });
  });

  describe('Lightweight History Manifest Storage (< 5 KB)', () => {
    it('stores strictly metadata headers in localStorage and keeps payload < 5 KB for 20 snapshots', () => {
      const activeNodes = getActiveNodeIds();
      const fullCanvases: Record<string, NodeCanvasDocument> = {};
      for (const nodeId of activeNodes) {
        const doc = createDefaultCanvasDocument(nodeId);
        // Add multiple heavy sections to ensure full snapshot would be large
        doc.sections = Array.from({ length: 5 }, (_, i) => ({
          id: `sec-${nodeId}-${i}`,
          type: 'section',
          title: `Heavy Section ${i} for ${nodeId} with long descriptive text`,
          elements: Array.from({ length: 5 }, (_, j) => ({
            id: `txt-${nodeId}-${i}-${j}`,
            pointId: `p-${nodeId}-${i}-${j}`,
            type: 'text',
            content: `Paragraph text content element ${j} in section ${i} for node ${nodeId}`.repeat(5),
          })),
        }));
        fullCanvases[nodeId] = doc;
      }

      const snapshots: UnifiedPortalSnapshot[] = Array.from({ length: 20 }, (_, i) => ({
        id: `snap-${i}`,
        schemaVersion: 1,
        type: i % 2 === 0 ? 'milestone' : 'autosave',
        title: `Checkpoint ${i}`,
        notes: i % 2 === 0 ? `Note ${i}` : '',
        createdAt: new Date(Date.now() - i * 60000).toISOString(),
        authorSessionId: `user-${i}`,
        canvases: fullCanvases,
        contentOverrides: {
          [`override_${i}_a`]: 'value a'.repeat(10),
          [`override_${i}_b`]: 'value b'.repeat(10),
        },
        summary: {
          totalSections: 25,
          totalSubsections: 0,
          totalLeafElements: 125,
          totalTextOverrides: 125,
        },
      }));

      const manifest: HistoryManifest = {
        updatedAt: new Date().toISOString(),
        snapshots,
      };

      saveHistoryManifest(manifest);

      const manifestKey = getHistoryManifestKey();
      const rawStored = storageMap.get(manifestKey);
      expect(rawStored).toBeDefined();

      const parsed = JSON.parse(rawStored!);
      expect(parsed.snapshots.length).toBe(20);

      // Verify that NO canvases or contentOverrides are in localStorage
      for (const snap of parsed.snapshots) {
        expect(snap.canvases).toBeUndefined();
        expect(snap.contentOverrides).toBeUndefined();
        expect(snap.id).toBeDefined();
        expect(snap.title).toBeDefined();
        expect(snap.createdAt).toBeDefined();
        expect(snap.type).toBeDefined();
        expect(snap.summary).toBeDefined();
      }

      // Verify payload size is strictly < 5 KB (5120 bytes)
      const byteSize = new TextEncoder().encode(rawStored!).length;
      expect(byteSize).toBeLessThan(5120);
    });
  });
});
