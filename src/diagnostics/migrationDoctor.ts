/**
 * Folio Engine — Migration Doctor & CLI Diagnostics
 * Location: src/diagnostics/migrationDoctor.ts
 *
 * Inspects the consumer's installed `@devcabs/folio-engine` version, consumer
 * `package.json`, and local content/setup files using monorepo-safe resolution,
 * compares against `FOLIO_MIGRATION_LEDGER`, and outputs ANSI-styled or JSON
 * migration guidance with an actionable AI Agent Prompt Block.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveInstalledEngineVersion,
  resolveConsumerPackageJson,
  resolveContentFiles,
  type InstalledEngineInfo,
  type ConsumerPackageInfo,
} from './packageResolver';
import { FOLIO_MIGRATION_LEDGER, compareSemver } from '../migrations/ledger';
import { isValidSemver } from '../utils/semver-utils';
import { generateAiMigrationPrompt } from '../utils/migrationPromptFormatter';
import type {
  CodeMigration,
  ContentMigration,
  MigrationEntry,
  PendingMigrationReport,
} from '../types/migration';

export type DoctorOutputFormat = 'text' | 'json';

export interface MigrationDoctorOptions {
  cwd?: string;
  format?: DoctorOutputFormat;
  fromVersion?: string;
  noColor?: boolean;
  ledger?: MigrationEntry[];
  log?: (message: string) => void;
}

export interface ParsedDoctorArgs {
  format: DoctorOutputFormat;
  fromVersion?: string;
  cwd?: string;
  noColor: boolean;
  help: boolean;
}

export interface VersionedBreakingChanges {
  version: string;
  releaseDate: string;
  title: string;
  changes: string[];
}

export interface VersionedCodeActions {
  version: string;
  actions: CodeMigration[];
}

export interface VersionedContentChanges {
  version: string;
  changes: ContentMigration[];
}

export interface MigrationDoctorReport {
  ok: boolean;
  status: 'not-installed' | 'up-to-date' | 'migrations-pending';
  installedEngine: InstalledEngineInfo | null;
  consumerPackage: ConsumerPackageInfo | null;
  latestEngineVersion: string;
  baselineVersion: string | null;
  detectedContentVersion: string | null;
  detectedFiles: string[];
  pendingVersions: string[];
  breakingChanges: VersionedBreakingChanges[];
  codeActions: VersionedCodeActions[];
  contentChanges: VersionedContentChanges[];
  pendingMigrationReport: PendingMigrationReport | null;
  agentPrompt: string | null;
  warnings: string[];
}

const FALLBACK_CONFIG_FILES = [
  'src/App.tsx',
  'src/App.ts',
  'src/main.tsx',
  'src/main.ts',
] as const;

const CONTENT_VERSION_PATTERNS = [
  /contentVersion\s*:\s*['"](\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?)['"]/,
  /"contentVersion"\s*:\s*"(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?)"/,
];

function createAnsiStyler(useColor: boolean) {
  const wrap = (code: string) => (text: string) =>
    useColor ? `\x1b[${code}m${text}\x1b[0m` : text;

  return {
    bold: wrap('1'),
    dim: wrap('2'),
    red: wrap('31'),
    green: wrap('32'),
    yellow: wrap('33'),
    blue: wrap('34'),
    cyan: wrap('36'),
  };
}

function shouldUseColor(noColor?: boolean): boolean {
  if (noColor) return false;
  if (typeof process !== 'undefined' && process.env && 'NO_COLOR' in process.env) {
    return false;
  }
  return true;
}

/**
 * Parses CLI flags for the migration doctor command.
 */
