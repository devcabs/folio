import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DICTIONARY_PATH = path.join(ROOT, 'tests/fixtures/domain-dictionary.json');

function collectFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(collectFiles(fullPath, extensions));
    } else if (extensions.some((ext) => file.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Domain Purity Enforcement', () => {
  const dictionary = JSON.parse(fs.readFileSync(DICTIONARY_PATH, 'utf8'));
  const bannedRegex = new RegExp(dictionary.bannedTermsRegex, 'i');

  it('guarantees zero banned institutional domain terms exist in src/ and scripts/', () => {
    const srcFiles = collectFiles(path.join(ROOT, 'src'), ['.ts', '.tsx', '.css', '.json', '.html']);
    const scriptFiles = collectFiles(path.join(ROOT, 'scripts'), ['.ts', '.js']);
    const allFiles = [...srcFiles, ...scriptFiles];

    const violations: { file: string; line: number; term: string; snippet: string }[] = [];

    for (const filePath of allFiles) {
      const relPath = path.relative(ROOT, filePath);
      
      // Also check if the file path itself contains a banned term
      const pathMatch = relPath.match(bannedRegex);
      if (pathMatch) {
        violations.push({
          file: relPath,
          line: 0,
          term: pathMatch[0],
          snippet: `File path contains banned term: ${relPath}`,
        });
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Skip comment lines in scripts that explicitly reference dictionary or allowlist
        if (relPath.startsWith('scripts/') && (line.includes('banned') || line.includes('dictionary'))) {
          return;
        }

        const match = line.match(bannedRegex);
        if (match) {
          violations.push({
            file: relPath,
            line: index + 1,
            term: match[0],
            snippet: line.trim(),
          });
        }
      });
    }

    if (violations.length > 0) {
      const details = violations
        .map((v) => `  ${v.file}:${v.line} -> "${v.term}" in "${v.snippet}"`)
        .join('\n');
      expect.fail(`Domain purity violations found (${violations.length}):\n${details}`);
    }

    expect(violations.length).toBe(0);
  });
});
