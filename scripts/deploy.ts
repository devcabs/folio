import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { calculateTargetVersion, compareSemver } from './lib/semver-utils.js';

// ANSI color formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function logStep(stepNum: number, totalSteps: number, title: string) {
  console.log(`\n${colors.cyan}[${stepNum}/${totalSteps}]${colors.reset} ${colors.bright}${title}${colors.reset}`);
}

function run(command: string, description: string, stdio: 'inherit' | 'pipe' = 'inherit'): string {
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: ['inherit', stdio, stdio] });
    return (output || '').trim();
  } catch (err: unknown) {
    const error = err as { stderr?: string; stdout?: string; message: string };
    console.error(`\n${colors.red}❌ FAILED: ${description}${colors.reset}`);
    if (error.stderr) console.error(`${colors.dim}${error.stderr.trim()}${colors.reset}`);
    if (error.stdout) console.error(`${colors.dim}${error.stdout.trim()}${colors.reset}`);
    process.exit(1);
  }
}

function getOutput(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
  } catch {
    return '';
  }
}

function printMissingLedgerEntry(targetVersion: string, c: typeof colors): void {
  console.error(`${c.dim}  {
    version: '${targetVersion}',
    releaseDate: 'YYYY-MM-DD',
    title: 'Release title',
    summary: 'Brief summary of this release.',
    breakingChanges: ['Describe breaking change here'],
    codeActions: [],
    contentChanges: ['Describe content change here'],
  }${c.reset}\n`);
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, '..');
  process.chdir(rootDir);

  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const pkgName = pkg.name || '@devcabs/folio-engine';
  const currentVersion = pkg.version || '0.0.0';

  console.log(`\n${colors.bright}${colors.blue}══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}   ${pkgName} — Automated Release & Deploy${colors.reset}`);
  console.log(`${colors.dim}   Current Version: v${currentVersion}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}══════════════════════════════════════════════════════════${colors.reset}`);

  const totalSteps = 7;

  // Parse bump argument: patch | minor | major | explicit semver (default: patch)
  const rawArg = process.argv.slice(2).find((arg) => !arg.startsWith('-')) || 'patch';
  const validBumps = ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease'];
  const isSemver = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(rawArg);

  if (!validBumps.includes(rawArg) && !isSemver) {
    console.error(`\n${colors.red}❌ Invalid version bump target: "${rawArg}"${colors.reset}`);
    console.error(`Valid options: ${validBumps.join(', ')} or explicit semver (e.g. 0.2.0)\n`);
    process.exit(1);
  }
  const bumpType = rawArg;

  // ── Step 1: Verify No Pending Tracked File Changes ──
  logStep(1, totalSteps, 'Checking working directory for pending tracked changes...');

  const trackedStatus = getOutput('git status --porcelain -uno');

  if (trackedStatus) {
    console.error(`\n${colors.red}❌ Pending tracked file changes detected!${colors.reset}`);
    console.error(`You have uncommitted changes in tracked files:\n`);
    trackedStatus.split('\n').filter(Boolean).forEach((line) => {
      const match = line.match(/^\s*([A-Z?]{1,2})\s+(.+)$/);
      const code = match ? match[1] : 'M';
      const file = match ? match[2] : line.trim();
      console.error(`   ${colors.yellow}[${code}]${colors.reset} ${file}`);
    });
    console.error(`\nPlease commit and push your changes before deploying:`);
    console.error(`  ${colors.cyan}git add -A${colors.reset}`);
    console.error(`  ${colors.cyan}git commit -m "your commit message"${colors.reset}`);
    console.error(`  ${colors.cyan}git push${colors.reset}\n`);
    process.exit(1);
  }
  console.log(`  ${colors.green}✓${colors.reset} No pending tracked changes. Working tree clean.`);

  // ── Step 2: Verify Git Sync with Remote (Check if Git Pushed Already) ──
  logStep(2, totalSteps, 'Verifying local branch is pushed to remote (GitHub)...');

  const branch = getOutput('git rev-parse --abbrev-ref HEAD') || 'main';

  // Fetch remote silently
  try {
    execSync(`git fetch origin ${branch}`, { stdio: 'ignore' });
  } catch {
    console.log(`  ${colors.yellow}⚠ Warning: Could not fetch from origin. Checking local upstream status...${colors.reset}`);
  }

  // Check upstream tracking or origin/<branch>
  let upstream = getOutput('git rev-parse --verify @{u}');
  if (!upstream) {
    upstream = getOutput(`git rev-parse --verify origin/${branch}`);
  }

  if (upstream) {
    const localHash = getOutput('git rev-parse HEAD');
    const upstreamHash = getOutput('git rev-parse @{u}') || getOutput(`git rev-parse origin/${branch}`);

    if (localHash !== upstreamHash) {
      const ahead = parseInt(getOutput(`git rev-list origin/${branch}..HEAD --count`) || '0', 10);
      const behind = parseInt(getOutput(`git rev-list HEAD..origin/${branch} --count`) || '0', 10);

      if (ahead > 0 && behind > 0) {
        console.error(`\n${colors.red}❌ Git branch and remote have diverged!${colors.reset}`);
        console.error(`Your local branch is ahead by ${colors.bright}${ahead}${colors.reset} commit(s) and behind remote by ${colors.bright}${behind}${colors.reset} commit(s).\n`);
        console.error(`Please push or sync with remote before deploying:`);
        console.error(`  ${colors.cyan}git push origin ${branch}${colors.reset}\n`);
        process.exit(1);
      } else if (ahead > 0) {
        console.error(`\n${colors.red}❌ Git changes not pushed!${colors.reset}`);
        console.error(`Your local branch '${branch}' has ${colors.bright}${ahead}${colors.reset} unpushed commit(s).\n`);
        console.error(`Please push your commits first:`);
        console.error(`  ${colors.cyan}git push origin ${branch}${colors.reset}\n`);
        process.exit(1);
      } else if (behind > 0) {
        console.error(`\n${colors.red}❌ Local branch is behind remote!${colors.reset}`);
        console.error(`Your branch '${branch}' is behind 'origin/${branch}' by ${colors.bright}${behind}${colors.reset} commit(s).\n`);
        console.error(`Please pull latest changes first:`);
        console.error(`  ${colors.cyan}git pull origin ${branch}${colors.reset}\n`);
        process.exit(1);
      }
    }
    console.log(`  ${colors.green}✓${colors.reset} Branch is in sync with origin/${branch} (all commits pushed).`);
  } else {
    console.log(`  ${colors.yellow}⚠ Upstream not set; proceeding with caution.${colors.reset}`);
  }

  // ── Step 3: Run Quality & Token Audits ──
  logStep(3, totalSteps, 'Running verification checks & test builds...');
  run('npm run test:tokens', 'Design token alias & purity validation');
  console.log(`  ${colors.green}✓${colors.reset} Token verification passed.`);

  run('npm run build:lib', 'Library compilation & type generation');
  console.log(`  ${colors.green}✓${colors.reset} Library bundle and declaration files generated.`);

  // ── Step 3.5: Ledger Pre-Flight Check ──
  logStep(4, totalSteps, 'Ledger Pre-Flight Check (migration ledger gate)...');

  const targetVersion = calculateTargetVersion(currentVersion, bumpType);
  console.log(`  ${colors.dim}  Target version:${colors.reset} ${colors.bright}v${targetVersion}${colors.reset}`);

  const ledgerPath = path.join(rootDir, 'src', 'migrations', 'ledger.ts');

  if (!fs.existsSync(ledgerPath)) {
    console.error(`\n${colors.red}❌ DEPLOY BLOCKED: Migration ledger not found at src/migrations/ledger.ts!${colors.reset}`);
    console.error(`\nCreate the file and add the following entry BEFORE running deploy:\n`);
    printMissingLedgerEntry(targetVersion, colors);
    process.exit(1);
  }

  const ledgerText = fs.readFileSync(ledgerPath, 'utf-8');

  // Extract all version strings present in the ledger.
  const versionRe = /version:\s*['"](\d+\.\d+\.\d+[^'"]*)['"]/g;
  const foundVersions: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = versionRe.exec(ledgerText)) !== null) {
    foundVersions.push(m[1]);
  }

  if (!foundVersions.includes(targetVersion)) {
    console.error(`\n${colors.red}❌ DEPLOY BLOCKED: Missing migration ledger entry for v${targetVersion}!${colors.reset}`);
    console.error(`\nAdd the following entry to src/migrations/ledger.ts BEFORE running deploy:\n`);
    printMissingLedgerEntry(targetVersion, colors);
    process.exit(1);
  }

  // Confirm the found entry has non-empty breakingChanges and contentChanges.
  // We locate the version's block by finding its position and scanning forward
  // to the next version block (or end of array literal).
  const versionIdx = ledgerText.indexOf(`version: '${targetVersion}'`) !== -1
    ? ledgerText.indexOf(`version: '${targetVersion}'`)
    : ledgerText.indexOf(`version: "${targetVersion}"`);

  // Find the closing bracket of this entry's object (heuristic: next top-level `}`).
  const entrySlice = ledgerText.slice(versionIdx);
  const nextEntryStart = entrySlice.search(/},\s*\{/) !== -1
    ? versionIdx + entrySlice.search(/},\s*\{/) + 1
    : ledgerText.length;
  const entryBlock = ledgerText.slice(versionIdx, nextEntryStart);

  const hasBreakingChanges = /breakingChanges:\s*\[[^\]]*\S[^\]]*\]/.test(entryBlock);
  const hasContentChanges = /contentChanges:\s*\[[^\]]*\S[^\]]*\]/.test(entryBlock);

  if (!hasBreakingChanges || !hasContentChanges) {
    const missing: string[] = [];
    if (!hasBreakingChanges) missing.push('breakingChanges (must be a non-empty array)');
    if (!hasContentChanges) missing.push('contentChanges (must be a non-empty array)');

    console.error(`\n${colors.red}❌ DEPLOY BLOCKED: Incomplete migration ledger entry for v${targetVersion}!${colors.reset}`);
    console.error(`\nMissing required fields in the ledger entry:`);
    missing.forEach((f) => console.error(`  ${colors.yellow}•${colors.reset} ${f}`));
    console.error(`\nUpdate the entry in src/migrations/ledger.ts to include non-empty arrays for all required fields.\n`);
    process.exit(1);
  }

  // Also assert target > current as a sanity guard.
  if (compareSemver(targetVersion, currentVersion) <= 0) {
    console.error(`\n${colors.red}❌ DEPLOY BLOCKED: Target version v${targetVersion} is not greater than current v${currentVersion}.${colors.reset}`);
    process.exit(1);
  }

  console.log(`  ${colors.green}✓${colors.reset} Ledger entry confirmed for ${colors.bright}v${targetVersion}${colors.reset} with breakingChanges and contentChanges.`);

  // ── Step 5: Bump Version & Create Release Tag ──
  logStep(5, totalSteps, `Bumping version (${bumpType})...`);
  run(`npm version ${bumpType} -m "chore(release): %s"`, `Bumping version via npm version ${bumpType}`);

  // Re-read updated package.json
  const updatedPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const newVersion = updatedPkg.version;
  console.log(`  ${colors.green}✓${colors.reset} Version bumped: ${colors.dim}v${currentVersion}${colors.reset} ➔ ${colors.bright}${colors.green}v${newVersion}${colors.reset}`);

  // ── Step 6: Publish to npm ──
  logStep(6, totalSteps, `Publishing ${pkgName}@${newVersion} to npm...`);
  run('npm publish', `Publishing to npm registry`);
  console.log(`  ${colors.green}✓${colors.reset} Successfully published ${pkgName}@${newVersion} to npm!`);

  // ── Step 7: Push Release Commit & Tag to GitHub ──
  logStep(7, totalSteps, `Pushing release commit and tag (v${newVersion}) to GitHub...`);
  run(`git push origin ${branch} --follow-tags`, `Pushing release commit and tags to origin/${branch}`);
  console.log(`  ${colors.green}✓${colors.reset} Pushed to GitHub with tags.`);

  // ── Done Summary ──
  console.log(`\n${colors.bright}${colors.green}══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  ${colors.green}🚀 RELEASE & DEPLOY COMPLETE!${colors.reset}`);
  console.log(`  ${colors.dim}Package:${colors.reset}      ${colors.bright}${pkgName}${colors.reset}`);
  console.log(`  ${colors.dim}Live Version:${colors.reset} ${colors.cyan}v${newVersion}${colors.reset}`);
  console.log(`  ${colors.dim}GitHub Tag:${colors.reset}   ${colors.cyan}v${newVersion}${colors.reset}`);
  console.log(`\n  ${colors.bright}To update consumer project (e.g. consumer-portal):${colors.reset}`);
  console.log(`    ${colors.yellow}npm install ${pkgName}@latest${colors.reset}`);
  console.log(`${colors.bright}${colors.green}══════════════════════════════════════════════════════════${colors.reset}\n`);
}

main();