export function parseDoctorArgs(argv: string[]): ParsedDoctorArgs {
  let format: DoctorOutputFormat = 'text';
  let fromVersion: string | undefined;
  let cwd: string | undefined;
  let noColor = false;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }

    if (arg === '--no-color') {
      noColor = true;
      continue;
    }

    if (arg === '--json') {
      format = 'json';
      continue;
    }

    if (arg === '--format') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('Missing value for --format. Expected "text" or "json".');
      }
      if (next !== 'text' && next !== 'json') {
        throw new Error(`Invalid --format value "${next}". Expected "text" or "json".`);
      }
      format = next;
      i++;
      continue;
    }

    if (arg.startsWith('--format=')) {
      const value = arg.slice('--format='.length);
      if (value !== 'text' && value !== 'json') {
        throw new Error(`Invalid --format value "${value}". Expected "text" or "json".`);
      }
      format = value;
      continue;
    }

    if (arg === '--from') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('Missing value for --from. Expected a semver string (e.g. 0.1.2).');
      }
      if (!isValidSemver(next)) {
        throw new Error(`Invalid --from semver "${next}". Expected bare semver (e.g. 0.1.2).`);
      }
      fromVersion = next;
      i++;
      continue;
    }

    if (arg.startsWith('--from=')) {
      const value = arg.slice('--from='.length);
      if (!isValidSemver(value)) {
        throw new Error(`Invalid --from semver "${value}". Expected bare semver (e.g. 0.1.2).`);
      }
      fromVersion = value;
      continue;
    }

    if (arg === '--cwd') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('Missing value for --cwd. Expected a directory path.');
      }
      cwd = next;
      i++;
      continue;
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length);
      if (!value) {
        throw new Error('Missing value for --cwd=. Expected a directory path.');
      }
      cwd = value;
      continue;
    }

    throw new Error(
      `Unknown flag "${arg}". Supported flags: --format <text|json>, --from <semver>, --cwd <path>, --no-color, --help`
    );
  }

  return { format, fromVersion, cwd, noColor, help };
}

/**
 * Attempts to detect `contentVersion` configured in consumer setup or entry files.
 * Never throws; returns null when no valid semver watermark is present.
 */
function detectConsumerContentVersion(
  consumerRoot: string,
  detectedFiles: string[]
): string | null {
  const candidates = new Set<string>(detectedFiles);
  for (const rel of FALLBACK_CONFIG_FILES) {
    const full = path.join(consumerRoot, rel);
    if (fs.existsSync(full)) {
      candidates.add(full);
    }
  }

  for (const filePath of candidates) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const pattern of CONTENT_VERSION_PATTERNS) {
        const match = content.match(pattern);
        if (match && match[1] && isValidSemver(match[1])) {
          return match[1];
        }
      }
    } catch {
      // Ignore unreadable files and continue scanning.
    }
  }

  return null;
}

/**
 * Builds an actionable AI migration prompt block combining breaking code changes,
 * code actions, and content migrations for pending releases.
 */
function buildDoctorAgentPrompt(
  baselineVersion: string,
  targetVersion: string,
  breakingChanges: VersionedBreakingChanges[],
  codeActions: VersionedCodeActions[],
  pendingMigrationReport: PendingMigrationReport
): string {
  const sections: string[] = [
    `Update this consumer application for @devcabs/folio-engine from v${baselineVersion} -> v${targetVersion}.`,
  ];

  if (breakingChanges.length > 0) {
    const lines = ['### Breaking Changes to Address'];
    for (const item of breakingChanges) {
      for (const change of item.changes) {
        lines.push(`- [v${item.version}] ${change}`);
      }
    }
    sections.push(lines.join('\n'));
  }

  if (codeActions.length > 0) {
    const lines = ['### Required Code Actions'];
    for (const group of codeActions) {
      for (const action of group.actions) {
        const files =
          action.affectedFiles && action.affectedFiles.length > 0
            ? ` (Files: ${action.affectedFiles.join(', ')})`
            : '';
        lines.push(`- [v${group.version}] ${action.description}${files}`);
        if (action.exampleBefore) {
          lines.push(`  Before:\n  \`\`\`ts\n  ${action.exampleBefore}\n  \`\`\``);
        }
        if (action.exampleAfter) {
          lines.push(`  After:\n  \`\`\`ts\n  ${action.exampleAfter}\n  \`\`\``);
        }
      }
    }
    sections.push(lines.join('\n'));
  }

  sections.push(generateAiMigrationPrompt(pendingMigrationReport));
  return sections.join('\n\n');
}

