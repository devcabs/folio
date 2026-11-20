import { describe, it, expect } from 'vitest';
import type { NodeItem } from '../../src/types/node';
import type { NodeCanvasDocument } from '../../src/types/canvas';
import type { PageRegistry } from '../../src/types/page';
import { PAGE_ID_REGEX } from '../../src/types/page';
import {
  RESERVED_SLUGS,
  MAX_PAGE_SUMMARY_WORDS,
  generatePageId,
  sanitizeSlug,
  validateSlug,
  ensureUniqueSiblingSlug,
  countSummaryWords,
  createPageNode,
  updatePageNodeMetadata,
  getDescendantPageIds,
  countDescendantPages,
  cascadeDeleteSubtree,
  reparentPageNode,
  extractPageLinkOrderFromCanvas,
  deriveSubpageOrderFromCanvas,
  getDirectChildren,
  buildPagePath,
  resolvePathToPage,
  getAncestorChain,
  buildTwoLevelNavTree,
  levenshteinDistance,
  findSimilarPages,
} from '../../src/services/pageTreeService';

const ROOT_NODES: NodeItem[] = [
  {
    id: 'access',
    index: 1,
    title: 'Access & Reach',
    accentColor: '#2563eb',
  },
  {
    id: 'equity',
    index: 2,
    title: 'Equity & Finance',
    accentColor: '#16a34a',
  },
];

function buildSampleTree(): PageRegistry {
  let pages: PageRegistry = {};
  const created1 = createPageNode(pages, {
    id: 'page-research',
    parentId: 'access',
    title: 'Research',
    slug: 'research',
    order: 0,
    nowIso: '2026-01-01T00:00:00.000Z',
  });
  pages = created1.pages;

  const created2 = createPageNode(pages, {
    id: 'page-overview',
    parentId: 'access',
    title: 'Overview',
    slug: 'overview',
    order: 1,
    nowIso: '2026-01-02T00:00:00.000Z',
  });
  pages = created2.pages;

  const created3 = createPageNode(pages, {
    id: 'page-interview-notes',
    parentId: 'page-research',
    title: 'Interview Notes',
    slug: 'interview-notes',
    order: 0,
    nowIso: '2026-01-03T00:00:00.000Z',
  });
  pages = created3.pages;

  const created4 = createPageNode(pages, {
    id: 'page-2026-notes',
    parentId: 'page-interview-notes',
    title: '2026 Notes',
    slug: '2026-notes',
    order: 0,
    nowIso: '2026-01-04T00:00:00.000Z',
  });
  pages = created4.pages;

  const created5 = createPageNode(pages, {
    id: 'page-finance',
    parentId: 'equity',
    title: 'Finance',
    slug: 'finance',
    order: 0,
    nowIso: '2026-01-05T00:00:00.000Z',
  });
  pages = created5.pages;

  const created6 = createPageNode(pages, {
    id: 'page-2026-budget',
    parentId: 'page-finance',
    title: '2026 Budget',
    slug: '2026-budget',
    order: 0,
    nowIso: '2026-01-06T00:00:00.000Z',
  });
  pages = created6.pages;

  return pages;
}

