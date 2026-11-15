import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  verifyMigrationSync,
  runMigrationSyncCli,
  type MigrationSyncOptions,
} from '../../scripts/verify-migration-sync';

describe('verify-migration-sync', () => {
  let tempDir: string;
  let pkgPath: string;
  let changelogPath: string;

  const validLedger = [
    {
      version: '0.1.10',
      releaseDate: '2026-11-15',
      title: 'Current Release',
      summary: 'All features up to date.',
      breakingChanges: ['No breaking API changes'],
      codeActions: [],
      contentChanges: [
        {
          id: 'watermark-0.1.10',
          title: 'Update watermark',
          required: true,
          description: 'Set contentVersion to 0.1.10',
        },
      ],
    },
  ];

  const validChangelog = `# Changelog

All notable changes to \`@devcabs/folio-engine\` are compiled automatically from [\`src/migrations/ledger.ts\`](src/migrations/ledger.ts).

## v0.1.10 — Current Release (2026-11-15)

All features up to date.

### Breaking Changes
- No breaking API changes

### Content Changes
- **[REQUIRED] Update watermark** (\`watermark-0.1.10\`): Set contentVersion to 0.1.10
`;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-verify-sync-'));
    pkgPath = path.join(tempDir, 'package.json');
    changelogPath = path.join(tempDir, 'CHANGELOG.md');

    fs.writeFileSync(pkgPath, JSON.stringify({ name: '@devcabs/folio-engine', version: '0.1.10' }));
    fs.writeFileSync(changelogPath, validChangelog);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('passes when ledger, package.json, and CHANGELOG.md are in sync', () => {
    const options: MigrationSyncOptions = {
      pkgPath,
      changelogPath,
      ledger: validLedger,
    };

    const result = verifyMigrationSync(options);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when package.json version is not in ledger', () => {
    fs.writeFileSync(pkgPath, JSON.stringify({ name: '@devcabs/folio-engine', version: '0.2.0' }));

    const options: MigrationSyncOptions = {
      pkgPath,
      changelogPath,
      ledger: validLedger,
    };

    const result = verifyMigrationSync(options);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('package.json version v0.2.0 is missing'))).toBe(true);
  });

  it('fails when CHANGELOG.md does not match ledger', () => {
    fs.writeFileSync(changelogPath, '# Stale Changelog\n');

    const options: MigrationSyncOptions = {
      pkgPath,
      changelogPath,
      ledger: validLedger,
    };

    const result = verifyMigrationSync(options);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('CHANGELOG.md is out of sync'))).toBe(true);
  });

  it('fails when current ledger entry has empty breakingChanges or contentChanges', () => {
    const invalidLedger = [
      {
        version: '0.1.10',
        releaseDate: '2026-11-15',
        title: 'Incomplete Release',
        summary: 'Missing required sections.',
        breakingChanges: [],
        codeActions: [],
        contentChanges: [],
      },
    ];

    const options: MigrationSyncOptions = {
      pkgPath,
      changelogPath,
      ledger: invalidLedger,
    };

    const result = verifyMigrationSync(options);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('breakingChanges'))).toBe(true);
    expect(result.errors.some((e) => e.includes('contentChanges'))).toBe(true);
  });

  it('runMigrationSyncCli writes errors to stderr and returns 1 on failure', () => {
    fs.writeFileSync(changelogPath, '# Drift\n');

    const errorsLogged: string[] = [];
    const exitCode = runMigrationSyncCli(
      {
        pkgPath,
        changelogPath,
        ledger: validLedger,
      },
      {
        writeStderr: (msg) => errorsLogged.push(msg),
        writeStdout: () => {},
      }
    );

    expect(exitCode).toBe(1);
    expect(errorsLogged.join('\n')).toContain('CHANGELOG.md is out of sync');
    expect(errorsLogged.join('\n')).toContain('npm run changelog');
  });

  it('runMigrationSyncCli returns 0 and writes success output on clean sync', () => {
    const stdoutLogged: string[] = [];
    const exitCode = runMigrationSyncCli(
      {
        pkgPath,
        changelogPath,
        ledger: validLedger,
      },
      {
        writeStderr: () => {},
        writeStdout: (msg) => stdoutLogged.push(msg),
      }
    );

    expect(exitCode).toBe(0);
    expect(stdoutLogged.join('\n')).toContain('✓ Migration ledger, Version Doctor, and CHANGELOG.md are 100% in sync');
  });
});
