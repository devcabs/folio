import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CanvasPageLink } from '../../src/components/canvas/CanvasPageLink';
import { CanvasAddBar } from '../../src/components/canvas/CanvasAddBar';
import { PortalChromeContext, type PortalChromeContextValue } from '../../src/context/PortalChromeContext';
import { UndoRedoProvider } from '../../src/context/UndoRedoContext';
import { useUndoRedo } from '../../src/hooks/useUndoRedo';
import { useDocumentCanvas } from '../../src/hooks/useDocumentCanvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as engineConfigModule from '../../src/config/engine.config';
import { buildTwoLevelNavTree } from '../../src/services/pageTreeService';
import type { PageLinkElement, NodeCanvasDocument } from '../../src/types/canvas';
import type { PageRegistry, PageNode } from '../../src/types/page';
import type { NodeItem } from '../../src/types/node';

function createMockPortalChrome(pages: PageRegistry): PortalChromeContextValue {
  return {
    contentOverrides: {},
    pages,
    publishedPages: {},
    isHydrating: false,
    hasHydrated: true,
    hydrationError: null,
    error: null,
    draftUpdatedAt: '2026-11-19T00:00:00.000Z',
    retry: vi.fn(),
    updateOverride: vi.fn().mockResolvedValue(undefined),
    removeOverride: vi.fn().mockResolvedValue(undefined),
    commitWorkspaceMutation: vi.fn(),
  };
}

const rootNodes: NodeItem[] = [
  {
    id: 'access',
    index: 0,
    nodeNumber: 1,
    title: 'Access',
    subtitle: 'Access & Equity',
    summary: 'Root chapter',
    accentColor: '#881337',
  },
];

const samplePages: PageRegistry = {
  'page-research': {
    id: 'page-research',
    parentId: 'access',
    slug: 'research',
    title: 'Research Findings',
    summary: 'Longitudinal outcomes across partner sites.',
    order: 0,
    createdAt: '2026-11-19T00:00:00.000Z',
    updatedAt: '2026-11-19T00:00:00.000Z',
  },
  'page-no-summary': {
    id: 'page-no-summary',
    parentId: 'access',
    slug: 'methodology',
    title: 'Methodology',
    order: 1,
    createdAt: '2026-11-19T00:00:00.000Z',
    updatedAt: '2026-11-19T00:00:00.000Z',
  },
};