describe('pageTreeService', () => {
  describe('ID generation, slug sanitization, and word counting', () => {
    it('generates page IDs matching PAGE_ID_REGEX', () => {
      for (let i = 0; i < 20; i++) {
        const id = generatePageId();
        expect(id.startsWith('page-')).toBe(true);
        expect(PAGE_ID_REGEX.test(id)).toBe(true);
      }
    });

    it('sanitizes spaces, uppercase, accents, repeated hyphens, and edge symbols', () => {
      expect(sanitizeSlug('Café & Notes!')).toBe('cafe-notes');
      expect(sanitizeSlug('  ---Hello   World---  ')).toBe('hello-world');
      expect(sanitizeSlug('UPPER_CASE/Slug 2026')).toBe('upper-case-slug-2026');
      expect(sanitizeSlug('!!!@@@###')).toBe('');
      expect(sanitizeSlug('')).toBe('');
    });

    it('caps sanitized slugs at 64 characters without trailing hyphens', () => {
      const longInput = 'a-'.repeat(40) + 'end';
      const sanitized = sanitizeSlug(longInput);
      expect(sanitized.length).toBeLessThanOrEqual(64);
      expect(sanitized.endsWith('-')).toBe(false);
    });

    it('rejects empty and reserved slugs in validateSlug', () => {
      const pages: PageRegistry = {};
      expect(validateSlug('   ', 'access', pages)).toEqual({
        valid: false,
        sanitized: '',
        error: 'URL name is required.',
      });

      for (const reserved of [
        'api',
        'node',
        'page',
        'index',
        'index.html',
        'assets',
        'static',
        'favicon.ico',
        'robots.txt',
      ]) {
        expect(RESERVED_SLUGS.has(reserved)).toBe(true);
        const res = validateSlug(reserved, 'access', pages);
        expect(res.valid).toBe(false);
        expect(res.error).toBe('This URL name is reserved.');
      }
    });

    it('enforces sibling-only uniqueness while allowing identical slugs under different parents', () => {
      const pages = buildSampleTree();

      const collision = validateSlug('overview', 'access', pages);
      expect(collision.valid).toBe(false);
      expect(collision.error).toContain('overview');
      expect(collision.suggestedSlug).toBe('overview-2');

      // Excluding self during edit should pass
      const selfEdit = validateSlug('overview', 'access', pages, 'page-overview');
      expect(selfEdit.valid).toBe(true);
      expect(selfEdit.sanitized).toBe('overview');

      // Different parent should pass
      const crossParent = validateSlug('overview', 'equity', pages);
      expect(crossParent.valid).toBe(true);
      expect(crossParent.sanitized).toBe('overview');
    });

    it('auto-disambiguates colliding sibling slugs via ensureUniqueSiblingSlug', () => {
      let pages: PageRegistry = {};
      pages = createPageNode(pages, {
        id: 'p1',
        parentId: 'access',
        title: 'Overview',
      }).pages;
      const second = createPageNode(pages, {
        id: 'p2',
        parentId: 'access',
        title: 'Overview',
      });
      expect(second.page.slug).toBe('overview-2');
      pages = second.pages;

      const third = createPageNode(pages, {
        id: 'p3',
        parentId: 'access',
        title: 'Overview',
      });
      expect(third.page.slug).toBe('overview-3');

      // Cross-parent remains 'overview'
      const cross = createPageNode(pages, {
        id: 'p4',
        parentId: 'equity',
        title: 'Overview',
      });
      expect(cross.page.slug).toBe('overview');

      // Empty/reserved fallback
      expect(ensureUniqueSiblingSlug('api', 'access', pages)).toBe('page');
      expect(ensureUniqueSiblingSlug('index.html', 'access', pages)).toBe('page');
      expect(ensureUniqueSiblingSlug('robots.txt', 'access', pages)).toBe('page');
      expect(ensureUniqueSiblingSlug('!!!', 'access', pages)).toBe('page');
    });

    it('counts summary words accurately against MAX_PAGE_SUMMARY_WORDS', () => {
      expect(MAX_PAGE_SUMMARY_WORDS).toBe(15);
      expect(countSummaryWords(undefined)).toBe(0);
      expect(countSummaryWords('   ')).toBe(0);
      expect(countSummaryWords('One two three')).toBe(3);
      expect(
        countSummaryWords('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen')
      ).toBe(15);
    });
  });

  describe('Immutable tree CRUD, cycle-safe reparenting, and cascade deletion', () => {
    it('never mutates caller-supplied PageRegistry during CRUD operations', () => {
      const original = buildSampleTree();
      const snapshot = structuredClone(original);

      const created = createPageNode(original, {
        id: 'page-new',
        parentId: 'access',
        title: 'New Page',
      });
      expect(original).toEqual(snapshot);
      expect(created.pages['page-new']).toBeDefined();

      const updated = updatePageNodeMetadata(created.pages, 'page-new', {
        title: 'Renamed Page',
        slug: 'renamed-page',
      });
      expect(created.pages['page-new'].title).toBe('New Page');
      expect(updated.page.title).toBe('Renamed Page');
      expect(updated.page.slug).toBe('renamed-page');

      const deleted = cascadeDeleteSubtree(updated.pages, 'page-research');
      expect(updated.pages['page-research']).toBeDefined();
      expect(deleted.pages['page-research']).toBeUndefined();
    });

    it('throws descriptive errors on missing page or invalid slug update', () => {
      const pages = buildSampleTree();
      expect(() =>
        updatePageNodeMetadata(pages, 'non-existent', { title: 'Nope' })
      ).toThrow();

      expect(() =>
        updatePageNodeMetadata(pages, 'page-research', { slug: 'overview' })
      ).toThrow();

      expect(() =>
        updatePageNodeMetadata(pages, 'page-research', { slug: 'api' })
      ).toThrow();
    });

    it('rejects self-reparent and ancestor-into-descendant reparenting', () => {
      const pages = buildSampleTree();
      expect(() => reparentPageNode(pages, 'page-research', 'page-research')).toThrow(
        'Cannot move a page into itself or one of its subpages.'
      );
      expect(() => reparentPageNode(pages, 'page-research', 'page-interview-notes')).toThrow(
        'Cannot move a page into itself or one of its subpages.'
      );
      expect(() => reparentPageNode(pages, 'page-research', 'page-2026-notes')).toThrow(
        'Cannot move a page into itself or one of its subpages.'
      );
    });

    it('reparents validly across chapters and auto-disambiguates colliding slug', () => {
      let pages = buildSampleTree();
      pages = createPageNode(pages, {
        id: 'page-eq-overview',
        parentId: 'equity',
        title: 'Overview',
        slug: 'overview',
      }).pages;

      const moved = reparentPageNode(pages, 'page-overview', 'equity');
      expect(moved.page.parentId).toBe('equity');
      expect(moved.page.slug).toBe('overview-2');
    });

    it('counts descendants accurately and cascade-deletes subtrees without touching siblings', () => {
      const pages = buildSampleTree();
      // Leaf has 0 descendants
      expect(countDescendantPages(pages, 'page-2026-notes')).toBe(0);

      // Add a second child under page-research so it has 2 children + 1 grandchild = 3 descendants
      const withExtra = createPageNode(pages, {
        id: 'page-surveys',
        parentId: 'page-research',
        title: 'Surveys',
      }).pages;
      expect(countDescendantPages(withExtra, 'page-research')).toBe(3);

      const { pages: afterDelete, deletedIds } = cascadeDeleteSubtree(withExtra, 'page-research');
      expect(new Set(deletedIds)).toEqual(
        new Set(['page-research', 'page-interview-notes', 'page-2026-notes', 'page-surveys'])
      );
      expect(afterDelete['page-overview']).toBeDefined();
      expect(afterDelete['page-finance']).toBeDefined();

      // Deleting absent ID is a no-op
      const noop = cascadeDeleteSubtree(withExtra, 'does-not-exist');
      expect(noop.deletedIds).toEqual([]);
      expect(noop.pages).toBe(withExtra);
    });

    it('guards against corrupted cycles in getDescendantPageIds, buildPagePath, and getAncestorChain', () => {
      const corrupted: PageRegistry = {
        a: {
          id: 'a',
          parentId: 'b',
          slug: 'a',
          title: 'A',
          order: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        b: {
          id: 'b',
          parentId: 'a',
          slug: 'b',
          title: 'B',
          order: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      };
      expect(getDescendantPageIds(corrupted, 'a')).toEqual(['b']);
      expect(buildPagePath('a', ROOT_NODES, corrupted)).toBe('/node/');
      const chain = getAncestorChain('a', ROOT_NODES, corrupted);
      expect(chain.rootNode).toBeNull();
    });
  });

  describe('Canvas-driven order synchronization', () => {
    it('extracts deduplicated PageLinkElement order across sections and subsections and syncs PageNode.order', () => {
      let pages: PageRegistry = {};
      pages = createPageNode(pages, { id: 'p-a', parentId: 'access', title: 'Alpha', order: 0 }).pages;
      pages = createPageNode(pages, { id: 'p-b', parentId: 'access', title: 'Beta', order: 1 }).pages;
      pages = createPageNode(pages, { id: 'p-c', parentId: 'access', title: 'Gamma', order: 2 }).pages;

      const canvas: NodeCanvasDocument = {
        nodeId: 'access',
        version: 3,
        updatedAt: '2026-01-01T00:00:00.000Z',
        elements: [
          {
            id: 'sec-1',
            type: 'section',
            title: 'One',
          },
          { id: 'pl-1', type: 'page-link', targetPageId: 'p-c' },
          {
            id: 'sub-1',
            type: 'subsection',
            title: 'Sub',
          },
          { id: 'pl-2', type: 'page-link', targetPageId: 'p-a' },
          { id: 'pl-dup', type: 'page-link', targetPageId: 'p-c' },
        ],
      };

      expect(extractPageLinkOrderFromCanvas(canvas)).toEqual(['p-c', 'p-a']);

      const synced = deriveSubpageOrderFromCanvas(
        pages,
        'access',
        canvas,
        '2026-02-01T00:00:00.000Z'
      );
      expect(synced.changed).toBe(true);
      expect(getDirectChildren(synced.pages, 'access').map((p) => p.id)).toEqual([
        'p-c',
        'p-a',
        'p-b',
      ]);
      expect(synced.pages['p-c'].order).toBe(0);
      expect(synced.pages['p-a'].order).toBe(1);
      expect(synced.pages['p-b'].order).toBe(2);

      // Re-running with same canvas returns changed: false
      const secondSync = deriveSubpageOrderFromCanvas(synced.pages, 'access', canvas);
      expect(secondSync.changed).toBe(false);
    });
  });

  describe('Folder path resolution, ancestor chains, and 2-level nav builder', () => {
    it('builds paths and resolves 4-level nested paths', () => {
      const pages = buildSampleTree();
      expect(buildPagePath('access', ROOT_NODES, pages)).toBe('/node/access/');
      expect(buildPagePath('page-2026-notes', ROOT_NODES, pages)).toBe(
        '/node/access/research/interview-notes/2026-notes/'
      );
      expect(buildPagePath('page-2026-notes', ROOT_NODES, pages, '/portal')).toBe(
        '/portal/node/access/research/interview-notes/2026-notes/'
      );

      const resolved = resolvePathToPage(
        ['access', 'research', 'interview-notes', '2026-notes'],
        ROOT_NODES,
        pages
      );
      expect(resolved.matched).toBe(true);
      if (resolved.matched) {
        expect(resolved.pageId).toBe('page-2026-notes');
        expect(resolved.rootNode.id).toBe('access');
        expect(resolved.pageNode?.id).toBe('page-2026-notes');
        expect(resolved.ancestors.map((a) => a.id)).toEqual([
          'access',
          'page-research',
          'page-interview-notes',
          'page-2026-notes',
        ]);
      }
    });

    it('returns rootNode, full ancestors, and immediate parent from getAncestorChain', () => {
      const pages = buildSampleTree();
      const chain = getAncestorChain('page-2026-notes', ROOT_NODES, pages);
      expect(chain.rootNode?.accentColor).toBe('#2563eb');
      expect(chain.parent?.id).toBe('page-interview-notes');
      expect(chain.ancestors.map((a) => a.title)).toEqual([
        'Access & Reach',
        'Research',
        'Interview Notes',
        '2026 Notes',
      ]);

      const rootChain = getAncestorChain('access', ROOT_NODES, pages);
      expect(rootChain.rootNode?.id).toBe('access');
      expect(rootChain.parent).toBeNull();
      expect(rootChain.ancestors).toHaveLength(1);
    });

    it('builds strictly 2-level nav tree and activates root chapter for Level 3+ descendant', () => {
      const pages = buildSampleTree();
      const nav = buildTwoLevelNavTree(ROOT_NODES, pages, 'page-2026-notes');

      expect(nav).toHaveLength(2);
      expect(nav[0].level).toBe('chapter');
      expect(nav[0].isActive).toBe(true);
      expect(nav[0].children?.map((c) => c.pageId)).toEqual(['page-research', 'page-overview']);
      expect(nav[0].children?.every((c) => c.level === 'subpage' && !c.children)).toBe(true);
      expect(nav[1].isActive).toBe(false);
    });
  });

  describe('Smart 404 fuzzy matcher and nearest valid ancestor', () => {
    it('computes Levenshtein distance accurately', () => {
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinDistance('abc', '')).toBe(3);
      expect(levenshteinDistance('interview-notes', 'interview-notess')).toBe(1);
    });

    it('returns nearestValidAncestor on partial path mismatch and ranks typo match #1', () => {
      const pages = buildSampleTree();
      const resolved = resolvePathToPage(
        ['access', 'research', 'interview-notess'],
        ROOT_NODES,
        pages
      );
      expect(resolved.matched).toBe(false);
      if (!resolved.matched) {
        expect(resolved.nearestValidAncestor?.id).toBe('page-research');
      }

      const matches = findSimilarPages(
        ['access', 'research', 'interview-notess'],
        ROOT_NODES,
        pages
      );
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].id).toBe('page-interview-notes');
      expect(matches[0].breadcrumbLabel).toBe('Access & Reach / Research / Interview Notes');
    });

    it('ranks moved page in top 3 when chapter changed', () => {
      const pages = buildSampleTree();
      const matches = findSimilarPages(['access', '2026-budget'], ROOT_NODES, pages);
      const top3Ids = matches.slice(0, 3).map((m) => m.id);
      expect(top3Ids).toContain('page-2026-budget');
    });

    it('returns empty array for completely gibberish paths', () => {
      const pages = buildSampleTree();
      const matches = findSimilarPages(['zzzzzz', 'qqqqqq', 'xxxxxx'], ROOT_NODES, pages);
      expect(matches).toEqual([]);
    });

    it('respects limit, basePath, titleResolver, and excludes unreachable orphan pages', () => {
      const pages = buildSampleTree();
      const withOrphan: PageRegistry = {
        ...pages,
        'page-orphan': {
          id: 'page-orphan',
          parentId: 'missing-chapter',
          slug: 'interview-notes',
          title: 'Orphan Interview Notes',
          order: 0,
          createdAt: '2026-01-07T00:00:00.000Z',
          updatedAt: '2026-01-07T00:00:00.000Z',
        },
      };

      const matches = findSimilarPages(
        ['access', 'research', 'interview-notess'],
        ROOT_NODES,
        withOrphan,
        {
          limit: 2,
          basePath: '/portal',
          titleResolver: (node) => `Chapter: ${node.title}`,
        }
      );

      expect(matches.length).toBeLessThanOrEqual(2);
      expect(matches.some((m) => m.id === 'page-orphan')).toBe(false);
      expect(matches[0].id).toBe('page-interview-notes');
      expect(matches[0].path).toBe('/portal/node/access/research/interview-notes/');
      expect(matches[0].breadcrumbLabel).toBe(
        'Chapter: Access & Reach / Research / Interview Notes'
      );
    });
  });
});
