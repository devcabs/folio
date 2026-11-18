import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs';
import path from 'node:path';
import {
  setContent,
  resetContent,
  updateDraftContentOverride,
  removeDraftContentOverride,
} from '../src/utils/contentDb';
import { PortalChromeProvider } from '../src/context/PortalChromeContext';
import { useContent } from '../src/hooks/useContent';
import { usePortalChromeHydration } from '../src/hooks/usePortalChromeHydration';

function setupDomEnv() {
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalFetch = global.fetch;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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

  const storageSetSpy = vi.fn();
  const storageGetSpy = vi.fn(() => null);
  const mockStorage = {
    getItem: storageGetSpy,
    setItem: storageSetSpy,
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(() => null),
  };

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

  const mockWindow: any = {
    Element: MockElement,
    HTMLElement: MockHTMLElement,
    HTMLIFrameElement: MockHTMLElement,
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    document: mockDoc,
    innerWidth: 1440,
    matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };

  mockDoc.defaultView = mockWindow;
  (globalThis as any).Element = MockElement;
  (globalThis as any).HTMLElement = MockHTMLElement;
  (globalThis as any).HTMLIFrameElement = MockHTMLElement;
  (globalThis as any).window = mockWindow;
  (globalThis as any).document = mockDoc;

  return {
    mockDoc,
    mockBody,
    storageSetSpy,
    storageGetSpy,
    restore() {
      (globalThis as any).window = originalWindow;
      (globalThis as any).document = originalDocument;
      global.fetch = originalFetch;
    },
  };
}

