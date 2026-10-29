import { z } from 'zod';

/**
 * Canvas Block Discriminated Types
 */
export type CanvasBlockType = 'text' | 'photo' | 'gallery' | 'chart' | 'source' | 'custom';

export const CanvasTextBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('text'),
  order: z.number().int().optional(),
  pointId: z.string().optional(),
  content: z.string(),
  as: z.enum(['lead', 'body', 'callout', 'quote', 'p', 'blockquote']).optional(),
});

export type CanvasTextBlock = z.infer<typeof CanvasTextBlockSchema>;

export const CanvasPhotoBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('photo'),
  order: z.number().int().optional(),
  pointId: z.string().optional(),
  url: z.string().min(1),
  src: z.string().optional(), // Backwards-compatible alias
  alt: z.string().default(''),
  caption: z.string().optional(),
  showCaption: z.boolean().optional(),
  aspectRatio: z.string().optional(),
  externalUrl: z.string().optional(),
});

export type CanvasPhotoBlock = z.infer<typeof CanvasPhotoBlockSchema>;

export const CanvasGalleryItemSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const CanvasGalleryBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('gallery'),
  order: z.number().int().optional(),
  pointId: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  photos: z.array(CanvasGalleryItemSchema).default([]),
  externalUrl: z.string().optional(),
});

export type CanvasGalleryBlock = z.infer<typeof CanvasGalleryBlockSchema>;

export const CanvasChartBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('chart'),
  order: z.number().int().optional(),
  chartId: z.string().min(1),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  datasetId: z.string().optional(),
});

export type CanvasChartBlock = z.infer<typeof CanvasChartBlockSchema>;

export const CanvasSourceBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('source'),
  order: z.number().int().optional(),
  sourceId: z.string().min(1),
  title: z.string().min(1),
  fileType: z.string().optional(),
  downloadUrl: z.string().optional(),
});

export type CanvasSourceBlock = z.infer<typeof CanvasSourceBlockSchema>;

export const CanvasBlockSchema = z.discriminatedUnion('type', [
  CanvasTextBlockSchema,
  CanvasPhotoBlockSchema,
  CanvasGalleryBlockSchema,
  CanvasChartBlockSchema,
  CanvasSourceBlockSchema,
]);

export type CanvasBlock = z.infer<typeof CanvasBlockSchema>;

export const CanvasSubsectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  titlePointId: z.string().optional(),
  subtitle: z.string().optional(),
  subtitlePointId: z.string().optional(),
  blocks: z.array(CanvasBlockSchema).default([]),
});

export type CanvasSubsection = z.infer<typeof CanvasSubsectionSchema>;

export const CanvasSectionSchema = z.object({
  id: z.string().min(1),
  number: z.union([z.string(), z.number()]).optional(),
  isNumbered: z.boolean().optional(),
  title: z.string().min(1),
  titlePointId: z.string().optional(),
  subtitle: z.string().optional(),
  summary: z.string().optional(),
  subsections: z.array(CanvasSubsectionSchema).default([]),
  blocks: z.array(CanvasBlockSchema).optional(),
});

export type CanvasSection = z.infer<typeof CanvasSectionSchema>;

export const DocumentCanvasSchema = z.object({
  documentId: z.string().min(1),
  version: z.number().int().nonnegative().default(1),
  updatedAt: z.string().min(1),
  sections: z.array(CanvasSectionSchema).default([]),
});

export type DocumentCanvas = z.infer<typeof DocumentCanvasSchema>;

/**
 * Type Guards
 */
export function isTextBlock(block: CanvasBlock): block is CanvasTextBlock {
  return block.type === 'text';
}

export function isPhotoBlock(block: CanvasBlock): block is CanvasPhotoBlock {
  return block.type === 'photo';
}

export function isGalleryBlock(block: CanvasBlock): block is CanvasGalleryBlock {
  return block.type === 'gallery';
}

export function isChartBlock(block: CanvasBlock): block is CanvasChartBlock {
  return block.type === 'chart';
}

export function isSourceBlock(block: CanvasBlock): block is CanvasSourceBlock {
  return block.type === 'source';
}

/**
 * Form Data Contract for Canvas Add & Edit Modals
 */
export const CanvasElementFormDataSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  isNumbered: z.boolean().optional(),
  content: z.string().optional(),
  as: z.enum(['lead', 'body', 'callout', 'quote', 'p', 'blockquote']).optional(),
  url: z.string().optional(),
  src: z.string().optional(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  showCaption: z.boolean().optional(),
  externalUrl: z.string().optional(),
  chartId: z.string().optional(),
});

export type CanvasElementFormData = z.infer<typeof CanvasElementFormDataSchema>;