/**
 * Computes a complete structured migration diagnostic report for a workspace.
 */
export function buildMigrationDoctorReport(
  options: MigrationDoctorOptions = {}
): MigrationDoctorReport {
  const cwd = options.cwd ?? process.cwd();
  const warnings: string[] = [];

  const sortedLedger = [...(options.ledger ?? FOLIO_MIGRATION_LEDGER)].sort((a, b) =>
    compareSemver(a.version, b.version)
  );
  const latestLedgerEntry = sortedLedger[sortedLedger.length - 1];

  const engineInfo = resolveInstalledEngineVersion(cwd);
  if (!engineInfo) {
    warnings.push(
      'Could not resolve @devcabs/folio-engine installation. Run from within a project that has @devcabs/folio-engine installed.'
    );
    return {
      ok: false,
      status: 'not-installed',
      installedEngine: null,
      consumerPackage: null,
      latestEngineVersion: latestLedgerEntry?.version ?? '0.0.0',
      baselineVersion: null,
      detectedContentVersion: null,
      detectedFiles: [],
      pendingVersions: [],
      breakingChanges: [],
      codeActions: [],
      contentChanges: [],
      pendingMigrationReport: null,
      agentPrompt: null,
      warnings,
    };
  }

  const consumerInfo = resolveConsumerPackageJson(cwd);
  if (!consumerInfo) {
    warnings.push('Could not resolve consumer package.json. Continuing with reduced diagnostics.');
  }

  const consumerRoot = consumerInfo ? path.dirname(consumerInfo.path) : cwd;
  const detectedFiles = consumerInfo ? resolveContentFiles(consumerRoot) : [];
  const detectedContentVersion = detectConsumerContentVersion(consumerRoot, detectedFiles);

  const latestEngineVersion = latestLedgerEntry?.version ?? engineInfo.version;
  const targetVersion =
    isValidSemver(engineInfo.version) &&
    isValidSemver(latestEngineVersion) &&
    compareSemver(engineInfo.version, latestEngineVersion) > 0
      ? engineInfo.version
      : latestEngineVersion;

  let baselineVersion = engineInfo.version;
  if (options.fromVersion) {
    if (!isValidSemver(options.fromVersion)) {
      throw new Error(`Invalid fromVersion semver: "${options.fromVersion}"`);
    }
    baselineVersion = options.fromVersion;
  } else if (
    detectedContentVersion &&
    isValidSemver(engineInfo.version) &&
    compareSemver(detectedContentVersion, engineInfo.version) < 0
  ) {
    baselineVersion = detectedContentVersion;
  }

  const pendingEntries = isValidSemver(baselineVersion) && isValidSemver(targetVersion)
    ? sortedLedger.filter(
        (entry) =>
          compareSemver(entry.version, baselineVersion) > 0 &&
          compareSemver(entry.version, targetVersion) <= 0
      )
    : [];

  const pendingVersions = pendingEntries.map((entry) => entry.version);
  const breakingChanges: VersionedBreakingChanges[] = pendingEntries
    .filter((entry) => entry.breakingChanges.length > 0)
    .map((entry) => ({
      version: entry.version,
      releaseDate: entry.releaseDate,
      title: entry.title,
      changes: entry.breakingChanges,
    }));

  const codeActions: VersionedCodeActions[] = pendingEntries
    .filter((entry) => entry.codeActions.length > 0)
    .map((entry) => ({
      version: entry.version,
      actions: entry.codeActions,
    }));

  const contentChanges: VersionedContentChanges[] = pendingEntries
    .filter((entry) => entry.contentChanges.length > 0)
    .map((entry) => ({
      version: entry.version,
      changes: entry.contentChanges,
    }));

  const allContentChanges = contentChanges.flatMap((group) => group.changes);
  const pendingMigrationReport: PendingMigrationReport = {
    currentEngineVersion: targetVersion,
    contentVersionWatermark: isValidSemver(baselineVersion) ? baselineVersion : '0.0.0',
    hasPendingContentChanges: allContentChanges.length > 0,
    pendingContentChanges: allContentChanges,
    unappliedVersions: pendingVersions,
  };

  const hasPending = pendingVersions.length > 0;
  const agentPrompt = hasPending
    ? buildDoctorAgentPrompt(
        baselineVersion,
        targetVersion,
        breakingChanges,
        codeActions,
        pendingMigrationReport
      )
    : null;

  return {
    ok: true,
    status: hasPending ? 'migrations-pending' : 'up-to-date',
    installedEngine: engineInfo,
    consumerPackage: consumerInfo,
    latestEngineVersion,
    baselineVersion,
    detectedContentVersion,
    detectedFiles,
    pendingVersions,
    breakingChanges,
    codeActions,
    contentChanges,
    pendingMigrationReport,
    agentPrompt,
    warnings,
  };
}