describe('Subtask 7.2: Direct KV Content Overrides & Portal Chrome Hydration SSOT', () => {
  let env: ReturnType<typeof setupDomEnv>;
  let roots: Root[] = [];

  beforeEach(() => {
    env = setupDomEnv();
    roots = [];
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const r of roots) {
      try {
        React.act(() => r.unmount());
      } catch {
        // ignore
      }
    }
    env.restore();
  });

  describe('Static Architecture Purity (Zero Module Caches & Zero localStorage)', () => {
    it('contentDb.ts contains zero module-level shadow caches, tombstones, or localStorage calls', () => {
      const contentDbSource = fs.readFileSync(
        path.resolve(__dirname, '../src/utils/contentDb.ts'),
        'utf-8'
      );
      expect(contentDbSource).not.toContain('liveMemoryCache');
      expect(contentDbSource).not.toContain('draftMemoryCache');
      expect(contentDbSource).not.toContain('inMemoryLiveStores');
      expect(contentDbSource).not.toContain('inMemoryDraftStores');
      expect(contentDbSource).not.toContain('draftTombstones');
      expect(contentDbSource).not.toContain('keySubscribers');
      expect(contentDbSource).not.toContain('loadLiveCache');
      expect(contentDbSource).not.toContain('loadDraftCache');
      expect(contentDbSource).not.toContain('saveLiveCache');
      expect(contentDbSource).not.toContain('saveDraftCache');
      expect(contentDbSource).not.toContain('getLegacyContentStorageKey');
      expect(contentDbSource).not.toContain('localStorage');
    });

    it('usePortalChromeHydration.ts contains zero module-level hasCompletedHydration singleton', () => {
      const hydrationSource = fs.readFileSync(
        path.resolve(__dirname, '../src/hooks/usePortalChromeHydration.ts'),
        'utf-8'
      );
      expect(hydrationSource).not.toContain('hasCompletedHydration');
      expect(hydrationSource).not.toContain('.catch(() => {})');
    });
  });

  describe('Direct KV Mutation Functions (Fail-Stop)', () => {
    it('updateDraftContentOverride sends PUT /api/draft with Bearer lockToken and expectedUpdatedAt', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            updatedAt: '2026-11-18T01:00:00Z',
            contentOverrides: { 'hero.title': 'Updated KV Title' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      global.fetch = fetchMock;

      const result = await updateDraftContentOverride(
        'hero.title',
        'Updated KV Title',
        { 'hero.kicker': 'Existing Kicker' },
        { lockToken: 'tok-secret-123', expectedUpdatedAt: '2026-11-18T00:00:00Z' }
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/draft');
      expect(init.method).toBe('PUT');
      expect(init.headers['Authorization']).toBe('Bearer tok-secret-123');
      const parsedBody = JSON.parse(init.body);
      expect(parsedBody.expectedUpdatedAt).toBe('2026-11-18T00:00:00Z');
      expect(parsedBody.contentOverrides).toEqual({
        'hero.kicker': 'Existing Kicker',
        'hero.title': 'Updated KV Title',
      });
      expect(result.updatedAt).toBe('2026-11-18T01:00:00Z');
      expect(env.storageSetSpy).not.toHaveBeenCalled();
    });

    it('removeDraftContentOverride deletes key and sends PUT /api/draft without tombstones', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            updatedAt: '2026-11-18T01:05:00Z',
            contentOverrides: { 'hero.kicker': 'Existing Kicker' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      global.fetch = fetchMock;

      const result = await removeDraftContentOverride(
        'hero.title',
        { 'hero.kicker': 'Existing Kicker', 'hero.title': 'Old Title' },
        { lockToken: 'tok-secret-123', expectedUpdatedAt: '2026-11-18T01:00:00Z' }
      );

      const [, init] = fetchMock.mock.calls[0];
      const parsedBody = JSON.parse(init.body);
      expect(parsedBody.contentOverrides).toEqual({ 'hero.kicker': 'Existing Kicker' });
      expect(parsedBody.contentOverrides).not.toHaveProperty('hero.title');
      expect(result.contentOverrides).not.toHaveProperty('hero.title');
    });

    it('setContent and resetContent call PUT /api/draft and throw (fail-stop) on non-2xx or network failure', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Concurrency conflict' }), { status: 409 })
      );

      await expect(setContent('hero.title', 'Bad Write', true)).rejects.toThrow(/409|Concurrency conflict/);

      global.fetch = vi.fn().mockRejectedValue(new Error('Network down'));

      await expect(resetContent('hero.title', true)).rejects.toThrow(/Network down/);
    });
  });

  describe('PortalChromeProvider & usePortalChromeHydration', () => {
    it('hydrates Public Mode from GET /api/public/manifest and re-hydrates when exiting Dev Mode', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/public/manifest') {
          return new Response(
            JSON.stringify({
              activeSnapshotId: 'snap-1',
              publishedAt: '2026-11-18T00:00:00Z',
              nodeIds: ['access'],
              schemaVersion: 1,
              contentOverrides: { 'hero.title': 'Live KV Title' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url === '/api/draft') {
          return new Response(
            JSON.stringify({
              id: 'active_draft',
              baseSnapshotId: 'snap-1',
              canvases: {},
              contentOverrides: { 'hero.title': 'Draft KV Title' },
              updatedAt: '2026-11-18T00:10:00Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 404 });
      });
      global.fetch = fetchMock;

      let latestText = '';
      let latestHydrating = true;
      function Consumer() {
        const { isHydrating } = usePortalChromeHydration();
        const { text } = useContent('hero.title', 'Fallback Title');
        latestHydrating = isHydrating;
        latestText = text;
        return React.createElement('div', null, text);
      }

      function Harness({ isDev }: { isDev: boolean }) {
        return React.createElement(
          PortalChromeProvider,
          { isDevModeOverride: isDev },
          React.createElement(Consumer)
        );
      }

      const container = env.mockDoc.createElement('div');
      const root = createRoot(container);
      roots.push(root);

      // 1. Public Mode mount -> does NOT flash Fallback Title while hydrating, then shows Live KV Title
      let resolveManifest!: (res: Response) => void;
      fetchMock.mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveManifest = resolve;
          })
      );

      await React.act(async () => {
        root.render(React.createElement(Harness, { isDev: false }));
      });
      expect(latestHydrating).toBe(true);
      expect(latestText).toBe('');

      await React.act(async () => {
        resolveManifest(
          new Response(
            JSON.stringify({
              activeSnapshotId: 'snap-1',
              publishedAt: '2026-11-18T00:00:00Z',
              nodeIds: ['access'],
              schemaVersion: 1,
              contentOverrides: { 'hero.title': 'Live KV Title' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(latestHydrating).toBe(false);
      expect(latestText).toBe('Live KV Title');
      expect(fetchMock).toHaveBeenCalledWith('/api/public/manifest', expect.anything());

      // 2. Enter Dev Mode -> fetches /api/draft
      await React.act(async () => {
        root.render(React.createElement(Harness, { isDev: true }));
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(latestText).toBe('Draft KV Title');

      // 3. Exit Dev Mode -> re-fetches /api/public/manifest (no hasCompletedHydration lock!)
      await React.act(async () => {
        root.render(React.createElement(Harness, { isDev: false }));
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(latestText).toBe('Live KV Title');
      const manifestCalls = fetchMock.mock.calls.filter(([u]) => u === '/api/public/manifest');
      expect(manifestCalls.length).toBe(2);
      expect(env.storageSetSpy).not.toHaveBeenCalled();
    });

    it('fails stop and surfaces error + TopErrorBanner when GET /api/public/manifest returns HTTP 503', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'KV unavailable' }), { status: 503 })
      );

      let latestError: string | null = null;
      let latestHydrating = true;
      function Consumer() {
        const { isHydrating, error } = usePortalChromeHydration();
        latestHydrating = isHydrating;
        latestError = error;
        return React.createElement('div', null, error || 'ok');
      }

      const container = env.mockDoc.createElement('div');
      const root = createRoot(container);
      roots.push(root);

      await React.act(async () => {
        root.render(
          React.createElement(PortalChromeProvider, { isDevModeOverride: false }, React.createElement(Consumer))
        );
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(latestHydrating).toBe(false);
      expect(latestError).toMatch(/503/);
      // TopErrorBanner is portaled into document.body
      expect(env.mockBody.childNodes.length).toBeGreaterThan(0);
    });

    it('useContent setText and resetText mutate KV via PUT /api/draft and fail stop on error', async () => {
      let currentDraft = {
        id: 'active_draft',
        baseSnapshotId: 'snap-1',
        canvases: {},
        contentOverrides: { 'hero.title': 'Initial Draft' },
        updatedAt: '2026-11-18T00:00:00Z',
      };

      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === '/api/draft' && (!init || !init.method || init.method === 'GET')) {
          return new Response(JSON.stringify(currentDraft), { status: 200 });
        }
        if (url === '/api/draft' && init?.method === 'PUT') {
          const body = JSON.parse(init.body as string);
          currentDraft = {
            ...currentDraft,
            contentOverrides: body.contentOverrides,
            updatedAt: '2026-11-18T00:05:00Z',
          };
          return new Response(JSON.stringify(currentDraft), { status: 200 });
        }
        return new Response('{}', { status: 404 });
      });

      let hookApi!: ReturnType<typeof useContent>;
      function Consumer() {
        hookApi = useContent('hero.title', 'Default Hero Title', true);
        return React.createElement('div', null, hookApi.text);
      }

      const container = env.mockDoc.createElement('div');
      const root = createRoot(container);
      roots.push(root);

      await React.act(async () => {
        root.render(
          React.createElement(
            PortalChromeProvider,
            { isDevModeOverride: true, lockTokenOverride: 'tok-dev-999' },
            React.createElement(Consumer)
          )
        );
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(hookApi.text).toBe('Initial Draft');
      expect(hookApi.isModified).toBe(true);

      // Update via setText -> PUT /api/draft
      await React.act(async () => {
        await hookApi.setText('Edited Hero Title');
      });
      expect(hookApi.text).toBe('Edited Hero Title');
      expect(hookApi.isModified).toBe(true);

      // Reset via resetText -> PUT /api/draft without key -> falls back to defaultValue
      await React.act(async () => {
        await hookApi.resetText();
      });
      expect(hookApi.text).toBe('Default Hero Title');
      expect(hookApi.isModified).toBe(false);

      // Fail stop when PUT /api/draft returns 500
      global.fetch = vi.fn().mockResolvedValue(new Response('Server error', { status: 500 }));
      await expect(hookApi.setText('Should Fail')).rejects.toThrow(/500/);
      expect(hookApi.text).toBe('Default Hero Title');
    });
  });
});
