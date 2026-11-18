import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DeveloperModeProvider, useDeveloperMode } from '../../src/context/DeveloperModeContext';
import { DevPublishModal } from '../../src/components/dev/DevPublishModal';
import * as devLockService from '../../src/services/devLockService';
import * as draftService from '../../src/services/draftService';
import * as historyService from '../../src/services/historyService';
import { registerDirtyEditor, clearAllDirtyEditors } from '../../src/services/unsavedChangesService';
import type { PublishedSnapshot } from '../../src/types/history';

function setupDomHarness(initialUrl = 'https://folio.example.com/?dev=true&mode=developer') {
  class Element {}
  class HTMLElement extends Element {}
  class HTMLTextAreaElement extends HTMLElement {}
  class HTMLButtonElement extends HTMLElement {}
  class Document {}

  (global as any).Element = (global as any).Element || Element;
  (global as any).HTMLElement = (global as any).HTMLElement || HTMLElement;
  (global as any).HTMLTextAreaElement = (global as any).HTMLTextAreaElement || HTMLTextAreaElement;
  (global as any).HTMLButtonElement = (global as any).HTMLButtonElement || HTMLButtonElement;
  (global as any).Document = (global as any).Document || Document;
  (global as any).window = (global as any).window || global;

  (global as any).window.Element = (global as any).Element;
  (global as any).window.HTMLElement = (global as any).HTMLElement;
  (global as any).window.HTMLTextAreaElement = (global as any).HTMLTextAreaElement;
  (global as any).window.HTMLButtonElement = (global as any).HTMLButtonElement;
  (global as any).window.Document = (global as any).Document;
  (global as any).window.HTMLIFrameElement = (global as any).HTMLIFrameElement || HTMLElement;
  (global as any).window.innerWidth = 1280;

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

  const reloadMock = vi.fn();
  const replaceStateMock = vi.fn((_state: any, _title: string, nextUrl: string) => {
    (global as any).window.location.href = nextUrl;
  });

  (global as any).window.location = {
    href: initialUrl,
    origin: 'https://folio.example.com',
    reload: reloadMock,
  };
  (global as any).window.history = {
    replaceState: replaceStateMock,
  };

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
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
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
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return true; },
        focus() {},
        blur() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        contains() { return false; },
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
  mockDoc.body = mockDoc.createElement('body');
  (global as any).document = mockDoc;

  return { reloadMock, replaceStateMock, eventListeners };
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

const mockSnapshot: PublishedSnapshot = {
  id: 'pub-exit-test-1',
  schemaVersion: 1,
  title: 'Published Revision',
  description: 'Exit dev mode after publish',
  createdAt: '2026-11-18T00:00:00.000Z',
  authorSessionId: 'sess-1',
  isActive: true,
  canvases: {},
  contentOverrides: {},
  summary: {
    totalSections: 1,
    totalSubsections: 0,
    totalLeafElements: 1,
    totalTextOverrides: 0,
  },
};

