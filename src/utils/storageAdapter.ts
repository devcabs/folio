/**
 * Storage Adapter & SSR Safety Layer
 *
 * Lightweight storage adapter abstraction that guards all localStorage access,
 * preventing SSR crashes and silent SecurityError failures in private/incognito mode.
 * Enables dependency injection for both production and test contexts.
 */

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear?(): void;
}

/**
 * Browser-safe localStorage adapter.
 * Wraps localStorage with runtime `typeof window !== 'undefined'` checks inside
 * every method call (preventing module-level evaluation crashes during SSR).
 * Gracefully handles SecurityError or QuotaExceededError in restricted environments.
 */
export const localStorageAdapter: StorageAdapter = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(key, value);
    } catch {
      // Safe no-op on SecurityError, QuotaExceededError, or sandboxed environments
    }
  },

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.removeItem(key);
    } catch {
      // Safe no-op on SecurityError or sandboxed environments
    }
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.clear();
    } catch {
      // Safe no-op
    }
  },
};

/**
 * Creates an in-memory StorageAdapter backed by an isolated Map instance.
 * Completely decoupled from global state or browser environment.
 * Suitable for SSR, isolated testing, and non-browser workflows.
 */
export function createInMemoryAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };
}

