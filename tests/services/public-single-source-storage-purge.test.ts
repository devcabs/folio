import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getNodeCanvas, getLiveNodeCanvas } from '../../src/services/canvasLayoutService';
import { useDocumentCanvas } from '../../src/hooks/useDocumentCanvas';
import { useSheetChartData, getMatrixCacheKey } from '../../src/hooks/useSheetChartData';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import { resetEngineConfig } from '../../src/config/engine.config';

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

  const storageMap = new Map<string, string>();
  const mockLocalStorage = {
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
    key: vi.fn((index: number) => Array.from(storageMap.keys())[index] ?? null),
  };
  (global as any).window.localStorage = mockLocalStorage;
  (global as any).localStorage = mockLocalStorage;

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
          if (!refChild) return this.appendChild(newChild);
          const idx = childNodes.indexOf(refChild);
          if (idx !== -1) childNodes.splice(idx, 0, newChild);
          else childNodes.push(newChild);
          newChild.parentNode = this;
          return newChild;
        },
        removeChild(c: any) {
          const idx = childNodes.indexOf(c);
          if (idx !== -1) childNodes.splice(idx, 1);
          c.parentNode = null;
          return c;
        },
        setAttribute(name: string, val: any) { (this as any)[name] = val; },
        removeAttribute(name: string) { delete (this as any)[name]; },
        getAttribute(name: string) { return (this as any)[name] || null; },
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
  mockDoc.body = mockDoc.createElement('body');
  (global as any).document = mockDoc;

  return { storageMap, mockLocalStorage };
}