describe('13.12 <CanvasPageLink> Editorial Card & Canvas Reorder Order-Sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(engineConfigModule, 'getActiveNodes').mockReturnValue(rootNodes);
    vi.spyOn(engineConfigModule, 'getEngineConfig').mockReturnValue({
      appId: 'folio-test',
      appNamespace: 'folio-test',
      basePath: '/',
      nodes: rootNodes,
      branding: { orgName: 'Folio Engine', portalTitle: 'Folio' },
    } as unknown as ReturnType<typeof engineConfigModule.getEngineConfig>);

    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: false,
      isDesktop: true,
      isHydrated: true,
      lockToken: null,
      enterDevMode: vi.fn(),
      exitDevMode: vi.fn(),
      toggleDevMode: vi.fn(),
    } as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders live PageNode.title, optional summary, PageIcon, ArrowRightIcon, and navigates with canonical href', () => {
    const element: PageLinkElement = {
      id: 'page-link-1',
      type: 'page-link',
      targetPageId: 'page-research',
    };
    const onNavigate = vi.fn();

    const { container } = render(
      <PortalChromeContext.Provider value={createMockPortalChrome(samplePages)}>
        <CanvasPageLink
          element={element}
          nodeId="access"
          onNavigate={onNavigate}
        />
      </PortalChromeContext.Provider>
    );

    const link = container.querySelectorAll('a')[0];
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/node/access/research/');
    expect(screen.getByText('Research Findings')).toBeTruthy();
    expect(screen.getByText('Longitudinal outcomes across partner sites.')).toBeTruthy();

    // Contains cycling cover photo or ArrowRightIcon SVG
    expect(link.querySelector('img') || link.querySelector('svg')).toBeTruthy();
    expect(link.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('page-research');
  });

  it('omits summary node cleanly when PageNode.summary is empty or undefined with zero badge theater', () => {
    const element: PageLinkElement = {
      id: 'page-link-2',
      type: 'page-link',
      targetPageId: 'page-no-summary',
    };

    const { container } = render(
      <PortalChromeContext.Provider value={createMockPortalChrome(samplePages)}>
        <CanvasPageLink element={element} nodeId="access" />
      </PortalChromeContext.Provider>
    );

    const link = container.querySelectorAll('a')[0];
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/node/access/methodology/');
    expect(screen.getByText('Methodology')).toBeTruthy();

    // No empty summary span or badge theater text
    const spans = Array.from(link.querySelectorAll('span')) as HTMLElement[];
    const emptyTextSpans = spans.filter(
      (s) => s.getAttribute('aria-hidden') !== 'true' && s.children.length === 0 && s.textContent?.trim() === ''
    );
    expect(emptyTextSpans.length).toBe(0);
    expect(screen.queryByText(/subpage/i)).toBeNull();
  });

  it('hides missing targetPageId in Public Mode (returns null) and shows disabled recovery card in Dev Mode', () => {
    const missingElement: PageLinkElement = {
      id: 'page-link-missing',
      type: 'page-link',
      targetPageId: 'non-existent-page',
    };

    // Public Mode: returns null
    const { container, rerender } = render(
      <PortalChromeContext.Provider value={createMockPortalChrome(samplePages)}>
        <CanvasPageLink element={missingElement} nodeId="access" />
      </PortalChromeContext.Provider>
    );
    expect(container.querySelectorAll('div, a').length).toBe(0);
    expect(container.textContent).toBe('');

    // Dev Mode: renders calm disabled recovery card
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: true,
      isDesktop: true,
      isHydrated: true,
      lockToken: 'lock-123',
      enterDevMode: vi.fn(),
      exitDevMode: vi.fn(),
      toggleDevMode: vi.fn(),
    } as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>);

    rerender(
      <PortalChromeContext.Provider value={createMockPortalChrome(samplePages)}>
        <CanvasPageLink element={missingElement} nodeId="access" />
      </PortalChromeContext.Provider>
    );

    const disabledCard = screen.getByRole('region', { name: /Linked subpage unavailable/i });
    expect(disabledCard.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Linked subpage unavailable')).toBeTruthy();
    expect(
      screen.getByText('Target page no longer exists in draft registry. Remove or undo to restore.')
    ).toBeTruthy();
    expect(container.querySelectorAll('a').length).toBe(0);
  });

  it('renders uniform Edit button in Dev Mode desktop and zero edit chrome in Public Mode', () => {
    const element: PageLinkElement = {
      id: 'page-link-1',
      type: 'page-link',
      targetPageId: 'page-research',
    };
    const onEdit = vi.fn();

    // Public mode: no Edit button
    const { rerender } = render(
      <PortalChromeContext.Provider value={createMockPortalChrome(samplePages)}>
        <CanvasPageLink element={element} nodeId="access" onEdit={onEdit} />
      </PortalChromeContext.Provider>
    );
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();

    // Dev Mode desktop: Edit button strictly labeled "Edit" (with ✎ prefix)
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: true,
      isDesktop: true,
      isHydrated: true,
      lockToken: 'lock-123',
      enterDevMode: vi.fn(),
      exitDevMode: vi.fn(),
      toggleDevMode: vi.fn(),
    } as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>);

    rerender(
      <PortalChromeContext.Provider value={createMockPortalChrome(samplePages)}>
        <CanvasPageLink element={element} nodeId="access" onEdit={onEdit} />
      </PortalChromeContext.Provider>
    );

    const editBtn = screen.getByRole('button', { name: /edit/i });
    expect(editBtn.textContent?.trim()).toBe('✎ Edit');
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('atomically syncs PageNode.order on canvas moveItem reorder and restores on undo', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: true,
      isDesktop: true,
      isHydrated: true,
      lockToken: 'lock-123',
      enterDevMode: vi.fn(),
      exitDevMode: vi.fn(),
      toggleDevMode: vi.fn(),
    } as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>);

    const initialPages: PageRegistry = {
      'page-1': {
        id: 'page-1',
        parentId: 'access',
        slug: 'one',
        title: 'Page 1',
        order: 0,
        createdAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:00:00.000Z',
      },
      'page-2': {
        id: 'page-2',
        parentId: 'access',
        slug: 'two',
        title: 'Page 2',
        order: 1,
        createdAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:00:00.000Z',
      },
    };

    const initialCanvas: NodeCanvasDocument = {
      nodeId: 'access',
      version: 3,
      updatedAt: '2026-11-19T00:00:00.000Z',
      elements: [
        {
          id: 'sec-1',
          type: 'section',
          title: 'Subpages',
        },
        {
          id: 'page-link-1',
          type: 'page-link',
          targetPageId: 'page-1',
        },
        {
          id: 'page-link-2',
          type: 'page-link',
          targetPageId: 'page-2',
        },
      ],
    };

    const putPayloads: Array<Record<string, unknown>> = [];
    let currentUpdatedAt = '2026-11-19T00:00:00.000Z';

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url.includes('/api/draft') && method === 'GET') {
        return new Response(
          JSON.stringify({
            canvases: { access: initialCanvas },
            pages: initialPages,
            contentOverrides: {},
            updatedAt: currentUpdatedAt,
            dirty: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/draft') && method === 'PUT') {
        const parsed = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        putPayloads.push(parsed);
        currentUpdatedAt = `2026-11-19T00:00:0${putPayloads.length}.000Z`;
        return new Response(
          JSON.stringify({
            canvases: parsed.canvases ?? { access: initialCanvas },
            pages: parsed.pages ?? initialPages,
            contentOverrides: {},
            updatedAt: currentUpdatedAt,
            dirty: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({}), { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    let livePages: PageRegistry = initialPages;

    function TestHarness() {
      const [pages, setPages] = React.useState<PageRegistry>(initialPages);
      livePages = pages;

      React.useEffect(() => {
        const handler = (e: Event) => {
          const detail = (e as CustomEvent<{ pages?: PageRegistry }>).detail;
          if (detail?.pages) setPages(detail.pages);
        };
        window.addEventListener('engine-draft-pages-change', handler);
        return () => window.removeEventListener('engine-draft-pages-change', handler);
      }, []);

      const portalValue = React.useMemo(
        () => createMockPortalChrome(pages),
        [pages]
      );

      return (
        <PortalChromeContext.Provider value={portalValue}>
          <UndoRedoProvider>
            <CanvasControls />
          </UndoRedoProvider>
        </PortalChromeContext.Provider>
      );
    }

    function CanvasControls() {
      const { moveItem, isHydrating } = useDocumentCanvas('access');
      const { undo } = useUndoRedo();
      return (
        <div>
          <span data-testid="hydrating">{String(isHydrating)}</span>
          <button type="button" onClick={() => void moveItem('page-link-2', 'up', 'sec-1')}>
            Move Up
          </button>
          <button type="button" onClick={() => void undo()}>
            Undo
          </button>
        </div>
      );
    }

    render(<TestHarness />);

    await vi.waitFor(() => {
      expect(screen.getByTestId('hydrating').textContent).toBe('false');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Move Up'));
    });

    await vi.waitFor(() => {
      expect(putPayloads.length).toBe(1);
    });

    const reorderPut = putPayloads[0];
    expect(reorderPut.canvases).toBeDefined();
    expect(reorderPut.pages).toBeDefined();
    const syncedPages = reorderPut.pages as PageRegistry;
    expect(syncedPages['page-2'].order).toBe(0);
    expect(syncedPages['page-1'].order).toBe(1);

    const navTreeAfterReorder = buildTwoLevelNavTree(rootNodes, livePages);
    expect(navTreeAfterReorder[0].children?.map((c) => c.label)).toEqual(['Page 2', 'Page 1']);

    // Undo restores both canvas order and page order atomically
    await act(async () => {
      fireEvent.click(screen.getByText('Undo'));
    });

    await vi.waitFor(() => {
      expect(putPayloads.length).toBe(2);
    });

    const navTreeAfterUndo = buildTwoLevelNavTree(rootNodes, livePages);
    expect(navTreeAfterUndo[0].children?.map((c) => c.label)).toEqual(['Page 1', 'Page 2']);
  });

  it('enforces token and restraint purity in CanvasPageLink.module.css', () => {
    const cssPath = resolve(process.cwd(), 'src/components/canvas/CanvasPageLink.module.css');
    const css = readFileSync(cssPath, 'utf-8');

    // Zero hardcoded hex, rgb(), rgba(), hsl(), hsla()
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\s*\(/i);

    // Universal Zero Outline Policy
    expect(css).toMatch(/outline:\s*none\s*;/);

    // Zero horizontal divider rules
    expect(css).not.toMatch(/border-top\s*:/);
    expect(css).not.toMatch(/border-bottom\s*:/);
  });

  it('allows adding a Page directly from the empty-canvas starter bar without creating a Section first', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: true,
      isDesktop: true,
      isHydrated: true,
      lockToken: 'lock-123',
      enterDevMode: vi.fn(),
      exitDevMode: vi.fn(),
      toggleDevMode: vi.fn(),
    } as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>);

    const onAddElement = vi.fn();
    render(
      <CanvasAddBar
        onAddElement={onAddElement}
      />
    );

    const addElementBtn = screen.getByRole('button', { name: /Add Element/i });
    expect(addElementBtn).toBeTruthy();
    (addElementBtn as any).getBoundingClientRect = () => ({
      top: 100,
      bottom: 130,
      left: 0,
      right: 100,
      width: 100,
      height: 30,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    fireEvent.click(addElementBtn);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Structure' }));

    const addPageBtn = screen.getByRole('menuitem', { name: /Page/i });
    fireEvent.click(addPageBtn);
    expect(onAddElement).toHaveBeenCalledTimes(1);
    expect(onAddElement).toHaveBeenCalledWith('page-link');
  });

  it('renders coverImage when set and applies mediaRight class when mediaPosition="right"', () => {
    const pagesWithCover: PageRegistry = {
      'page-cover': {
        ...samplePages['page-research'],
        id: 'page-cover',
        coverImage: 'https://example.com/cover.jpg',
      },
    };
    const element: PageLinkElement = {
      id: 'page-link-cover',
      type: 'page-link',
      targetPageId: 'page-cover',
    };

    const { container } = render(
      <PortalChromeContext.Provider value={createMockPortalChrome(pagesWithCover)}>
        <CanvasPageLink
          element={element}
          nodeId="access"
          mediaPosition="right"
        />
      </PortalChromeContext.Provider>
    );

    const link = container.querySelectorAll('a')[0];
    expect(link).toBeTruthy();
    expect(link.className).toContain('mediaRight');

    const img = link.querySelectorAll('img')[0];
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/cover.jpg');
  });

  describe('card size variants', () => {
    const baseElement: PageLinkElement = {
      id: 'page-link-test-size',
      type: 'page-link',
      targetPageId: 'page-research',
    };
    const mockPage = samplePages['page-research'];

    it('renders .cardSm class when cardSize is sm', () => {
      render(
        <CanvasPageLink
          element={{ ...baseElement, cardSize: 'sm' }}
          page={mockPage}
          isDevMode={false}
        />
      );
      expect(document.querySelector('[class*="cardSm"]')).toBeTruthy();
      expect(document.querySelector('[class*="cardLg"]')).toBeNull();
    });

    it('renders .cardLg class when cardSize is lg', () => {
      render(
        <CanvasPageLink
          element={{ ...baseElement, cardSize: 'lg' }}
          page={mockPage}
          isDevMode={false}
        />
      );
      expect(document.querySelector('[class*="cardLg"]')).toBeTruthy();
      expect(document.querySelector('[class*="cardSm"]')).toBeNull();
    });

    it('renders neither cardSm nor cardLg when cardSize is omitted (defaults to md)', () => {
      const { container } = render(
        <CanvasPageLink
          element={baseElement}
          page={mockPage}
          isDevMode={false}
        />
      );
      expect(container.querySelector('[class*="cardSm"]')).toBeNull();
      expect(container.querySelector('[class*="cardLg"]')).toBeNull();
    });

    it('lg variant makes the card clickable as a link without Explore CTA button and navigates on click', () => {
      const onNavigate = vi.fn();
      render(
        <CanvasPageLink
          element={{ ...baseElement, cardSize: 'lg' }}
          page={mockPage}
          onNavigate={onNavigate}
          isDevMode={false}
        />
      );

      // Explore CTA button is removed
      expect(screen.queryByText(/Explore/i)).toBeNull();

      // Card is clickable anchor element
      const cardLink = document.querySelector('a[class*="cardLg"]');
      expect(cardLink).toBeTruthy();
      expect(cardLink?.getAttribute('href')).toBe('/node/access/research/');

      // Clicking card calls onNavigate
      fireEvent.click(cardLink!);
      expect(onNavigate).toHaveBeenCalledWith('page-research');
    });

    it('lg variant renders edit button in dev mode alongside the card', () => {
      const onEdit = vi.fn();
      render(
        <CanvasPageLink
          element={{ ...baseElement, cardSize: 'lg' }}
          page={mockPage}
          onEdit={onEdit}
          isDevMode={true}
        />
      );

      const editBtn = screen.getByRole('button', { name: /Edit/i });
      expect(editBtn).toBeInTheDocument();
      expect(editBtn.getAttribute('data-canvas-edit-trigger')).toBe('page-link-test-size');

      fireEvent.click(editBtn);
      expect(onEdit).toHaveBeenCalled();
    });

    it('sm variant renders edit button in dev mode alongside the card', () => {
      const onEdit = vi.fn();
      render(
        <CanvasPageLink
          element={{ ...baseElement, cardSize: 'sm' }}
          page={mockPage}
          onEdit={onEdit}
          isDevMode={true}
        />
      );

      const editBtn = screen.getByRole('button', { name: /Edit/i });
      expect(editBtn).toBeInTheDocument();
      expect(editBtn.getAttribute('data-canvas-edit-trigger')).toBe('page-link-test-size');

      fireEvent.click(editBtn);
      expect(onEdit).toHaveBeenCalled();
    });

    it('sm variant renders Read cue', () => {
      render(
        <CanvasPageLink
          element={{ ...baseElement, cardSize: 'sm' }}
          page={mockPage}
          isDevMode={false}
        />
      );
      expect(screen.getByText(/Read/i)).toBeInTheDocument();
    });
  });

  describe('photo randomizer starting point', () => {
    it('immediately renders a photo on empty pages without flashing identical ParametricShape placeholders', () => {
      const emptyPage1: PageNode = {
        id: 'page-empty-1',
        parentId: 'access',
        slug: 'page-1',
        title: 'Empty Page 1',
        order: 0,
        createdAt: '2026-11-24T00:00:00.000Z',
        updatedAt: '2026-11-24T00:00:00.000Z',
      };
      const emptyPage2: PageNode = {
        id: 'page-empty-2',
        parentId: 'access',
        slug: 'page-2',
        title: 'Empty Page 2',
        order: 1,
        createdAt: '2026-11-24T00:00:00.000Z',
        updatedAt: '2026-11-24T00:00:00.000Z',
      };

      const testPages: PageRegistry = {
        'page-empty-1': emptyPage1,
        'page-empty-2': emptyPage2,
      };

      const { container } = render(
        <PortalChromeContext.Provider value={createMockPortalChrome(testPages)}>
          <div>
            <CanvasPageLink
              element={{ id: 'link-1', type: 'page-link', targetPageId: 'page-empty-1', cardSize: 'sm' }}
              page={emptyPage1}
            />
            <CanvasPageLink
              element={{ id: 'link-2', type: 'page-link', targetPageId: 'page-empty-2', cardSize: 'sm' }}
              page={emptyPage2}
            />
          </div>
        </PortalChromeContext.Provider>
      );

      const imgs = container.querySelectorAll('img[data-shuffle-photo="true"]');
      expect(imgs.length).toBe(2);
      expect(imgs[0].getAttribute('src')).toBeTruthy();
      expect(imgs[1].getAttribute('src')).toBeTruthy();
    });
  });
});