describe('Developer Mode Exit & Publish-to-Exit Flow', () => {
  let container: any;
  let root: any;
  let reloadMock: ReturnType<typeof vi.fn>;
  let replaceStateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const harness = setupDomHarness();
    reloadMock = harness.reloadMock;
    replaceStateMock = harness.replaceStateMock;

    container = (global as any).document.createElement('div');
    (global as any).document.body.appendChild(container);
    root = createRoot(container);

    vi.spyOn(draftService, 'initDraftSession').mockResolvedValue({
      baseSnapshotId: 'pub-1',
      dirty: false,
      canvases: {},
      contentOverrides: {},
      revision: 1,
      updatedAt: '2026-11-18T00:00:00.000Z',
      authorSessionId: 'sess-1',
    });
    vi.spyOn(draftService, 'discardDraftSession').mockResolvedValue({
      baseSnapshotId: 'pub-1',
      dirty: false,
      canvases: {},
      contentOverrides: {},
      revision: 1,
      updatedAt: '2026-11-18T00:00:00.000Z',
      authorSessionId: 'sess-1',
    });
    vi.spyOn(devLockService, 'releaseDevLock').mockResolvedValue(true);
    vi.spyOn(devLockService, 'renewDevLockHeartbeat').mockResolvedValue(true);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    clearAllDirtyEditors();
    vi.restoreAllMocks();
  });

  it('exitDevMode awaits releaseDevLock, strips dev query params, and refreshes the page', async () => {
    let ctxRef: ReturnType<typeof useDeveloperMode> | null = null;
    const Probe = () => {
      ctxRef = useDeveloperMode();
      return null;
    };

    await act(async () => {
      root.render(
        React.createElement(
          DeveloperModeProvider,
          { initialUnlockedAt: Date.now() },
          React.createElement(Probe)
        )
      );
    });

    expect(ctxRef!.isDevMode).toBe(true);

    await act(async () => {
      await ctxRef!.exitDevMode({ discard: false });
    });

    expect(devLockService.releaseDevLock).toHaveBeenCalledTimes(1);
    expect(draftService.discardDraftSession).not.toHaveBeenCalled();
    expect(replaceStateMock).toHaveBeenCalled();
    expect((global as any).window.location.href).not.toContain('dev=true');
    expect((global as any).window.location.href).not.toContain('mode=developer');
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('exitDevMode with discard: true awaits discardDraftSession and releaseDevLock before refreshing', async () => {
    let resolveDiscard!: () => void;
    vi.spyOn(draftService, 'discardDraftSession').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDiscard = () =>
            resolve({
              baseSnapshotId: 'pub-1',
              dirty: false,
              canvases: {},
              contentOverrides: {},
              revision: 1,
              updatedAt: '2026-11-18T00:00:00.000Z',
              authorSessionId: 'sess-1',
            });
        })
    );

    let ctxRef: ReturnType<typeof useDeveloperMode> | null = null;
    const Probe = () => {
      ctxRef = useDeveloperMode();
      return null;
    };

    await act(async () => {
      root.render(
        React.createElement(
          DeveloperModeProvider,
          { initialUnlockedAt: Date.now() },
          React.createElement(Probe)
        )
      );
    });

    let exitPromise: Promise<void> | void;
    await act(async () => {
      exitPromise = ctxRef!.exitDevMode({ discard: true });
    });

    // Reload must not fire before discardDraftSession resolves
    expect(draftService.discardDraftSession).toHaveBeenCalledTimes(1);
    expect(reloadMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveDiscard();
      await exitPromise;
    });

    expect(devLockService.releaseDevLock).toHaveBeenCalledTimes(1);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('exitDevMode clears dirty editors and allows beforeunload without prompting during reload', async () => {
    let ctxRef: ReturnType<typeof useDeveloperMode> | null = null;
    const Probe = () => {
      ctxRef = useDeveloperMode();
      return null;
    };

    await act(async () => {
      root.render(
        React.createElement(
          DeveloperModeProvider,
          { initialUnlockedAt: Date.now() },
          React.createElement(Probe)
        )
      );
    });

    registerDirtyEditor('test-editor', true);

    await act(async () => {
      await ctxRef!.exitDevMode({ discard: false });
    });

    const preventDefault = vi.fn();
    const beforeUnloadEvent: any = {
      type: 'beforeunload',
      preventDefault,
      returnValue: undefined,
    };
    (global as any).window.dispatchEvent(beforeUnloadEvent);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('publishing via DevPublishModal exits dev mode and refreshes the page on success', async () => {
    vi.spyOn(historyService, 'publishNewSnapshot').mockResolvedValue({
      success: true,
      snapshot: mockSnapshot,
      localSaved: true,
      cloudSynced: true,
      edgeDeployed: true,
    });

    const onClose = vi.fn();
    const onPublished = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(
          DeveloperModeProvider,
          { initialUnlockedAt: Date.now() },
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
      const props = getReactProps(textareas[0]);
      textareas[0].value = 'Publish and exit dev mode';
      props.onChange?.({ target: { value: 'Publish and exit dev mode' } });
    });

    await act(async () => {
      const props = getReactProps(forms[0]);
      await props.onSubmit?.({ preventDefault: () => {} });
    });

    expect(onPublished).toHaveBeenCalledWith(mockSnapshot, true);
    expect(onClose).toHaveBeenCalled();
    expect(devLockService.releaseDevLock).toHaveBeenCalledTimes(1);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('publishing failure in DevPublishModal does NOT exit dev mode or refresh the page', async () => {
    vi.spyOn(historyService, 'publishNewSnapshot').mockResolvedValue({
      success: false,
      snapshot: null as any,
      localSaved: false,
      cloudSynced: false,
      edgeDeployed: false,
      error: 'Edge deployment failed',
    });

    const onClose = vi.fn();
    const onPublished = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(
          DeveloperModeProvider,
          { initialUnlockedAt: Date.now() },
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
      const props = getReactProps(textareas[0]);
      textareas[0].value = 'Publish failure test';
      props.onChange?.({ target: { value: 'Publish failure test' } });
    });

    await act(async () => {
      const props = getReactProps(forms[0]);
      await props.onSubmit?.({ preventDefault: () => {} });
    });

    expect(onPublished).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
