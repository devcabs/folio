import * as fs from 'fs';
import * as path from 'path';

function findCssModuleFiles(dir: string): string[] {
  let results: string[] = [];
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

const files = findCssModuleFiles(path.resolve(process.cwd(), 'src'));
let failureCount = 0;

console.log('--- CSS Module Token Purity Audit ---');

for (const file of files) {
  const relPath = path.relative(process.cwd(), file);
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) {
      return;
    }

    const hexMatches = line.match(HEX_COLOR_REGEX);
    if (hexMatches) {
      console.error(`❌ [${relPath}:${idx + 1}] Hardcoded HEX color: ${hexMatches.join(', ')} -> Line: "${line.trim()}"`);
      failureCount++;
    }

    const rgbaMatches = line.match(RAW_RGBA_REGEX);
    if (rgbaMatches) {
      console.error(`❌ [${relPath}:${idx + 1}] Hardcoded RGBA color: ${rgbaMatches.join(', ')} -> Line: "${line.trim()}"`);
      failureCount++;
    }
  });
}

if (failureCount > 0) {
  console.error(`\n❌ Token purity check failed: Found ${failureCount} hardcoded color instances in CSS modules.`);
  process.exit(1);
} else {
  console.log('\n✅ Token purity check passed: 100% token adherence in all CSS modules.');
  process.exit(0);
}
