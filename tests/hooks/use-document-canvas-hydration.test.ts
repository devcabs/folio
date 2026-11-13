import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useDocumentCanvas } from '../../src/hooks/useDocumentCanvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';

function ensureDomEnvironment() {
  class Element { }
  class HTMLElement extends Element { }
  class HTMLIFrameElement extends HTMLElement { }
  class HTMLTextAreaElement extends HTMLElement { }
  class HTMLButtonElement extends HTMLElement { }
  class Document { }

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
    nodeType: number = 3;
    _value: string = '';
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
        addEventListener() { },
        removeEventListener() { },
        dispatchEvent() { return true; },
        focus() { },
        blur() { },
      });
      return el;
    },
    createElementNS(_ns: string, tag: string) {
      return this.createElement(tag);
    },
    createTextNode(text: string) {
      return new MockTextNode(text, mockDoc);
    },
    addEventListener() { },
    removeEventListener() { },
  };
  const mockBody = mockDoc.createElement('body');
  mockDoc.body = mockBody;

  (global as any).document = mockDoc;
}

describe('Subtask 2.8: useDocumentCanvas isHydrating Lifecycle', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    ensureDomEnvironment();
    originalFetch = global.fetch;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('exposes isHydrating = true initially on cold public boot and switches to false after edge resolves', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: false,
      isDesktop: true,
      canUnlock: true,
      isUnlocked: false,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);

    let resolveFetch: (val: any) => void = () => { };
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = vi.fn().mockReturnValue(fetchPromise);

    let latestHookReturn: any = null;
    function TestComponent() {
      latestHookReturn = useDocumentCanvas('node-cold-boot');
      return null;
    }

    const container = (global as any).document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    // 1. Initially on cold public boot, isHydrating must be true
    expect(latestHookReturn.isHydrating).toBe(true);

    // 2. Resolve edge fetch
    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({
          nodeId: 'node-cold-boot',
          canvas: {
            nodeId: 'node-cold-boot',
            version: 2,
            sections: [
              {
                id: 'sec-edge-1',
                type: 'section',
                title: 'Hydrated from Cloudflare Edge KV',
                elements: [],
              },
            ],
            updatedAt: '2026-11-13T10:00:00Z',
          },
        }),
      });
      // flush microtasks
      await new Promise((r) => setTimeout(r, 50));
    });

    // 3. After edge resolves, isHydrating must flip to false and document must be updated
    expect(latestHookReturn.isHydrating).toBe(false);
    expect(latestHookReturn.document.sections.length).toBe(1);
    expect(latestHookReturn.document.sections[0].title).toBe('Hydrated from Cloudflare Edge KV');

    await act(async () => {
      root.unmount();
    });
  });

  it('flips isHydrating to false if edge fetch fails', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: false,
      isDesktop: true,
      canUnlock: true,
      isUnlocked: false,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    let latestHookReturn: any = null;
    function TestComponent() {
      latestHookReturn = useDocumentCanvas('node-cold-boot-fail');
      return null;
    }

    const container = (global as any).document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent));
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(latestHookReturn.isHydrating).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('sets isHydrating = false immediately in Developer Mode', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: true,
      isDesktop: true,
      canUnlock: true,
      isUnlocked: true,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);

    let latestHookReturn: any = null;
    function TestComponent() {
      latestHookReturn = useDocumentCanvas('node-dev-mode');
      return null;
    }

    const container = (global as any).document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(latestHookReturn.isHydrating).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});
