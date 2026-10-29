import { z } from 'zod';

/**
 * NodeHeroImage Contract
 * Single anchor hero visual representation for a sequence node.
 */
export const NodeHeroImageSchema = z.object({
  src: z.string().min(1, 'Hero image source is required'),
  alt: z.string().min(1, 'Hero image alt text is required'),
  caption: z.string().optional(),
});

export type NodeHeroImage = z.infer<typeof NodeHeroImageSchema>;

/**
 * NodeItem Contract
 * Open, parameterized milestone item supporting dynamic sequence lengths (N >= 1).
 */
export const NodeItemSchema = z.object({
  id: z.string().min(1, 'Node ID is required'),
  index: z.number().int().nonnegative('Node index must be non-negative'),
  title: z.string().min(1, 'Node title is required'),
  subtitle: z.string().optional(),
  summary: z.string().optional(),
  accentColor: z.string().min(1, 'Accent color is required'),
  accentTint: z.string().optional(),
  heroImage: NodeHeroImageSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type NodeItem = z.infer<typeof NodeItemSchema>;

/**
 * NodeNavigationLink Contract
 * Route navigation binding for sequence nodes.
 */
export const NodeNavigationLinkSchema = z.object({
  id: z.string().min(1, 'Node ID is required'),
  index: z.number().int().nonnegative('Index must be non-negative'),
  title: z.string().min(1, 'Title is required'),
  path: z.string().min(1, 'Path is required'),
});

export type NodeNavigationLink = z.infer<typeof NodeNavigationLinkSchema>;
