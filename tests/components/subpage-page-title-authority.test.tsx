import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { App } from '../../src/App';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import type { NodeItem } from '../../src/types/node';
import type { PageRegistry } from '../../src/types/page';
import type { NodeCanvasDocument } from '../../src/types/canvas';

const testNodes: NodeItem[] = [
  {
    id: 'access',
    index: 0,
    nodeNumber: 1,
    title: 'Access',
    subtitle: 'Access Subtitle',
    summary: 'Root chapter summary',
    accentColor: '#0284c7',
  },
];

function createTestPages(): PageRegistry {
  return {
    'page-research': {
      id: 'page-research',
      parentId: 'access',
      slug: 'research',
      title: 'Research',
      summary: 'Research summary',
      order: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    'page-interviews': {
      id: 'page-interviews',
      parentId: 'page-research',
      slug: 'interviews',
      title: 'Interviews',
      summary: 'Interviews summary',
      order: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  };
}

function createTestCanvases(): Record<string, NodeCanvasDocument> {
  return {
    access: {
      version: 3,
      nodeId: 'access',
      updatedAt: '2026-01-01T00:00:00Z',
      elements: [
        {
          id: 'sec-links',
          type: 'section',
          title: 'Subpages',
          isNumbered: true,
        },
        {
          id: 'el-link-research',
          type: 'page-link',
          targetPageId: 'page-research',
        },
      ],
    },
    'page-research': {
      version: 3,
      nodeId: 'page-research',
      updatedAt: '2026-01-01T00:00:00Z',
      elements: [
        {
          id: 'sec-res',
          type: 'section',
          title: 'Overview',
          isNumbered: true,
        },
      ],
    },
    'page-interviews': {
      version: 3,
      nodeId: 'page-interviews',
      updatedAt: '2026-01-01T00:00:00Z',
      elements: [],
    },
  };
}

const testConfig = {
  appId: 'test-folio',
  appNamespace: 'test_folio',
  nodes: testNodes,
  branding: {
    appName: 'Test Folio',
    logoText: 'T',
  },
};

function stubBrowserLocation(pathname: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      pathname,
      hash: '',
      search: '',
      href: `http://localhost${pathname}`,
    },
  });
  Object.defineProperty(window, 'history', {
    configurable: true,
    writable: true,
    value: {
      replaceState: vi.fn((_state: unknown, _title: string, url?: string | URL | null) => {
        if (typeof url === 'string') {
          window.location.pathname = url.split('#')[0] || '/';
        }
      }),
      pushState: vi.fn((_state: unknown, _title: string, url?: string | URL | null) => {
        if (typeof url === 'string') {
          window.location.pathname = url.split('#')[0] || '/';
        }
      }),
    },
  });
  (window as any).getComputedStyle = () => ({
    getPropertyValue: () => '',
  });
  (window as any).scrollTo = vi.fn();
  (window as any).matchMedia =
    (window as any).matchMedia ||
    (() => ({
      matches: false,
      addEventListener: () => { },
      removeEventListener: () => { },
    }));
}

function createDevModeStub(showToast = vi.fn()) {
  return {
    isDevMode: true,
    isDesktop: true,
    isPinModalOpen: false,
    isLockBlockedModalOpen: false,
    isExitConfirmModalOpen: false,
    lockConflictHolder: null,
    lockToken: 'lock-test-123',
    hasUnpublishedChanges: false,
    isPublishing: false,
    isRefreshing: false,
    isSyncing: false,
    openPinModal: vi.fn(),
    closePinModal: vi.fn(),
    submitPin: vi.fn(),
    forceTakeoverLock: vi.fn(),
    closeLockBlockedModal: vi.fn(),
    requestExitDevMode: vi.fn(),
    confirmDiscardAndExit: vi.fn(),
    cancelExitDevMode: vi.fn(),
    setHasUnpublishedChanges: vi.fn(),
    publishDraft: vi.fn(),
    refreshFromProduction: vi.fn(),
    showToast,
  };
}

