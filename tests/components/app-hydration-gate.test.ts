import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortalChromeProvider, usePortalChrome } from '../../src/context/PortalChromeContext';
import { App } from '../../src/App';

function setupDomEnv() {
  const originalElement = (globalThis as any).Element;
  const originalHTMLElement = (globalThis as any).HTMLElement;
  const originalHTMLIFrameElement = (globalThis as any).HTMLIFrameElement;
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalFetch = global.fetch;
  const originalRaf = (globalThis as any).requestAnimationFrame;
  const originalCaf = (globalThis as any).cancelAnimationFrame;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  class MockElement {
    nodeType = 1;
    tagName = 'DIV';
    style: Record<string, any> = {
      setProperty: (k: string, v: string) => {
        this.style[k] = v;
      },
      removeProperty: (k: string) => {
        delete this.style[k];
      },
    };
    childNodes: any[] = [];
    attributes: Record<string, string> = {};
    textContent = '';
    ownerDocument: any;
    className = '';
    classList = {
      add: () => {},
      remove: () => {},
      contains: () => false,
    };
    appendChild = (c: any) => {
      this.childNodes.push(c);
      return c;
    };
    removeChild = (c: any) => {
      this.childNodes = this.childNodes.filter((x) => x !== c);
      return c;
    };
    insertBefore = (c: any, ref: any) => {
      const idx = this.childNodes.indexOf(ref);
      if (idx === -1) this.childNodes.push(c);
      else this.childNodes.splice(idx, 0, c);
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
    querySelector = () => null;
    querySelectorAll = () => [];
    getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 });
  }

  class MockHTMLElement extends MockElement {}

  const mockBody = new MockHTMLElement();
  mockBody.tagName = 'BODY';

  const mockDoc: any = {
    nodeType: 9,
    activeElement: null,
    body: mockBody,
    documentElement: {
      style: {},
      scrollHeight: 1000,
      classList: { add: () => {}, remove: () => {}, contains: () => false },
    },
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
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  mockBody.ownerDocument = mockDoc;

  const mockWindow: any = {
    Element: MockElement,
    HTMLElement: MockHTMLElement,
    HTMLIFrameElement: MockHTMLElement,
    document: mockDoc,
    location: { href: 'http://localhost/', search: '', hash: '', pathname: '/' },
    history: { replaceState: () => {}, pushState: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    scrollTo: () => {},
    scrollY: 0,
    innerHeight: 900,
    innerWidth: 1440,
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '1px' }),
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };

  mockDoc.defaultView = mockWindow;
  (globalThis as any).Element = MockElement;
  (globalThis as any).HTMLElement = MockHTMLElement;
  (globalThis as any).HTMLIFrameElement = MockHTMLElement;
  (globalThis as any).document = mockDoc;
  (globalThis as any).window = mockWindow;
  (globalThis as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
  (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

  return {
    mockDoc,
    mockBody,
    restore() {
      (globalThis as any).Element = originalElement;
      (globalThis as any).HTMLElement = originalHTMLElement;
      (globalThis as any).HTMLIFrameElement = originalHTMLIFrameElement;
      (globalThis as any).window = originalWindow;
      (globalThis as any).document = originalDocument;
      (globalThis as any).requestAnimationFrame = originalRaf;
      (globalThis as any).cancelAnimationFrame = originalCaf;
      global.fetch = originalFetch;
      delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    },
  };
}

function findByAttr(node: any, attr: string, value: string): any {
  if (!node) return null;
  if (node.attributes && node.attributes[attr] === value) return node;
  if (Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) {
      const found = findByAttr(child, attr, value);
      if (found) return found;
    }
  }
  return null;
}

describe('App Hydration Gate & Auto-Retry During API Unavailability', () => {
  let env: ReturnType<typeof setupDomEnv>;
  let roots: Root[] = [];

  beforeEach(() => {
    env = setupDomEnv();
    roots = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const r of roots) {
      try {
        React.act(() => r.unmount());
      } catch {
        // ignore
      }
    }
    env.restore();
    vi.restoreAllMocks();
  });

  it('renders only HeroWelcomeGhostWireframe (and hides the website) when /api/public/manifest returns 503', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'KV unavailable' }), { status: 503 })
    );

    const container = env.mockDoc.createElement('div');
    const root = createRoot(container);
    roots.push(root);

    await React.act(async () => {
      root.render(React.createElement(App));
      await new Promise((r) => setTimeout(r, 25));
    });

    const gate = findByAttr(container, 'data-testid', 'portal-hydration-gate');
    const skeleton = findByAttr(container, 'id', 'hero-skeleton');
    const mainContent = findByAttr(container, 'id', 'main-content');

    expect(gate).not.toBeNull();
    expect(skeleton).not.toBeNull();
    expect(mainContent).toBeNull();
  });

  it('automatically retries /api/public/manifest with backoff and reveals the website once API recovers', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/public/manifest') {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: 'Deploying' }), { status: 503 });
        }
        return new Response(
          JSON.stringify({
            activeSnapshotId: 'snap-1',
            publishedAt: '2026-11-18T00:00:00Z',
            nodeIds: ['access'],
            schemaVersion: 1,
            contentOverrides: { 'hero.title': 'Recovered Title' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    let latestHasHydrated = false;
    function Probe() {
      const ctx = usePortalChrome();
      latestHasHydrated = Boolean(ctx?.hasHydrated);
      return React.createElement('div', { id: 'probe' }, String(latestHasHydrated));
    }

    const container = env.mockDoc.createElement('div');
    const root = createRoot(container);
    roots.push(root);

    await React.act(async () => {
      root.render(
        React.createElement(PortalChromeProvider, { isDevModeOverride: false }, React.createElement(Probe))
      );
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(callCount).toBe(1);
    expect(latestHasHydrated).toBe(false);

    // Advance past the first backoff retry (2000ms)
    await React.act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(callCount).toBe(2);
    expect(latestHasHydrated).toBe(true);
  });
});
