/**
 * watermarkResolver.ts
 *
 * Implements the definitive precedence rule for resolving the content watermark.
 * When EngineConfig.contentVersion and localStorage disagree, the higher version wins.
 * This prevents silent session regressions where a user's acknowledged migrations
 * are reverted simply because the host app passed an older contentVersion.
 */

import { compareSemver, isValidSemver } from './semver-utils';
import type { StorageAdapter } from './storageAdapter';

export const FOLIO_CONTENT_VERSION_KEY = 'folio_content_version';

/**
 * Resolves the active content watermark version between configVersion and storage.
 * Precedence rule:
 * - Return the higher of configVersion and storage value.
 * - If configVersion is undefined or empty string, return storage value.
 * - If storage value is null or empty string, return configVersion.
 * - If both are undefined/null/empty, return '0.0.0'.
 */
export function resolveContentWatermark(
  configVersion: string | undefined,
  storage: StorageAdapter
): string {
  const hasConfig = typeof configVersion === 'string' && configVersion.trim() !== '';
  const rawStorage = storage.getItem(FOLIO_CONTENT_VERSION_KEY);
  const hasStorage = typeof rawStorage === 'string' && rawStorage.trim() !== '';

  const cfg = hasConfig ? configVersion!.trim() : undefined;
  const stored = hasStorage ? rawStorage!.trim() : undefined;

  if (!cfg && !stored) {
    return '0.0.0';
  }
  if (cfg && !stored) {
    return cfg;
  }
  if (!cfg && stored) {
    return stored;
  }

  // Both are present — higher version wins
  if (isValidSemver(cfg!) && isValidSemver(stored!)) {
    return compareSemver(cfg!, stored!) >= 0 ? cfg! : stored!;
  }
  if (isValidSemver(cfg!)) return cfg!;
  if (isValidSemver(stored!)) return stored!;

  return cfg!;
}

/**
 * Updates the stored watermark to newVersion only if newVersion is strictly
 * greater than the current resolved watermark in storage. Never downgrades.
 *
 * @param newVersion - The target semver string to record as acknowledged.
 * @param storage    - The StorageAdapter to persist into.
 */
export function updateWatermark(newVersion: string, storage: StorageAdapter): void {
  const current = resolveContentWatermark(undefined, storage);
  if (compareSemver(newVersion, current) === 1) {
    storage.setItem(FOLIO_CONTENT_VERSION_KEY, newVersion);
  }
}

