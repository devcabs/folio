import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  EVENT_INDEXEDDB_ERROR,
  notifyIndexedDBError,
  saveToIndexedDB,
} from '../../src/services/historyStorage';
import {
  saveHistoryManifest,
} from '../../src/services/historyService';
import type { HistoryManifest } from '../../src/types/history';
import {
  DeveloperModeProvider,
  useDeveloperMode,
} from '../../src/context/DeveloperModeContext';

function ensureDomEnvironment() {
  class MockElement {
    nodeType: number = 1;
    tagName: string = 'DIV';
    style: Record<string, any> = {};
    childNodes: any[] = [];
    ownerDocument: any;
    appendChild = (c: any) => {
      this.childNodes.push(c);
      return c;
    };
    removeChild = (c: any) => c;
    setAttribute = () => { };
    removeAttribute = () => { };
    addEventListener = () => { };
    removeEventListener = () => { };
  }
  class MockHTMLElement extends MockElement { }

  (global as any).Element = MockElement;
  (global as any).HTMLElement = MockHTMLElement;
  (global as any).HTMLIFrameElement = MockHTMLElement;
  (global as any).IS_REACT_ACT_ENVIRONMENT = true;

  const mockDoc: any = {
    nodeType: 9,
    activeElement: null,
    defaultView: (global as any).window,
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
    addEventListener() { },
    removeEventListener() { },
  };
  const mockBody = new MockHTMLElement();
  mockBody.tagName = 'BODY';
  mockBody.ownerDocument = mockDoc;
  mockDoc.body = mockBody;

  (global as any).document = mockDoc;
}

class MockWindow extends EventTarget {
  indexedDB: any;
  Element: any;
  HTMLElement: any;
  HTMLIFrameElement: any;
  Document: any;
  location: any = {
    pathname: '/',
    search: '',
    hash: '',
  };
  history: any = {
    replaceState: () => { },
  };
  setInterval: any = () => 1;
  clearInterval: any = () => { };
  setTimeout: any = setTimeout;
  clearTimeout: any = clearTimeout;
  matchMedia: any = () => ({
    matches: true,
    addEventListener: () => { },
    removeEventListener: () => { },
  });
}

