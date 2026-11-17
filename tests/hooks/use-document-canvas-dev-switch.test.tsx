import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useDocumentCanvas } from '../../src/hooks/useDocumentCanvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import {
  clearDraftStorage,
  setInMemoryDraftCanvas,
  syncDraftWithPublished,
} from '../../src/services/draftService';
import {
  EVENT_DRAFT_CANVAS_CHANGE,
  dispatchAggregateCanvasChange,
} from '../../src/services/canvasLayoutService';
import type { NodeCanvasDocument } from '../../src/types/canvas';

function ensureDomEnvironment() {
  class Element {}
  class HTMLElement extends Element {}
  class HTMLIFrameElement extends HTMLElement {}
  class HTMLTextAreaElement extends HTMLElement {}
  class HTMLButtonElement extends HTMLElement {}
  class Document {}

  (global as any).Element = (global as any).Element || Element;
  (global as any).HTMLElement = (global as any).HTMLElement || HTMLElement;
  (global as any).HTMLIFrameElement = (global as any).HTMLIFrameElement || HTMLIFrameElement;
  (global as any).HTMLTextAreaElement = (global as any).HTMLTextAreaElement || HTMLTextAreaElement;
  (global as any).HTMLButtonElement = (global as any).HTMLButtonElement || HTMLButtonElement;
  (global as any).Document = (global as any).Document || Document;
  (global as any).window = (global as any).window || global;

  (global as any).window.Element = (global as any).Element;
  (global as any).window.HTMLElement = (global as any).HTMLElement;
  (global as any).window.HTMLIFrameElement = (global as any).HTMLIFrameElement;
  (global as any).window.HTMLTextAreaElement = (global as any).HTMLTextAreaElement;
  (global as any).window.HTMLButtonElement = (global as any).HTMLButtonElement;
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

  class MockTextNode {
    nodeType = 3;
    _value = '';
    ownerDocument: any;
    constructor(text: string, doc: any) {
      this._value = text;
      this.ownerDocument = doc;
    }
    get textContent() { return this._value; }
    set textContent(v: string) { this._value = v; }
    get nodeValue() { return this._value; }
    set nodeValue(v: string) { this._value = v; }
    get data() { return this._value; }
    set data(v: string) { this._value = v; }
  }

  const mockDoc: any = {
    nodeType: 9,
    activeElement: null,
    defaultView: (global as any).window,
    documentElement: { style: {} },
    createElement(tag: string) {
      const el = new HTMLElement();
      const childNodes: any[] = [];
      Object.assign(el, {
        nodeType: 1,
        tagName: tag.toUpperCase(),
        ownerDocument: mockDoc,
        childNodes,
        style: {},
        value: '',
        placeholder: '',
        disabled: false,
        type: 'button',
        className: '',
        appendChild(c: any) {
          childNodes.push(c);
          c.parentNode = this;
          return c;
        },
        insertBefore(newChild: any, refChild: any) {
          if (!refChild) {
            return this.appendChild(newChild);
          }
          const idx = childNodes.indexOf(refChild);
          if (idx !== -1) {
            childNodes.splice(idx, 0, newChild);
          } else {
            childNodes.push(newChild);
          }
          newChild.parentNode = this;
          return newChild;
        },
        removeChild(c: any) {
          const idx = childNodes.indexOf(c);
          if (idx !== -1) {
            childNodes.splice(idx, 1);
          }
          c.parentNode = null;
          return c;
        },
        setAttribute(name: string, val: any) {
          (this as any)[name] = val;
        },
        removeAttribute(name: string) {
          delete (this as any)[name];
        },
        getAttribute(name: string) {
          return (this as any)[name] || null;
        },
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return true; },
        focus() {},
        blur() {},
      });
      return el;
    },
    createElementNS(_ns: string, tag: string) {
      return this.createElement(tag);
    },
    createTextNode(text: string) {
      return new MockTextNode(text, mockDoc);
    },
    addEventListener() {},
    removeEventListener() {},
  };
  const mockBody = mockDoc.createElement('body');
  mockDoc.body = mockBody;

  (global as any).document = mockDoc;
}

