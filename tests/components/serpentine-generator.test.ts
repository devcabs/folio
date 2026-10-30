import { describe, it, expect } from 'vitest';
import {
  generateSerpentineRoadmap,
  progressToDrawnLength,
} from '../../src/components/roadmap/serpentine-generator';
import { parseRoute } from '../../src/hooks/use-hash-route';

describe('Parametric Serpentine Roadmap Generator (Task 18.3)', () => {
  it('generates mathematically sound SVG serpentine paths for arbitrary node counts (N = 1, 3, 5, 8, 12)', () => {
    const testCounts = [1, 3, 5, 8, 12];

    for (const count of testCounts) {
      const roadmap = generateSerpentineRoadmap(1200, 800, {
        nodeCount: count,
      });

      expect(roadmap).toBeDefined();
      expect(roadmap.points.length).toBe(count);
      expect(roadmap.pathData).not.toContain('NaN');
      expect(roadmap.pathData).not.toContain('Infinity');
      expect(roadmap.pathData).not.toContain('undefined');
      expect(roadmap.totalLength).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(roadmap.totalLength)).toBe(true);
      expect(Number.isFinite(roadmap.totalHeight)).toBe(true);

      // Verify alternating flanking and increasing Y coordinates
      for (let i = 0; i < roadmap.points.length; i++) {
        const pt = roadmap.points[i];
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
        expect(Number.isFinite(pt.threshold)).toBe(true);
        expect(pt.stage).toBe(i + 1);

        if (i % 2 === 0) {
          expect(pt.flank).toBe('left');
        } else {
          expect(pt.flank).toBe('right');
        }

        if (i > 0) {
          expect(pt.y).toBeGreaterThan(roadmap.points[i - 1].y);
          expect(pt.threshold).toBeGreaterThan(roadmap.points[i - 1].threshold);
        }
      }
    }
  });

  it('supports classic S-curve (curved) track style without NaN or discontinuities', () => {
    const roadmap = generateSerpentineRoadmap(1200, 800, {
      nodeCount: 5,
      trackStyle: 'curved',
    });

    expect(roadmap.pathData).toContain(' C ');
    expect(roadmap.pathData).not.toContain('NaN');
    expect(roadmap.points.length).toBe(5);
    expect(roadmap.totalLength).toBeGreaterThan(0);
  });

  it('handles edge case N = 1 gracefully without divide-by-zero', () => {
    const singleNode = generateSerpentineRoadmap(1200, 800, {
      nodeCount: 1,
    });

    expect(singleNode.points.length).toBe(1);
    expect(singleNode.points[0].threshold).toBe(0);
    expect(singleNode.pathData).not.toContain('NaN');
    expect(singleNode.totalLength).toBe(0);

    const length = progressToDrawnLength(0.5, singleNode.cumLengths);
    expect(length).toBe(0);
  });

  it('calculates piecewise ink drawn lengths accurately and monotonically across N segments', () => {
    const roadmap = generateSerpentineRoadmap(1200, 800, {
      nodeCount: 5,
    });

    expect(progressToDrawnLength(0, roadmap.cumLengths)).toBe(0);
    expect(progressToDrawnLength(1, roadmap.cumLengths)).toBe(roadmap.totalLength);

    // Test clamped bounds
    expect(progressToDrawnLength(-0.5, roadmap.cumLengths)).toBe(0);
    expect(progressToDrawnLength(1.5, roadmap.cumLengths)).toBe(roadmap.totalLength);

    // Monotonic increase check across 20 sample steps
    let previous = -1;
    for (let step = 0; step <= 20; step++) {
      const p = step / 20;
      const drawn = progressToDrawnLength(p, roadmap.cumLengths);
      expect(drawn).toBeGreaterThanOrEqual(previous);
      expect(Number.isFinite(drawn)).toBe(true);
      previous = drawn;
    }
  });

  it('parses dynamic routes and arbitrary stage targets in parseRoute', () => {
    // Arbitrary stage numbers
    expect(parseRoute('/', '#stage-1').targetStage).toBe(1);
    expect(parseRoute('/', '#stage-5').targetStage).toBe(5);
    expect(parseRoute('/', '#stage-8').targetStage).toBe(8);

    // Standard node paths
    const accessRoute = parseRoute('/node/access/');
    expect(accessRoute.type).toBe('node');
    expect(accessRoute.nodeId).toBe('access');

    // Dynamic custom node slug
    const customRoute = parseRoute('/node/custom-phase-3/');
    expect(customRoute.type).toBe('node');
    expect(customRoute.nodeId).toBe('custom-phase-3');
  });
});
