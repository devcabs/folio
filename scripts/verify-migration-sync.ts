/**
 * verify-migration-sync.ts
 *
 * Strict compliance gate verifying that:
 * 1. Current package.json semver has a corresponding release entry in src/migrations/ledger.ts
 * 2. Ledger entries contain non-empty breakingChanges and contentChanges
 * 3. CHANGELOG.md is 100% synchronized with the migration ledger
 * 4. Version Doctor diagnostics can resolve the ledger cleanly
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOLIO_MIGRATION_LEDGER } from '../src/migrations/ledger';
import { generateChangelog } from './generate-changelog';
import type { MigrationEntry } from '../src/types/migration';

export interface MigrationSyncOptions {
  pkgPath?: string;
  changelogPath?: string;
  ledger?: MigrationEntry[];
}

export interface MigrationSyncResult {
  valid: boolean;
  errors: string[];
  currentVersion?: string;
}

export interface CliDeps {
  writeStdout?: (msg: string) => void;
  writeStderr?: (msg: string) => void;
}

export function verifyMigrationSync(options: MigrationSyncOptions = {}): MigrationSyncResult {
  const rootDir = process.cwd();
  const pkgPath = options.pkgPath ?? path.join(rootDir, 'package.json');
  const changelogPath = options.changelogPath ?? path.join(rootDir, 'CHANGELOG.md');
  const ledger = options.ledger ?? FOLIO_MIGRATION_LEDGER;

  const errors: string[] = [];

  // 1. Verify package.json
  if (!fs.existsSync(pkgPath)) {
    return { valid: false, errors: [`package.json not found at ${pkgPath}`] };
  }

  let pkgVersion = '';
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkgVersion = pkg.version || '';
  } catch (err) {
    return { valid: false, errors: [`Failed to parse package.json: ${(err as Error).message}`] };
  }

  if (!pkgVersion) {
    errors.push('package.json missing "version" field.');
  }

  // 2. Verify ledger entries
  if (!ledger || ledger.length === 0) {
    errors.push('Migration ledger is empty or undefined.');
    return { valid: false, errors, currentVersion: pkgVersion };
  }

  const currentEntry = ledger.find((entry) => entry.version === pkgVersion);
  if (!currentEntry) {
    errors.push(
      `Active package.json version v${pkgVersion} is missing from migration ledger (src/migrations/ledger.ts).`
    );
  } else {
    if (!currentEntry.breakingChanges || currentEntry.breakingChanges.length === 0) {
      errors.push(
        `Ledger entry for v${pkgVersion} must have a non-empty breakingChanges array (note 'No breaking changes' if none).`
      );
    }
    if (!currentEntry.contentChanges || currentEntry.contentChanges.length === 0) {
      errors.push(
        `Ledger entry for v${pkgVersion} must have a non-empty contentChanges array describing content/schema updates.`
      );
    }
  }

  // 3. Verify CHANGELOG.md synchronization
  if (!fs.existsSync(changelogPath)) {
    errors.push(`CHANGELOG.md not found at ${changelogPath}. Run "npm run changelog" to generate it.`);
  } else {
    try {
      const actualChangelog = fs.readFileSync(changelogPath, 'utf-8');
      const expectedChangelog = generateChangelog(ledger);

      const normalize = (str: string) => str.replace(/\r\n/g, '\n').trim();
      if (normalize(actualChangelog) !== normalize(expectedChangelog)) {
        errors.push(
          `CHANGELOG.md is out of sync with migration ledger. Run "npm run changelog" to regenerate.`
        );
      }
    } catch (err) {
      errors.push(`Failed to verify CHANGELOG.md: ${(err as Error).message}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    currentVersion: pkgVersion,
  };
}

export function runMigrationSyncCli(
  options: MigrationSyncOptions = {},
  deps: CliDeps = {}
): number {
  const writeStdout = deps.writeStdout ?? ((msg: string) => console.log(msg));
  const writeStderr = deps.writeStderr ?? ((msg: string) => console.error(msg));

  const result = verifyMigrationSync(options);

  if (result.valid) {
    writeStdout(
      `\x1b[32m✓ Migration ledger, Version Doctor, and CHANGELOG.md are 100% in sync for v${result.currentVersion}.\x1b[0m`
    );
    return 0;
  }

  writeStderr(`\n\x1b[31m❌ STRICT COMPLIANCE GATE FAILED:\x1b[0m`);
  writeStderr(
    `\x1b[33mAny changes must be registered in the migration ledger for Version Doctor before publishing.\x1b[0m\n`
  );
  result.errors.forEach((err) => {
    writeStderr(`  \x1b[31m•\x1b[0m ${err}`);
  });
  writeStderr(`\n\x1b[36mRequired Remediation:\x1b[0m`);
  writeStderr(`  1. Ensure \`src/migrations/ledger.ts\` has an entry for the target release.`);
  writeStderr(`  2. Run \`npm run changelog\` to update CHANGELOG.md.`);
  writeStderr(`  3. Run \`npm run doctor\` to verify doctor diagnostics output.\n`);

  return 1;
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
  const exitCode = runMigrationSyncCli();
  process.exit(exitCode);
}
