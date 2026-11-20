import { describe, expect, it } from 'vitest';
import {
  PAGE_ID_REGEX,
  PAGE_SLUG_REGEX,
  PageNodeSchema,
  PageRegistrySchema,
  type PageNode,
} from '../../src/types/page';
import {
  CanvasLeafElementSchema,
  NodeCanvasDocumentSchema,
  PublicPortalManifestPayloadSchema,
} from '../../src/types/edge';
import {
  isLeafElement,
  isPageLinkElement,
  type PageLinkElement,
  type TextElement,
} from '../../src/types/canvas';
import { createDefaultPageLink } from '../../src/utils/canvasDefaults';

describe('Epic 13.1 — Page Tree, Canvas AST & Edge KV Contracts', () => {
  const validPageNode: PageNode = {
    id: 'page-m5k2x-ab12c',
    parentId: 'access',
    slug: 'regional-hubs',
    title: 'Regional Hubs',
    subtitle: 'Subpage overview',
    summary: 'Coverage and capacity metrics across regional hubs.',
    order: 0,
    createdAt: '2026-11-19T00:00:00.000Z',
    updatedAt: '2026-11-19T00:00:00.000Z',
  };

  describe('PageNodeSchema & PageRegistrySchema', () => {
    it('accepts valid PageNode with string parentId or null parentId and optional fields', () => {
      expect(PAGE_ID_REGEX.test(validPageNode.id)).toBe(true);
      expect(PAGE_SLUG_REGEX.test(validPageNode.slug)).toBe(true);
      expect(PageNodeSchema.safeParse(validPageNode).success).toBe(true);

      const rootCompatNode: PageNode = {
        id: 'page_1',
        parentId: null,
        slug: 'a',
        title: 'Root Compatible Page',
        order: 2,
        createdAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:00:00.000Z',
      };
      expect(PageNodeSchema.safeParse(rootCompatNode).success).toBe(true);
      expect(
        PageRegistrySchema.safeParse({
          [validPageNode.id]: validPageNode,
          [rootCompatNode.id]: rootCompatNode,
        }).success,
      ).toBe(true);
    });

    it('rejects invalid page IDs (uppercase, spaces, traversal, >64 chars)', () => {
      const invalidIds = [
        '',
        'Page-Upper',
        'page with spaces',
        '../etc/passwd',
        'a'.repeat(65),
      ];
      for (const id of invalidIds) {
        const result = PageNodeSchema.safeParse({ ...validPageNode, id });
        expect(result.success).toBe(false);
      }
    });

    it('rejects invalid slugs, empty title, and negative or non-integer order', () => {
      const invalidSlugs = [
        '',
        'My Page',
        'foo/bar',
        '-leading',
        'trailing-',
        'double--hyphen',
        'a'.repeat(65),
      ];
      for (const slug of invalidSlugs) {
        expect(PageNodeSchema.safeParse({ ...validPageNode, slug }).success).toBe(false);
      }

      expect(PageNodeSchema.safeParse({ ...validPageNode, title: '' }).success).toBe(false);
      expect(PageNodeSchema.safeParse({ ...validPageNode, order: -1 }).success).toBe(false);
      expect(PageNodeSchema.safeParse({ ...validPageNode, order: 1.5 }).success).toBe(false);
    });
  });

  describe('PublicPortalManifestPayloadSchema backward compatibility', () => {
    const baseManifest = {
      activeSnapshotId: 'snap-1',
      publishedAt: '2026-11-19T00:00:00.000Z',
      nodeIds: ['access', 'equity'],
      schemaVersion: 2,
    };

    it('accepts manifests without pages (pre-Epic 13 KV records)', () => {
      expect(PublicPortalManifestPayloadSchema.safeParse(baseManifest).success).toBe(true);
    });

    it('accepts manifests with valid pages registry and rejects malformed pages entries', () => {
      const withValidPages = {
        ...baseManifest,
        pages: {
          [validPageNode.id]: validPageNode,
        },
      };
      expect(PublicPortalManifestPayloadSchema.safeParse(withValidPages).success).toBe(true);

      const withInvalidPages = {
        ...baseManifest,
        pages: {
          bad: { ...validPageNode, slug: 'Invalid Slug' },
        },
      };
      expect(PublicPortalManifestPayloadSchema.safeParse(withInvalidPages).success).toBe(false);
    });
  });

  describe('PageLinkElementSchema & Canvas AST integration', () => {
    it('accepts valid page-link in CanvasLeafElementSchema and NodeCanvasDocumentSchema', () => {
      const pageLink = {
        id: 'page-link-1',
        type: 'page-link' as const,
        targetPageId: 'page-abc-123',
      };
      expect(CanvasLeafElementSchema.safeParse(pageLink).success).toBe(true);

      const doc = {
        nodeId: 'access',
        version: 3,
        updatedAt: '2026-11-19T00:00:00.000Z',
        elements: [
          {
            id: 'section-1',
            type: 'section' as const,
            title: 'Subpages',
          },
          pageLink,
        ],
      };
      expect(NodeCanvasDocumentSchema.safeParse(doc).success).toBe(true);
    });

    it('rejects page-link missing targetPageId or with empty targetPageId', () => {
      expect(
        CanvasLeafElementSchema.safeParse({
          id: 'page-link-1',
          type: 'page-link',
        }).success,
      ).toBe(false);

      expect(
        CanvasLeafElementSchema.safeParse({
          id: 'page-link-1',
          type: 'page-link',
          targetPageId: '',
        }).success,
      ).toBe(false);
    });
  });

  describe('Type guards & default factory', () => {
    it('isPageLinkElement and isLeafElement identify PageLinkElement accurately', () => {
      const pageLink: PageLinkElement = {
        id: 'page-link-1',
        type: 'page-link',
        targetPageId: 'page-abc-123',
      };
      const textEl: TextElement = {
        id: 'text-1',
        type: 'text',
        pointId: 'node.access.text.text-1',
        content: 'Hello',
      };

      expect(isPageLinkElement(pageLink)).toBe(true);
      expect(isLeafElement(pageLink)).toBe(true);
      expect(isPageLinkElement(textEl)).toBe(false);
    });

    it('createDefaultPageLink returns a valid PageLinkElement', () => {
      const el = createDefaultPageLink('page-abc-123');
      expect(el.type).toBe('page-link');
      expect(el.id.startsWith('page-link-')).toBe(true);
      expect(el.targetPageId).toBe('page-abc-123');
      expect(CanvasLeafElementSchema.safeParse(el).success).toBe(true);
    });
  });
});