/**
 * Formats a MigrationDoctorReport into clean ANSI-styled terminal output.
 */
export function formatMigrationDoctorReport(
  report: MigrationDoctorReport,
  options: { noColor?: boolean } = {}
): string {
  const ansi = createAnsiStyler(shouldUseColor(options.noColor));
  const lines: string[] = [];

  if (!report.installedEngine) {
    lines.push(ansi.yellow('⚠️  Could not resolve @devcabs/folio-engine installation.'));
    lines.push('Run from within a project that has @devcabs/folio-engine installed.');
    return lines.join('\n');
  }

  if (!report.consumerPackage) {
    lines.push(
      ansi.yellow('⚠️  Could not resolve consumer package.json. Continuing with reduced diagnostics.')
    );
  }

  lines.push(
    `📦 Installed @devcabs/folio-engine: ${ansi.bold(report.installedEngine.version)} ${ansi.dim(`(${report.installedEngine.pkgPath})`)}`
  );
  lines.push(`📚 Latest ledger version: ${ansi.bold(report.latestEngineVersion)}`);

  if (report.consumerPackage) {
    const consumerLabel = report.consumerPackage.name || '(unnamed package)';
    const consumerVersion = report.consumerPackage.version
      ? `@${report.consumerPackage.version}`
      : '';
    lines.push(
      `🏠 Consumer package: ${ansi.bold(`${consumerLabel}${consumerVersion}`)} ${ansi.dim(`(${report.consumerPackage.path})`)}`
    );

    if (report.detectedFiles.length > 0) {
      lines.push(
        `📄 Detected content/setup files (${report.detectedFiles.length}): ${report.detectedFiles.join(', ')}`
      );
    } else {
      lines.push('📄 No standard consumer content/setup files detected.');
    }
  }

  lines.push('');
  lines.push(ansi.bold(ansi.cyan('📦 Version Comparison')));
  lines.push(`  Installed Engine : ${report.installedEngine.version}`);
  lines.push(`  Latest Available : ${report.latestEngineVersion}`);
  if (report.detectedContentVersion) {
    lines.push(`  Content Watermark: ${report.detectedContentVersion} (detected in local setup)`);
  }
  if (report.baselineVersion) {
    lines.push(`  Audit Baseline   : ${report.baselineVersion}`);
  }

  if (report.status === 'up-to-date') {
    lines.push('');
    lines.push(
      ansi.green(
        `✅ Up to date! No pending migrations between v${report.baselineVersion} and v${report.latestEngineVersion}.`
      )
    );
    return lines.join('\n');
  }

  lines.push(
    `  Pending Releases : ${ansi.yellow(report.pendingVersions.map((v) => `v${v}`).join(', '))}`
  );

  if (report.breakingChanges.length > 0 || report.codeActions.length > 0) {
    lines.push('');
    lines.push(ansi.bold(ansi.red('🚨 Breaking Changes & Code Actions')));

    for (const entry of report.breakingChanges) {
      lines.push(ansi.bold(`  v${entry.version} — ${entry.title} (${entry.releaseDate})`));
      for (const change of entry.changes) {
        lines.push(`    • ${change}`);
      }
    }

    for (const group of report.codeActions) {
      for (const action of group.actions) {
        lines.push(ansi.yellow(`  [v${group.version}] Code Action: ${action.description}`));
        if (action.affectedFiles && action.affectedFiles.length > 0) {
          lines.push(ansi.dim(`    Affected files: ${action.affectedFiles.join(', ')}`));
        }
        if (action.exampleBefore) {
          lines.push(ansi.dim('    Before:'));
          lines.push('    ```ts');
          lines.push(`    ${action.exampleBefore}`);
          lines.push('    ```');
        }
        if (action.exampleAfter) {
          lines.push(ansi.dim('    After:'));
          lines.push('    ```ts');
          lines.push(`    ${action.exampleAfter}`);
          lines.push('    ```');
        }
      }
    }
  }

  if (report.contentChanges.length > 0) {
    lines.push('');
    lines.push(ansi.bold(ansi.blue('📝 Pending Content Changes')));
    for (const group of report.contentChanges) {
      for (const change of group.changes) {
        const badge = change.required
          ? ansi.red('[REQUIRED]')
          : ansi.cyan('[OPTIONAL]');
        lines.push(`  ${badge} ${ansi.bold(`[v${group.version}] ${change.title}`)}`);
        lines.push(`    ${change.description}`);
        if (change.affectedEntities && change.affectedEntities.length > 0) {
          lines.push(ansi.dim(`    Affected entities: ${change.affectedEntities.join(', ')}`));
        }
        if (change.migrationPrompt) {
          lines.push(`    Action: ${change.migrationPrompt}`);
        }
      }
    }
  }

  if (report.agentPrompt) {
    lines.push('');
    lines.push(ansi.bold(ansi.green('🤖 Agent Prompt Block')));
    lines.push('````markdown');
    lines.push(report.agentPrompt);
    lines.push('````');
  }

  return lines.join('\n');
}

