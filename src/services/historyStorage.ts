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
        console.warn('[historyStorage] Save to IndexedDB failed:', req.error);
        resolve(false);
      };
    } catch (err) {
      console.warn('[historyStorage] IndexedDB transaction error:', err);
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
        console.warn('[historyStorage] Read from IndexedDB failed:', req.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('[historyStorage] IndexedDB read error:', err);
      resolve(null);
    }
  });
}
