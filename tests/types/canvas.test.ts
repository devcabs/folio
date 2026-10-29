import { describe, it, expect } from 'vitest';
import {
  DocumentCanvasSchema,
  CanvasBlockSchema,
  isTextBlock,
  isPhotoBlock,
  isGalleryBlock,
  isChartBlock,
  isSourceBlock,
  type DocumentCanvas,
  type CanvasBlock,
} from '../../src/types/canvas';

describe('Document Canvas AST Contracts', () => {
  it('validates a complete recursive document canvas AST', () => {
    const document: DocumentCanvas = {
      documentId: 'doc-alpha',
      version: 1,
      updatedAt: '2026-10-29T00:00:00.000Z',
      sections: [
        {
          id: 'sec-1',
          number: '01',
          isNumbered: true,
          title: 'Introduction & Context',
          summary: 'High-level contextual summary.',
          subsections: [
            {
              id: 'subsec-1-1',
              title: 'Current Baseline',
              blocks: [
                {
                  id: 'block-1',
                  type: 'text',
                  content: 'Comprehensive analysis of foundational metrics.',
                  as: 'lead',
                },
                {
                  id: 'block-2',
                  type: 'photo',
                  url: 'https://images.example.com/field-work.jpg',
                  alt: 'Field work verification team',
                  caption: 'Baseline verification team on site.',
                  aspectRatio: '16:9',
                },
                {
                  id: 'block-3',
                  type: 'chart',
                  chartId: 'chart-enrollment-trend',
                  title: 'Longitudinal Trend',
                },
                {
                  id: 'block-4',
                  type: 'source',
                  sourceId: 'src-dataset-2026',
                  title: 'Annual Survey Dataset',
                  fileType: 'csv',
                },
              ],
            },
          ],
        },
      ],
    };

    const parsed = DocumentCanvasSchema.safeParse(document);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.documentId).toBe('doc-alpha');
      expect(parsed.data.sections).toHaveLength(1);
      expect(parsed.data.sections[0].subsections[0].blocks).toHaveLength(4);
    }
  });

  it('correctly discriminates block types using type guards', () => {
    const textBlock: CanvasBlock = {
      id: 'tb-1',
      type: 'text',
      content: 'Hello world',
    };
    const photoBlock: CanvasBlock = {
      id: 'pb-1',
      type: 'photo',
      url: 'https://example.com/p.jpg',
      alt: 'Test photo',
    };
    const galleryBlock: CanvasBlock = {
      id: 'gb-1',
      type: 'gallery',
      photos: [{ id: 'p1', url: 'https://example.com/1.jpg' }],
    };
    const chartBlock: CanvasBlock = {
      id: 'cb-1',
      type: 'chart',
      chartId: 'c-1',
    };
    const sourceBlock: CanvasBlock = {
      id: 'sb-1',
      type: 'source',
      sourceId: 's-1',
      title: 'Documentation',
    };

    expect(isTextBlock(textBlock)).toBe(true);
    expect(isPhotoBlock(photoBlock)).toBe(true);
    expect(isGalleryBlock(galleryBlock)).toBe(true);
    expect(isChartBlock(chartBlock)).toBe(true);
    expect(isSourceBlock(sourceBlock)).toBe(true);

    expect(isTextBlock(photoBlock)).toBe(false);
    expect(isPhotoBlock(textBlock)).toBe(false);
  });

  it('rejects malformed blocks missing discriminator or required keys', () => {
    const invalidBlock = {
      id: 'b-bad',
      type: 'text',
      // missing content
    };

    const parsed = CanvasBlockSchema.safeParse(invalidBlock);
    expect(parsed.success).toBe(false);
  });
});
