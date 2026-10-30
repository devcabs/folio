import { describe, it, expect } from 'vitest';
import { generateParametricPath } from '../../src/components/ui/ParametricShape';

describe('Parametric Mathematical Rosette Generator', () => {
  it('generates valid closed SVG path strings for various lobe counts (S = 3, 5, 8, 12)', () => {
    const lobeCounts = [3, 5, 8, 12];

    for (const sides of lobeCounts) {
      const pathData = generateParametricPath(sides, 0.15, 24);

      expect(pathData.startsWith('M ')).toBe(true);
      expect(pathData.endsWith(' Z')).toBe(true);
      expect(pathData).not.toContain('NaN');
      expect(pathData).not.toContain('Infinity');
      expect(pathData).not.toContain('undefined');
    }
  });

  it('correctly adapts to waviness and radius scales', () => {
    const flatCircle = generateParametricPath(8, 0, 50);
    expect(flatCircle).toBeDefined();
    expect(flatCircle.length).toBeGreaterThan(50);

    const highWaviness = generateParametricPath(6, 0.4, 30);
    expect(highWaviness).toBeDefined();
    expect(highWaviness).not.toContain('NaN');
  });
});
