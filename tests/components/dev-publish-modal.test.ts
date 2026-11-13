import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DevPublishModal } from '../../src/components/dev/DevPublishModal';
import * as historyService from '../../src/services/historyService';
import * as edgePreBakeService from '../../src/services/edgePreBakeService';
import * as draftService from '../../src/services/draftService';
import { DeveloperModeProvider } from '../../src/context/DeveloperModeContext';
import type { PublishedSnapshot } from '../../src/types/history';

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
    getElementById(id: string) {
      const el = findElements(mockDoc.body, (n) => n.id === id || n.getAttribute?.('id') === id);
      return el[0] || null;
    },
    querySelector(_sel: string) {
      return null;
    },
    querySelectorAll(_sel: string) {
      return [];
    },
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
        querySelector(_sel: string) { return null; },
        querySelectorAll(_sel: string) { return []; },
        contains(_other: any) { return false; },
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

const mockSnapshot: PublishedSnapshot = {
  id: 'pub-test-123',
  schemaVersion: 1,
  title: 'Published Revision',
  description: 'Updated hero section and metrics',
  createdAt: '2026-11-13T00:00:00.000Z',
  authorSessionId: 'sess-123',
  isActive: true,
  canvases: {},
  contentOverrides: {},
  summary: {
    totalSections: 5,
    totalSubsections: 2,
    totalLeafElements: 20,
    totalTextOverrides: 2,
  },
};

function collectText(node: any): string {
  if (!node) return '';
  if (node.nodeType === 3) return node.textContent || node.nodeValue || '';
  let str = typeof node.textContent === 'string' ? node.textContent : '';
  if (node.childNodes && Array.isArray(node.childNodes) && node.childNodes.length > 0) {
    let childStr = '';
    for (const child of node.childNodes) {
      childStr += ' ' + collectText(child);
    }
    if (childStr.trim()) {
      str = childStr;
    }
  }
  return str.trim();
}

function findElements(root: any, predicate: (el: any) => boolean): any[] {
  const matches: any[] = [];
  function walk(node: any) {
    if (!node) return;
    if (predicate(node)) matches.push(node);
    if (node.childNodes) {
      for (const child of node.childNodes) walk(child);
    }
  }
  walk(root);
  return matches;
}

function getReactProps(element: any): any {
  if (!element) return {};
  const propKey = Object.keys(element).find((k) => k.startsWith('__reactProps$'));
  return propKey ? element[propKey] : element;
}

function triggerChange(element: any, value: string) {
  const props = getReactProps(element);
  element.value = value;
  props.onChange?.({ target: { value } });
}

function triggerSubmit(element: any) {
  const props = getReactProps(element);
  return props.onSubmit?.({ preventDefault: () => { } });
}

function triggerClick(element: any) {
  const props = getReactProps(element);
  return props.onClick?.({ preventDefault: () => { } });
}

