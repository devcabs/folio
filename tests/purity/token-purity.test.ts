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

describe('Design Token Purity & Anti-Hardcoded Color Suite', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const tokensPath = path.join(rootDir, 'src/styles/tokens.css');
  const fixturePath = path.join(rootDir, 'tests/fixtures/domain-dictionary.json');

  it('declares all required core tokens in tokens.css', () => {
    expect(fs.existsSync(tokensPath)).toBe(true);
    const tokensContent = fs.readFileSync(tokensPath, 'utf-8');

    const REQUIRED_CORE_TOKENS = [
      '--folio-surface-canvas',
      '--folio-surface-card',
      '--folio-surface-glass',
      '--folio-surface-scrim',
      '--folio-text-primary',
      '--folio-text-secondary',
      '--folio-text-muted',
      '--folio-primary',
      '--folio-accent',
      '--color-node-1',
      '--color-node-12',
      '--font-display',
      '--font-sans',
      '--font-mono',
      '--space-1',
      '--space-16',
      '--radius-md',
      '--duration-normal',
      '--ease-out',
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

  it('strictly enforces 100% token adherence (0 hex, 0 raw rgba) across all CSS modules', () => {
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
      expect.fail(
        `Token purity violations encountered in CSS modules (must consume var(--folio-*)):\n${violations.join('\n')}`
      );
    }

    expect(violations).toHaveLength(0);
  });
});
