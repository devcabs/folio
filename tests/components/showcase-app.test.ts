import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import App, { App as AppNamed } from '../../src/App';
import type { NodeItem } from '../../src/types/node';
import type { ChartDataset } from '../../src/types/chart';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('Standalone Showcase Application (Task 18.10)', () => {
  it('exports App as a valid React component (both default and named)', () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
    expect(AppNamed).toBeDefined();
    expect(typeof AppNamed).toBe('function');
  });

  it('provides a clean, rich 5-stage generic dataset in sample-nodes.json', () => {
    const filePath = path.join(ROOT, 'src/data/sample-nodes.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const raw = fs.readFileSync(filePath, 'utf8');
    const nodes = JSON.parse(raw) as NodeItem[];

    expect(Array.isArray(nodes)).toBe(true);
    expect(nodes.length).toBe(5);

    const expectedIds = ['access', 'equity', 'quality', 'resiliency', 'governance'];

    nodes.forEach((node, idx) => {
      expect(node.id).toBe(expectedIds[idx]);
      expect(node.index).toBe(idx);
      expect(node.nodeNumber).toBe(idx + 1);
      expect(typeof node.title).toBe('string');
      expect(node.title.length).toBeGreaterThan(3);
      expect(typeof node.subtitle).toBe('string');
      expect(node.subtitle!.length).toBeGreaterThan(5);
      expect(typeof node.summary).toBe('string');
      expect(node.summary!.length).toBeGreaterThan(10);
      expect(typeof node.tagline).toBe('string');
      expect(node.accentColor).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(node.accentTint).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(node.heroImage).toBeDefined();
      expect(node.heroImage?.src).toBeDefined();
      expect(node.heroImage?.alt).toBeDefined();

      // Verify stages
      expect(Array.isArray(node.stages)).toBe(true);
      expect(node.stages?.length).toBe(5);
      node.stages?.forEach((stage, sIdx) => {
        expect(stage.step).toBe(sIdx + 1);
        expect(typeof stage.stageName).toBe('string');
        expect(typeof stage.narrative).toBe('string');
      });

      // Verify sourceItems
      expect(Array.isArray(node.sourceItems)).toBe(true);
      expect(node.sourceItems?.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('keeps node-nodes.json in parity with sample-nodes.json for existing consumers', () => {
    const samplePath = path.join(ROOT, 'src/data/sample-nodes.json');
    const nodeNodesPath = path.join(ROOT, 'src/data/node-nodes.json');

    if (fs.existsSync(samplePath) && fs.existsSync(nodeNodesPath)) {
      const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
      const nodeNodes = JSON.parse(fs.readFileSync(nodeNodesPath, 'utf8'));
      expect(nodeNodes.length).toBe(sample.length);
    }
  });

  it('provides rich pre-baked demonstration chart datasets in baked-charts.json', () => {
    const filePath = path.join(ROOT, 'src/data/baked-charts.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const raw = fs.readFileSync(filePath, 'utf8');
    const charts = JSON.parse(raw) as ChartDataset[];

    expect(Array.isArray(charts)).toBe(true);
    expect(charts.length).toBeGreaterThanOrEqual(5);

    const nodeIds = charts.map((c) => c.nodeId);
    expect(nodeIds).toContain('access');
    expect(nodeIds).toContain('equity');
    expect(nodeIds).toContain('quality');
    expect(nodeIds).toContain('resiliency');
    expect(nodeIds).toContain('governance');

    charts.forEach((chart) => {
      expect(typeof chart.chartId).toBe('string');
      expect(typeof chart.title).toBe('string');
      expect(typeof chart.asOfDate).toBe('string');
      expect(['bar', 'line', 'donut', 'scatter', 'histogram']).toContain(chart.chartType);
    });
  });
});
