import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setEngineConfig,
  resetEngineConfig,
  getStorageNamespace,
  getStorageKey,
} from '../../src/config/engine.config';
import {
  getDraftCanvasPrefix,
  getDraftContentKey,
  getDraftActiveKey,
  getDraftDirtyKey,
  getDraftCanvasKey,
} from '../../src/services/draftService';
import {
  getActiveNodeIds,
  computeMetricsSummary,
} from '../../src/services/historyService';
import {
  getLiveContentStorageKey,
  getDraftContentStorageKey,
  setContent,
  getContent,
  resetAllContentOverrides,
} from '../../src/utils/contentDb';
import { getStorage } from '../../src/utils/storage';
import { createDefaultCanvasDocument } from '../../src/utils/canvasDefaults';

describe('Task 18.7: Storage Isolation & Namespace Parameterization', () => {
  beforeEach(() => {
    resetEngineConfig();
    const storage = getStorage();
    if (storage) {
      storage.clear();
    }
    resetAllContentOverrides(false);
    resetAllContentOverrides(true);
  });

  afterEach(() => {
    resetEngineConfig();
    const storage = getStorage();
    if (storage) {
      storage.clear();
    }
  });

  describe('Namespace Parameterization', () => {
    it('defaults to folio namespace without institutional hardcoding', () => {
      expect(getStorageNamespace()).toBe('folio');
      expect(getStorageKey('test_key')).toBe('folio_test_key');
      expect(getDraftCanvasPrefix()).toBe('folio_draft_canvas_');
      expect(getDraftContentKey()).toBe('folio_draft_content_overrides');
      expect(getDraftActiveKey()).toBe('folio_draft_active');
      expect(getDraftDirtyKey()).toBe('folio_draft_dirty');
      expect(getLiveContentStorageKey()).toBe('folio_live_content_overrides');
      expect(getDraftContentStorageKey()).toBe('folio_draft_content_overrides');
    });

    it('dynamically adapts keys when application namespace is updated', () => {
      setEngineConfig({ appNamespace: 'civic_portal' });

      expect(getStorageNamespace()).toBe('civic_portal');
      expect(getStorageKey('test_key')).toBe('civic_portal_test_key');
      expect(getDraftCanvasPrefix()).toBe('civic_portal_draft_canvas_');
      expect(getDraftContentKey()).toBe('civic_portal_draft_content_overrides');
      expect(getDraftActiveKey()).toBe('civic_portal_draft_active');
      expect(getDraftDirtyKey()).toBe('civic_portal_draft_dirty');
      expect(getLiveContentStorageKey()).toBe('civic_portal_live_content_overrides');
      expect(getDraftContentStorageKey()).toBe('civic_portal_draft_content_overrides');
    });

    it('enforces clean storage separation between distinct namespaces', () => {
      // Store under namespace tenant_alpha
      setEngineConfig({ appNamespace: 'tenant_alpha' });
      const alphaKey = getDraftCanvasKey('node-1');
      expect(alphaKey).toBe('tenant_alpha_draft_canvas_node-1');

      setContent('site_header_title', 'Alpha Portal Header', false);
      expect(getContent('site_header_title', '', false)).toBe('Alpha Portal Header');

      // Switch to namespace tenant_beta
      setEngineConfig({ appNamespace: 'tenant_beta' });
      const betaKey = getDraftCanvasKey('node-1');
      expect(betaKey).toBe('tenant_beta_draft_canvas_node-1');

      // Tenant Beta should not see Tenant Alpha's content
      expect(getContent('site_header_title', '', false)).toBe('');

      // Set Tenant Beta content
      setContent('site_header_title', 'Beta Portal Header', false);
      expect(getContent('site_header_title', '', false)).toBe('Beta Portal Header');

      // Switch back to Tenant Alpha and verify preservation
      setEngineConfig({ appNamespace: 'tenant_alpha' });
      expect(getContent('site_header_title', '', false)).toBe('Alpha Portal Header');
    });
  });

  describe('Dynamic Node Snapshotting & Metrics Calculation', () => {
    it('iterates over dynamic node configurations instead of hardcoded 5 pillars', () => {
      // Configure 3 arbitrary nodes
      setEngineConfig({
        nodes: [
          { id: 'node_env', index: 0, title: 'Environment', accentColor: '#10b981' },
          { id: 'node_tech', index: 1, title: 'Technology', accentColor: '#3b82f6' },
          { id: 'node_comm', index: 2, title: 'Community', accentColor: '#f59e0b' },
        ],
      });

      const activeNodes = getActiveNodeIds();
      expect(activeNodes).toEqual(['node_env', 'node_tech', 'node_comm']);
      expect(activeNodes).toHaveLength(3);
    });

    it('computes accurate metrics summary across arbitrary node counts', () => {
      const doc1 = createDefaultCanvasDocument('node_env');
      doc1.sections = [
        {
          id: 'sec-1', type: 'section',
          title: 'Section 1',
          elements: [
            { id: 'el-1', pointId: 'p-1', type: 'text', content: 'Text 1' },
            {
              id: 'sub-1',
              type: 'subsection',
              title: 'Sub 1',
              elements: [{ id: 'el-2', pointId: 'p-2', type: 'text', content: 'Text 2' }],
            },
          ],
        },
      ];

      const doc2 = createDefaultCanvasDocument('node_tech');
      doc2.sections = [
        {
          id: 'sec-2', type: 'section',
          title: 'Section 2',
          elements: [{ id: 'el-3', pointId: 'p-3', type: 'text', content: 'Text 3' }],
        },
      ];

      const canvases = {
        node_env: doc1,
        node_tech: doc2,
      };

      const summary = computeMetricsSummary(canvases, { key1: 'val1', key2: 'val2' });
      expect(summary.totalSections).toBe(2);
      expect(summary.totalSubsections).toBe(1);
      expect(summary.totalTextOverrides).toBe(2);
    });
  });
  describe("Mutex & Dev Lock Service", () => {
    it("derives developer lock and session keys from active namespace", async () => {
      const { getDevLockStorageKey, getDevSessionIdKey } = await import("../../src/services/devLockService");
      
      expect(getDevLockStorageKey()).toBe("folio_dev_lock");
      expect(getDevSessionIdKey()).toBe("folio_dev_session_id");

      setEngineConfig({ appNamespace: "regional_edu" });
      expect(getDevLockStorageKey()).toBe("regional_edu_dev_lock");
      expect(getDevSessionIdKey()).toBe("regional_edu_dev_session_id");
    });
  });

  describe("Media Asset Service", () => {
    it("sanitizes filenames robustly for object storage", async () => {
      const { sanitizeFilename } = await import("../../src/services/mediaService");
      expect(sanitizeFilename("my photo with spaces!@#.jpg")).toBe("my_photo_with_spaces_.jpg");
      expect(sanitizeFilename("report..pdf")).toBe("report_.pdf");
      expect(sanitizeFilename("")).toBe("asset.png");
    });
  });

  describe("Undo / Redo & Navigation Safety Services", () => {
    it("manages undo / redo stack integrity", async () => {
      const { undoRedoService } = await import("../../src/services/undoRedoService");
      undoRedoService.clear();
      expect(undoRedoService.getState().canUndo).toBe(false);
      expect(undoRedoService.getState().canRedo).toBe(false);

      let undone = false;
      let redone = false;
      undoRedoService.push({
        type: "canvas_update_item",
        description: "Initial edit",
        undo: () => { undone = true; },
        redo: () => { redone = true; },
      });
      expect(undoRedoService.getState().canUndo).toBe(true);
      expect(undoRedoService.getState().canRedo).toBe(false);

      undoRedoService.popUndo();
      expect(undone).toBe(true);
      expect(undoRedoService.getState().canRedo).toBe(true);

      undoRedoService.popRedo();
      expect(redone).toBe(true);
      expect(undoRedoService.getState().canUndo).toBe(true);
    });

    it("tracks unsaved dirty changes correctly", async () => {
      const { registerDirtyEditor, hasAnyUnsavedChanges, clearAllDirtyEditors } = await import("../../src/services/unsavedChangesService");
      clearAllDirtyEditors();
      expect(hasAnyUnsavedChanges()).toBe(false);

      registerDirtyEditor("test-editor", true);
      expect(hasAnyUnsavedChanges()).toBe(true);

      clearAllDirtyEditors();
      expect(hasAnyUnsavedChanges()).toBe(false);
    });
  });

});
