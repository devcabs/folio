import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ReactDOMServer from 'react-dom/server';
import { useSheetChartData } from '../../src/hooks/useSheetChartData';
import { ChartCard } from '../../src/components/chart/ChartCard';
import type { ChartDataset } from '../../src/types/chart';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as chartSourceService from '../../src/services/chartSourceService';

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
          c.parentElement = el;
          return c;
        },
        removeChild(c: any) {
          const idx = childNodes.indexOf(c);
          if (idx >= 0) childNodes.splice(idx, 1);
          return c;
        },
        contains(other: any) {
          if (other === el) return true;
          return childNodes.some((c) => c === other || c.contains?.(other));
        },
        getAttribute(name: string) {
          return (this as any)[name] || null;
        },
        setAttribute(name: string, value: any) {
          (this as any)[name] = value;
        },
        removeAttribute(name: string) {
          delete (this as any)[name];
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

describe('Subtask 3.2: Eliminate Misleading Node-Level Chart Fallbacks', () => {
  beforeEach(() => {
    ensureDomEnvironment();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns dataset === null and status === "pending_data" for an unrecognized chartId on a valid node', async () => {
    // Mock cloud config to return null (no cloud override for this unregistered chart)
    vi.spyOn(chartSourceService, 'fetchChartConfig').mockResolvedValue(null);
    vi.spyOn(chartSourceService, 'getCachedChartConfig').mockReturnValue(null);

    let hookResult: ReturnType<typeof useSheetChartData> | null = null;
    function TestHookConsumer() {
      hookResult = useSheetChartData({
        chartId: 'chart-access-unregistered-99x',
        nodeId: 'access',
      });
      return null;
    }

    const container = (global as any).document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestHookConsumer));
    });

    expect(hookResult).not.toBeNull();
    // CRITICAL REQUIREMENT: Must NOT adopt the sibling baked chart on the same 'access' node!
    expect(hookResult!.dataset).toBeNull();
    expect(hookResult!.status).toBe('pending_data');
  });

  it('correctly resolves dataset when chartId explicitly matches a baked chart', async () => {
    vi.spyOn(chartSourceService, 'fetchChartConfig').mockResolvedValue(null);
    vi.spyOn(chartSourceService, 'getCachedChartConfig').mockReturnValue(null);

    let hookResult: ReturnType<typeof useSheetChartData> | null = null;
    function TestHookConsumer() {
      hookResult = useSheetChartData({
        chartId: 'chart-access-enrolment',
        nodeId: 'access',
      });
      return null;
    }

    const container = (global as any).document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestHookConsumer));
    });

    expect(hookResult).not.toBeNull();
    expect(hookResult!.dataset).not.toBeNull();
    expect(hookResult!.dataset?.chartId).toBe('chart-access-enrolment');
    expect(hookResult!.status).toBe('success');
  });

  it('correctly resolves initialDataset when provided via options', async () => {
    vi.spyOn(chartSourceService, 'fetchChartConfig').mockResolvedValue(null);
    vi.spyOn(chartSourceService, 'getCachedChartConfig').mockReturnValue(null);

    const customDataset: ChartDataset = {
      chartId: 'custom-chart-1',
      title: 'Custom Indicator',
      chartType: 'bar',
      asOfDate: '2026-Q1',
      sanitizedCsvContent: 'A,B\n1,2',
      categories: ['A', 'B'],
      series: [{ name: 'Values', data: [10, 20] }],
    };

    let hookResult: ReturnType<typeof useSheetChartData> | null = null;
    function TestHookConsumer() {
      hookResult = useSheetChartData({
        chartId: 'custom-chart-1',
        nodeId: 'access',
        initialDataset: customDataset,
      });
      return null;
    }

    const container = (global as any).document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestHookConsumer));
    });

    expect(hookResult).not.toBeNull();
    expect(hookResult!.dataset).not.toBeNull();
    expect(hookResult!.dataset?.title).toBe('Custom Indicator');
    expect(hookResult!.status).toBe('success');
  });

  it('renders DataPendingCard in public mode without leaking sibling chart data', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: false,
      isDesktop: true,
      canUnlock: true,
      isUnlocked: false,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);

    const html = ReactDOMServer.renderToString(
      React.createElement(ChartCard, {
        chartId: 'chart-access-unregistered-99x',
        dataset: null,
        status: 'pending_data',
        nodeId: 'access',
      })
    );

    // Must NOT contain sibling chart data or titles
    expect(html).not.toContain('Operational Activity Volume');
    expect(html).not.toContain('Completed Tasks');
    // Must render dignified pending notice in public mode
    expect(html).toContain('Indicator Data Pending');
  });

  it('renders diagnostic panel with "No Google Sheet Linked" and "✎ Edit" in developer mode', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: true,
      isDesktop: true,
      canUnlock: true,
      isUnlocked: true,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);

    const html = ReactDOMServer.renderToString(
      React.createElement(ChartCard, {
        chartId: 'chart-access-unregistered-99x',
        dataset: null,
        status: 'pending_data',
        nodeId: 'access',
      })
    );

    // In Dev Mode, diagnostic hints are displayed
    expect(html).toContain('No Google Sheet Linked');
    expect(html).toContain('✎ Edit');
    // Sibling data must still never be rendered
    expect(html).not.toContain('Operational Activity Volume');
  });
});
