import { getStorageNamespace } from '../config/engine.config';
/**
 * Folio Engine - Persistent IndexedDB Storage for History Snapshots
 * Location: src/services/historyStorage.ts
 * Specification: docs/tasks/task9_7_draft_and_publish_history_system.md
 *
 * Provides high-capacity, persistent client-side storage for full
 * snapshot bundles to eliminate the 5MB localStorage QuotaExceededError.
 */

export const getHistoryDbName = (ns?: string) => (ns || getStorageNamespace()) + '_portal_db';
const DB_VERSION = 1;
const STORE_NAME = 'history_store';

export const EVENT_INDEXEDDB_ERROR = 'engine-indexeddb-storage-error';

export interface IndexedDBErrorDetail {
  action: 'save' | 'load';
  error: string;
  timestamp: string;
}

export function notifyIndexedDBError(action: 'save' | 'load', error: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    const errorMsg = error instanceof Error ? error.message : String(error);
    window.dispatchEvent(
      new CustomEvent<IndexedDBErrorDetail>(EVENT_INDEXEDDB_ERROR, {
        detail: { action, error: errorMsg, timestamp: new Date().toISOString() },
      })
    );
  } catch {
    // Non-browser context
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(getHistoryDbName(), DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('[historyStorage] IndexedDB open error:', request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('[historyStorage] IndexedDB initialization error:', err);
      resolve(null);
    }
  });
}

/**
 * Persists an item to IndexedDB with zero quota risk.
 */
export async function saveToIndexedDB(key: string, value: unknown): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);

      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        const error = req.error;
        const errName = error?.name || 'IndexedDBError';
        const errMsg = error?.message || String(error);
        console.warn(`[historyStorage] Save to IndexedDB failed: ${errName}: ${errMsg}`);
        notifyIndexedDBError('save', error);
        resolve(false);
      };
    } catch (err) {
      const errName = err instanceof Error ? err.name : 'IndexedDBTransactionError';
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[historyStorage] IndexedDB transaction error: ${errName}: ${errMsg}`);
      notifyIndexedDBError('save', err);
      resolve(false);
    }
  });
}

/**
 * Retrieves an item from IndexedDB.
 */
export async function loadFromIndexedDB<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve((req.result as T) ?? null);
      };

      req.onerror = () => {
        const error = req.error;
        const errName = error?.name || 'IndexedDBError';
        const errMsg = error?.message || String(error);
        console.warn(`[historyStorage] Read from IndexedDB failed: ${errName}: ${errMsg}`);
        notifyIndexedDBError('load', error);
        resolve(null);
      };
    } catch (err) {
      const errName = err instanceof Error ? err.name : 'IndexedDBReadError';
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[historyStorage] IndexedDB read error: ${errName}: ${errMsg}`);
      notifyIndexedDBError('load', err);
      resolve(null);
    }
  });
}
