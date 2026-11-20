import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  undoRedoService,
  createWorkspaceUndoAction,
} from '../../src/services/undoRedoService';
import { UndoRedoProvider } from '../../src/context/UndoRedoContext';
import { useUndoRedo } from '../../src/hooks/useUndoRedo';
import { useDocumentCanvas } from '../../src/hooks/useDocumentCanvas';
import { useHashRoute } from '../../src/hooks/use-hash-route';
import {
  clearLastKnownDraftUpdatedAt,
  getLastKnownDraftUpdatedAt,
} from '../../src/services/draftService';
import { EVENT_HISTORY_CHANGE } from '../../src/services/historyService';
import { setEngineConfig, resetEngineConfig } from '../../src/config/engine.config';
import type { SectionElement } from '../../src/types/canvas';
import type { PageRegistry } from '../../src/types/page';

function setupDomEnv(initialPath = '/node/access/') {
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalFetch = global.fetch;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  const listeners = new Map<string, Set<(e: Event) => void>>();
  const locationState = {
    pathname: initialPath,
    hash: '',
  };

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
    addEventListener = () => {};
    removeEventListener = () => {};
  }

  class MockHTMLElement extends MockElement {}
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
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  mockBody.ownerDocument = mockDoc;

  const replaceStateCalls: string[] = [];
  const pushStateCalls: string[] = [];

  const mockWindow: any = {
    Element: MockElement,
    HTMLElement: MockHTMLElement,
    HTMLIFrameElement: MockHTMLElement,
    document: mockDoc,
    innerWidth: 1440,
    location: locationState,
    history: {
      replaceState: (_state: any, _title: string, url: string) => {
        locationState.pathname = url;
        replaceStateCalls.push(url);
      },
      pushState: (_state: any, _title: string, url: string) => {
        locationState.pathname = url;
        pushStateCalls.push(url);
      },
    },
    scrollTo: () => {},
    matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
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
    locationState,
    replaceStateCalls,
    pushStateCalls,
    restore() {
      (globalThis as any).window = originalWindow;
      (globalThis as any).document = originalDocument;
      global.fetch = originalFetch;
    },
  };
}