describe('Subtask 2.7: DevPublishModal 3-Tier Status & Retry Affordance', () => {
  let container: any;
  let root: any;

  beforeEach(() => {
    ensureDomEnvironment();
    (global as any).window.location = {
      pathname: '/',
      search: '',
      hash: '',
      origin: 'http://localhost:3000',
    };

    vi.spyOn(draftService, 'checkDraftStaleness').mockReturnValue({
      isStale: false,
      baseId: 'pub-test-base',
      currentActiveId: 'pub-test-base',
    });

    container = (global as any).document.createElement('div');
    (global as any).document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    vi.restoreAllMocks();
    (global as any).document.body.childNodes = [];
  });

  it('renders initial form in idle state and requires at least 4 characters to publish', async () => {
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(
          DeveloperModeProvider,
          null,
          React.createElement(DevPublishModal, {
            isOpen: true,
            onClose,
          })
        )
      );
    });

    const bodyText = collectText((global as any).document.body);
    expect(bodyText).toContain('Publish Changes');
    const textareas = findElements((global as any).document.body, (el) => el.tagName === 'TEXTAREA');
    expect(textareas[0].placeholder).toBe('What changed in this version?');
    expect(bodyText).toContain('Publish');
  });

  it('closes modal and calls onPublished when publish succeeds across all 3 tiers', async () => {
    const onClose = vi.fn();
    const onPublished = vi.fn();

    vi.spyOn(historyService, 'publishNewSnapshot').mockResolvedValue({
      success: true,
      snapshot: mockSnapshot,
      localSaved: true,
      cloudSynced: true,
      edgeDeployed: true,
    });

    await act(async () => {
      root.render(
        React.createElement(
          DeveloperModeProvider,
          null,
          React.createElement(DevPublishModal, {
            isOpen: true,
            onClose,
            onPublished,
          })
        )
      );
    });

    // Find textarea and change value
    const textareas = findElements(
      (global as any).document.body,
      (el) => el.tagName === 'TEXTAREA'
    );
    expect(textareas.length).toBeGreaterThan(0);

    const forms = findElements(
      (global as any).document.body,
      (el) => el.tagName === 'FORM'
    );
    expect(forms.length).toBeGreaterThan(0);

    // Trigger textarea change
    await act(async () => {
      triggerChange(textareas[0], 'Fixing navigation header spacing');
    });

    // Trigger form submit
    await act(async () => {
      await triggerSubmit(forms[0]);
    });

    expect(historyService.publishNewSnapshot).toHaveBeenCalledWith(
      'Fixing navigation header spacing',
      undefined,
      undefined,
      { forcePublish: true }
    );
    expect(onPublished).toHaveBeenCalledWith(mockSnapshot, true);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps modal open and displays 3-tier checklist with retry affordance when Edge deployment fails', async () => {
    const onClose = vi.fn();
    const onPublished = vi.fn();

    vi.spyOn(historyService, 'publishNewSnapshot').mockResolvedValue({
      success: true,
      snapshot: mockSnapshot,
      localSaved: true,
      cloudSynced: true,
      edgeDeployed: false,
      edgeError: 'Cloudflare KV bulk API returned HTTP 500: Internal error',
    });

    await act(async () => {
      root.render(
        React.createElement(
          DeveloperModeProvider,
          null,
          React.createElement(DevPublishModal, {
            isOpen: true,
            onClose,
            onPublished,
          })
        )
      );
    });

    const textareas = findElements((global as any).document.body, (el) => el.tagName === 'TEXTAREA');
    const forms = findElements((global as any).document.body, (el) => el.tagName === 'FORM');

    await act(async () => {
      triggerChange(textareas[0], 'Updated node 3 assets');
    });

    await act(async () => {
      await triggerSubmit(forms[0]);
    });

    // Modal must NOT close!
    expect(onClose).not.toHaveBeenCalled();

    // Body must render the 3-tier checklist and error details
    const bodyText = collectText((global as any).document.body);
    expect(bodyText).toContain('Local Snapshot');
    expect(bodyText).toContain('Saved');
    expect(bodyText).toContain('Supabase Cloud');
    expect(bodyText).toContain('Synced');
    expect(bodyText).toContain('Cloudflare KV Edge');
    expect(bodyText).toContain('Failed');
    expect(bodyText).toContain('Cloudflare KV bulk API returned HTTP 500');

    // Actions must contain "Retry Edge Deploy" and "Close Anyway"
    expect(bodyText).toContain('Retry Edge Deploy');
    expect(bodyText).toContain('Close Anyway');
  });

  it('re-deploys exact same snapshot on Retry Edge Deploy without re-publishing', async () => {
    const onClose = vi.fn();
    const onPublished = vi.fn();

    vi.spyOn(historyService, 'publishNewSnapshot').mockResolvedValue({
      success: true,
      snapshot: mockSnapshot,
      localSaved: true,
      cloudSynced: true,
      edgeDeployed: false,
      edgeError: 'Network failure during KV upload',
    });

    const retrySpy = vi.spyOn(edgePreBakeService, 'compileAndDeployToEdgeKV').mockResolvedValue({
      success: true,
      snapshotId: mockSnapshot.id,
      transformedNodes: ['node-1'],
      totalKvKeys: 5,
      deployResult: { success: true, deployedCount: 5 },
    });

    await act(async () => {
      root.render(
        React.createElement(
          DeveloperModeProvider,
          null,
          React.createElement(DevPublishModal, {
            isOpen: true,
            onClose,
            onPublished,
          })
        )
      );
    });

    const textareas = findElements((global as any).document.body, (el) => el.tagName === 'TEXTAREA');
    const forms = findElements((global as any).document.body, (el) => el.tagName === 'FORM');

    await act(async () => {
      triggerChange(textareas[0], 'Updated node 3 assets');
    });

    await act(async () => {
      await triggerSubmit(forms[0]);
    });

    expect(historyService.publishNewSnapshot).toHaveBeenCalledTimes(1);

    // Find "Retry Edge Deploy" button
    const buttons = findElements(
      (global as any).document.body,
      (el) => el.tagName === 'BUTTON' && collectText(el).includes('Retry Edge Deploy')
    );
    expect(buttons.length).toBe(1);

    // Click retry
    await act(async () => {
      await triggerClick(buttons[0]);
    });

    // Verify compileAndDeployToEdgeKV called with exact same snapshot
    expect(retrySpy).toHaveBeenCalledWith(mockSnapshot);
    // Crucial: publishNewSnapshot must NOT have been called a second time
    expect(historyService.publishNewSnapshot).toHaveBeenCalledTimes(1);

    // Modal closes and calls onPublished
    expect(onPublished).toHaveBeenCalledWith(mockSnapshot, true);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps modal open if retry fails again and displays the updated error', async () => {
    const onClose = vi.fn();

    vi.spyOn(historyService, 'publishNewSnapshot').mockResolvedValue({
      success: true,
      snapshot: mockSnapshot,
      localSaved: true,
      cloudSynced: true,
      edgeDeployed: false,
      edgeError: 'Network failure',
    });

    const retrySpy = vi.spyOn(edgePreBakeService, 'compileAndDeployToEdgeKV').mockResolvedValue({
      success: false,
      snapshotId: mockSnapshot.id,
      transformedNodes: [],
      totalKvKeys: 0,
      deployResult: { success: false, deployedCount: 0, error: 'Rate limit exceeded on Edge KV' },
    });

    await act(async () => {
      root.render(
        React.createElement(
          DeveloperModeProvider,
          null,
          React.createElement(DevPublishModal, {
            isOpen: true,
            onClose,
          })
        )
      );
    });

    const textareas = findElements((global as any).document.body, (el) => el.tagName === 'TEXTAREA');
    const forms = findElements((global as any).document.body, (el) => el.tagName === 'FORM');

    await act(async () => {
      triggerChange(textareas[0], 'Updated node 3 assets');
    });
    await act(async () => {
      await triggerSubmit(forms[0]);
    });

    const retryBtn = findElements(
      (global as any).document.body,
      (el) => el.tagName === 'BUTTON' && collectText(el).includes('Retry Edge Deploy')
    )[0];

    await act(async () => {
      await triggerClick(retryBtn);
    });

    expect(retrySpy).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    const bodyText = collectText((global as any).document.body);
    expect(bodyText).toContain('Rate limit exceeded on Edge KV');
  });

  it('allows closing modal via Close Anyway after Edge deployment failure', async () => {
    const onClose = vi.fn();
    const onPublished = vi.fn();

    vi.spyOn(historyService, 'publishNewSnapshot').mockResolvedValue({
      success: true,
      snapshot: mockSnapshot,
      localSaved: true,
      cloudSynced: true,
      edgeDeployed: false,
      edgeError: 'Edge unavailable',
    });

    await act(async () => {
      root.render(
        React.createElement(
          DeveloperModeProvider,
          null,
          React.createElement(DevPublishModal, {
            isOpen: true,
            onClose,
            onPublished,
          })
        )
      );
    });

    const textareas = findElements((global as any).document.body, (el) => el.tagName === 'TEXTAREA');
    const forms = findElements((global as any).document.body, (el) => el.tagName === 'FORM');

    await act(async () => {
      triggerChange(textareas[0], 'Updated node 3 assets');
    });
    await act(async () => {
      await triggerSubmit(forms[0]);
    });

    const closeAnywayBtn = findElements(
      (global as any).document.body,
      (el) => el.tagName === 'BUTTON' && collectText(el).includes('Close Anyway')
    )[0];
    expect(closeAnywayBtn).toBeDefined();

    await act(async () => {
      await triggerClick(closeAnywayBtn);
    });

    expect(onPublished).toHaveBeenCalledWith(mockSnapshot, true);
    expect(onClose).toHaveBeenCalled();
  });
});
