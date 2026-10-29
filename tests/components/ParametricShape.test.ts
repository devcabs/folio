import { describe, it, expect } from 'vitest';
import { generateParametricPolygonPath } from '../../src/components/ui/ParametricShape';

describe('ParametricShape Mathematics & Path Generator', () => {
  it('generates valid closed SVG path and viewBox for default parameters (S = 8)', () => {
    const { pathData, viewBox } = generateParametricPolygonPath();

    expect(pathData).toMatch(/^M\s/);
    expect(pathData).toMatch(/\sZ$/);
    expect(pathData).not.toContain('NaN');

    const viewBoxParts = viewBox.split(' ').map(Number);
    expect(viewBoxParts).toHaveLength(4);
    expect(viewBoxParts.every((n) => !Number.isNaN(n))).toBe(true);
    expect(viewBoxParts[2]).toBeGreaterThan(0); // width
    expect(viewBoxParts[3]).toBeGreaterThan(0); // height
  });

  it('generates mathematically stable paths across various polygon lobes (S = 3, 5, 8, 12)', () => {
    const lobes = [3, 5, 8, 12];

    lobes.forEach((sides) => {
      const { pathData, viewBox } = generateParametricPolygonPath({
        sides,
        radius: 40,
        waviness: 10,
        strokeWidth: 8,
      });

      expect(pathData).toMatch(/^M\s/);
      expect(pathData).toMatch(/\sZ$/);
      expect(pathData).not.toContain('NaN');
      expect(pathData).not.toContain('Infinity');

      // Check cubic-bezier segments count equals safeSides * 2
      const cubicCount = (pathData.match(/C\s/g) || []).length;
      expect(cubicCount).toBe(sides * 2);

      const viewBoxParts = viewBox.split(' ').map(Number);
      expect(viewBoxParts[2]).toBeGreaterThan(0);
      expect(viewBoxParts[3]).toBeGreaterThan(0);
    });
  });

  it('safely handles edge case min sides parameter (sides < 3 clamped to 3)', () => {
    const { pathData } = generateParametricPolygonPath({ sides: 1 });
    const cubicCount = (pathData.match(/C\s/g) || []).length;
    expect(cubicCount).toBe(6); // 3 * 2
  });
});
