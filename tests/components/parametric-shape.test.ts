import { describe, it, expect } from 'vitest';
import { generateParametricPath, generateWavyPolygonPath } from '../../src/components/ui/ParametricShape';

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

  it('computes smooth cubic-Bézier wavy polygon paths with auto-centered viewBox for N = 3, 5, 8', () => {
    for (const sides of [3, 5, 8]) {
      const result = generateWavyPolygonPath({ sides, radius: 45, waviness: 10, roundness: 1 });
      expect(result.pathData).toBeDefined();
      expect(result.viewBox).toBeDefined();

      // Starts with M, contains cubic Bézier segments C, ends with Z
      expect(result.pathData.startsWith('M ')).toBe(true);
      expect(result.pathData).toContain(' C ');
      expect(result.pathData.endsWith(' Z')).toBe(true);

      // ViewBox format: "minX minY width height"
      const parts = result.viewBox.split(' ').map(Number);
      expect(parts).toHaveLength(4);
      expect(parts.every((p) => !isNaN(p) && isFinite(p))).toBe(true);
      expect(parts[2]).toBeGreaterThan(0); // width > 0
      expect(parts[3]).toBeGreaterThan(0); // height > 0
    }
  });
});