describe('Subtask 5.4: useDocumentCanvas Dev Mode Switch & Hydration Realignment', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    ensureDomEnvironment();
    originalFetch = global.fetch;
    clearDraftStorage();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearDraftStorage();
    vi.restoreAllMocks();
  });

  it('preserves active live canvas on Dev Mode switch until draft hydration completes', async () => {
    let isDevModeActive = false;
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockImplementation(() => ({
      isDevMode: isDevModeActive,
      isDesktop: true,
      canUnlock: true,
      isUnlocked: isDevModeActive,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any));

    let resolveFetch: (val: any) => void = () => {};
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/public/node/access')) {
        return fetchPromise;
      }
      return new Response('{}', { status: 200 });
    });

    let hookResult: any = null;
    function AccessCanvasViewer() {
      hookResult = useDocumentCanvas('access');
      return null;
    }

    const container = (global as any).document.createElement('div');
    const root = createRoot(container);

    // 1. Initial public mount with isDevMode = false
    await act(async () => {
      root.render(React.createElement(AccessCanvasViewer));
    });

    // 2. Resolve Edge KV fetch for public view
    await act(async () => {
      resolveFetch({
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({
          nodeId: 'access',
          version: 2,
          canvas: {
            nodeId: 'access',
            version: 2,
            sections: [
              {
                id: 'sec-edge-live-1',
                type: 'section',
                title: 'Authoritative Edge KV Live Document',
                number: '01',
                elements: [],
              },
            ],
            updatedAt: '2026-11-17T08:00:00.000Z',
          },
        }),
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    // Verify public view has populated edge sections
    expect(hookResult.document.sections.length).toBe(1);
    expect(hookResult.document.sections[0].title).toBe('Authoritative Edge KV Live Document');

    // 3. User switches isDevMode to true while in-memory draft is not yet populated
    isDevModeActive = true;
    await act(async () => {
      root.render(React.createElement(AccessCanvasViewer));
      await new Promise((r) => setTimeout(r, 50));
    });

    // CRITICAL: Document MUST NOT be wiped to 0 sections during the switch transition
    expect(hookResult.document.sections.length).toBe(1);
    expect(hookResult.document.sections[0].title).toBe('Authoritative Edge KV Live Document');

    // 4. Draft hydration finishes: in-memory draft is populated and aggregate event is dispatched
    const hydratedDraft: NodeCanvasDocument = {
      nodeId: 'access',
      version: 2,
      sections: [
        {
          id: 'sec-draft-hydrated',
          type: 'section',
          title: 'Hydrated Draft Baseline Section',
          number: '01',
          elements: [],
        },
        {
          id: 'sec-draft-added',
          type: 'section',
          title: 'Hydrated Draft Second Section',
          number: '02',
          elements: [],
        },
      ],
      updatedAt: '2026-11-17T08:05:00.000Z',
    };
    setInMemoryDraftCanvas('access', hydratedDraft);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(EVENT_DRAFT_CANVAS_CHANGE, {
          detail: { nodeId: '*' },
        })
      );
      await new Promise((r) => setTimeout(r, 50));
    });

    // Mounted canvas hook updates to the hydrated draft state
    expect(hookResult.document.sections.length).toBe(2);
    expect(hookResult.document.sections[0].title).toBe('Hydrated Draft Baseline Section');
    expect(hookResult.document.sections[1].title).toBe('Hydrated Draft Second Section');

    await act(async () => {
      root.unmount();
    });
  });

  it('updates mounted canvas when syncDraftWithPublished is triggered', async () => {
    // 1. Mount hook directly in Developer Mode
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: true,
      isDesktop: true,
      canUnlock: true,
      isUnlocked: true,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);

    const initialDraftDoc: NodeCanvasDocument = {
      nodeId: 'access',
      version: 2,
      sections: [
        {
          id: 'sec-working-draft',
          type: 'section',
          title: 'Working Draft Before Publishing',
          number: '01',
          elements: [],
        },
      ],
      updatedAt: '2026-11-17T08:00:00.000Z',
    };
    setInMemoryDraftCanvas('access', initialDraftDoc);

    let hookResult: any = null;
    function AccessCanvasViewer() {
      hookResult = useDocumentCanvas('access');
      return null;
    }

    const container = (global as any).document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(AccessCanvasViewer));
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(hookResult.document.sections.length).toBe(1);
    expect(hookResult.document.sections[0].title).toBe('Working Draft Before Publishing');

    // 2. Publish action resolves, calling syncDraftWithPublished
    const newlyPublishedDoc: NodeCanvasDocument = {
      nodeId: 'access',
      version: 2,
      sections: [
        {
          id: 'sec-synced-published',
          type: 'section',
          title: 'Newly Published Snapshot Baseline',
          number: '01',
          elements: [],
        },
      ],
      updatedAt: '2026-11-17T08:15:00.000Z',
    };

    await act(async () => {
      syncDraftWithPublished(
        { access: newlyPublishedDoc },
        { 'portal.title': 'Updated Title' },
        'snap-published-new'
      );
      await new Promise((r) => setTimeout(r, 50));
    });

    // Mounted canvas hook updates to newly published baseline without manual refresh
    expect(hookResult.document.sections.length).toBe(1);
    expect(hookResult.document.sections[0].title).toBe('Newly Published Snapshot Baseline');

    await act(async () => {
      root.unmount();
    });
  });

  it('immediately consumes pre-populated draft when switching to Dev Mode', async () => {
    // In-memory draft already pre-populated from cloud or prior edit
    const prePopulatedDraft: NodeCanvasDocument = {
      nodeId: 'access',
      version: 2,
      sections: [
        {
          id: 'sec-prepopulated',
          type: 'section',
          title: 'Pre-Populated Cloud Draft',
          number: '01',
          elements: [],
        },
      ],
      updatedAt: '2026-11-17T08:20:00.000Z',
    };
    setInMemoryDraftCanvas('access', prePopulatedDraft);

    let isDevModeActive = false;
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockImplementation(() => ({
      isDevMode: isDevModeActive,
      isDesktop: true,
      canUnlock: true,
      isUnlocked: isDevModeActive,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any));

    let hookResult: any = null;
    function AccessCanvasViewer() {
      hookResult = useDocumentCanvas('access');
      return null;
    }

    const container = (global as any).document.createElement('div');
    const root = createRoot(container);

    // Initial public mount (default shell before edge fetch)
    await act(async () => {
      root.render(React.createElement(AccessCanvasViewer));
    });

    // Switch to Dev Mode: since draft is already populated, it immediately adopts the pre-populated draft
    isDevModeActive = true;
    await act(async () => {
      root.render(React.createElement(AccessCanvasViewer));
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(hookResult.document.sections.length).toBe(1);
    expect(hookResult.document.sections[0].title).toBe('Pre-Populated Cloud Draft');

    await act(async () => {
      root.unmount();
    });
  });

  it('updates multiple mounted node canvases when wildcard aggregate event is dispatched', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: true,
      isDesktop: true,
      canUnlock: true,
      isUnlocked: true,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);

    let accessHook: any = null;
    let statusHook: any = null;

    function MultiCanvasViewer() {
      accessHook = useDocumentCanvas('access');
      statusHook = useDocumentCanvas('status');
      return null;
    }

    const container = (global as any).document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(MultiCanvasViewer));
    });

    // Populate drafts for both nodes
    setInMemoryDraftCanvas('access', {
      nodeId: 'access',
      version: 2,
      sections: [{ id: 's-acc', type: 'section', title: 'Updated Access', elements: [] }],
      updatedAt: '2026-11-17T08:30:00.000Z',
    });
    setInMemoryDraftCanvas('status', {
      nodeId: 'status',
      version: 2,
      sections: [{ id: 's-sta', type: 'section', title: 'Updated Status', elements: [] }],
      updatedAt: '2026-11-17T08:30:00.000Z',
    });

    await act(async () => {
      dispatchAggregateCanvasChange(true);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(accessHook.document.sections[0].title).toBe('Updated Access');
    expect(statusHook.document.sections[0].title).toBe('Updated Status');

    await act(async () => {
      root.unmount();
    });
  });
});
