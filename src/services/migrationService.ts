/**
 * Migration Service (Pre-wire for Task 1.11)
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
import type { EngineConfig } from '../config/engine.config';
import type { MigrationEntry, PendingMigrationReport } from '../types/migration';

import {
  generateAiMigrationPrompt,
  type PromptFormatterOptions,
} from '../utils/migrationPromptFormatter';

export { generateAiMigrationPrompt, type PromptFormatterOptions };
export { FOLIO_CONTENT_VERSION_KEY };

/**
 * Returns the recorded migration ledger history.
 * Stubbed for task 1.2; populated in task 1.11.
 */
export function getMigrationLedger(): MigrationEntry[] {
  return [];
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
  return resolveContentWatermark(config?.contentVersion, storage);
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
 * Stubbed for task 1.2; complete ledger comparison implemented in task 1.11.
 */
export function getPendingMigrations(
  watermark?: string,
  storage: StorageAdapter = localStorageAdapter
): PendingMigrationReport {
  const resolvedWatermark = watermark ?? getContentVersionWatermark(undefined, storage);

  return {
    currentEngineVersion: '0.1.3',
    contentVersionWatermark: resolvedWatermark,
    hasPendingContentChanges: false,
    pendingContentChanges: [],
    unappliedVersions: [],
  };
}


