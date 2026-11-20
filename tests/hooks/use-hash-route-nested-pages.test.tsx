import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { parseRoute, useHashRoute } from '../../src/hooks/use-hash-route';
import { setEngineConfig, resetEngineConfig } from '../../src/config/engine.config';
import type { NodeItem } from '../../src/types/node';
import type { PageRegistry } from '../../src/types/page';

const ROOT_NODES: NodeItem[] = [
  { id: 'access', title: 'Access', subtitle: 'Access chapter', nodeNumber: 1, index: 0, accentColor: 'var(--color-node-1)' },
  { id: 'build', title: 'Build', subtitle: 'Build chapter', nodeNumber: 2, index: 1, accentColor: 'var(--color-node-2)' },
];

const SAMPLE_PAGES: PageRegistry = {
  'page-research': {
    id: 'page-research',
    parentId: 'access',
    slug: 'research',
    title: 'Research',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  'page-interviews': {
    id: 'page-interviews',
    parentId: 'page-research',
    slug: 'interviews',
    title: 'Interviews',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  'page-2026': {
    id: 'page-2026',
    parentId: 'page-interviews',
    slug: '2026-notes',
    title: '2026 Notes',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  'page-draft-only': {
    id: 'page-draft-only',
    parentId: 'access',
    slug: 'draft-only',
    title: 'Draft Only',
    order: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

describe('Subtask 13.7: Multi-Segment Folder Routing & Dev-Mode Draft Refresh Guard', () => {
  beforeEach(() => {
    resetEngineConfig();
    setEngineConfig({ nodes: ROOT_NODES, basePath: '' });

    const locationState = { pathname: '/', hash: '' };
    const updateLocation = (url: string) => {
      const [pathPart, hashPart] = url.split('#');
      locationState.pathname = pathPart || '/';
      locationState.hash = hashPart ? `#${hashPart}` : '';
    };

    (window as any).location = locationState;
    (window as any).history = {
      pushState: (_state: unknown, _title: string, url?: string | URL | null) => {
        if (typeof url === 'string') updateLocation(url);
      },
      replaceState: (_state: unknown, _title: string, url?: string | URL | null) => {
        if (typeof url === 'string') updateLocation(url);
      },
    };
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetEngineConfig();
  });

  describe('1. Legacy & Single-Segment Backward Compatibility', () => {
    it('parses /node/access/, /page/access/, legacy #node/access, /#stage-2, /, and basePath: /portal identically', () => {
      const nodeRoute = parseRoute('/node/access/', '', ['access', 'build']);
      expect(nodeRoute.type).toBe('node');
      expect(nodeRoute.nodeId).toBe('access');
      expect(nodeRoute.pageId).toBe('access');
      expect(nodeRoute.activePageId).toBe('access');
      expect(nodeRoute.rootNodeId).toBe('access');
      expect(nodeRoute.pageNode).toBeNull();
      expect(nodeRoute.pathname).toBe('/node/access/');
      expect(nodeRoute.targetStage).toBe(1);

      const pageRoute = parseRoute('/page/access/', '', ['access', 'build']);
      expect(pageRoute.type).toBe('node');
      expect(pageRoute.nodeId).toBe('access');
      expect(pageRoute.pathname).toBe('/node/access/');

      const hashRoute = parseRoute('/', '#node/access', ['access', 'build']);
      expect(hashRoute.type).toBe('node');
      expect(hashRoute.nodeId).toBe('access');
      expect(hashRoute.pathname).toBe('/node/access/');

      const stageRoute = parseRoute('/', '#stage-2', ['access', 'build']);
      expect(stageRoute.type).toBe('home');
      expect(stageRoute.targetStage).toBe(2);

      const homeRoute = parseRoute('/', '', ['access', 'build']);
      expect(homeRoute.type).toBe('home');
      expect(homeRoute.nodeId).toBeNull();

      const portalRoute = parseRoute('/portal/node/access/', '', ['access', 'build'], '/portal');
      expect(portalRoute.type).toBe('node');
      expect(portalRoute.nodeId).toBe('access');
      expect(portalRoute.pathname).toBe('/node/access/');
    });

    it('handles malformed % URI sequences gracefully as not-found without throwing', () => {
      const malformed = parseRoute('/node/access/%E0%A4%A/', '', ['access'], undefined, {
        pages: SAMPLE_PAGES,
        rootNodes: ROOT_NODES,
      });
      expect(malformed.type).toBe('not-found');
      expect(malformed.nodeId).toBeNull();
    });
  });

  describe('2. Multi-Segment Folder Path Resolution', () => {
    it('resolves arbitrary-depth /node/access/research/interviews/2026-notes/ with full ancestor chain', () => {
      const route = parseRoute(
        '/node/access/research/interviews/2026-notes/',
        '',
        ['access', 'build'],
        '',
        { pages: SAMPLE_PAGES, rootNodes: ROOT_NODES }
      );

      expect(route.type).toBe('node');
      expect(route.nodeId).toBe('access');
      expect(route.rootNodeId).toBe('access');
      expect(route.pageId).toBe('page-2026');
      expect(route.activePageId).toBe('page-2026');
      expect(route.pageNode?.id).toBe('page-2026');
      expect(route.attemptedSegments).toEqual(['access', 'research', 'interviews', '2026-notes']);
      expect(route.ancestors).toHaveLength(4);
      expect(route.ancestors.map((a) => a.id)).toEqual([
        'access',
        'page-research',
        'page-interviews',
        'page-2026',
      ]);
      expect(route.pathname).toBe('/node/access/research/interviews/2026-notes/');
    });
  });

  describe('3. Optimistic Chapter-Prefix Hydration Fallback', () => {
    it('holds in hydrating when isHydrating is true and pages is empty, then resolves once hydrated', () => {
      const hydratingRoute = parseRoute(
        '/node/access/research/2026-notes/',
        '',
        ['access', 'build'],
        '',
        { pages: {}, rootNodes: ROOT_NODES, isHydrating: true }
      );

      expect(hydratingRoute.type).toBe('hydrating');
      expect(hydratingRoute.rootNodeId).toBe('access');
      expect(hydratingRoute.attemptedSegments).toEqual(['access', 'research', '2026-notes']);

      const settledRoute = parseRoute(
        '/node/access/research/interviews/2026-notes/',
        '',
        ['access', 'build'],
        '',
        { pages: SAMPLE_PAGES, rootNodes: ROOT_NODES, isHydrating: false }
      );
      expect(settledRoute.type).toBe('node');
      expect(settledRoute.activePageId).toBe('page-2026');
    });

    it('returns not-found immediately for invalid root chapter even when isHydrating is true', () => {
      const invalidRoot = parseRoute(
        '/node/nonexistent/foo/',
        '',
        ['access', 'build'],
        '',
        { pages: {}, rootNodes: ROOT_NODES, isHydrating: true }
      );

      expect(invalidRoot.type).toBe('not-found');
      expect(invalidRoot.rootNodeId).toBeNull();
    });
  });

  describe('4. Partial Invalid Path & Smart 404 Ancestor Context', () => {
    it('returns not-found with attemptedSegments and nearestValidAncestor for partial broken paths', () => {
      const broken = parseRoute(
        '/node/access/research/broken-slug/',
        '',
        ['access', 'build'],
        '',
        { pages: SAMPLE_PAGES, rootNodes: ROOT_NODES, isHydrating: false }
      );

      expect(broken.type).toBe('not-found');
      expect(broken.attemptedSegments).toEqual(['access', 'research', 'broken-slug']);
      expect(broken.nearestValidAncestor?.id).toBe('page-research');
      expect(broken.nearestValidAncestor?.path).toBe('/node/access/research/');
    });
  });

  describe('5. Canonical navigateToPage & Reactive Hook Hydration', () => {
    it('pushes canonical folder URL via window.history.pushState on navigateToPage', () => {
      const pushSpy = vi.spyOn(window.history, 'pushState');
      const { result } = renderHook(() =>
        useHashRoute(['access', 'build'], '', { pages: SAMPLE_PAGES, isHydrating: false })
      );

      act(() => {
        result.current.navigateToPage('page-2026');
      });

      expect(pushSpy).toHaveBeenCalledWith(
        null,
        '',
        '/node/access/research/interviews/2026-notes/'
      );
      expect(result.current.route).toBe('node');
      expect(result.current.activePageId).toBe('page-2026');
      expect(result.current.rootNodeId).toBe('access');
      expect(result.current.ancestors).toHaveLength(4);
    });

    it('transitions reactively from hydrating to node when pages hydrate without 404 flash', () => {
      window.history.replaceState(null, '', '/node/access/research/interviews/2026-notes/');

      const { result, rerender } = renderHook(
        (props?: { pages: PageRegistry; isHydrating: boolean }) =>
          useHashRoute(['access', 'build'], '', {
            pages: props?.pages,
            isHydrating: props?.isHydrating,
          }),
        { initialProps: { pages: {} as PageRegistry, isHydrating: true } }
      );

      expect(result.current.route).toBe('hydrating');

      rerender({ pages: SAMPLE_PAGES, isHydrating: false });

      expect(result.current.route).toBe('node');
      expect(result.current.activePageId).toBe('page-2026');
      expect(result.current.pageNode?.id).toBe('page-2026');
    });
  });

  describe('6. Dev Mode Draft Refresh / Exit Guard', () => {
    it('redirects cleanly to nearest published ancestor via replaceState and fires onDraftExitRedirect', () => {
      window.history.replaceState(null, '', '/node/access/draft-only/');
      const replaceSpy = vi.spyOn(window.history, 'replaceState');
      const onDraftExitRedirect = vi.fn();

      const publishedPages: PageRegistry = {
        'page-research': SAMPLE_PAGES['page-research'],
      };

      const { result, rerender } = renderHook(
        (props?: { isDevMode: boolean; pages: PageRegistry }) =>
          useHashRoute(['access', 'build'], '', {
            pages: props?.pages,
            isHydrating: false,
            isDevMode: props?.isDevMode,
            publishedPages,
            onDraftExitRedirect,
          }),
        { initialProps: { isDevMode: true, pages: SAMPLE_PAGES } }
      );

      expect(result.current.route).toBe('node');
      expect(result.current.activePageId).toBe('page-draft-only');

      rerender({ isDevMode: false, pages: publishedPages });

      expect(replaceSpy).toHaveBeenCalledWith(null, '', '/node/access/');
      expect(onDraftExitRedirect).toHaveBeenCalledWith('Access');
      expect(result.current.route).toBe('node');
      expect(result.current.activePageId).toBe('access');
    });
  });
});