describe('Subtask 3.1: Public Single-Source Reading Pipeline & LocalStorage Purge', () => {
  let env: ReturnType<typeof ensureDomEnvironment>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    env = ensureDomEnvironment();
    originalFetch = global.fetch;
    resetEngineConfig();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    resetEngineConfig();
    vi.restoreAllMocks();
  });

  describe('1. getNodeCanvas Single-Source Guard', () => {
    it('returns a clean empty baseline shell and NEVER reads localStorage when isDevMode = false', () => {
      // Seed localStorage with a stale snapshot
      const staleKey = 'folio_live_canvas_access';
      env.mockLocalStorage.setItem(staleKey, JSON.stringify({
        nodeId: 'access',
        version: 2,
        sections: [{ id: 'sec-stale', type: 'section', title: 'Stale Section', elements: [] }],
        updatedAt: '2020-01-01T00:00:00Z',
      }));

      env.mockLocalStorage.getItem.mockClear();

      const publicDoc = getNodeCanvas('access', false);

      // Must NOT read from localStorage
      expect(env.mockLocalStorage.getItem).not.toHaveBeenCalledWith(staleKey);
      // Must return clean baseline shell with 0 sections
      expect(publicDoc.nodeId).toBe('access');
      expect(publicDoc.sections).toEqual([]);
    });

    it('reads live storage or draft storage when isDevMode = true', () => {
      const liveKey = 'folio_live_canvas_access';
      env.mockLocalStorage.setItem(liveKey, JSON.stringify({
        nodeId: 'access',
        version: 2,
        sections: [{ id: 'sec-live', type: 'section', title: 'Live Section', elements: [] }],
        updatedAt: '2026-11-13T00:00:00Z',
      }));

      const devDoc = getNodeCanvas('access', true);
      expect(devDoc.sections.length).toBe(1);
      expect(devDoc.sections[0].title).toBe('Live Section');
    });

    it('preserves getLiveNodeCanvas for publisher bundling and draft initialization', () => {
      const liveKey = 'folio_live_canvas_quality';
      env.mockLocalStorage.setItem(liveKey, JSON.stringify({
        nodeId: 'quality',
        version: 2,
        sections: [{ id: 'sec-quality', type: 'section', title: 'Quality Live', elements: [] }],
        updatedAt: '2026-11-13T00:00:00Z',
      }));

      const liveDoc = getLiveNodeCanvas('quality');
      expect(liveDoc.sections.length).toBe(1);
      expect(liveDoc.sections[0].title).toBe('Quality Live');
    });
  });

  describe('2. useDocumentCanvas Public Cold Boot & Edge Hydration Storage Purity', () => {
    it('on cold reload in public mode, localStorage is never read to populate initial DOM and zero writes occur on hydration', async () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
        canUnlock: true,
        isUnlocked: false,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      // Seed localStorage to check if it's touched
      env.mockLocalStorage.setItem('folio_live_canvas_access', JSON.stringify({
        nodeId: 'access',
        version: 2,
        sections: [{ id: 'old-sec', type: 'section', title: 'Old Section', elements: [] }],
      }));

      const initialStorageLength = env.mockLocalStorage.length;
      env.mockLocalStorage.getItem.mockClear();
      env.mockLocalStorage.setItem.mockClear();

      let resolveFetch!: (val: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      global.fetch = vi.fn().mockReturnValue(fetchPromise);

      let latestHookReturn: any = null;
      function TestComponent() {
        latestHookReturn = useDocumentCanvas('access');
        return null;
      }

      const container = (global as any).document.createElement('div');
      const root = createRoot(container);

      await act(async () => {
        root.render(React.createElement(TestComponent));
      });

      // 1. Initial State: Must be hydrating, document sections must be empty, no localStorage reads for canvas
      expect(latestHookReturn.isHydrating).toBe(true);
      expect(latestHookReturn.document.sections).toEqual([]);
      expect(env.mockLocalStorage.getItem).not.toHaveBeenCalledWith('folio_live_canvas_access');

      // 2. Resolve Edge KV fetch with canvas and chartDatasets
      const edgePayload = {
        nodeId: 'access',
        canvas: {
          nodeId: 'access',
          version: 2,
          sections: [
            {
              id: 'edge-sec-1',
              type: 'section',
              title: 'Single Source Edge Canvas',
              number: '01',
              elements: [],
            },
          ],
          updatedAt: '2026-11-13T12:00:00Z',
        },
        chartDatasets: {
          'chart-1': {
            title: 'Edge Chart',
            chartType: 'bar',
            sanitizedCsvContent: 'Category,Count\nA,10\nB,20',
          },
        },
      };

      await act(async () => {
        resolveFetch({
          ok: true,
          json: async () => edgePayload,
        });
        await new Promise((r) => setTimeout(r, 50));
      });

      // 3. Hydrated state: Canvas reflects Edge KV, isHydrating is false
      expect(latestHookReturn.isHydrating).toBe(false);
      expect(latestHookReturn.document.sections.length).toBe(1);
      expect(latestHookReturn.document.sections[0].title).toBe('Single Source Edge Canvas');

      // 4. STORAGE PURITY GATE: Public visits must generate ZERO writes to localStorage!
      expect(env.mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        'folio_live_canvas_access',
        expect.anything()
      );
      expect(env.mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        expect.stringContaining('chart_matrix_'),
        expect.anything()
      );
      // Storage length must not increase!
      expect(env.mockLocalStorage.length).toBe(initialStorageLength);

      await act(async () => {
        root.unmount();
      });
    });
  });

  describe('3. useSheetChartData Public Matrix Storage Isolation', () => {
    it('does NOT read tabular matrices from localStorage when isDevMode = false', () => {
      const matrixKey = getMatrixCacheKey('chart-matrix-test');
      env.mockLocalStorage.setItem(
        matrixKey,
        JSON.stringify([
          ['Category', 'Count'],
          ['CachedLocally', '999'],
        ])
      );

      env.mockLocalStorage.getItem.mockClear();

      let latestResult: any = null;
      function Harness() {
        latestResult = useSheetChartData({
          chartId: 'chart-matrix-test',
          isDevMode: false,
        });
        return null;
      }

      const container = (global as any).document.createElement('div');
      const root = createRoot(container);

      act(() => {
        root.render(React.createElement(Harness));
      });

      // Assert localStorage was NOT read for matrix in public mode
      expect(env.mockLocalStorage.getItem).not.toHaveBeenCalledWith(matrixKey);
      expect(latestResult.dataset?.categories ?? []).not.toContain('CachedLocally');

      act(() => {
        root.unmount();
      });
    });

    it('reads tabular matrices from localStorage when isDevMode = true', () => {
      const matrixKey = getMatrixCacheKey('chart-matrix-dev');
      env.mockLocalStorage.setItem(
        matrixKey,
        JSON.stringify([
          ['Category', 'Count'],
          ['DevMatrixRow', '42'],
        ])
      );

      let latestResult: any = null;
      function Harness() {
        latestResult = useSheetChartData({
          chartId: 'chart-matrix-dev',
          isDevMode: true,
        });
        return null;
      }

      const container = (global as any).document.createElement('div');
      const root = createRoot(container);

      act(() => {
        root.render(React.createElement(Harness));
      });

      expect(latestResult.dataset?.categories).toContain('DevMatrixRow');

      act(() => {
        root.unmount();
      });
    });
  });
});
