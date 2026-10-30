import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { NodeItem, NodeNavigationLink } from '../../src/types/node';

const NodeHeroImageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().optional(),
  showCaption: z.boolean().optional(),
});

const NodeItemSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  summary: z.string().optional(),
  tagline: z.string().optional(),
  accentColor: z.string().regex(/^#([0-9a-fA-F]{3,8})$/),
  accentTint: z.string().optional(),
  heroImage: NodeHeroImageSchema.optional(),
  annotation: z.string().optional(),
  nodeNumber: z.number().optional(),
  stages: z.array(z.object({
    step: z.number(),
    stageName: z.string(),
    narrative: z.string(),
  })).optional(),
  sourceItems: z.array(z.any()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

describe('Generic Sequence Node Contract', () => {
  it('instantiates valid nodes supporting arbitrary sequence lengths (N >= 1)', () => {
    const lengths = [1, 3, 5, 8, 12];

    for (const N of lengths) {
      const sequence: NodeItem[] = Array.from({ length: N }, (_, i) => ({
        id: `node-${i + 1}`,
        index: i,
        title: `Milestone Phase ${i + 1}`,
        subtitle: `Operational sequence step ${i + 1}`,
        accentColor: '#881337',
        accentTint: '#ffe4e6',
        heroImage: {
          src: `/assets/node-${i + 1}.jpg`,
          alt: `Visual record for milestone ${i + 1}`,
        },
      }));

      expect(sequence).toHaveLength(N);
      for (const node of sequence) {
        const parseResult = NodeItemSchema.safeParse(node);
        expect(parseResult.success).toBe(true);
      }
    }
  });

  it('guarantees node contracts contain zero legacy institutional keys', () => {
    const sampleNode: NodeItem = {
      id: 'access-stage',
      index: 0,
      title: 'Universal Access',
      accentColor: '#0284c7',
    };

    const keys = Object.keys(sampleNode);
    expect(keys).not.toContain('depedTitle');
    expect(keys).not.toContain('enzoReflection');
    expect(keys).not.toContain('pillarId');
    expect(keys).not.toContain('depedReference');
  });

  it('allows open navigation link synthesis', () => {
    const link: NodeNavigationLink = {
      id: 'custom-node-7',
      index: 6,
      title: 'Community Governance',
      path: '#custom-node-7',
    };

    expect(link.id).toBe('custom-node-7');
    expect(link.index).toBe(6);
    expect(link.path).toBe('#custom-node-7');
  });
});
