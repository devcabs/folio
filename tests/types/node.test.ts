import { describe, it, expect } from 'vitest';
import {
  NodeItemSchema,
  NodeNavigationLinkSchema,
  type NodeItem,
} from '../../src/types/node';

describe('Node Type & Schema Contracts', () => {
  it('validates a minimal valid node item', () => {
    const minimalNode: NodeItem = {
      id: 'step-1',
      index: 0,
      title: 'First Milestone',
      accentColor: '#2563eb',
    };

    const parsed = NodeItemSchema.safeParse(minimalNode);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toBe('step-1');
      expect(parsed.data.index).toBe(0);
    }
  });

  it('validates a complete node item with hero image and metadata', () => {
    const fullNode: NodeItem = {
      id: 'stage-alpha',
      index: 1,
      title: 'Growth Phase',
      subtitle: 'Scaling Operations',
      summary: 'Executive summary of key operational milestones.',
      accentColor: '#059669',
      accentTint: '#ecfdf5',
      heroImage: {
        src: 'https://cdn.example.com/hero.jpg',
        alt: 'Team collaborative workshop',
        caption: 'Q2 Strategy Workshop',
      },
      metadata: {
        department: 'Operations',
        budgetCap: 50000,
        tags: ['strategy', 'execution'],
      },
    };

    const parsed = NodeItemSchema.safeParse(fullNode);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid node items missing required fields', () => {
    const invalidNode = {
      id: '',
      title: 'Missing Index and Accent',
    };

    const parsed = NodeItemSchema.safeParse(invalidNode);
    expect(parsed.success).toBe(false);
  });

  it('supports arbitrary dynamic sequence lengths (N >= 1)', () => {
    const sequenceLengths = [1, 3, 5, 8, 12, 20];

    sequenceLengths.forEach((count) => {
      const nodes: NodeItem[] = Array.from({ length: count }, (_, i) => ({
        id: `node-${i + 1}`,
        index: i,
        title: `Stage ${i + 1}`,
        accentColor: '#2563eb',
      }));

      expect(nodes).toHaveLength(count);
      nodes.forEach((node) => {
        const parsed = NodeItemSchema.safeParse(node);
        expect(parsed.success).toBe(true);
      });
    });
  });

  it('validates navigation links', () => {
    const navLink = {
      id: 'step-3',
      index: 2,
      title: 'Review',
      path: '#node/step-3',
    };

    const parsed = NodeNavigationLinkSchema.safeParse(navLink);
    expect(parsed.success).toBe(true);
  });
});
