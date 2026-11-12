/**
 * Migration Service
 *
 * Manages runtime migration ledger inspection, content watermark resolution,
 * pending migration calculations, and prompt generation.
 *
 * Strict SSR and storage safety: all persistence operations MUST go through
 * the injected StorageAdapter (defaulting to localStorageAdapter).
 * Direct calls to localStorage are strictly forbidden.
 */

import { localStorageAdapter, type StorageAdapter } from '../utils/storageAdapter';
import {
  resolveContentWatermark,
  updateWatermark,
  FOLIO_CONTENT_VERSION_KEY,
} from '../utils/watermarkResolver';
import { FOLIO_MIGRATION_LEDGER, compareSemver } from '../migrations/ledger';
import { isValidSemver } from '../utils/semver-utils';
import { getEngineConfig, type EngineConfig } from '../config/engine.config';
import type { MigrationEntry, PendingMigrationReport } from '../types/migration';

import {
  generateAiMigrationPrompt,
  type PromptFormatterOptions,
} from '../utils/migrationPromptFormatter';

export { generateAiMigrationPrompt, type PromptFormatterOptions };
export { FOLIO_CONTENT_VERSION_KEY };

/**
 * Returns the recorded migration ledger history sorted deterministically in ascending semver order.
 */
export function getMigrationLedger(): MigrationEntry[] {
  return [...FOLIO_MIGRATION_LEDGER].sort((a, b) =>
    compareSemver(a.version, b.version)
  );
}

/**
 * Resolves the active content watermark version using the provided storage adapter.
 * Precedence logic is strictly delegated to resolveContentWatermark.
 *
 * @param config  - Optional EngineConfig or object containing contentVersion.
 * @param storage - StorageAdapter instance (defaults to localStorageAdapter).
 * @returns The resolved watermark semver string.
 */
export function getContentVersionWatermark(
  config?: EngineConfig | { contentVersion?: string },
  storage: StorageAdapter = localStorageAdapter
): string {
  const effectiveConfigVersion =
    config !== undefined ? config.contentVersion : getEngineConfig().contentVersion;
  return resolveContentWatermark(effectiveConfigVersion, storage);
}

/**
 * Persists the content watermark version through the injected storage adapter.
 * Monotonically updates watermark using updateWatermark (never downgrades).
 * Never accesses window.localStorage directly.
 */
export function setContentVersionWatermark(
  version: string,
  storage: StorageAdapter = localStorageAdapter
): void {
  updateWatermark(version, storage);
}

/**
 * Computes pending content migrations newer than the given or resolved watermark.
 *
 * @param watermark - Optional explicit watermark semver override.
 * @param storage   - StorageAdapter instance (defaults to localStorageAdapter).
 * @returns Structured PendingMigrationReport detailing unapplied versions and content changes.
 */
export function getPendingMigrations(
  watermark?: string,
  storage: StorageAdapter = localStorageAdapter
): PendingMigrationReport {
  const ledger = getMigrationLedger();
  const currentEngineVersion =
    ledger.length > 0 ? ledger[ledger.length - 1].version : '0.0.0';

  const trimmedWatermark =
    typeof watermark === 'string' && watermark.trim() !== ''
      ? watermark.trim()
      : undefined;

  if (trimmedWatermark !== undefined && !isValidSemver(trimmedWatermark)) {
    throw new Error(`Invalid watermark semver: "${trimmedWatermark}"`);
  }

  const resolvedWatermark =
    trimmedWatermark ?? getContentVersionWatermark(undefined, storage);

  const unappliedEntries = ledger.filter(
    (entry) =>
      compareSemver(entry.version, resolvedWatermark) > 0 &&
      compareSemver(entry.version, currentEngineVersion) <= 0
  );

  const unappliedVersions = unappliedEntries.map((entry) => entry.version);
  const pendingContentChanges = unappliedEntries.flatMap(
    (entry) => entry.contentChanges
  );

  return {
    currentEngineVersion,
    contentVersionWatermark: resolvedWatermark,
    hasPendingContentChanges: pendingContentChanges.length > 0,
    pendingContentChanges,
    unappliedVersions,
  };
}