/**
 * Formats the migration ledger as a newest-first Markdown changelog for CLI display.
 */
export function formatLedgerChangelog(ledger: MigrationEntry[] = FOLIO_MIGRATION_LEDGER): string {
  const descending = [...ledger].sort((a, b) => compareSemver(b.version, a.version));
  const blocks: string[] = ['# @devcabs/folio-engine Changelog'];

  for (const entry of descending) {
    const section: string[] = [
      `## v${entry.version} — ${entry.title} (${entry.releaseDate})`,
      '',
      entry.summary,
    ];

    if (entry.breakingChanges.length > 0) {
      section.push('', '### Breaking Changes');
      for (const item of entry.breakingChanges) {
        section.push(`- ${item}`);
      }
    }

    if (entry.codeActions.length > 0) {
      section.push('', '### Code Actions');
      for (const action of entry.codeActions) {
        section.push(`- ${action.description}`);
      }
    }

    if (entry.contentChanges.length > 0) {
      section.push('', '### Content Changes');
      for (const change of entry.contentChanges) {
        const tag = change.required ? 'REQUIRED' : 'OPTIONAL';
        section.push(`- [${tag}] **${change.title}**: ${change.description}`);
      }
    }

    blocks.push(section.join('\n'));
  }

  return blocks.join('\n\n');
}

/**
 * Reads `@devcabs/folio-engine` own package version from the package root.
 */
export function getEnginePackageVersion(): string {
  const candidates = ['../package.json', '../../package.json'];
  for (const rel of candidates) {
    try {
      const pkgPath = fileURLToPath(new URL(rel, import.meta.url));
      if (!fs.existsSync(pkgPath)) continue;
      const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
        name?: unknown;
        version?: unknown;
      };
      if (parsed.name === '@devcabs/folio-engine' && typeof parsed.version === 'string') {
        return parsed.version;
      }
    } catch {
      // Try next candidate path.
    }
  }
  const sorted = [...FOLIO_MIGRATION_LEDGER].sort((a, b) => compareSemver(a.version, b.version));
  return sorted[sorted.length - 1]?.version ?? '0.0.0';
}

