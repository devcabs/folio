/**
 * Folio Engine — Migration Doctor (Pre-wired for Task 1.13)
 * Location: src/diagnostics/migrationDoctor.ts
 *
 * Inspects the consumer's installed `@devcabs/folio-engine` version, consumer
 * `package.json`, and local content/setup files using monorepo-safe resolution.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveInstalledEngineVersion,
  resolveConsumerPackageJson,
  resolveContentFiles,
} from './packageResolver';
import { FOLIO_MIGRATION_LEDGER } from '../migrations/ledger';

export interface MigrationDoctorOptions {
  cwd?: string;
  log?: (message: string) => void;
}

/**
 * Runs the Folio Engine migration diagnostic check for the target workspace directory.
 * Returns a process exit code (`0` on completion or graceful configuration warning).
 */
export function runMigrationDoctor(options: MigrationDoctorOptions = {}): number {
  const cwd = options.cwd ?? process.cwd();
  const log = options.log ?? console.log;

  const engineInfo = resolveInstalledEngineVersion(cwd);
  if (!engineInfo) {
    log('⚠️  Could not resolve @devcabs/folio-engine installation.');
    log('Run from within a project that has @devcabs/folio-engine installed.');
    return 0;
  }

  const consumerInfo = resolveConsumerPackageJson(cwd);
  if (!consumerInfo) {
    log('⚠️  Could not resolve consumer package.json. Continuing with reduced diagnostics.');
  }

  const latestLedgerEntry = FOLIO_MIGRATION_LEDGER[FOLIO_MIGRATION_LEDGER.length - 1];
  const latestAvailableVersion = latestLedgerEntry?.version ?? engineInfo.version;

  log(`📦 Installed @devcabs/folio-engine: ${engineInfo.version} (${engineInfo.pkgPath})`);
  log(`📚 Latest ledger version: ${latestAvailableVersion}`);

  if (consumerInfo) {
    const consumerLabel = consumerInfo.name || '(unnamed package)';
    const consumerVersion = consumerInfo.version ? `@${consumerInfo.version}` : '';
    log(`🏠 Consumer package: ${consumerLabel}${consumerVersion} (${consumerInfo.path})`);

    const contentFiles = resolveContentFiles(path.dirname(consumerInfo.path));
    if (contentFiles.length > 0) {
      log(`📄 Detected content/setup files (${contentFiles.length}): ${contentFiles.join(', ')}`);
    } else {
      log('📄 No standard consumer content/setup files detected.');
    }
  }

  return 0;
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
  const exitCode = runMigrationDoctor();
  process.exit(exitCode);
}

