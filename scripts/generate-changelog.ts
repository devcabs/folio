/**
 * generate-changelog.ts
 *
 * CLI contract for generating and verifying CHANGELOG.md from src/migrations/ledger.ts.
 * Pre-wired in Task 1.9; ledger formatting implemented in Task 1.14.
 *
 * Flags:
 *   --output <path>   Target file path (defaults to ./CHANGELOG.md)
 *   --dry-run         Print generated changelog to stdout without writing to disk
 *   --verify          Compare in-memory generated changelog against --output file
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_OUTPUT_PATH = './CHANGELOG.md';
const MAX_DIFF_LINES = 20;

export interface ChangelogCliOptions {
  outputPath: string;
  isDryRun: boolean;
  isVerify: boolean;
}

export interface ChangelogCliDeps {
  generate?: () => string;
  cwd?: string;
  writeStdout?: (text: string) => void;
  writeStderr?: (text: string) => void;
}

/**
 * Parse CLI flags from argv (without external flag-parsing libraries).
 */
export function parseChangelogArgs(argv: string[]): ChangelogCliOptions {
  let outputPath = DEFAULT_OUTPUT_PATH;
  let isDryRun = false;
  let isVerify = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--dry-run') {
      isDryRun = true;
      continue;
    }

    if (arg === '--verify') {
      isVerify = true;
      continue;
    }

    if (arg === '--output') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('Missing value for --output flag. Expected: --output <path>');
      }
      outputPath = next;
      i++;
      continue;
    }

    if (arg.startsWith('--output=')) {
      const value = arg.slice('--output='.length);
      if (!value) {
        throw new Error('Missing value for --output= flag. Expected: --output=<path>');
      }
      outputPath = value;
      continue;
    }

    throw new Error(`Unknown flag: "${arg}". Supported flags: --output <path>, --dry-run, --verify`);
  }

  if (isDryRun && isVerify) {
    throw new Error('--dry-run and --verify are mutually exclusive.');
  }

  return { outputPath, isDryRun, isVerify };
}

/**
 * Generate the formatted CHANGELOG.md contents.
 */
export function generateChangelog(): string {
  // TODO (task 1.14): Import FOLIO_MIGRATION_LEDGER and format CHANGELOG.md
  return '';
}

/**
 * Build a human-readable line-level diff summary between expected and actual file contents.
 */
export function summarizeDiff(expected: string, actual: string, outputPath: string): string {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const maxLines = Math.max(expectedLines.length, actualLines.length);
  const diffEntries: string[] = [];

  for (let i = 0; i < maxLines; i++) {
    const expLine = expectedLines[i];
    const actLine = actualLines[i];
    if (expLine === actLine) continue;

    diffEntries.push(`  Line ${i + 1}:`);
    if (actLine !== undefined) diffEntries.push(`    - ${actLine}`);
    if (expLine !== undefined) diffEntries.push(`    + ${expLine}`);
  }

  const shown = diffEntries.slice(0, MAX_DIFF_LINES * 3);
  const omittedCount = diffEntries.length - shown.length;

  const lines = [
    `❌ Changelog mismatch at ${outputPath} (expected ${expectedLines.length} lines, found ${actualLines.length} lines):`,
    ...shown,
  ];

  if (omittedCount > 0) {
    lines.push(`  ... (${omittedCount} more diff lines omitted)`);
  }

  return lines.join('\n');
}

/**
 * Execute the changelog CLI command and return a POSIX exit code (0 or 1).
 */
export function runChangelogCli(options: ChangelogCliOptions, deps: ChangelogCliDeps = {}): number {
  const generate = deps.generate ?? generateChangelog;
  const cwd = deps.cwd ?? process.cwd();
  const writeStdout = deps.writeStdout ?? ((text: string) => process.stdout.write(text));
  const writeStderr = deps.writeStderr ?? ((text: string) => process.stderr.write(text));

  const resolvedOutput = path.resolve(cwd, options.outputPath);
  const generated = generate();

  if (options.isVerify) {
    if (!fs.existsSync(resolvedOutput)) {
      if (generated === '') {
        writeStdout(
          `✓ No ${options.outputPath} on disk yet and generated output is empty (stub); nothing to verify.\n`
        );
        return 0;
      }
      writeStderr(
        `❌ Changelog verification failed: ${options.outputPath} does not exist (expected ${generated.split('\n').length} lines).\n`
      );
      return 1;
    }

    const existing = fs.readFileSync(resolvedOutput, 'utf-8');
    if (existing === generated) {
      writeStdout(`✓ ${options.outputPath} is up to date.\n`);
      return 0;
    }

    writeStderr(`${summarizeDiff(generated, existing, options.outputPath)}\n`);
    return 1;
  }

  if (options.isDryRun) {
    writeStdout(generated);
    return 0;
  }

  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, generated, 'utf-8');
  return 0;
}

function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  }
}

if (isMainModule()) {
  try {
    const options = parseChangelogArgs(process.argv.slice(2));
    const exitCode = runChangelogCli(options);
    process.exit(exitCode);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

