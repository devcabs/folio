import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getContentVersionWatermark,
  setContentVersionWatermark,
  getPendingMigrations,
  generateAiMigrationPrompt,
  getMigrationLedger,
  FOLIO_CONTENT_VERSION_KEY,
} from '../../src/services/migrationService';
import { createInMemoryAdapter, type StorageAdapter } from '../../src/utils/storageAdapter';
import { setEngineConfig, resetEngineConfig } from '../../src/config/engine.config';

describe('migrationService (SSR, Storage Safety & Ledger Runtime)', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    resetEngineConfig();
    storage = createInMemoryAdapter();
  });

  afterEach(() => {
    resetEngineConfig();
  });

  describe('Watermark Persistence & Retrieval', () => {
    it('returns 0.0.0 when neither config nor storage has a watermark', () => {
      const watermark = getContentVersionWatermark(undefined, storage);
      expect(watermark).toBe('0.0.0');
    });

    it('retrieves stored watermark from injected storage adapter', () => {
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.2');
      const watermark = getContentVersionWatermark(undefined, storage);
      expect(watermark).toBe('0.1.2');
    });

    it('prefers config.contentVersion when specified', () => {
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.0');
      const watermark = getContentVersionWatermark({ contentVersion: '0.1.3' }, storage);
      expect(watermark).toBe('0.1.3');
    });

    it('resolves precedence to the higher version when config and storage disagree', () => {
      // Storage is newer than config
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.3');
      expect(getContentVersionWatermark({ contentVersion: '0.1.1' }, storage)).toBe('0.1.3');

      // Config is newer than storage
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.1');
      expect(getContentVersionWatermark({ contentVersion: '0.1.3' }, storage)).toBe('0.1.3');
    });

    it('persists watermark to storage through setContentVersionWatermark', () => {
      setContentVersionWatermark('0.1.4', storage);
      expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.1.4');
      expect(getContentVersionWatermark(undefined, storage)).toBe('0.1.4');
    });

    it('prevents watermark downgrades via setContentVersionWatermark', () => {
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.3');
      setContentVersionWatermark('0.1.2', storage);
      expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.1.3');
    });
  });

  describe('Pending Migrations & Prompt Generation', () => {
    it('returns pending migrations report with resolved watermark and unapplied versions', () => {
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.1');
      const ledger = getMigrationLedger();
      const latestVersion = ledger[ledger.length - 1].version;
      const report = getPendingMigrations(undefined, storage);

      expect(report.currentEngineVersion).toBe(latestVersion);
      expect(report.contentVersionWatermark).toBe('0.1.1');
      expect(report.hasPendingContentChanges).toBe(true);
      expect(report.pendingContentChanges.length).toBeGreaterThan(0);
      expect(report.unappliedVersions).toEqual(
        expect.arrayContaining(['0.1.2', '0.1.3', latestVersion])
      );
    });

    it('returns empty pending changes when watermark matches latest engine version', () => {
      const ledger = getMigrationLedger();
      const latestVersion = ledger[ledger.length - 1].version;
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, latestVersion);

      const report = getPendingMigrations(undefined, storage);
      expect(report.currentEngineVersion).toBe(latestVersion);
      expect(report.contentVersionWatermark).toBe(latestVersion);
      expect(report.hasPendingContentChanges).toBe(false);
      expect(report.pendingContentChanges).toEqual([]);
      expect(report.unappliedVersions).toEqual([]);
    });

    it('falls back to active EngineConfig.contentVersion when config argument is omitted', () => {
      setEngineConfig({ contentVersion: '0.1.2' });
      expect(getContentVersionWatermark(undefined, storage)).toBe('0.1.2');

      const report = getPendingMigrations(undefined, storage);
      expect(report.contentVersionWatermark).toBe('0.1.2');
      expect(report.unappliedVersions).not.toContain('0.1.2');
    });

    it('throws on invalid explicit watermark semver', () => {
      expect(() => getPendingMigrations('v0.1.1', storage)).toThrow(
        /Invalid watermark semver/
      );
    });

    it('uses explicit watermark if provided to getPendingMigrations', () => {
      const report = getPendingMigrations('0.1.0', storage);
      expect(report.contentVersionWatermark).toBe('0.1.0');
    });

    it('returns migration ledger as a sorted array', () => {
      const ledger = getMigrationLedger();
      expect(Array.isArray(ledger)).toBe(true);
      expect(ledger.length).toBeGreaterThanOrEqual(4);
      expect(ledger[0].version).toBe('0.1.0');
    });

    it('generates an AI migration prompt string', () => {
      const report = getPendingMigrations('0.1.1', storage);
      const prompt = generateAiMigrationPrompt(report);
      expect(prompt).toContain('Generated by @devcabs/folio-engine migrationService');
    });
  });

  describe('Zero Direct localStorage Dependency', () => {
    it('operates purely in memory without relying on global window or localStorage', () => {
      const memA = createInMemoryAdapter();
      const memB = createInMemoryAdapter();

      setContentVersionWatermark('0.1.2', memA);
      expect(getContentVersionWatermark(undefined, memA)).toBe('0.1.2');
      expect(getContentVersionWatermark(undefined, memB)).toBe('0.0.0');
    });
  });
});

