import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const TOKENS_FILE = path.join(ROOT_DIR, 'src', 'styles', 'tokens.css');
const SRC_DIR = path.join(ROOT_DIR, 'src');

if (!fs.existsSync(TOKENS_FILE)) {
  console.error(`❌ Tokens file not found at ${TOKENS_FILE}`);
  process.exit(1);
}

// 1. Parse defined tokens in tokens.css
const tokensContent = fs.readFileSync(TOKENS_FILE, 'utf-8');
const definedTokens = new Set<string>();
const aliasMap = new Map<string, string>();

const DEF_REGEX = /^\s*(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/gm;
let match: RegExpExecArray | null;

while ((match = DEF_REGEX.exec(tokensContent)) !== null) {
  const tokenName = match[1].trim();
  const tokenVal = match[2].trim();
  definedTokens.add(tokenName);

  const varMatch = tokenVal.match(/var\((--[a-zA-Z0-9_-]+)\)/);
  if (varMatch) {
    aliasMap.set(tokenName, varMatch[1]);
  }
}

console.log(`🔍 [Token Gate] Found ${definedTokens.size} defined CSS tokens in tokens.css.`);

// 2. Verify all aliases in tokens.css resolve to a defined token (no dangling aliases)
let danglingCount = 0;
aliasMap.forEach((target, source) => {
  if (!definedTokens.has(target)) {
    console.error(`❌ [Dangling Alias] ${source} -> ${target} (Target is not defined in tokens.css)`);
    danglingCount++;
  }
});

if (danglingCount > 0) {
  console.error(`\n❌ Token Alias Verification Failed: ${danglingCount} dangling alias(es) detected.`);
  process.exit(1);
}

// 3. Scan all source files in src/ for token usage
function collectFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(collectFiles(fullPath, extensions));
    } else {
      if (extensions.some((ext) => file.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const sourceFiles = collectFiles(SRC_DIR, ['.css', '.tsx', '.ts']);
const VAR_USAGE_REGEX = /var\((--[a-zA-Z0-9_-]+)/g;

let missingTokenCount = 0;

for (const file of sourceFiles) {
  const relPath = path.relative(ROOT_DIR, file);
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  // Collect component-scoped CSS variables declared within this file
  const localDefs = new Set<string>();
  const LOCAL_DEF_REGEX = /^\s*(--[a-zA-Z0-9_-]+)\s*:/gm;
  let localMatch: RegExpExecArray | null;
  while ((localMatch = LOCAL_DEF_REGEX.exec(content)) !== null) {
    localDefs.add(localMatch[1].trim());
  }

  lines.forEach((line, idx) => {
    // Skip single-line comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || (trimmed.startsWith('/*') && trimmed.endsWith('*/'))) {
      return;
    }

    let usageMatch: RegExpExecArray | null;
    while ((usageMatch = VAR_USAGE_REGEX.exec(line)) !== null) {
      const usedToken = usageMatch[1];
      if (!definedTokens.has(usedToken) && !localDefs.has(usedToken)) {
        console.error(
          `❌ [${relPath}:${idx + 1}] Undefined token: "${usedToken}" in expression: "${line.trim()}"`
        );
        missingTokenCount++;
      }
    }
  });
}

if (missingTokenCount > 0) {
  console.error(
    `\n❌ Token Gate Failed: ${missingTokenCount} undefined or mismatched CSS token reference(s) found!`
  );
  process.exit(1);
}

console.log(`✅ [Token Gate] 100% token purity and alias verification passed! (${sourceFiles.length} files scanned)`);
process.exit(0);