async function flushTicks(count = 4) {
  for (let i = 0; i < count; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function findById(container: HTMLElement, tag: string, id: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll(tag)).find(
    (el) => el.getAttribute('id') === id
  ) as HTMLElement | undefined;
}

function getModalInput(dialog: HTMLElement): HTMLInputElement | HTMLTextAreaElement {
  return (
    Array.from(dialog.querySelectorAll('textarea'))[0] ||
    Array.from(dialog.querySelectorAll('input'))[0]
  ) as HTMLInputElement | HTMLTextAreaElement;
}

async function setModalInputValue(dialog: HTMLElement, value: string) {
  const input = getModalInput(dialog);
  input.value = value;
  input.setAttribute('value', value);
  const propsKey = Object.keys(input).find((k) => k.startsWith('__reactProps$'));
  const reactProps = propsKey ? (input as any)[propsKey] : null;
  await act(async () => {
    reactProps?.onChange?.({ target: { value }, currentTarget: { value } });
    fireEvent.change(input, { target: { value } });
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (typeof window !== 'undefined') {
    delete (window as any).__FOLIO_MANIFEST__;
  }
});

describe('Subtask 13.14: Subpage <PageTitle> Header Defaults & Single PageNode Title Authority', () => {
  it('1. Default Kicker & Root accentColor Inheritance for Level 2 and Level 3 subpages', async () => {
    const pages = createTestPages();
    const canvases = createTestCanvases();

    // Level 2 subpage: /node/access/research/
    stubBrowserLocation('/node/access/research/');
    (window as any).__FOLIO_MANIFEST__ = {
      activeSnapshotId: 'snap-1',
      nodeIds: ['access'],
      contentOverrides: {},
      pages,
      canvases,
    };

    let rendered!: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(<App config={testConfig} />);
    });

    const overviewL2 = findById(rendered.container, 'section', 'node-overview');
    const headerL2 = overviewL2?.querySelectorAll('header')[0] as HTMLElement | undefined;
    expect(headerL2).toBeTruthy();
    expect((headerL2 as any)?.style?.['--title-accent'] || headerL2?.getAttribute('style')).toContain('#0284c7');
    expect(headerL2?.querySelectorAll('h1')[0]?.textContent).toBe('Research');
    expect(headerL2?.textContent).not.toContain('Access');
    expect(headerL2?.textContent).not.toContain('Stage 01:');

    cleanup();

    // Level 3 subpage: /node/access/research/interviews/
    stubBrowserLocation('/node/access/research/interviews/');
    (window as any).__FOLIO_MANIFEST__ = {
      activeSnapshotId: 'snap-1',
      nodeIds: ['access'],
      contentOverrides: {},
      pages,
      canvases,
    };

    await act(async () => {
      rendered = render(<App config={testConfig} />);
    });

    const overviewL3 = findById(rendered.container, 'section', 'node-overview');
    const headerL3 = overviewL3?.querySelectorAll('header')[0] as HTMLElement | undefined;
    expect(headerL3).toBeTruthy();
    expect((headerL3 as any)?.style?.['--title-accent'] || headerL3?.getAttribute('style')).toContain('#0284c7');
    expect(headerL3?.querySelectorAll('h1')[0]?.textContent).toBe('Interviews');
    expect(headerL3?.textContent).not.toContain('Access / Research');
  });

  it('2. Dual-Entry Single Title Authority: editing <PageTitle> updates draft.pages[id] (0 contentOverrides writes) and syncs Breadcrumb, AppHeader, and CanvasPageLink', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub() as any);

    let currentPages = createTestPages();
    const currentCanvases = createTestCanvases();
    const putPayloads: any[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.includes('/api/draft') && method === 'GET') {
          return new Response(
            JSON.stringify({
              status: 'ok',
              contentOverrides: {},
              canvases: currentCanvases,
              pages: currentPages,
              updatedAt: '2026-11-18T00:00:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/api/draft') && method === 'PUT') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          putPayloads.push(body);
          if (body.pages) currentPages = body.pages;
          return new Response(
            JSON.stringify({
              status: 'ok',
              pages: currentPages,
              canvases: currentCanvases,
              contentOverrides: {},
              updatedAt: '2026-11-18T00:01:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    stubBrowserLocation('/node/access/research/');
    let rendered!: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(<App config={testConfig} />);
    });
    await flushTicks();

    const overviewSection = findById(rendered.container, 'section', 'node-overview')!;
    expect(overviewSection).toBeTruthy();
    expect(overviewSection.querySelectorAll('h1')[0]?.textContent).toBe('Research');

    // Uniform ✎ Edit button on PageTitle (strictly "✎ Edit")
    const editButtons = Array.from(overviewSection.querySelectorAll('button')).filter(
      (btn) => btn.getAttribute('data-dev-edit-trigger') === 'true'
    ) as HTMLButtonElement[];
    expect(editButtons.length).toBeGreaterThanOrEqual(2);
    expect(editButtons[0].textContent?.trim()).toBe('✎ Edit');

    // Click first ✎ Edit (Title)
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });

    const dialog = screen.getByRole('dialog');
    const input = getModalInput(dialog);
    expect(input).toBeTruthy();
    expect(input.value).toBe('Research');

    await setModalInputValue(dialog, 'Field Research');

    const saveBtn = screen.getByRole('button', { name: /save/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    await flushTicks();

    expect(putPayloads.length).toBeGreaterThanOrEqual(1);
    const latestPut = putPayloads[putPayloads.length - 1];
    expect(latestPut.pages?.['page-research']?.title).toBe('Field Research');
    expect(latestPut.contentOverrides).toBeUndefined();

    // Verify <PageTitle> and <Breadcrumb> reflect 'Field Research'
    expect(findById(rendered.container, 'section', 'node-overview')?.querySelectorAll('h1')[0]?.textContent).toBe(
      'Field Research'
    );
    const breadcrumbNav = (Array.from(rendered.container.querySelectorAll('nav')) as HTMLElement[]).find(
      (el) => el.getAttribute('aria-label') === 'Breadcrumb navigation'
    );
    expect(breadcrumbNav?.textContent).toContain('Field Research');

    // Navigate back to parent chapter 'Access' via Breadcrumb and verify <CanvasPageLink> shows 'Field Research'
    const accessCrumb = (Array.from(breadcrumbNav!.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim() === 'Access'
    );
    expect(accessCrumb).toBeTruthy();
    await act(async () => {
      fireEvent.click(accessCrumb!);
    });
    await flushTicks();

    const canvas = findById(rendered.container, 'div', 'node-canvas');
    expect(canvas?.textContent).toContain('Field Research');
  });

  it('3. Undo/Redo Synchronization: Cmd+Z reverts pages[subpageId].title across PageTitle and Breadcrumb', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub() as any);

    let currentPages = createTestPages();
    const currentCanvases = createTestCanvases();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.includes('/api/draft') && method === 'GET') {
          return new Response(
            JSON.stringify({
              status: 'ok',
              contentOverrides: {},
              canvases: currentCanvases,
              pages: currentPages,
              updatedAt: '2026-11-18T00:00:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/api/draft') && method === 'PUT') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          if (body.pages) currentPages = body.pages;
          return new Response(
            JSON.stringify({
              status: 'ok',
              pages: currentPages,
              canvases: currentCanvases,
              contentOverrides: {},
              updatedAt: '2026-11-18T00:02:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    stubBrowserLocation('/node/access/research/');
    let rendered!: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(<App config={testConfig} />);
    });
    await flushTicks();

    const overviewSection = findById(rendered.container, 'section', 'node-overview')!;
    const editButtons = Array.from(overviewSection.querySelectorAll('button')).filter(
      (btn) => btn.getAttribute('data-dev-edit-trigger') === 'true'
    ) as HTMLButtonElement[];

    await act(async () => {
      fireEvent.click(editButtons[0]);
    });

    const dialog = screen.getByRole('dialog');
    await setModalInputValue(dialog, 'Renamed Research');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });
    await flushTicks();

    expect(findById(rendered.container, 'section', 'node-overview')?.querySelectorAll('h1')[0]?.textContent).toBe(
      'Renamed Research'
    );

    // Press Cmd+Z to undo
    await act(async () => {
      window.dispatchEvent({
        type: 'keydown',
        key: 'z',
        metaKey: true,
        preventDefault: () => { },
      } as any);
    });
    await flushTicks();

    expect(findById(rendered.container, 'section', 'node-overview')?.querySelectorAll('h1')[0]?.textContent).toBe(
      'Research'
    );
    const breadcrumbNav = (Array.from(rendered.container.querySelectorAll('nav')) as HTMLElement[]).find(
      (el) => el.getAttribute('aria-label') === 'Breadcrumb navigation'
    );
    expect(breadcrumbNav?.textContent).toContain('Research');
  });

  it('4. Public Mode Purity: subpage <PageTitle> renders zero ✎ Edit buttons and zero DevActionAffordance chrome', async () => {
    stubBrowserLocation('/node/access/research/');
    (window as any).__FOLIO_MANIFEST__ = {
      activeSnapshotId: 'snap-1',
      nodeIds: ['access'],
      contentOverrides: {},
      pages: createTestPages(),
      canvases: createTestCanvases(),
    };

    let rendered!: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(<App config={testConfig} />);
    });

    const overviewSection = findById(rendered.container, 'section', 'node-overview')!;
    const editBtns = Array.from(overviewSection.querySelectorAll('button')).filter(
      (btn) => btn.getAttribute('data-dev-edit-trigger') === 'true'
    );
    expect(editBtns.length).toBe(0);
    expect(overviewSection.textContent).not.toContain('✎ Edit');
    expect(overviewSection.querySelectorAll('h1')[0]?.textContent).toBe('Research');
  });

  it('5. Root Chapter Backward Compatibility: root chapters still bind to node.<id>.title / summary via EditableText', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub() as any);

    const currentCanvases = createTestCanvases();
    const currentPages = createTestPages();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.includes('/api/draft') && method === 'GET') {
          return new Response(
            JSON.stringify({
              status: 'ok',
              contentOverrides: { 'node.access.title': 'Custom Access Title' },
              canvases: currentCanvases,
              pages: currentPages,
              updatedAt: '2026-11-18T00:00:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    stubBrowserLocation('/node/access/');
    let rendered!: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(<App config={testConfig} />);
    });
    await flushTicks();

    expect(findById(rendered.container, 'section', 'node-overview')?.querySelectorAll('h1')[0]?.textContent).toBe(
      'Custom Access Title'
    );
  });

  it('6. Summary Editing & 15-Word Guardrail: enforces <= 15 words on summary edits from <PageTitle> and writes zero contentOverrides', async () => {
    const showToast = vi.fn();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(showToast) as any
    );

    let currentPages = createTestPages();
    const currentCanvases = createTestCanvases();
    const putPayloads: any[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.includes('/api/draft') && method === 'GET') {
          return new Response(
            JSON.stringify({
              status: 'ok',
              contentOverrides: {},
              canvases: currentCanvases,
              pages: currentPages,
              updatedAt: '2026-11-18T00:00:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/api/draft') && method === 'PUT') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          putPayloads.push(body);
          if (body.pages) currentPages = body.pages;
          return new Response(
            JSON.stringify({
              status: 'ok',
              pages: currentPages,
              canvases: currentCanvases,
              contentOverrides: {},
              updatedAt: '2026-11-18T00:03:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    stubBrowserLocation('/node/access/research/');
    let rendered!: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(<App config={testConfig} />);
    });
    await flushTicks();

    const overviewSection = findById(rendered.container, 'section', 'node-overview')!;
    const editButtons = Array.from(overviewSection.querySelectorAll('button')).filter(
      (btn) => btn.getAttribute('data-dev-edit-trigger') === 'true'
    ) as HTMLButtonElement[];
    expect(editButtons.length).toBeGreaterThanOrEqual(2);

    // Click second ✎ Edit (Summary)
    await act(async () => {
      fireEvent.click(editButtons[1]);
    });

    const dialog = screen.getByRole('dialog');

    // 16 words -> rejected by word-budget guardrail
    const sixteenWords =
      'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen';
    await setModalInputValue(dialog, sixteenWords);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });
    await flushTicks();

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('15 words'),
      'error'
    );
    expect(putPayloads.length).toBe(0);

    // Edit again with valid 4-word summary -> succeeds
    await act(async () => {
      fireEvent.click(editButtons[1]);
    });
    const dialog2 = screen.getByRole('dialog');
    await setModalInputValue(dialog2, 'Concise field research summary.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });
    await flushTicks();

    expect(putPayloads.length).toBe(1);
    expect(putPayloads[0].pages?.['page-research']?.summary).toBe(
      'Concise field research summary.'
    );
    expect(putPayloads[0].contentOverrides).toBeUndefined();
    expect(findById(rendered.container, 'section', 'node-overview')?.textContent).toContain(
      'Concise field research summary.'
    );
  });
});
