import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  buildMigrationDoctorReport,
  formatMigrationDoctorReport,
  formatLedgerChangelog,
  parseDoctorArgs,
  runMigrationDoctor,
} from '../../src/diagnostics/migrationDoctor';
import { FOLIO_MIGRATION_LEDGER } from '../../src/migrations/ledger';
import type { MigrationEntry } from '../../src/types/migration';

const REPO_ROOT = path.resolve(__dirname, '../..');
const BIN_SCRIPT = path.join(REPO_ROOT, 'bin/folio-engine.js');
const DOCTOR_SCRIPT = path.join(REPO_ROOT, 'src/diagnostics/migrationDoctor.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules/.bin/tsx');
const RULE_FILE = path.join(REPO_ROOT, '.agents/rules/folio-engine-migration.md');

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function writeText(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('Subtask 1.13: CLI Doctor & AI Migration Agent Rules', () => {
  let tempDirs: string[] = [];

  function createTempDir(prefix = 'folio-doctor-'): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  function createConsumerWorkspace(options: {
    engineVersion: string;
    consumerName?: string;
    consumerVersion?: string;
    setupFileContent?: string;
    includeSampleNodes?: boolean;
  }): string {
    const dir = createTempDir();
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
    writeJson(path.join(dir, 'package.json'), {
      name: options.consumerName ?? 'consumer-portfolio',
      version: options.consumerVersion ?? '1.0.0',
      dependencies: {
        '@devcabs/folio-engine': options.engineVersion,
      },
    });
    writeJson(
      path.join(dir, 'node_modules/@devcabs/folio-engine/package.json'),
      {
        name: '@devcabs/folio-engine',
        version: options.engineVersion,
      }
    );
    if (options.setupFileContent !== undefined) {
      writeText(path.join(dir, 'src/engine-setup.ts'), options.setupFileContent);
    }
    if (options.includeSampleNodes) {
      writeJson(path.join(dir, 'sample-nodes.json'), []);
    }
    return dir;
  }

  beforeEach(() => {
    tempDirs = [];
  });

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe('parseDoctorArgs', () => {
    it('parses --format json, --from, --cwd, and --no-color flags', () => {
      const parsed = parseDoctorArgs([
        '--format',
        'json',
        '--from=0.1.1',
        '--cwd',
        '/tmp/app',
        '--no-color',
      ]);

      expect(parsed).toEqual({
        format: 'json',
        fromVersion: '0.1.1',
        cwd: '/tmp/app',
        noColor: true,
        help: false,
      });
    });

    it('rejects unsupported --format values', () => {
      expect(() => parseDoctorArgs(['--format', 'yaml'])).toThrow(/Invalid --format/);
    });
  });

  describe('buildMigrationDoctorReport & formatting', () => {
    it('identifies pending versions, breaking changes, content changes, and AI prompt when installed engine lags behind ledger', () => {
      const workspace = createConsumerWorkspace({
        engineVersion: '0.1.1',
        includeSampleNodes: true,
        setupFileContent: `export const config = { contentVersion: '0.1.1' };\n`,
      });

      const report = buildMigrationDoctorReport({ cwd: workspace });

      expect(report.ok).toBe(true);
      expect(report.status).toBe('migrations-pending');
      expect(report.installedEngine?.version).toBe('0.1.1');
      expect(report.baselineVersion).toBe('0.1.1');
      expect(report.detectedContentVersion).toBe('0.1.1');
      expect(report.pendingVersions).toContain('0.1.2');
      expect(report.pendingVersions).toContain('0.1.3');
      expect(report.pendingVersions).toContain('0.1.4');
      expect(report.contentChanges.length).toBeGreaterThan(0);
      expect(report.breakingChanges.length).toBeGreaterThan(0);
      expect(report.agentPrompt).toContain('AI Migration Prompt');
      expect(report.detectedFiles.some((f) => f.endsWith('sample-nodes.json'))).toBe(true);
      expect(report.detectedFiles.some((f) => f.endsWith('src/engine-setup.ts'))).toBe(true);
    });

    it('detects lagging contentVersion in consumer setup even after npm package is upgraded to latest', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')
      ) as { version: string };

      const workspace = createConsumerWorkspace({
        engineVersion: pkg.version,
        setupFileContent: `import { setEngineConfig } from '@devcabs/folio-engine';\nsetEngineConfig({ contentVersion: '0.1.1' });\n`,
      });

      const report = buildMigrationDoctorReport({ cwd: workspace });

      expect(report.status).toBe('migrations-pending');
      expect(report.installedEngine?.version).toBe(pkg.version);
      expect(report.detectedContentVersion).toBe('0.1.1');
      expect(report.baselineVersion).toBe('0.1.1');
      expect(report.pendingVersions).toContain('0.1.2');
      expect(report.agentPrompt).toContain('0.1.1');
    });

    it('renders breaking code actions with before/after examples, required/optional content changes, and ANSI styling', () => {
      const workspace = createConsumerWorkspace({
        engineVersion: '0.1.0',
      });

      const syntheticLedger: MigrationEntry[] = [
        {
          version: '0.1.0',
          releaseDate: '2026-10-28',
          title: 'Initial',
          summary: 'Initial release.',
          breakingChanges: [],
          codeActions: [],
          contentChanges: [],
        },
        {
          version: '0.2.0',
          releaseDate: '2026-11-12',
          title: 'Strict Config Migration',
          summary: 'Renames legacy config key.',
          breakingChanges: ['Renamed legacyTitle to heroTitle in EngineConfig.'],
          codeActions: [
            {
              description: 'Replace legacyTitle with heroTitle in engine setup.',
              affectedFiles: ['src/engine-setup.ts'],
              exampleBefore: 'setEngineConfig({ legacyTitle: "Hello" });',
              exampleAfter: 'setEngineConfig({ branding: { heroTitle: "Hello" } });',
            },
          ],
          contentChanges: [
            {
              id: 'req-nodes-0.2.0',
              title: 'Required Node Schema Update',
              required: true,
              description: 'Add summary field to all milestone nodes.',
              affectedEntities: ['sample-nodes.json'],
              migrationPrompt: 'Update sample-nodes.json to include summary on every node.',
            },
          ],
        },
      ];

      const report = buildMigrationDoctorReport({
        cwd: workspace,
        ledger: syntheticLedger,
      });

      const ansiText = formatMigrationDoctorReport(report, { noColor: false });
      expect(ansiText).toContain('\x1b[');
      expect(ansiText).toContain('Version Comparison');
      expect(ansiText).toContain('Breaking');
      expect(ansiText).toContain('Renamed legacyTitle to heroTitle');
      expect(ansiText).toContain('setEngineConfig({ legacyTitle: "Hello" });');
      expect(ansiText).toContain('setEngineConfig({ branding: { heroTitle: "Hello" } });');
      expect(ansiText).toContain('REQUIRED');
      expect(ansiText).toContain('Required Node Schema Update');
      expect(ansiText).toContain('Agent Prompt Block');

      const plainText = formatMigrationDoctorReport(report, { noColor: true });
      expect(plainText).not.toContain('\x1b[');
      expect(plainText).toContain('Agent Prompt Block');
    });

    it('reports up-to-date when installed version and detected contentVersion match latest ledger', () => {
      const latestLedgerVersion =
        FOLIO_MIGRATION_LEDGER[FOLIO_MIGRATION_LEDGER.length - 1]!.version;

      const workspace = createConsumerWorkspace({
        engineVersion: latestLedgerVersion,
        setupFileContent: `setEngineConfig({ contentVersion: '${latestLedgerVersion}' });\n`,
      });

      const report = buildMigrationDoctorReport({ cwd: workspace });
      expect(report.status).toBe('up-to-date');
      expect(report.pendingVersions).toEqual([]);
      expect(report.agentPrompt).toBeNull();

      const text = formatMigrationDoctorReport(report, { noColor: true });
      expect(text.toLowerCase()).toContain('up to date');
    });
  });

  describe('runMigrationDoctor (--format json & tsx execution)', () => {
    it('outputs valid machine-readable JSON when format is json', () => {
      const workspace = createConsumerWorkspace({
        engineVersion: '0.1.1',
        includeSampleNodes: true,
      });
      const logs: string[] = [];

      const exitCode = runMigrationDoctor({
        cwd: workspace,
        format: 'json',
        log: (msg) => logs.push(msg),
      });

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(logs.join('\n'));
      expect(parsed.status).toBe('migrations-pending');
      expect(parsed.installedEngine.version).toBe('0.1.1');
      expect(parsed.pendingVersions).toContain('0.1.2');
      expect(parsed.agentPrompt).toBeTruthy();
    });

    it('outputs valid JSON with status not-installed and exit code 0 when package is absent', () => {
      const emptyDir = createTempDir();
      const logs: string[] = [];

      const exitCode = runMigrationDoctor({
        cwd: emptyDir,
        format: 'json',
        log: (msg) => logs.push(msg),
      });

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(logs.join('\n'));
      expect(parsed.status).toBe('not-installed');
      expect(parsed.installedEngine).toBeNull();
    });

    it('executes via tsx src/diagnostics/migrationDoctor.ts --format json', () => {
      const workspace = createConsumerWorkspace({
        engineVersion: '0.1.2',
      });

      const stdout = execFileSync(TSX_BIN, [DOCTOR_SCRIPT, '--format', 'json'], {
        cwd: workspace,
        encoding: 'utf-8',
      });

      const parsed = JSON.parse(stdout);
      expect(parsed.installedEngine.version).toBe('0.1.2');
      expect(parsed.pendingVersions).toContain('0.1.3');
    });
  });

  describe('bin/folio-engine.js CLI runner', () => {
    it('exists with node shebang and executable permissions', () => {
      expect(fs.existsSync(BIN_SCRIPT)).toBe(true);
      const content = fs.readFileSync(BIN_SCRIPT, 'utf-8');
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
      const mode = fs.statSync(BIN_SCRIPT).mode;
      expect((mode & 0o111) !== 0).toBe(true);
    });

    it('supports doctor and check commands with ANSI output and --format json', () => {
      const workspace = createConsumerWorkspace({
        engineVersion: '0.1.1',
        includeSampleNodes: true,
      });

      const doctorRes = spawnSync(BIN_SCRIPT, ['doctor'], {
        cwd: workspace,
        encoding: 'utf-8',
      });
      expect(doctorRes.status).toBe(0);
      expect(doctorRes.stdout).toContain('0.1.1');
      expect(doctorRes.stdout).toContain('Version Comparison');
      expect(doctorRes.stdout).toContain('Agent Prompt Block');

      const checkRes = spawnSync(BIN_SCRIPT, ['check', '--format', 'json'], {
        cwd: workspace,
        encoding: 'utf-8',
      });
      expect(checkRes.status).toBe(0);
      const parsed = JSON.parse(checkRes.stdout);
      expect(parsed.installedEngine.version).toBe('0.1.1');
      expect(parsed.pendingVersions).toContain('0.1.2');
    });

    it('supports changelog command in text and json formats', () => {
      const textRes = spawnSync(BIN_SCRIPT, ['changelog'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
      });
      expect(textRes.status).toBe(0);
      expect(textRes.stdout).toContain('0.1.4');
      expect(textRes.stdout).toContain('0.1.0');

      const jsonRes = spawnSync(BIN_SCRIPT, ['changelog', '--format', 'json'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
      });
      expect(jsonRes.status).toBe(0);
      const entries = JSON.parse(jsonRes.stdout) as MigrationEntry[];
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThanOrEqual(5);
      expect(entries[0].version).toBe(
        FOLIO_MIGRATION_LEDGER[FOLIO_MIGRATION_LEDGER.length - 1]!.version
      );
    });

    it('supports version command and exits non-zero on unknown subcommand', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')
      ) as { version: string };

      const versionRes = spawnSync(BIN_SCRIPT, ['version'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
      });
      expect(versionRes.status).toBe(0);
      expect(versionRes.stdout).toContain(pkg.version);

      const unknownRes = spawnSync(BIN_SCRIPT, ['nonexistent-cmd'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
      });
      expect(unknownRes.status).toBe(1);
      expect(unknownRes.stderr.toLowerCase()).toContain('unknown command');
    });

    it('formats changelog newest-first via formatLedgerChangelog', () => {
      const md = formatLedgerChangelog();
      const idx014 = md.indexOf('0.1.4');
      const idx010 = md.indexOf('0.1.0');
      expect(idx014).toBeGreaterThanOrEqual(0);
      expect(idx010).toBeGreaterThan(idx014);
    });
  });

  describe('package.json & agent migration rule', () => {
    it('configures bin, files, and doctor script in package.json', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')
      ) as {
        bin?: Record<string, string>;
        files?: string[];
        scripts?: Record<string, string>;
      };

      expect(pkg.bin?.['folio-engine']).toBe('./bin/folio-engine.js');
      expect(pkg.files).toContain('dist');
      expect(pkg.files).toContain('bin');
      expect(pkg.scripts?.doctor).toBe('tsx src/diagnostics/migrationDoctor.ts');
    });

    it('provides reusable .agents/rules/folio-engine-migration.md rule', () => {
      expect(fs.existsSync(RULE_FILE)).toBe(true);
      const content = fs.readFileSync(RULE_FILE, 'utf-8');
      expect(content).toContain('@devcabs/folio-engine');
      expect(content).toContain('npx folio-engine doctor');
      expect(content.toLowerCase()).toContain('breaking changes');
      expect(content.toLowerCase()).toContain('content changes');
    });
  });
});