function getDoctorHelpText(): string {
  return [
    'Usage: folio-engine <command> [options]',
    '',
    'Commands:',
    '  doctor, check     Inspect installed version, breaking changes, and pending migrations',
    '  changelog         Print release history from FOLIO_MIGRATION_LEDGER',
    '  version           Print installed @devcabs/folio-engine CLI version',
    '',
    'Options:',
    '  --format <type>   Output format: "text" (default) or "json"',
    '  --from <semver>   Compare migrations starting from an explicit baseline version',
    '  --cwd <path>      Target consumer directory (defaults to current working directory)',
    '  --no-color        Disable ANSI color output',
    '  -h, --help        Show this help message',
  ].join('\n');
}

/**
 * Runs the Folio Engine migration diagnostic check for the target workspace directory.
 * Returns a process exit code (`0` on completion or graceful configuration warning).
 */
export function runMigrationDoctor(options: MigrationDoctorOptions = {}): number {
  const log = options.log ?? console.log;
  const report = buildMigrationDoctorReport(options);

  if (options.format === 'json') {
    log(JSON.stringify(report, null, 2));
    return 0;
  }

  log(formatMigrationDoctorReport(report, { noColor: options.noColor }));
  return 0;
}

/**
 * Unified CLI router invoked by `bin/folio-engine.js`.
 */
export function runFolioCli(
  argv: string[],
  io: {
    log?: (msg: string) => void;
    error?: (msg: string) => void;
  } = {}
): number {
  const log = io.log ?? console.log;
  const error = io.error ?? console.error;
  const [rawCommand, ...rest] = argv;

  if (!rawCommand || rawCommand === 'help' || rawCommand === '--help' || rawCommand === '-h') {
    log(getDoctorHelpText());
    return 0;
  }

  if (rawCommand === 'version' || rawCommand === '--version' || rawCommand === '-v') {
    const version = getEnginePackageVersion();
    if (rest.includes('--format=json') || (rest.includes('--format') && rest[rest.indexOf('--format') + 1] === 'json') || rest.includes('--json')) {
      log(JSON.stringify({ name: '@devcabs/folio-engine', version }, null, 2));
    } else {
      log(`@devcabs/folio-engine v${version}`);
    }
    return 0;
  }

  if (rawCommand === 'changelog') {
    const wantsJson =
      rest.includes('--json') ||
      rest.includes('--format=json') ||
      (rest.includes('--format') && rest[rest.indexOf('--format') + 1] === 'json');

    if (wantsJson) {
      const descending = [...FOLIO_MIGRATION_LEDGER].sort((a, b) =>
        compareSemver(b.version, a.version)
      );
      log(JSON.stringify(descending, null, 2));
    } else {
      log(formatLedgerChangelog());
    }
    return 0;
  }

  if (rawCommand === 'doctor' || rawCommand === 'check') {
    try {
      const parsed = parseDoctorArgs(rest);
      if (parsed.help) {
        log(getDoctorHelpText());
        return 0;
      }
      return runMigrationDoctor({
        cwd: parsed.cwd,
        format: parsed.format,
        fromVersion: parsed.fromVersion,
        noColor: parsed.noColor,
        log,
      });
    } catch (err: unknown) {
      error(`❌ ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
  }

  error(`❌ Unknown command: "${rawCommand}".`);
  error(getDoctorHelpText());
  return 1;
}

function isCliEntrypoint(): boolean {
  try {
    if (
      typeof process === 'undefined' ||
      !Array.isArray(process.argv) ||
      typeof process.argv[1] !== 'string'
    ) {
      return false;
    }
    const scriptPath = fs.realpathSync(fileURLToPath(import.meta.url));
    const entryPath = fs.realpathSync(path.resolve(process.argv[1]));
    return scriptPath === entryPath;
  } catch {
    return false;
  }
}

if (isCliEntrypoint()) {
  try {
    const parsed = parseDoctorArgs(process.argv.slice(2));
    if (parsed.help) {
      console.log(getDoctorHelpText());
      process.exit(0);
    }
    const exitCode = runMigrationDoctor({
      cwd: parsed.cwd,
      format: parsed.format,
      fromVersion: parsed.fromVersion,
      noColor: parsed.noColor,
    });
    process.exit(exitCode);
  } catch (err: unknown) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
