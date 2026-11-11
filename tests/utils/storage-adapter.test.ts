import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  localStorageAdapter,
  createInMemoryAdapter,
  type StorageAdapter,
} from '../../src/utils/storageAdapter';

describe('StorageAdapter & SSR Safety', () => {
  describe('Node.js / SSR Environment (No DOM)', () => {
    it('returns null on getItem when window is undefined', () => {
      // Vitest runs in Node by default, window is undefined
      const origWindow = (globalThis as unknown as { window?: unknown }).window;
      try {
        delete (globalThis as unknown as { window?: unknown }).window;
        expect(typeof window).toBe('undefined');
        expect(localStorageAdapter.getItem('test_key')).toBeNull();
      } finally {
        if (origWindow !== undefined) {
          (globalThis as unknown as { window: unknown }).window = origWindow;
        }
      }
    });

    it('does not throw on setItem when window is undefined', () => {
      const origWindow = (globalThis as unknown as { window?: unknown }).window;
      try {
        delete (globalThis as unknown as { window?: unknown }).window;
        expect(typeof window).toBe('undefined');
        expect(() => {
          localStorageAdapter.setItem('test_key', 'test_value');
        }).not.toThrow();
      } finally {
        if (origWindow !== undefined) {
          (globalThis as unknown as { window: unknown }).window = origWindow;
        }
      }
    });

    it('does not throw on removeItem when window is undefined', () => {
      const origWindow = (globalThis as unknown as { window?: unknown }).window;
      try {
        delete (globalThis as unknown as { window?: unknown }).window;
        expect(typeof window).toBe('undefined');
        expect(() => {
          localStorageAdapter.removeItem('test_key');
        }).not.toThrow();
      } finally {
        if (origWindow !== undefined) {
          (globalThis as unknown as { window: unknown }).window = origWindow;
        }
      }
    });
  });

  describe('createInMemoryAdapter', () => {
    it('correctly stores, retrieves, and removes values', () => {
      const adapter = createInMemoryAdapter();

      expect(adapter.getItem('non_existent')).toBeNull();

      adapter.setItem('greeting', 'hello');
      expect(adapter.getItem('greeting')).toBe('hello');

      adapter.setItem('num', '42');
      expect(adapter.getItem('num')).toBe('42');

      adapter.removeItem('greeting');
      expect(adapter.getItem('greeting')).toBeNull();
      expect(adapter.getItem('num')).toBe('42');
    });

    it('two separate instances are completely isolated without shared state', () => {
      const adapterA = createInMemoryAdapter();
      const adapterB = createInMemoryAdapter();

      adapterA.setItem('shared_key', 'value_for_A');
      expect(adapterA.getItem('shared_key')).toBe('value_for_A');
      expect(adapterB.getItem('shared_key')).toBeNull();

      adapterB.setItem('shared_key', 'value_for_B');
      expect(adapterA.getItem('shared_key')).toBe('value_for_A');
      expect(adapterB.getItem('shared_key')).toBe('value_for_B');

      adapterA.removeItem('shared_key');
      expect(adapterA.getItem('shared_key')).toBeNull();
      expect(adapterB.getItem('shared_key')).toBe('value_for_B');
    });

    it('implements StorageAdapter interface contract', () => {
      const adapter: StorageAdapter = createInMemoryAdapter();
      expect(typeof adapter.getItem).toBe('function');
      expect(typeof adapter.setItem).toBe('function');
      expect(typeof adapter.removeItem).toBe('function');
    });
  });

  describe('Browser Environment with Mocked localStorage', () => {
    let mockStorage: Map<string, string>;

    beforeEach(() => {
      mockStorage = new Map<string, string>();
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage.set(key, val);
        }),
        removeItem: vi.fn((key: string) => {
          mockStorage.delete(key);
        }),
        clear: vi.fn(() => {
          mockStorage.clear();
        }),
      };
      (globalThis as unknown as { window: unknown }).window = {
        localStorage: mockLocalStorage,
      };
    });

    afterEach(() => {
      delete (globalThis as unknown as { window?: unknown }).window;
    });

    it('reads and writes to mocked browser storage on window when available', () => {
      localStorageAdapter.setItem('theme', 'dark');
      expect(localStorageAdapter.getItem('theme')).toBe('dark');
      localStorageAdapter.removeItem('theme');
      expect(localStorageAdapter.getItem('theme')).toBeNull();
    });

    it('catches SecurityError on getItem gracefully in private browsing', () => {
      const mockLocalStorage = {
        getItem: vi.fn(() => {
          const err = new Error('Access is denied for this document');
          err.name = 'SecurityError';
          throw err;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      (globalThis as unknown as { window: unknown }).window = {
        localStorage: mockLocalStorage,
      };

      expect(() => {
        const val = localStorageAdapter.getItem('secret_key');
        expect(val).toBeNull();
      }).not.toThrow();
    });

    it('catches SecurityError on setItem gracefully in private browsing', () => {
      const mockLocalStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(() => {
          const err = new Error('QuotaExceeded or SecurityError');
          err.name = 'SecurityError';
          throw err;
        }),
        removeItem: vi.fn(),
      };
      (globalThis as unknown as { window: unknown }).window = {
        localStorage: mockLocalStorage,
      };

      expect(() => {
        localStorageAdapter.setItem('key', 'value');
      }).not.toThrow();
    });

    it('catches SecurityError on removeItem gracefully in private browsing', () => {
      const mockLocalStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(() => {
          const err = new Error('SecurityError');
          err.name = 'SecurityError';
          throw err;
        }),
      };
      (globalThis as unknown as { window: unknown }).window = {
        localStorage: mockLocalStorage,
      };

      expect(() => {
        localStorageAdapter.removeItem('key');
      }).not.toThrow();
    });
  });
});