describe('Epic 13.9: Workspace-Aware Cross-Page Undo/Redo Engine', () => {
  let env: ReturnType<typeof setupDomEnv>;
  let root: Root | null = null;

  beforeEach(() => {
    env = setupDomEnv('/node/access/');
    setEngineConfig({
      nodes: [
        { id: 'access', title: 'Access', subtitle: 'Access chapter', nodeNumber: 1, index: 0, accentColor: 'var(--color-node-1)' },
        { id: 'equity', title: 'Equity', subtitle: 'Equity chapter', nodeNumber: 2, index: 1, accentColor: 'var(--color-node-2)' },
      ],
    });
    undoRedoService.clear();
    clearLastKnownDraftUpdatedAt();
  });

  afterEach(async () => {
    if (root) {
      await React.act(async () => {
        root!.unmount();
      });
      root = null;
    }
    resetEngineConfig();
    env.restore();
  });

  it('1. Cross-Page Canvas Undo/Redo: edits Page A, unmounts Page A, undoes & redoes Page A via PUT /api/draft without 409', async () => {
    let kvUpdatedAt = '2026-11-19T10:00:00.000Z';
    let kvRev = 1;
    const kvCanvases: Record<string, any> = {
      access: { nodeId: 'access', version: 3, elements: [], updatedAt: kvUpdatedAt },
      equity: { nodeId: 'equity', version: 3, elements: [], updatedAt: kvUpdatedAt },
    };
    const putPayloads: any[] = [];

    global.fetch = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();

      if (url === '/api/draft' && method === 'GET') {
        return new Response(
          JSON.stringify({
            updatedAt: kvUpdatedAt,
            revision: kvRev,
            canvases: kvCanvases,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url === '/api/draft' && method === 'PUT') {
        const body = JSON.parse(String(init?.body || '{}'));
        putPayloads.push(body);
        if (body.expectedUpdatedAt && body.expectedUpdatedAt !== kvUpdatedAt) {
          return new Response(
            JSON.stringify({ error: 'Concurrent modification' }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }
        kvRev += 1;
        kvUpdatedAt = `2026-11-19T10:00:0${kvRev}.000Z`;
        if (body.canvases) {
          Object.assign(kvCanvases, body.canvases);
        }
        return new Response(
          JSON.stringify({
            updatedAt: kvUpdatedAt,
            revision: kvRev,
            canvases: kvCanvases,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({}), { status: 200 });
    }) as any;

    const { default: DeveloperModeContext } = await import('../../src/context/DeveloperModeContext');

    let canvasApi!: ReturnType<typeof useDocumentCanvas>;
    let undoApi!: ReturnType<typeof useUndoRedo>;

    const PageCanvasView: React.FC<{ nodeId: string }> = ({ nodeId }) => {
      canvasApi = useDocumentCanvas(nodeId);
      return null;
    };

    const Shell: React.FC<{ activeNode: string }> = ({ activeNode }) => {
      undoApi = useUndoRedo();
      return React.createElement(PageCanvasView, { key: activeNode, nodeId: activeNode });
    };

    const renderPage = (activeNode: string) =>
      React.createElement(
        DeveloperModeContext.Provider,
        {
          value: {
            isDevMode: true,
            isDesktop: true,
            lockToken: 'tok-cross-page',
            showToast: () => {},
          } as any,
        },
        React.createElement(
          UndoRedoProvider,
          null,
          React.createElement(Shell, { activeNode })
        )
      );

    const container = env.mockDoc.createElement('div');
    root = createRoot(container);

    // Mount Page A ('access')
    await React.act(async () => {
      root!.render(renderPage('access'));
    });
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });

    const secA: SectionElement = {
      id: 'sec-page-a',
      type: 'section',
      title: 'Section on Page A',
      isNumbered: true,
    };

    await React.act(async () => {
      const res = await canvasApi.addSection(0, secA);
      expect(res.ok).toBe(true);
    });
    expect(kvCanvases.access.elements).toHaveLength(1);
    expect(undoApi.canUndo).toBe(true);

    // Navigate to Page B ('equity'), unmounting Page A's hook
    await React.act(async () => {
      root!.render(renderPage('equity'));
    });
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });

    // Undo history from Page A must be preserved!
    expect(undoApi.canUndo).toBe(true);
    expect(undoApi.undoCount).toBe(1);

    // Undo Page A's edit while viewing Page B
    await React.act(async () => {
      await undoApi.undo();
    });

    expect(kvCanvases.access.elements).toHaveLength(0);
    expect(undoApi.canRedo).toBe(true);

    // Redo Page A's edit while still on Page B
    await React.act(async () => {
      await undoApi.redo();
    });

    expect(kvCanvases.access.elements).toHaveLength(1);
    expect(kvCanvases.access.elements[0].id).toBe('sec-page-a');
    expect(getLastKnownDraftUpdatedAt()).toBe(kvUpdatedAt);
  });

  it('2. Undo Page Creation While Viewing Subpage -> Automatic Parent Redirect', async () => {
    let kvUpdatedAt = '2026-11-19T11:00:00.000Z';
    const beforePages: PageRegistry = {};
    const afterPages: PageRegistry = {
      'page-child': {
        id: 'page-child',
        parentId: 'access',
        title: 'Child Page',
        slug: 'child',
        order: 0,
        createdAt: kvUpdatedAt,
        updatedAt: kvUpdatedAt,
      },
    };
    const deletedPayloads: any[] = [];

    global.fetch = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();
      if (url === '/api/draft' && method === 'PUT') {
        const body = JSON.parse(String(init?.body || '{}'));
        deletedPayloads.push(body);
        kvUpdatedAt = '2026-11-19T11:00:02.000Z';
        return new Response(
          JSON.stringify({
            updatedAt: kvUpdatedAt,
            revision: 2,
            pages: body.pages ?? {},
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as any;

    const { default: DeveloperModeContext } = await import('../../src/context/DeveloperModeContext');
    const toastSpy = vi.fn();

    env.locationState.pathname = '/node/access/child/';

    let routeApi!: ReturnType<typeof useHashRoute>;
    let undoApi!: ReturnType<typeof useUndoRedo>;

    const Harness: React.FC<{ pages: PageRegistry }> = ({ pages }) => {
      routeApi = useHashRoute(['access', 'equity'], undefined, {
        pages,
        onUndoRedirect: (parentTitle) => toastSpy(parentTitle),
      });
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
              lockToken: 'tok-redirect',
              showToast: () => {},
            } as any,
          },
          React.createElement(
            UndoRedoProvider,
            null,
            React.createElement(Harness, { pages: afterPages })
          )
        )
      );
    });

    expect(routeApi.activePageId).toBe('page-child');

    undoRedoService.push(
      createWorkspaceUndoAction({
        type: 'page_create',
        description: 'Create subpage "Child Page"',
        before: {
          canvases: { access: { nodeId: 'access', version: 3, elements: [], updatedAt: kvUpdatedAt } },
          pages: beforePages,
          deletedPageIds: ['page-child'],
        },
        after: {
          canvases: { access: { nodeId: 'access', version: 3, elements: [], updatedAt: kvUpdatedAt } },
          pages: afterPages,
        },
        getLockToken: () => 'tok-redirect',
        getExpectedUpdatedAt: () => kvUpdatedAt,
      })
    );

    await React.act(async () => {
      await undoApi.undo();
    });

    expect(deletedPayloads).toHaveLength(1);
    expect(deletedPayloads[0].deletedPageIds).toEqual(['page-child']);
    expect(env.locationState.pathname).toBe('/node/access/');
    expect(toastSpy).toHaveBeenCalled();
  });

  it('3. Undo Slug Change -> URL Reconciliation via replaceState', async () => {
    let kvUpdatedAt = '2026-11-19T12:00:00.000Z';
    const beforePages: PageRegistry = {
      'page-sub': {
        id: 'page-sub',
        parentId: 'access',
        title: 'Draft Slug',
        slug: 'draft-slug',
        order: 0,
        createdAt: kvUpdatedAt,
        updatedAt: kvUpdatedAt,
      },
    };
    const afterPages: PageRegistry = {
      'page-sub': {
        ...beforePages['page-sub'],
        title: 'Renamed Slug',
        slug: 'renamed-slug',
      },
    };

    global.fetch = vi.fn(async (input: any, init?: any) => {
      if (String(input) === '/api/draft' && (init?.method || 'GET').toUpperCase() === 'PUT') {
        const body = JSON.parse(String(init?.body || '{}'));
        kvUpdatedAt = '2026-11-19T12:00:05.000Z';
        return new Response(
          JSON.stringify({
            updatedAt: kvUpdatedAt,
            revision: 3,
            pages: body.pages,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as any;

    const { default: DeveloperModeContext } = await import('../../src/context/DeveloperModeContext');
    env.locationState.pathname = '/node/access/renamed-slug/';

    let routeApi!: ReturnType<typeof useHashRoute>;
    let undoApi!: ReturnType<typeof useUndoRedo>;

    const Harness: React.FC = () => {
      routeApi = useHashRoute(['access'], undefined, { pages: afterPages });
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
            value: { isDevMode: true, isDesktop: true, lockToken: 'tok-slug', showToast: () => {} } as any,
          },
          React.createElement(UndoRedoProvider, null, React.createElement(Harness))
        )
      );
    });

    expect(routeApi.activePageId).toBe('page-sub');

    undoRedoService.push(
      createWorkspaceUndoAction({
        type: 'page_update_metadata',
        description: 'Rename slug',
        before: { pages: beforePages },
        after: { pages: afterPages },
        getLockToken: () => 'tok-slug',
        getExpectedUpdatedAt: () => kvUpdatedAt,
      })
    );

    await React.act(async () => {
      await undoApi.undo();
    });

    expect(env.locationState.pathname).toBe('/node/access/draft-slug/');
    expect(env.replaceStateCalls).toContain('/node/access/draft-slug/');
  });

  it('4. KV Failure Rollback: HTTP 500 during undo restores action onto undoStack and invokes onError', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'KV write unavailable' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const onError = vi.fn();
    undoRedoService.push(
      createWorkspaceUndoAction({
        type: 'canvas_insert_section',
        description: 'Add failing section',
        before: { canvases: { access: { nodeId: 'access', version: 3, elements: [], updatedAt: '2026-11-19T12:00:00.000Z' } } },
        after: { canvases: { access: { nodeId: 'access', version: 3, elements: [], updatedAt: '2026-11-19T12:00:00.000Z' } } },
        getLockToken: () => 'tok-err',
        onError,
      })
    );

    const popped = await undoRedoService.popUndoAsync();
    expect(popped).toBeNull();
    expect(undoRedoService.getState().canUndo).toBe(true);
    expect(undoRedoService.getState().canRedo).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toContain('KV write unavailable');
  });

  it('5. History Clear on Dev Mode Exit & EVENT_HISTORY_CHANGE', async () => {
    const { default: DeveloperModeContext } = await import('../../src/context/DeveloperModeContext');
    let undoApi!: ReturnType<typeof useUndoRedo>;

    const Harness: React.FC = () => {
      undoApi = useUndoRedo();
      return null;
    };

    const renderWithDevMode = (isDevMode: boolean) =>
      React.createElement(
        DeveloperModeContext.Provider,
        {
          value: { isDevMode, isDesktop: true, lockToken: isDevMode ? 'tok-1' : null, showToast: () => {} } as any,
        },
        React.createElement(UndoRedoProvider, null, React.createElement(Harness))
      );

    const container = env.mockDoc.createElement('div');
    root = createRoot(container);

    await React.act(async () => {
      root!.render(renderWithDevMode(true));
    });

    await React.act(async () => {
      undoApi.pushAction({
        type: 'workspace_transaction',
        description: 'Some edit',
        undo: () => {},
        redo: () => {},
      });
    });
    expect(undoApi.canUndo).toBe(true);

    // Dispatch EVENT_HISTORY_CHANGE (e.g. snapshot restore or publish)
    await React.act(async () => {
      env.mockWindow.dispatchEvent(new CustomEvent(EVENT_HISTORY_CHANGE));
    });
    expect(undoApi.canUndo).toBe(false);

    // Push again, then exit Dev Mode (true -> false)
    await React.act(async () => {
      undoApi.pushAction({
        type: 'workspace_transaction',
        description: 'Another edit',
        undo: () => {},
        redo: () => {},
      });
    });
    expect(undoApi.canUndo).toBe(true);

    await React.act(async () => {
      root!.render(renderWithDevMode(false));
    });
    expect(undoApi.canUndo).toBe(false);
    expect(undoApi.canRedo).toBe(false);
  });
});
