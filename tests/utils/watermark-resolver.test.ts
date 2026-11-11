import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveContentWatermark,
  updateWatermark,
  FOLIO_CONTENT_VERSION_KEY,
} from '../../src/utils/watermarkResolver';
import { createInMemoryAdapter, type StorageAdapter } from '../../src/utils/storageAdapter';

describe('watermarkResolver', () => {
  let storage: StorageAdapter;

  const adapterWith = (version: string): StorageAdapter => {
    const adapter = createInMemoryAdapter();
    adapter.setItem(FOLIO_CONTENT_VERSION_KEY, version);
    return adapter;
  };

  beforeEach(() => {
    storage = createInMemoryAdapter();
  });

  describe('resolveContentWatermark', () => {
    // ── Required verification criteria from Task 1.3 ──

    it("resolveContentWatermark('0.1.1', adapterWith('0.1.3')) returns '0.1.3'", () => {
      expect(resolveContentWatermark('0.1.1', adapterWith('0.1.3'))).toBe('0.1.3');
    });

    it("resolveContentWatermark('0.1.3', adapterWith('0.1.1')) returns '0.1.3'", () => {
      expect(resolveContentWatermark('0.1.3', adapterWith('0.1.1'))).toBe('0.1.3');
    });

    it("resolveContentWatermark(undefined, emptyAdapter) returns '0.0.0'", () => {
      expect(resolveContentWatermark(undefined, storage)).toBe('0.0.0');
    });

    it("resolveContentWatermark('0.1.3', emptyAdapter) returns '0.1.3'", () => {
      expect(resolveContentWatermark('0.1.3', storage)).toBe('0.1.3');
    });

    it("resolveContentWatermark(undefined, adapterWith('0.1.2')) returns '0.1.2'", () => {
      expect(resolveContentWatermark(undefined, adapterWith('0.1.2'))).toBe('0.1.2');
    });

    // ── Extended edge-case coverage ──

    it('returns 0.0.0 when configVersion and storage are both empty strings', () => {
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '');
      expect(resolveContentWatermark('', storage)).toBe('0.0.0');
    });

    it('handles whitespace-only inputs gracefully', () => {
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '   ');
      expect(resolveContentWatermark('   ', storage)).toBe('0.0.0');
    });

    it('returns storage value if configVersion is empty string or whitespace', () => {
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.2.0');
      expect(resolveContentWatermark('', storage)).toBe('0.2.0');
      expect(resolveContentWatermark('   ', storage)).toBe('0.2.0');
    });

    it('returns configVersion if storage value is empty string or whitespace', () => {
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '   ');
      expect(resolveContentWatermark('0.2.0', storage)).toBe('0.2.0');
    });

    it('returns either when versions are equal', () => {
      expect(resolveContentWatermark('0.1.5', adapterWith('0.1.5'))).toBe('0.1.5');
    });

    it('correctly compares major and minor version bumps', () => {
      expect(resolveContentWatermark('1.0.0', adapterWith('0.9.9'))).toBe('1.0.0');
      expect(resolveContentWatermark('0.2.0', adapterWith('0.1.9'))).toBe('0.2.0');
      expect(resolveContentWatermark('0.1.9', adapterWith('0.2.0'))).toBe('0.2.0');
    });
  });

  describe('updateWatermark', () => {
    // ── Required verification criteria from Task 1.3 ──

    it("calling updateWatermark('0.1.2', storage) when current watermark is '0.1.3' does NOT write to storage", () => {
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.3');
      updateWatermark('0.1.2', storage);
      expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.1.3');
    });

    it("calling updateWatermark('0.1.4', storage) when current watermark is '0.1.3' DOES write '0.1.4' to storage", () => {
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.3');
      updateWatermark('0.1.4', storage);
      expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.1.4');
    });

    // ── Extended coverage ──

    it('does NOT write when newVersion is equal to current watermark', () => {
      storage.setItem(FOLIO_CONTENT_VERSION_KEY, '0.1.3');
      updateWatermark('0.1.3', storage);
      expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.1.3');
    });

    it('writes newVersion when storage was previously empty (current is 0.0.0)', () => {
      updateWatermark('0.1.0', storage);
      expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.1.0');
    });

    it('never downgrades the watermark across multiple updates', () => {
      updateWatermark('0.1.0', storage);
      expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.1.0');

      updateWatermark('0.2.0', storage);
      expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.2.0');

      // Attempted downgrade
      updateWatermark('0.1.9', storage);
      expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('0.2.0');

      // Higher upgrade
      updateWatermark('1.0.0', storage);
      expect(storage.getItem(FOLIO_CONTENT_VERSION_KEY)).toBe('1.0.0');
    });
  });
});

