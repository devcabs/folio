import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs';
import path from 'node:path';
import { UndoRedoManager, undoRedoService } from '../../src/services/undoRedoService';
import { UndoRedoProvider } from '../../src/context/UndoRedoContext';
import { PortalChromeProvider } from '../../src/context/PortalChromeContext';
import { useUndoRedo } from '../../src/hooks/useUndoRedo';
import { useDocumentCanvas } from '../../src/hooks/useDocumentCanvas';
import {
  EVENT_DRAFT_UPDATED_AT_SYNC,
  dispatchDraftUpdatedAtSync,
  enqueueDraftMutation,
} from '../../src/services/draftService';
import type { SectionElement } from '../../src/types/canvas';

function setupDomEnv() {
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalFetch = global.fetch;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  const listeners = new Map<string, Set<(e: Event) => void>>();

  class MockElement {
    nodeType = 1;
    tagName = 'DIV';
    style: Record<string, any> = {};
    childNodes: any[] = [];
    attributes: Record<string, string> = {};
    textContent = '';
    ownerDocument: any;
    appendChild = (c: any) => {
      this.childNodes.push(c);
      return c;
    };
    removeChild = (c: any) => {
      this.childNodes = this.childNodes.filter((x) => x !== c);
      return c;
    };
    setAttribute = (k: string, v: string) => {
      this.attributes[k] = String(v);
    };
    getAttribute = (k: string) => this.attributes[k] ?? null;
    removeAttribute = (k: string) => {
      delete this.attributes[k];
    };
    addEventListener = () => { };
    removeEventListener = () => { };
  }

  class MockHTMLElement extends MockElement { }

  const mockBody = new MockHTMLElement();
  mockBody.tagName = 'BODY';

  const mockDoc: any = {
    nodeType: 9,
    activeElement: null,
    body: mockBody,
    documentElement: { style: {} },
    createElement(tag: string) {
      const el = new MockHTMLElement();
      el.tagName = tag.toUpperCase();
      el.ownerDocument = mockDoc;
      return el;
    },
    createElementNS(_ns: string, tag: string) {
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
  mockBody.ownerDocument = mockDoc;

  const mockWindow: any = {
    Element: MockElement,
    HTMLElement: MockHTMLElement,
    HTMLIFrameElement: MockHTMLElement,
    document: mockDoc,
    innerWidth: 1440,
    matchMedia: () => ({ matches: true, addEventListener: () => { }, removeEventListener: () => { } }),
    addEventListener: (type: string, cb: (e: Event) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type: string, cb: (e: Event) => void) => {
      listeners.get(type)?.delete(cb);
    },
    dispatchEvent: (event: Event) => {
      const cbs = listeners.get(event.type);
      if (cbs) {
        for (const cb of [...cbs]) {
          cb(event);
        }
      }
      return true;
    },
  };

  mockDoc.defaultView = mockWindow;
  (globalThis as any).Element = MockElement;
  (globalThis as any).HTMLElement = MockHTMLElement;
  (globalThis as any).HTMLIFrameElement = MockHTMLElement;
  (globalThis as any).window = mockWindow;
  (globalThis as any).document = mockDoc;

  return {
    mockDoc,
    mockWindow,
    restore() {
      (globalThis as any).window = originalWindow;
      (globalThis as any).document = originalDocument;
      global.fetch = originalFetch;
    },
  };
}

describe('Dev Mode Undo / Redo Engine & Persistence', () => {
  beforeEach(() => {
    undoRedoService.clear();
  });

  describe('1. UndoRedoManager async execution, rollback, and scope pruning', () => {
    it('awaits async undo/redo and keeps executingLock active until settled', async () => {
      const mgr = new UndoRedoManager();
      let resolveUndo!: (val: boolean) => void;
      const undoPromise = new Promise<boolean>((resolve) => {
        resolveUndo = resolve;
      });

      mgr.push({
        type: 'canvas_update_item',
        description: 'Edit text',
        undo: () => undoPromise,
        redo: async () => true,
      });

      const pending = mgr.popUndoAsync();
      expect(mgr.isExecuting()).toBe(true);

      // Re-entrant pushes while async undo is in flight must be ignored
      expect(
        mgr.push({
          type: 'canvas_update_item',
          description: 'Nested push',
          undo: () => { },
          redo: () => { },
        })
      ).toBeNull();

      resolveUndo(true);
      const result = await pending;
      expect(result).not.toBeNull();
      expect(mgr.isExecuting()).toBe(false);
      expect(mgr.getState().canUndo).toBe(false);
      expect(mgr.getState().canRedo).toBe(true);
    });

    it('restores action onto undo stack when async undo returns false or rejects', async () => {
      const mgr = new UndoRedoManager();
      mgr.push({
        type: 'canvas_update_item',
        description: 'Failing KV write',
        undo: async () => false,
        redo: async () => true,
      });

      const failed = await mgr.popUndoAsync();
      expect(failed).toBeNull();
      expect(mgr.getState().canUndo).toBe(true);
      expect(mgr.getState().canRedo).toBe(false);

      const mgr2 = new UndoRedoManager();
      mgr2.push({
        type: 'content_text_override',
        description: 'Rejected KV write',
        undo: async () => {
          throw new Error('HTTP 409');
        },
        redo: async () => true,
      });

      const rejected = await mgr2.popUndoAsync();
      expect(rejected).toBeNull();
      expect(mgr2.getState().canUndo).toBe(true);
      expect(mgr2.getState().canRedo).toBe(false);
    });

    it('clearScope prunes only matching scoped actions while keeping global actions', () => {
      const mgr = new UndoRedoManager();
      mgr.push({
        type: 'content_text_override',
        description: 'Header title',
        undo: () => { },
        redo: () => { },
      });
      mgr.push({
        type: 'canvas_insert_section',
        description: 'Add section on N1',
        scope: 'canvas:N1',
        undo: () => { },
        redo: () => { },
      });
      mgr.push({
        type: 'canvas_insert_section',
        description: 'Add section on N2',
        scope: 'canvas:N2',
        undo: () => { },
        redo: () => { },
      });

      mgr.clearScope('canvas:N1');
      const stacks = mgr.getStacks();
      expect(stacks.undo).toHaveLength(2);
      expect(stacks.undo.map((a) => a.description)).toEqual([
        'Header title',
        'Add section on N2',
      ]);
    });
  });

  describe('2. Shared draft mutation queue and updatedAt sync', () => {
    it('serializes concurrent draft mutations in FIFO order', async () => {
      const order: string[] = [];

      const p1 = enqueueDraftMutation(async () => {
        order.push('start-1');
        await new Promise((r) => setTimeout(r, 25));
        order.push('end-1');
        return 1;
      });

      const p2 = enqueueDraftMutation(async () => {
        order.push('start-2');
        order.push('end-2');
        return 2;
      });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(1);
      expect(r2).toBe(2);
      expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    });

    it('broadcasts EVENT_DRAFT_UPDATED_AT_SYNC with the latest updatedAt timestamp', () => {
      const env = setupDomEnv();
      try {
        const received: string[] = [];
        const handler = (e: Event) => {
          const detail = (e as CustomEvent<{ updatedAt?: string }>).detail;
          if (detail?.updatedAt) received.push(detail.updatedAt);
        };
        window.addEventListener(EVENT_DRAFT_UPDATED_AT_SYNC, handler);
        dispatchDraftUpdatedAtSync('2026-11-19T10:00:00.000Z');
        window.removeEventListener(EVENT_DRAFT_UPDATED_AT_SYNC, handler);
        expect(received).toEqual(['2026-11-19T10:00:00.000Z']);
      } finally {
        env.restore();
      }
    });
  });

  describe('3. Static architectural invariants for UniversalEditModal & DocumentCanvas', () => {
    it('UniversalEditModal does not call legacy unauthenticated setContent/resetContent/getContent from contentDb', () => {
      const modalPath = path.resolve(process.cwd(), 'src/components/dev/UniversalEditModal.tsx');
      const src = fs.readFileSync(modalPath, 'utf-8');
      expect(src).not.toMatch(/\bsetContent\s*\(/);
      expect(src).not.toMatch(/\bresetContent\s*\(/);
      expect(src).not.toMatch(/\bgetContent\s*\(/);
      expect(src).toContain('usePortalChrome');
    });

    it('DocumentCanvas registers newly added sections and subsections via history-aware addSection/addSubsection', () => {
      const canvasPath = path.resolve(process.cwd(), 'src/components/canvas/DocumentCanvas.tsx');
      const src = fs.readFileSync(canvasPath, 'utf-8');
      expect(src).toContain('addSection');
      expect(src).toContain('addSubsection');
      expect(src).not.toMatch(/\brestoreSection\s*\(/);
      expect(src).not.toMatch(/\brestoreSubsection\s*\(/);
    });
  });

  describe('4. Live hook integration: cross-surface concurrency & rapid canvas undo/redo', () => {
    let env: ReturnType<typeof setupDomEnv>;
    let root: Root | null = null;

    beforeEach(() => {
      env = setupDomEnv();
      undoRedoService.clear();
    });

    afterEach(async () => {
      if (root) {
        await React.act(async () => {
          root!.unmount();
        });
        root = null;
      }
      env.restore();
    });

    it('keeps expectedUpdatedAt synchronized across rapid canvas add -> undo -> redo without HTTP 409', async () => {
      let kvUpdatedAt = '2026-11-19T09:00:00.000Z';
      let kvRev = 1;
      const putExpectedTimestamps: Array<string | undefined> = [];

      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input);
        const method = (init?.method || 'GET').toUpperCase();

        if (url === '/api/draft' && method === 'GET') {
          return new Response(
            JSON.stringify({
              updatedAt: kvUpdatedAt,
              revision: kvRev,
              canvases: {
                N1: {
                  nodeId: 'N1',
                  version: 3,
                  elements: [],
                  updatedAt: kvUpdatedAt,
                },
              },
              contentOverrides: {},
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (url === '/api/draft' && method === 'PUT') {
          const body = JSON.parse(String(init?.body || '{}'));
          putExpectedTimestamps.push(body.expectedUpdatedAt);
          if (body.expectedUpdatedAt && body.expectedUpdatedAt !== kvUpdatedAt) {
            return new Response(
              JSON.stringify({ error: 'Draft workspace was modified concurrently' }),
              { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
          }
          kvRev += 1;
          kvUpdatedAt = `2026-11-19T09:00:0${kvRev}.000Z`;
          return new Response(
            JSON.stringify({
              updatedAt: kvUpdatedAt,
              revision: kvRev,
              contentOverrides: body.contentOverrides ?? {},
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as any;

      let canvasApi!: ReturnType<typeof useDocumentCanvas>;
      let undoApi!: ReturnType<typeof useUndoRedo>;

      // Provide DeveloperModeContext values by mocking via DeveloperModeContext default export
      const { default: DeveloperModeContext } = await import('../../src/context/DeveloperModeContext');

      const Harness: React.FC = () => {
        canvasApi = useDocumentCanvas('N1');
        undoApi = useUndoRedo();
        return null;
      };

      const container = env.mockDoc.createElement('div');
      root = createRoot(container);

      await React.act(async () => {
        root!.render(
          React.createElement(
            DeveloperModeContext.Provider,
            {
              value: {
                isDevMode: true,
                isDesktop: true,
                lockToken: 'tok-test-123',
                hasUnpublishedChanges: false,
                setHasUnpublishedChanges: () => { },
                showToast: () => { },
              } as any,
            },
            React.createElement(
              PortalChromeProvider,
              { isDevModeOverride: true, lockTokenOverride: 'tok-test-123' },
              React.createElement(UndoRedoProvider, null, React.createElement(Harness))
            )
          )
        );
      });

      // Wait for initial GET /api/draft hydration
      await React.act(async () => {
        await new Promise((r) => setTimeout(r, 15));
      });

      // 1. Add a custom section (simulating DocumentCanvas handleExecuteAdd)
      const customSec: SectionElement = {
        id: 'sec-custom-1',
        type: 'section',
        title: 'Custom Section',
        titlePointId: 'node.N1.section.sec-custom-1.title',
        isNumbered: true,
      };

      await React.act(async () => {
        await canvasApi.addSection(0, customSec);
      });

      expect(canvasApi.document.elements).toHaveLength(1);
      expect(canvasApi.saveError).toBeNull();
      expect(undoApi.canUndo).toBe(true);

      // 2. Undo
      await React.act(async () => {
        await undoApi.undo();
      });

      expect(canvasApi.document.elements).toHaveLength(0);
      expect(canvasApi.saveError).toBeNull();
      expect(undoApi.canRedo).toBe(true);

      // 3. Redo
      await React.act(async () => {
        await undoApi.redo();
      });

      expect(canvasApi.document.elements).toHaveLength(1);
      expect(canvasApi.saveError).toBeNull();
      expect(putExpectedTimestamps).toEqual([
        '2026-11-19T09:00:00.000Z',
        '2026-11-19T09:00:02.000Z',
        '2026-11-19T09:00:03.000Z',
      ]);
    });

    it('synchronizes expectedUpdatedAt across PortalChromeContext and useDocumentCanvas and preserves canvas undo across unmount', async () => {
      let kvUpdatedAt = '2026-11-19T09:10:00.000Z';
      let kvRev = 1;
      let conflictCount = 0;

      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input);
        const method = (init?.method || 'GET').toUpperCase();

        if (url === '/api/draft' && method === 'GET') {
          return new Response(
            JSON.stringify({
              updatedAt: kvUpdatedAt,
              revision: kvRev,
              canvases: {
                N1: { nodeId: 'N1', version: 3, elements: [], updatedAt: kvUpdatedAt },
              },
              contentOverrides: {},
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (url === '/api/draft' && method === 'PUT') {
          const body = JSON.parse(String(init?.body || '{}'));
          if (body.expectedUpdatedAt && body.expectedUpdatedAt !== kvUpdatedAt) {
            conflictCount += 1;
            return new Response(
              JSON.stringify({ error: 'Draft workspace was modified concurrently' }),
              { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
          }
          kvRev += 1;
          kvUpdatedAt = `2026-11-19T09:10:0${kvRev}.000Z`;
          return new Response(
            JSON.stringify({
              updatedAt: kvUpdatedAt,
              revision: kvRev,
              contentOverrides: body.contentOverrides ?? {},
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as any;

      const { default: DeveloperModeContext } = await import('../../src/context/DeveloperModeContext');
      const { usePortalChrome } = await import('../../src/context/PortalChromeContext');

      let canvasApi!: ReturnType<typeof useDocumentCanvas>;
      let chromeApi!: ReturnType<typeof usePortalChrome>;
      let undoApi!: ReturnType<typeof useUndoRedo>;

      const CanvasChild: React.FC = () => {
        canvasApi = useDocumentCanvas('N1');
        return null;
      };

      const Shell: React.FC<{ showCanvas: boolean }> = ({ showCanvas }) => {
        chromeApi = usePortalChrome();
        undoApi = useUndoRedo();
        return showCanvas ? React.createElement(CanvasChild) : null;
      };

      const renderTree = (showCanvas: boolean) =>
        React.createElement(
          DeveloperModeContext.Provider,
          {
            value: {
              isDevMode: true,
              isDesktop: true,
              lockToken: 'tok-cross-123',
              hasUnpublishedChanges: false,
              setHasUnpublishedChanges: () => { },
              showToast: () => { },
            } as any,
          },
          React.createElement(
            PortalChromeProvider,
            { isDevModeOverride: true, lockTokenOverride: 'tok-cross-123' },
            React.createElement(
              UndoRedoProvider,
              null,
              React.createElement(Shell, { showCanvas })
            )
          )
        );

      const container = env.mockDoc.createElement('div');
      root = createRoot(container);

      await React.act(async () => {
        root!.render(renderTree(true));
      });
      await React.act(async () => {
        await new Promise((r) => setTimeout(r, 15));
      });

      // 1. Portal Chrome mutation advances KV updatedAt and broadcasts sync event
      await React.act(async () => {
        await chromeApi!.updateOverride('hero.title', 'Updated Hero');
        undoApi.pushAction({
          type: 'content_text_override',
          description: 'Edit hero title',
          undo: async () => {
            await chromeApi!.removeOverride('hero.title');
            return true;
          },
          redo: async () => {
            await chromeApi!.updateOverride('hero.title', 'Updated Hero');
            return true;
          },
        });
      });

      // 2. Canvas mutation immediately after Portal Chrome edit must NOT 409
      await React.act(async () => {
        const res = await canvasApi.addSection(0);
        expect(res.ok).toBe(true);
      });

      expect(conflictCount).toBe(0);
      expect(undoApi.undoCount).toBe(2);

      // 3. Unmount CanvasChild (simulating route navigation away from N1)
      await React.act(async () => {
        root!.render(renderTree(false));
      });

      // Workspace-addressed canvas action AND global Portal Chrome action are both preserved
      expect(undoApi.undoCount).toBe(2);

      // Undo unmounted canvas action first, then Portal Chrome action
      await React.act(async () => {
        await undoApi.undo();
      });
      await React.act(async () => {
        await undoApi.undo();
      });

      expect(conflictCount).toBe(0);
      expect(chromeApi!.contentOverrides['hero.title']).toBeUndefined();
      expect(undoApi.canRedo).toBe(true);
    });
  });
});
