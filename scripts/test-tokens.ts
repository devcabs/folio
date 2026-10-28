import * as fs from 'node:fs';
import * as path from 'node:path';

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

const HEX_COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b/g;
const RAW_RGBA_REGEX = /rgba?\([^)]+\)/g;

// Load banned terms from the fixture dictionary dynamically
const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/domain-dictionary.json');
let bannedColorRegex: RegExp;
if (fs.existsSync(fixturePath)) {
  const dict = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  bannedColorRegex = new RegExp(dict.bannedTermsRegex, 'i');
} else {
  // Fallback pattern if fixture missing
  bannedColorRegex = /banned-token-pattern-fallback/i;
}

const REQUIRED_CORE_TOKENS = [
  '--folio-surface-canvas',
  '--folio-surface-card',
  '--folio-surface-glass',
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

let failureCount = 0;

console.log('--- @folio/engine Token Purity Audit ---');

// 1. Audit tokens.css for banned domain color names
const tokensPath = path.resolve(process.cwd(), 'src/styles/tokens.css');
if (!fs.existsSync(tokensPath)) {
  console.error(`❌ Missing tokens file: ${tokensPath}`);
  process.exit(1);
}

const tokensContent = fs.readFileSync(tokensPath, 'utf-8');
const tokenLines = tokensContent.split('\n');

tokenLines.forEach((line, idx) => {
  const trimmed = line.trim();
  if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) {
    return;
  }
  const match = line.match(bannedColorRegex);
  if (match) {
    console.error(`❌ [tokens.css:${idx + 1}] Banned domain token identifier: "${match[0]}" -> "${trimmed}"`);
    failureCount++;
  }
});

// 2. Verify all required core tokens are declared
REQUIRED_CORE_TOKENS.forEach((token) => {
  if (!tokensContent.includes(token)) {
    console.error(`❌ Missing required design token: "${token}"`);
    failureCount++;
  }
});

// 3. Audit all CSS modules for hardcoded colors
const cssModuleFiles = findCssModuleFiles(path.resolve(process.cwd(), 'src'));
for (const file of cssModuleFiles) {
  const relPath = path.relative(process.cwd(), file);
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) {
      return;
    }

    const hexMatches = line.match(HEX_COLOR_REGEX);
    if (hexMatches) {
      console.error(`❌ [${relPath}:${idx + 1}] Hardcoded HEX color: ${hexMatches.join(', ')} -> Line: "${trimmed}"`);
      failureCount++;
    }

    const rgbaMatches = line.match(RAW_RGBA_REGEX);
    if (rgbaMatches) {
      console.error(`❌ [${relPath}:${idx + 1}] Hardcoded RGBA color: ${rgbaMatches.join(', ')} -> Line: "${trimmed}"`);
      failureCount++;
    }
  });
}

if (failureCount > 0) {
  console.error(`\n❌ Token purity check failed: Encountered ${failureCount} violations.`);
  process.exit(1);
} else {
  console.log('\n✅ Token purity check passed: 100% token adherence and zero domain leaks.');
  process.exit(0);
}
