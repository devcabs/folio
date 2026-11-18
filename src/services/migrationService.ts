/**
 * Migration Service
 *
 * Manages runtime migration ledger inspection, content watermark resolution,
 * pending migration calculations, and prompt generation.
 *
 * Single-source watermark: resolves strictly from EngineConfig.contentVersion.
 */

import { resolveContentWatermark } from '../utils/watermarkResolver';
import { FOLIO_MIGRATION_LEDGER, compareSemver } from '../migrations/ledger';
import { isValidSemver } from '../utils/semver-utils';
import { getEngineConfig, type EngineConfig } from '../config/engine.config';
import type { MigrationEntry, PendingMigrationReport } from '../types/migration';

import {
  generateAiMigrationPrompt,
  type PromptFormatterOptions,
} from '../utils/migrationPromptFormatter';

export { generateAiMigrationPrompt, type PromptFormatterOptions };

/**
 * Returns the recorded migration ledger history sorted deterministically in ascending semver order.
 */
export function getMigrationLedger(): MigrationEntry[] {
  return [...FOLIO_MIGRATION_LEDGER].sort((a, b) =>
    compareSemver(a.version, b.version)
  );
}

/**
 * Resolves the active content watermark version strictly from EngineConfig.contentVersion.
 *
 * @param config - Optional EngineConfig or object containing contentVersion.
 * @returns The resolved watermark semver string.
 */
export function getContentVersionWatermark(
  config?: EngineConfig | { contentVersion?: string }
): string {
  const effectiveConfigVersion =
    config !== undefined ? config.contentVersion : getEngineConfig().contentVersion;
  return resolveContentWatermark(effectiveConfigVersion);
}

/**
 * Computes pending content migrations newer than the given or resolved watermark.
 *
 * @param watermark - Optional explicit watermark semver override.
 * @returns Structured PendingMigrationReport detailing unapplied versions and content changes.
 */
export function getPendingMigrations(
  watermark?: string
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
    trimmedWatermark ?? getContentVersionWatermark();

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
