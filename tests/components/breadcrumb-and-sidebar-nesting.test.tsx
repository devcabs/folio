import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { Breadcrumb } from '../../src/components/ui/Breadcrumb';
import { EditorialSidebar } from '../../src/components/layout/EditorialSidebar';
import { App } from '../../src/App';
import type { NavItem } from '../../src/types/navigation';
import type { NodeItem } from '../../src/types/node';
import type { PageRegistry } from '../../src/types/page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (typeof window !== 'undefined') {
    delete (window as any).__FOLIO_MANIFEST__;
  }
});

describe('Subtask 13.10: Collapsed Breadcrumb, Contextual EditorialSidebar & Subpage Shell', () => {
  describe('Breadcrumb middle-segment collapsing', () => {
    it('renders all items with no ellipsis when items.length <= 4', () => {
      const { container, rerender } = render(
        <Breadcrumb
          items={[
            { label: 'Overview', onClick: vi.fn() },
            { label: 'Chapter 1', onClick: vi.fn() },
            { label: 'Research', isCurrent: true },
          ]}
        />
      );

      expect(screen.getByText('Overview')).toBeTruthy();
      expect(screen.getByText('Chapter 1')).toBeTruthy();
      expect(screen.getByText('Research')).toBeTruthy();
      expect(container.textContent).not.toContain('…');

      rerender(
        <Breadcrumb
          items={[
            { label: 'Overview', onClick: vi.fn() },
            { label: 'Chapter 1', onClick: vi.fn() },
            { label: 'Research', onClick: vi.fn() },
            { label: 'Interviews', isCurrent: true },
          ]}
        />
      );

      expect(screen.getByText('Overview')).toBeTruthy();
      expect(screen.getByText('Chapter 1')).toBeTruthy();
      expect(screen.getByText('Research')).toBeTruthy();
      expect(screen.getByText('Interviews')).toBeTruthy();
      expect(container.textContent).not.toContain('…');
    });

    it('collapses 5+ items to First / Second / … / Parent / Current with a purely visual non-interactive span ellipsis', () => {
      const onOverview = vi.fn();
      const onChapter = vi.fn();
      const onParent = vi.fn();

      const { container } = render(
        <Breadcrumb
          items={[
            { id: 'overview', label: 'Overview', onClick: onOverview },
            { id: 'chapter-1', label: 'Chapter 1', onClick: onChapter },
            { id: 'research', label: 'Research', onClick: vi.fn() },
            { id: 'archive', label: 'Archive', onClick: vi.fn() },
            { id: 'interviews', label: 'Interviews', onClick: onParent },
            { id: 'notes-2026', label: '2026 Notes', isCurrent: true },
          ]}
        />
      );

      // First 2 and last 2 remain visible
      expect(screen.getByText('Overview')).toBeTruthy();
      expect(screen.getByText('Chapter 1')).toBeTruthy();
      expect(screen.getByText('Interviews')).toBeTruthy();
      expect(screen.getByText('2026 Notes')).toBeTruthy();

      // Middle items collapsed
      expect(screen.queryByText('Research')).toBeNull();
      expect(screen.queryByText('Archive')).toBeNull();

      // Ellipsis is a non-interactive <span> with aria-hidden="true", NOT a button or link
      const spans = Array.from(container.querySelectorAll('span')) as HTMLElement[];
      const ellipsisEl = spans.find((el) => el.textContent === '…');
      expect(ellipsisEl).toBeTruthy();
      expect(ellipsisEl!.tagName).toBe('SPAN');
      expect(ellipsisEl!.getAttribute('aria-hidden')).toBe('true');
      const hasInteractiveAncestor = (el: HTMLElement | null, tags: string[]) => {
        let cur: any = el?.parentNode;
        while (cur) {
          if (cur.tagName && tags.includes(cur.tagName.toUpperCase())) return true;
          cur = cur.parentNode;
        }
        return false;
      };
      expect(hasInteractiveAncestor(ellipsisEl!, ['BUTTON', 'A'])).toBe(false);
      expect(ellipsisEl!.getAttribute('tabindex')).toBeNull();

      // Clicking ellipsis does nothing & opens no popover/menu
      fireEvent.click(ellipsisEl!);
      expect(container.querySelectorAll('[role="menu"]').length).toBe(0);
      expect(container.querySelectorAll('[role="dialog"]').length).toBe(0);

      // Ancestors remain clickable
      const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
      fireEvent.click(buttons.find((b) => b.textContent === 'Overview')!);
      expect(onOverview).toHaveBeenCalledTimes(1);
      fireEvent.click(buttons.find((b) => b.textContent === 'Chapter 1')!);
      expect(onChapter).toHaveBeenCalledTimes(1);
      fireEvent.click(buttons.find((b) => b.textContent === 'Interviews')!);
      expect(onParent).toHaveBeenCalledTimes(1);

      // Current has aria-current="page"
      const currentSpan = spans.find(
        (el) => el.getAttribute('aria-current') === 'page'
      );
      expect(currentSpan).toBeTruthy();
      expect(currentSpan?.textContent).toContain('2026 Notes');
    });
  });

  describe('Contextual EditorialSidebar back-link', () => {
    it('renders "< Roadmap" when backLabel is omitted and "< Research Methods" when provided, firing onBack', () => {
      const onBack = vi.fn();
      const { rerender } = render(
        <EditorialSidebar title="Contents" items={[]} onBack={onBack} />
      );

      const defaultBackBtn = screen.getByRole('button', { name: 'Return to Roadmap' });
      expect(defaultBackBtn.textContent).toContain('Roadmap');
      fireEvent.click(defaultBackBtn);
      expect(onBack).toHaveBeenCalledTimes(1);

      rerender(
        <EditorialSidebar
          title="Contents"
          items={[]}
          backLabel="Research Methods"
          onBack={onBack}
        />
      );

      const parentBackBtn = screen.getByRole('button', { name: 'Return to Research Methods' });
      expect(parentBackBtn.textContent).toContain('Research Methods');
      expect(parentBackBtn.getAttribute('title')).toBe('Return to Research Methods');
      fireEvent.click(parentBackBtn);
      expect(onBack).toHaveBeenCalledTimes(2);
    });

    it('renders only current-page sections/subsections (never subpage trees)', () => {
      const items: NavItem[] = [
        {
          id: 'sec-methods',
          label: 'Methodology',
          number: '01',
          href: '#sec-methods',
          children: [
            { id: 'sub-sampling', label: 'Sampling Frame', href: '#sub-sampling', level: 'subsection' },
          ],
        },
      ];

      const { container } = render(
        <EditorialSidebar title="Contents" items={items} backLabel="Research" onBack={vi.fn()} />
      );

      const links = Array.from(container.querySelectorAll('a')) as HTMLAnchorElement[];
      expect(links.map((l) => l.textContent?.trim())).toEqual([
        '01Methodology',
        'Sampling Frame',
      ]);
    });
  });

  describe('App subpage shell & hydrating state', () => {
    const testNodes: NodeItem[] = [
      {
        id: 'access',
        index: 0,
        nodeNumber: 1,
        title: 'Chapter 1',
        subtitle: 'Chapter 1 Subtitle',
        summary: 'Root chapter summary',
        accentColor: '#2563eb',
      },
    ];

    const testPages: PageRegistry = {
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
      'page-2026-notes': {
        id: 'page-2026-notes',
        parentId: 'page-interviews',
        slug: '2026-notes',
        title: '2026 Notes',
        summary: 'Deep subpage summary',
        order: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    };

    const testConfig = {
      appId: 'test-folio',
      appNamespace: 'test_folio',
      nodes: testNodes,
      branding: {
        appName: 'Test Folio',
        logoText: 'T',
      },
    };

    const stubBrowserLocation = (pathname: string) => {
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
          replaceState: vi.fn(),
          pushState: vi.fn(),
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
          addEventListener: () => {},
          removeEventListener: () => {},
        }));
    };

    it('renders deep subpage shell at /node/access/research/interviews/2026-notes/ with collapsed Breadcrumb, "< Interviews" back-link, inherited accentColor, and DocumentCanvas', async () => {
      stubBrowserLocation('/node/access/research/interviews/2026-notes/');
      (window as any).__FOLIO_MANIFEST__ = {
        activeSnapshotId: 'snap-test-1',
        nodeIds: ['access'],
        contentOverrides: {},
        pages: testPages,
        canvases: {
          'page-2026-notes': {
            nodeId: 'page-2026-notes',
            sections: [
              {
                id: 'sec-deep',
                type: 'section',
                title: 'Field Findings',
                isNumbered: true,
                elements: [],
              },
            ],
          },
        },
      };

      let rendered!: ReturnType<typeof render>;
      await act(async () => {
        rendered = render(<App config={testConfig} />);
      });
      const { container } = rendered;

      // Breadcrumb collapsed: Overview / Chapter 1 / … / Interviews / 2026 Notes
      const nav = (Array.from(container.querySelectorAll('nav')) as HTMLElement[]).find(
        (el) => el.getAttribute('aria-label') === 'Breadcrumb navigation'
      );
      expect(nav).toBeTruthy();
      expect(nav?.textContent).toContain('Overview');
      expect(nav?.textContent).toContain('Chapter 1');
      expect(nav?.textContent).toContain('…');
      expect(nav?.textContent).toContain('Interviews');
      expect(nav?.textContent).toContain('2026 Notes');
      expect(nav?.textContent).not.toContain('Research');

      // Contextual EditorialSidebar back-link: < Interviews
      const backBtn = screen.getByRole('button', { name: 'Return to Interviews' });
      expect(backBtn.textContent).toContain('Interviews');

      // Inherited root chapter accentColor on sidebar & PageTitle
      const sidebar = container.querySelectorAll('aside')[0] as HTMLElement | undefined;
      expect(sidebar).toBeTruthy();
      expect((sidebar as any)?.style?.['--sidebar-accent'] || sidebar?.getAttribute('style')).toContain('#2563eb');

      // Subpage PageTitle rendered with pageNode.title
      const heading = container.querySelectorAll('h1')[0] as HTMLElement | undefined;
      expect(heading?.textContent).toBe('2026 Notes');

      // DocumentCanvas rendered for page-2026-notes
      const nodeCanvas = (Array.from(container.querySelectorAll('div')) as HTMLElement[]).find(
        (el) => el.getAttribute('id') === 'node-canvas'
      );
      expect(nodeCanvas).toBeTruthy();
    });

    it('renders calm CanvasGhostWireframe (not PageNotFound) when route is hydrating on a deep subpage path', async () => {
      stubBrowserLocation('/node/access/research/interviews/2026-notes/');
      delete (window as any).__FOLIO_MANIFEST__;

      // Pending fetch simulates cold-boot hydration in progress
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

      let rendered!: ReturnType<typeof render>;
      await act(async () => {
        rendered = render(<App config={testConfig} />);
      });

      const { container } = rendered;
      const wireframe = (Array.from(container.querySelectorAll('div')) as HTMLElement[]).find(
        (el) => el.getAttribute('data-testid') === 'canvas-ghost-wireframe'
      );
      expect(wireframe).toBeTruthy();
      expect(container.textContent).not.toContain('404');
      expect(container.textContent).not.toContain('Page Not Found');
    });
  });
});
