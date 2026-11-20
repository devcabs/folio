import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const COMPONENTS_DIR = path.join(ROOT, 'src/components');

function collectFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(collectFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Intentional shared parent/layout CSS modules that multiple components in the
 * same subsystem are explicitly permitted to import.
 */
const ALLOWED_SHARED_CSS_MODULES = new Set([
  'src/components/canvas/CanvasContainers.module.css',
  'src/components/canvas/CanvasLeaf.module.css',
  'src/components/canvas/CanvasControls.module.css',
  'src/components/chart/ChartConfigDrawer.module.css',
]);

/**
 * Explicitly documented exemptions for raw HTML controls outside `src/components/ui/`.
 * Any file NOT listed here (including all Epic 12 migrated modals, drawers, and
 * showcases) must use canonical primitives from `src/components/ui/`.
 */
const RAW_CONTROL_EXEMPTIONS: Record<string, Set<string>> = {
  // Hidden numeric PIN overlay with custom digit boxes
  'src/components/dev/DevPinModal.tsx': new Set(['input']),
  // Composite search input with leading icon & keyboard shortcut badge
  'src/components/layout/SearchField.tsx': new Set(['input']),
  // Feedback primitives (live outside src/components/ui/)
  'src/components/feedback/Toast.tsx': new Set(['button']),
  // Custom media/node/navigation triggers with bespoke hit-area geometry
  'src/components/canvas/CanvasAddBar.tsx': new Set(['button']),
  'src/components/canvas/CanvasPhoto.tsx': new Set(['button']),
  'src/components/canvas/HeroPhoto.tsx': new Set(['button']),
  'src/components/roadmap/RoadmapNode.tsx': new Set(['button']),
  'src/components/source/LightboxPhotoStrip.tsx': new Set(['button']),
  'src/components/source/SourceImage.tsx': new Set(['button']),
  'src/components/chart/ChartLegend.tsx': new Set(['button']),
  'src/components/chart/ChartTableModal.tsx': new Set(['button']),
  'src/components/chart/drawer/panels/Step3ChartSetup.tsx': new Set(['button']),
  // Legacy node/chrome edit branch (canvas element fields use CanvasElementFields)
  'src/components/dev/UniversalEditModal.tsx': new Set(['button', 'input', 'textarea']),
};

describe('Canonical UI Enforcement Guardrails', () => {
  it('guarantees zero hardcoded hex, rgb/rgba, or hsl/hsla colors in src/components/**/*.module.css', () => {
    const cssFiles = collectFiles(COMPONENTS_DIR, ['.module.css']);
    const colorPattern = /(#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\()/i;
    const violations: string[] = [];

    for (const filePath of cssFiles) {
      const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
        const match = line.match(colorPattern);
        if (match) {
          violations.push(`${relPath}:${idx + 1} -> "${match[0]}" in "${trimmed}"`);
        }
      });
    }

    expect(violations, `Hardcoded colors found in CSS modules:\n${violations.join('\n')}`).toEqual([]);
  });

  it('guarantees zero unauthorized cross-component .module.css imports in src/components/', () => {
    const tsFiles = collectFiles(COMPONENTS_DIR, ['.ts', '.tsx']);
    const importRegex = /from\s+['"]([^'"]+\.module\.css)['"]/;
    const violations: string[] = [];

    for (const filePath of tsFiles) {
      const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');

      lines.forEach((line, idx) => {
        const match = line.match(importRegex);
        if (!match) return;

        const resolvedTarget = path
          .normalize(path.join(path.dirname(relPath), match[1]))
          .replace(/\\/g, '/');
        const expectedOwnCss = relPath.replace(/\.tsx?$/, '.module.css');

        if (resolvedTarget !== expectedOwnCss && !ALLOWED_SHARED_CSS_MODULES.has(resolvedTarget)) {
          violations.push(`${relPath}:${idx + 1} imports "${resolvedTarget}" (expected "${expectedOwnCss}")`);
        }
      });
    }

    expect(
      violations,
      `Unauthorized cross-component .module.css imports found:\n${violations.join('\n')}`
    ).toEqual([]);
  });

  it('guarantees zero unauthorized raw <button>, <input>, <textarea>, or <select> outside src/components/ui/', () => {
    const tsxFiles = collectFiles(COMPONENTS_DIR, ['.tsx']);
    const rawControlRegex = /<(button|input|textarea|select)(?=[\s>/]|$)/g;
    const violations: string[] = [];

    for (const filePath of tsxFiles) {
      const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
      if (relPath.startsWith('src/components/ui/')) continue;

      const allowedTags = RAW_CONTROL_EXEMPTIONS[relPath];
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');

      lines.forEach((line, idx) => {
        let match: RegExpExecArray | null;
        rawControlRegex.lastIndex = 0;
        while ((match = rawControlRegex.exec(line)) !== null) {
          const tag = match[1];
          if (!allowedTags || !allowedTags.has(tag)) {
            violations.push(`${relPath}:${idx + 1} -> raw <${tag}> outside src/components/ui/`);
          }
        }
      });
    }

    expect(
      violations,
      `Unauthorized raw HTML form/button controls found:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});
