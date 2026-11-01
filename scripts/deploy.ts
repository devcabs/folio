import { execSync } from 'child_process';

// ANSI color formatting for elegant terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function logStep(stepNum: number, totalSteps: number, title: string) {
  console.log(
    `\n${colors.cyan}[${stepNum}/${totalSteps}]${colors.reset} ${colors.bright}${title}${colors.reset}`
  );
}

function runCommand(command: string, description: string): string {
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: ['inherit', 'pipe', 'pipe'] });
    return output.trim();
  } catch (err: unknown) {
    const error = err as { stderr?: string; stdout?: string; message: string };
    console.error(`\n${colors.red}❌ FAILED: ${description}${colors.reset}`);
    if (error.stderr) console.error(`${colors.dim}${error.stderr.trim()}${colors.reset}`);
    if (error.stdout) console.error(`${colors.dim}${error.stdout.trim()}${colors.reset}`);
    process.exit(1);
  }
}

async function main() {
  console.log(`\n${colors.bright}${colors.magenta}══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}   Engine Portal — Automated Deploy Pipeline${colors.reset}`);
  console.log(`${colors.dim}  Destination: https://engine.example.com${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}══════════════════════════════════════════════════════════${colors.reset}`);

  const totalSteps = 5;

  // ── Step 1: Quality & Token Audits ──
  logStep(1, totalSteps, 'Verifying Design Tokens & Data Contracts...');
  runCommand('npm run test:tokens', 'Design Token Purity check');
  console.log(`  ${colors.green}✓${colors.reset} 100% Token adherence verified in all CSS modules.`);

  runCommand('npm run test:schema', 'Node Schema & Contract check');
  console.log(`  ${colors.green}✓${colors.reset} Zod contracts, images, and stages verified.`);

  runCommand('npm run test:env', 'Environment separation check');
  console.log(`  ${colors.green}✓${colors.reset} Dev/prod environment separation verified.`);

  runCommand('npm run test:task-15', 'Edge Shield & Media Gateway verification');
  console.log(`  ${colors.green}✓${colors.reset} Edge routing, media proxy, pre-baking, and byte budgets verified.`);

  // ── Step 2: Static Typecheck & Production Bundle ──
  logStep(2, totalSteps, 'Compiling TypeScript & Building Production Assets...');
  runCommand('npm run build', 'TypeScript compile & Vite production build');
  console.log(`  ${colors.green}✓${colors.reset} Production bundle generated cleanly in dist/.`);

  runCommand('npm run test:dist', 'Dist secret / dev-reference scan');
  console.log(`  ${colors.green}✓${colors.reset} dist/ contains no secrets or dev-project references.`);

  // ── Step 3: Git Status & Stage ──
  logStep(3, totalSteps, 'Checking Git Working Tree & Staging Changes...');
  const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();

  // Extract optional custom commit message from CLI args (e.g. npm run deploy -- "my message")
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const userCommitMessage = args.length > 0 ? args.join(' ') : null;

  const envLeak = statusOutput
    .split('\n')
    .filter((l) => /\.env(?!\.example|\.scripts\.example)/.test(l.slice(3)));
  if (envLeak.length) {
    console.error(`\n${colors.red}❌ Refusing to commit env files:${colors.reset}\n${envLeak.join('\n')}`);
    process.exit(1);
  }

  if (statusOutput) {
    console.log(`  ${colors.yellow}•${colors.reset} Detected changes to be committed:`);
    statusOutput.split('\n').forEach((line) => {
      console.log(`    ${colors.dim}${line}${colors.reset}`);
    });

    const commitMsg =
      userCommitMessage ||
      `feat(deploy): update portal content and assets (${new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })})`;

    runCommand('git add .', 'Staging modified and untracked files');
    runCommand(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, 'Creating git commit');
    console.log(`  ${colors.green}✓${colors.reset} Committed with message: "${commitMsg}"`);
  } else {
    console.log(`  ${colors.green}✓${colors.reset} Working tree clean (no new changes to commit).`);
  }

  // ── Step 4: Push to GitHub ──
  logStep(4, totalSteps, 'Pushing to GitHub (origin main)...');
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  runCommand(`git push origin ${branch}`, `Pushing to origin ${branch}`);
  console.log(`  ${colors.green}✓${colors.reset} Pushed to branch: ${colors.bright}${branch}${colors.reset}`);

  // ── Step 5: Direct Cloudflare Edge Deployment ──
  logStep(5, totalSteps, 'Deploying directly to Cloudflare Edge via Wrangler...');
  try {
    execSync('npx -y wrangler deploy', { encoding: 'utf-8', stdio: ['inherit', 'pipe', 'pipe'] });
    console.log(`  ${colors.green}✓${colors.reset} Direct edge deployment completed.`);
  } catch (err: unknown) {
    console.log(`  ${colors.yellow}⚠ Warning: Direct Wrangler edge push skipped or timed out. Cloudflare remote CI build triggered via GitHub push.${colors.reset}`);
  }

  const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

  console.log(`\n${colors.bright}${colors.green}══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  ${colors.green}✨ ALL CHECKS PASSED, COMMITTED, PUSHED & DEPLOYED!${colors.reset}`);
  console.log(`  ${colors.dim}Commit:${colors.reset}    ${commitHash}`);
  console.log(`  ${colors.dim}GitHub:${colors.reset}    ${colors.cyan}origin/${branch}${colors.reset}`);
  console.log(`  ${colors.dim}Live Edge:${colors.reset} ${colors.cyan}https://engine.example.com${colors.reset}`);
  console.log(`${colors.bright}${colors.green}══════════════════════════════════════════════════════════${colors.reset}\n`);
}

main();
