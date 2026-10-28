import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Load domain dictionary fixture
const fixturePath = path.resolve(__dirname, '../fixtures/domain-dictionary.json');
const dictionary = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
const BANNED_REGEX = new RegExp(dictionary.bannedTermsRegex, 'i');

function scanDirectory(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'fixtures', '.wrangler', 'coverage'].includes(entry.name)) {
        continue;
      }
      scanDirectory(fullPath, fileList);
    } else if (entry.isFile()) {
      if (/\.(ts|tsx|js|jsx|css|html|json)$/.test(entry.name)) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

interface Violation {
  file: string;
  line: number;
  match: string;
  snippet: string;
}

function auditFileForDomainLeaks(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const fileName = path.basename(filePath);

  // Check file name
  const fileMatch = fileName.match(BANNED_REGEX);
  if (fileMatch) {
    violations.push({
      file: filePath,
      line: 0,
      match: fileMatch[0],
      snippet: `File name contains banned term: ${fileName}`,
    });
  }

  // Check file contents
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const matches = trimmed.match(BANNED_REGEX);
    if (matches) {
      violations.push({
        file: filePath,
        line: index + 1,
        match: matches[0],
        snippet: trimmed,
      });
    }
  });

  return violations;
}

describe('Domain Decoupling & Anti-Domain Purity Suite', () => {
  it('detects deliberate leaks in synthetic code', () => {
    // Construct test string without hardcoding literal banned term in this source file
    const sampleIllegalTerm = Buffer.from('ZGVwZWQ=', 'base64').toString('utf-8'); // 'deped'
    const syntheticSnippet = `const organization = "${sampleIllegalTerm}";`;
    const match = syntheticSnippet.match(BANNED_REGEX);
    expect(match).not.toBeNull();
    expect(match?.[0]?.toLowerCase()).toBe(sampleIllegalTerm);
  });

  it('rejects bespoke institutional or mascot terminology across all engine code', () => {
    const rootDir = path.resolve(__dirname, '../../');
    const targetDirs = [
      path.join(rootDir, 'src'),
      path.join(rootDir, 'scripts'),
    ];

    const allFiles: string[] = [];
    for (const d of targetDirs) {
      scanDirectory(d, allFiles);
    }

    const rootConfigs = [
      'vite.config.ts',
      'vite.config.lib.ts',
      'vitest.config.ts',
      'tsconfig.json',
      'tsconfig.node.json',
      'tsconfig.lib.json',
      'package.json',
      'index.html',
      'eslint.config.js',
    ];

    for (const cfg of rootConfigs) {
      const cfgPath = path.join(rootDir, cfg);
      if (fs.existsSync(cfgPath)) {
        allFiles.push(cfgPath);
      }
    }

    const allViolations: Violation[] = [];
    for (const file of allFiles) {
      const violations = auditFileForDomainLeaks(file);
      allViolations.push(...violations);
    }

    if (allViolations.length > 0) {
      const formatted = allViolations
        .map((v) => `❌ [${path.relative(rootDir, v.file)}:${v.line}] Term: "${v.match}" -> "${v.snippet}"`)
        .join('\n');
      expect.fail(`Domain purity violations encountered:\n${formatted}`);
    }

    expect(allViolations).toHaveLength(0);
  });
});
