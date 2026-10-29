import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const HEX_COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b/g;
const RAW_RGBA_REGEX = /rgba?\([^)]+\)/g;

function findCssModuleFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findCssModuleFiles(filePath));
    } else if (file.endsWith('.module.css')) {
      results.push(filePath);
    }
  }
  return results;
}

describe('Design Token Purity & Anti-Hardcoded Design Tokens Suite', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const tokensPath = path.join(rootDir, 'src/styles/tokens.css');
  const fixturePath = path.join(rootDir, 'tests/fixtures/domain-dictionary.json');

  it('declares all required design token scales in tokens.css', () => {
    expect(fs.existsSync(tokensPath)).toBe(true);
    const tokensContent = fs.readFileSync(tokensPath, 'utf-8');

    const REQUIRED_CORE_TOKENS = [
      // Surfaces
      '--folio-surface-canvas',
      '--folio-surface-card',
      '--folio-surface-glass',
      '--folio-surface-scrim',
      '--folio-surface-tooltip',
      // Text
      '--folio-text-primary',
      '--folio-text-secondary',
      '--folio-text-muted',
      '--folio-text-inverse',
      // Primary & Accent
      '--folio-primary',
      '--folio-accent',
      // N-Node scale
      '--color-node-1',
      '--color-node-12',
      // Typography Trinity
      '--font-display',
      '--font-sans',
      '--font-mono',
      '--text-title',
      '--text-body',
      '--text-caption',
      '--text-small',
      '--text-micro',
      // Spacing
      '--space-0-5',
      '--space-1',
      '--space-1-5',
      '--space-2',
      '--space-16',
      // Radii
      '--radius-sm',
      '--radius-md',
      '--radius-lg',
      '--radius-pill',
      // Z-Index
      '--z-drawer',
      '--z-modal',
      '--z-topmost',
      // Dimensions
      '--size-control-md',
      '--size-btn-close',
      // Motion & Elevation
      '--duration-normal',
      '--ease-out',
      '--shadow-sm',
      '--shadow-md',
      '--shadow-lg',
    ];

    const missingTokens = REQUIRED_CORE_TOKENS.filter((token) => !tokensContent.includes(token));
    expect(missingTokens, `Missing required design tokens in tokens.css: ${missingTokens.join(', ')}`).toHaveLength(0);
  });

  it('rejects banned domain color or token identifiers in tokens.css', () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const dict = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    const bannedRegex = new RegExp(dict.bannedTermsRegex, 'i');

    const tokensContent = fs.readFileSync(tokensPath, 'utf-8');
    const lines = tokensContent.split('\n');
    const violations: string[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) {
        return;
      }
      const match = trimmed.match(bannedRegex);
      if (match) {
        violations.push(`[tokens.css:${idx + 1}] Banned token name "${match[0]}" in: "${trimmed}"`);
      }
    });

    if (violations.length > 0) {
      expect.fail(`Domain leaks in tokens.css:\n${violations.join('\n')}`);
    }
  });

  it('enforces 100% color token adherence (0 hex, 0 raw rgba) across all CSS modules', () => {
    const cssModuleFiles = findCssModuleFiles(path.join(rootDir, 'src'));
    expect(cssModuleFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of cssModuleFiles) {
      const relPath = path.relative(rootDir, file);
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) {
          return;
        }

        const hexMatches = trimmed.match(HEX_COLOR_REGEX);
        if (hexMatches) {
          violations.push(`[${relPath}:${idx + 1}] Hardcoded HEX: ${hexMatches.join(', ')} -> "${trimmed}"`);
        }

        const rgbaMatches = trimmed.match(RAW_RGBA_REGEX);
        if (rgbaMatches) {
          violations.push(`[${relPath}:${idx + 1}] Hardcoded RGBA: ${rgbaMatches.join(', ')} -> "${trimmed}"`);
        }
      });
    }

    if (violations.length > 0) {
      expect.fail(`Color token purity violations in CSS modules:\n${violations.join('\n')}`);
    }

    expect(violations).toHaveLength(0);
  });

  it('enforces typography token adherence (font-family must consume var(--font-*))', () => {
    const cssModuleFiles = findCssModuleFiles(path.join(rootDir, 'src'));
    const violations: string[] = [];

    for (const file of cssModuleFiles) {
      const relPath = path.relative(rootDir, file);
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) {
          return;
        }

        if (trimmed.startsWith('font-family:')) {
          if (!trimmed.includes('var(--font-')) {
            violations.push(`[${relPath}:${idx + 1}] Hardcoded font-family: "${trimmed}"`);
          }
        }
      });
    }

    if (violations.length > 0) {
      expect.fail(`Font-family token violations (must consume var(--font-*)):\n${violations.join('\n')}`);
    }

    expect(violations).toHaveLength(0);
  });

  it('enforces font-size token adherence (font-size must consume var(--text-*) or calc)', () => {
    const cssModuleFiles = findCssModuleFiles(path.join(rootDir, 'src'));
    const violations: string[] = [];

    for (const file of cssModuleFiles) {
      const relPath = path.relative(rootDir, file);
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) {
          return;
        }

        if (trimmed.startsWith('font-size:')) {
          const value = trimmed.replace('font-size:', '').replace(';', '').trim();
          const isValid = value.includes('var(--text-') || value.startsWith('calc(') || value === 'inherit';
          if (!isValid) {
            violations.push(`[${relPath}:${idx + 1}] Hardcoded font-size: "${trimmed}" (must use var(--text-*))`);
          }
        }
      });
    }

    if (violations.length > 0) {
      expect.fail(`Font-size token violations in CSS modules:\n${violations.join('\n')}`);
    }

    expect(violations).toHaveLength(0);
  });

  it('enforces border-radius token adherence (border-radius must consume var(--radius-*) or 0/50%)', () => {
    const cssModuleFiles = findCssModuleFiles(path.join(rootDir, 'src'));
    const violations: string[] = [];

    for (const file of cssModuleFiles) {
      const relPath = path.relative(rootDir, file);
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) {
          return;
        }

        if (trimmed.startsWith('border-radius:')) {
          const value = trimmed.replace('border-radius:', '').replace(';', '').trim();
          const isValid = value.includes('var(--radius-') || value === '0' || value === '50%' || value === 'inherit';
          if (!isValid) {
            violations.push(`[${relPath}:${idx + 1}] Hardcoded border-radius: "${trimmed}" (must use var(--radius-*))`);
          }
        }
      });
    }

    if (violations.length > 0) {
      expect.fail(`Border-radius token violations in CSS modules:\n${violations.join('\n')}`);
    }

    expect(violations).toHaveLength(0);
  });

  it('enforces z-index token adherence (high z-index values >= 10 must consume var(--z-*))', () => {
    const cssModuleFiles = findCssModuleFiles(path.join(rootDir, 'src'));
    const violations: string[] = [];

    for (const file of cssModuleFiles) {
      const relPath = path.relative(rootDir, file);
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) {
          return;
        }

        if (trimmed.startsWith('z-index:')) {
          const value = trimmed.replace('z-index:', '').replace(';', '').trim();
          // Allow low stacking integers (0, 1, 2, auto) or require var(--z-*)
          const isLowStack = ['0', '1', '2', '-1', 'auto', 'inherit'].includes(value);
          const isToken = value.includes('var(--z-');
          if (!isLowStack && !isToken) {
            violations.push(`[${relPath}:${idx + 1}] Hardcoded magic z-index: "${trimmed}" (must use var(--z-*))`);
          }
        }
      });
    }

    if (violations.length > 0) {
      expect.fail(`Z-index token violations in CSS modules:\n${violations.join('\n')}`);
    }

    expect(violations).toHaveLength(0);
  });
});
