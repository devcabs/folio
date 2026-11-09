import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PhotoFlightEngine } from '../../src/components/roadmap/PhotoFlightEngine';
import { HeroPhoto } from '../../src/components/canvas/HeroPhoto';
import {
  NODE_PHOTO_CONFIGS,
  getNodePhotoConfig,
  DESTINATION_GLOBAL_MARGINS,
} from '../../src/data/node-photo-configs';
import rawNodes from '../../src/data/sample-nodes.json';
import type { NodeItem } from '../../src/types/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('Photo Flight Engine & Sequence Node Photo Wiring', () => {
  it('exports PhotoFlightEngine and HeroPhoto components properly', () => {
    expect(PhotoFlightEngine).toBeDefined();
    expect(typeof PhotoFlightEngine).toBe('function');
    expect(HeroPhoto).toBeDefined();
    expect(typeof HeroPhoto).toBe('function');
  });

  it('defines valid single-source-of-truth placement configs for all 5 sequence nodes', () => {
    expect(Array.isArray(NODE_PHOTO_CONFIGS)).toBe(true);
    expect(NODE_PHOTO_CONFIGS.length).toBe(5);

    NODE_PHOTO_CONFIGS.forEach((cfg, idx) => {
      expect(cfg.nodeNumber).toBe(idx + 1);
      expect(['left', 'right']).toContain(cfg.source.side);
      expect(typeof cfg.source.x).toBe('number');
      expect(typeof cfg.source.y).toBe('number');
      expect(typeof cfg.source.width).toBe('number');
      expect(typeof cfg.source.rotation).toBe('number');
      expect(typeof cfg.focalPoint.x).toBe('number');
      expect(typeof cfg.focalPoint.y).toBe('number');
    });

    // Lookup helper
    expect(getNodePhotoConfig(1)?.nodeNumber).toBe(1);
    expect(getNodePhotoConfig(5)?.nodeNumber).toBe(5);
    expect(getNodePhotoConfig(99)).toBeUndefined();
  });

  it('verifies safe global destination margins for desktop and mobile', () => {
    expect(DESTINATION_GLOBAL_MARGINS.desktop.marginX).toBeGreaterThanOrEqual(16);
    expect(DESTINATION_GLOBAL_MARGINS.desktop.bottomPadding).toBeGreaterThanOrEqual(50);
    expect(DESTINATION_GLOBAL_MARGINS.mobile.marginX).toBeGreaterThanOrEqual(12);
  });

  it('wires every node in sample-nodes.json to an authentic, existing image asset', () => {
    const nodes = rawNodes as NodeItem[];
    expect(nodes.length).toBe(5);

    nodes.forEach((node) => {
      expect(node.heroImage).toBeDefined();
      expect(node.heroImage?.src).toBeDefined();
      expect(node.heroImage?.src.startsWith('/images/nodes/')).toBe(true);
      expect(node.heroImage?.alt.length).toBeGreaterThan(5);

      // Verify physical image file exists in public/
      const relPath = node.heroImage!.src.replace(/^\//, '');
      const fullPath = path.join(ROOT, 'public', relPath);
      expect(fs.existsSync(fullPath), `Expected image file at ${fullPath}`).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size).toBeGreaterThan(1000);
    });
  });
});