describe('Subtask 2.5: IndexedDB Quota & Storage Observability Guard', () => {
  let mockWindow: MockWindow;
  let originalWindow: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    ensureDomEnvironment();
    originalWindow = (global as any).window;
    mockWindow = new MockWindow();
    mockWindow.Element = (global as any).Element;
    mockWindow.HTMLElement = (global as any).HTMLElement;
    mockWindow.HTMLIFrameElement = (global as any).HTMLIFrameElement;
    mockWindow.Document = (global as any).Document;
    (global as any).window = mockWindow;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (global as any).window = originalWindow;
  });

  describe('1. EVENT_INDEXEDDB_ERROR and notifyIndexedDBError', () => {
    it('defines EVENT_INDEXEDDB_ERROR correctly', () => {
      expect(EVENT_INDEXEDDB_ERROR).toBe('engine-indexeddb-storage-error');
    });

    it('dispatches CustomEvent with error detail on window when called', () => {
      const listener = vi.fn();
      window.addEventListener(EVENT_INDEXEDDB_ERROR, listener);

      const err = new Error('Disk quota exceeded');
      notifyIndexedDBError('save', err);

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe(EVENT_INDEXEDDB_ERROR);
      expect(event.detail.action).toBe('save');
      expect(event.detail.error).toBe('Disk quota exceeded');
      expect(typeof event.detail.timestamp).toBe('string');

      window.removeEventListener(EVENT_INDEXEDDB_ERROR, listener);
    });

    it('handles non-Error objects gracefully in notifyIndexedDBError', () => {
      const listener = vi.fn();
      window.addEventListener(EVENT_INDEXEDDB_ERROR, listener);

      notifyIndexedDBError('load', 'String error reason');

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.detail.action).toBe('load');
      expect(event.detail.error).toBe('String error reason');

      window.removeEventListener(EVENT_INDEXEDDB_ERROR, listener);
    });

    it('does not crash in non-browser environment when window is undefined', () => {
      (global as any).window = undefined;
      expect(() => {
        notifyIndexedDBError('save', new Error('Fail outside browser'));
      }).not.toThrow();
    });
  });

  describe('2. saveToIndexedDB error handling & event dispatching', () => {
    it('dispatches EVENT_INDEXEDDB_ERROR and returns false when transaction throws', async () => {
      const listener = vi.fn();
      window.addEventListener(EVENT_INDEXEDDB_ERROR, listener);

      const mockDb = {
        transaction: vi.fn().mockImplementation(() => {
          throw new Error('QuotaExceededError: Storage quota exceeded');
        }),
      };

      (window as any).indexedDB = {
        open: vi.fn().mockReturnValue({
          set onsuccess(cb: () => void) {
            this.result = mockDb;
            setTimeout(cb, 0);
          },
          set onerror(_cb: () => void) { },
          set onupgradeneeded(_cb: () => void) { },
        }),
      };

      const result = await saveToIndexedDB('test_key', { data: 123 });

      expect(result).toBe(false);
      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.detail.action).toBe('save');
      expect(event.detail.error).toContain('QuotaExceededError');

      window.removeEventListener(EVENT_INDEXEDDB_ERROR, listener);
    });

    it('dispatches EVENT_INDEXEDDB_ERROR and returns false when req.onerror triggers', async () => {
      const listener = vi.fn();
      window.addEventListener(EVENT_INDEXEDDB_ERROR, listener);

      const mockReq: {
        onsuccess?: () => void;
        onerror?: () => void;
        error?: unknown;
      } = {
        error: new Error('Database locked'),
      };

      const mockStore = {
        put: vi.fn().mockImplementation(() => {
          setTimeout(() => {
            if (mockReq.onerror) mockReq.onerror();
          }, 0);
          return mockReq;
        }),
      };

      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue(mockStore),
        }),
      };

      (window as any).indexedDB = {
        open: vi.fn().mockReturnValue({
          set onsuccess(cb: () => void) {
            this.result = mockDb;
            setTimeout(cb, 0);
          },
          set onerror(_cb: () => void) { },
          set onupgradeneeded(_cb: () => void) { },
        }),
      };

      const result = await saveToIndexedDB('test_key', { data: 456 });

      expect(result).toBe(false);
      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.detail.action).toBe('save');
      expect(event.detail.error).toBe('Database locked');

      window.removeEventListener(EVENT_INDEXEDDB_ERROR, listener);
    });

    it('does not dispatch EVENT_INDEXEDDB_ERROR when saveToIndexedDB succeeds', async () => {
      const listener = vi.fn();
      window.addEventListener(EVENT_INDEXEDDB_ERROR, listener);

      const mockReq: {
        onsuccess?: () => void;
        onerror?: () => void;
      } = {};

      const mockStore = {
        put: vi.fn().mockImplementation(() => {
          setTimeout(() => {
            if (mockReq.onsuccess) mockReq.onsuccess();
          }, 0);
          return mockReq;
        }),
      };

      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue(mockStore),
        }),
      };

      (window as any).indexedDB = {
        open: vi.fn().mockReturnValue({
          set onsuccess(cb: () => void) {
            this.result = mockDb;
            setTimeout(cb, 0);
          },
          set onerror(_cb: () => void) { },
          set onupgradeneeded(_cb: () => void) { },
        }),
      };

      const result = await saveToIndexedDB('test_key', { data: 'ok' });

      expect(result).toBe(true);
      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener(EVENT_INDEXEDDB_ERROR, listener);
    });
  });

  describe('3. saveHistoryManifest notification handling', () => {
    it('notifies on failure when saveToIndexedDB returns false', async () => {
      const listener = vi.fn();
      window.addEventListener(EVENT_INDEXEDDB_ERROR, listener);

      const sampleManifest: HistoryManifest = {
        activePublishedId: 'snap-1',
        snapshots: [],
        updatedAt: new Date().toISOString(),
      };

      const storageModule = await import('../../src/services/historyStorage');
      const saveSpy = vi.spyOn(storageModule, 'saveToIndexedDB').mockResolvedValue(false);

      saveHistoryManifest(sampleManifest);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(saveSpy).toHaveBeenCalled();
      expect(listener).toHaveBeenCalled();

      window.removeEventListener(EVENT_INDEXEDDB_ERROR, listener);
    });

    it('notifies on failure when saveToIndexedDB rejects', async () => {
      const listener = vi.fn();
      window.addEventListener(EVENT_INDEXEDDB_ERROR, listener);

      const sampleManifest: HistoryManifest = {
        activePublishedId: 'snap-2',
        snapshots: [],
        updatedAt: new Date().toISOString(),
      };

      const storageModule = await import('../../src/services/historyStorage');
      const saveSpy = vi.spyOn(storageModule, 'saveToIndexedDB').mockRejectedValue(new Error('IndexedDB crash'));

      saveHistoryManifest(sampleManifest);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(saveSpy).toHaveBeenCalled();
      expect(listener).toHaveBeenCalled();

      window.removeEventListener(EVENT_INDEXEDDB_ERROR, listener);
    });

    it('does not notify when saveHistoryManifest succeeds', async () => {
      const listener = vi.fn();
      window.addEventListener(EVENT_INDEXEDDB_ERROR, listener);

      const sampleManifest: HistoryManifest = {
        activePublishedId: 'snap-ok',
        snapshots: [],
        updatedAt: new Date().toISOString(),
      };

      const storageModule = await import('../../src/services/historyStorage');
      const saveSpy = vi.spyOn(storageModule, 'saveToIndexedDB').mockResolvedValue(true);

      saveHistoryManifest(sampleManifest);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(saveSpy).toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener(EVENT_INDEXEDDB_ERROR, listener);
    });
  });

  describe('4. DeveloperModeContext toast integration', () => {
    it('triggers warning toast when EVENT_INDEXEDDB_ERROR is dispatched', () => {
      const doc = (global as any).document;
      const container = doc.createElement('div');
      const root = createRoot(container);

      let contextRef: any = null;
      const TestConsumer = () => {
        contextRef = useDeveloperMode();
        return null;
      };

      act(() => {
        root.render(
          React.createElement(
            DeveloperModeProvider,
            null,
            React.createElement(TestConsumer)
          )
        );
      });

      expect(contextRef).not.toBeNull();
      const initialBodyChildCount = doc.body.childNodes.length;

      act(() => {
        window.dispatchEvent(
          new CustomEvent(EVENT_INDEXEDDB_ERROR, {
            detail: {
              action: 'save',
              error: 'QuotaExceededError',
              timestamp: new Date().toISOString(),
            },
          })
        );
      });

      // The toast is mounted into document.body via createPortal
      expect(doc.body.childNodes.length).toBeGreaterThan(initialBodyChildCount);

      function collectText(node: any): string {
        let text = node.textContent || '';
        if (node.childNodes && Array.isArray(node.childNodes)) {
          for (const child of node.childNodes) {
            text += ' ' + collectText(child);
          }
        }
        return text;
      }

      // Verify the toast message was rendered
      const allText = collectText(doc.body);
      expect(allText).toContain('Browser storage limit reached');
      expect(allText).toContain('full snapshot backup could not be saved locally');

      act(() => {
        root.unmount();
      });
    });
  });
});
