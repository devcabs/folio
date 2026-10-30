/**
 * Content Database & Dynamic Text Registry Engine
 * Folio Engine
 *
 * Implements a reactive, client-side dual-channel content repository.
 * Strictly separates uncommitted drafts (isDevMode = true) from canonical live
 * published text (isDevMode = false), preventing cross-talk and leaks to public visitors.
 */

import {
  setDraftDirty,
} from '../services/draftService';
import { getStorage } from './storage';

export const STORAGE_KEY_LIVE_CONTENT = 'masid_live_content_overrides';
export const STORAGE_KEY_DRAFT_CONTENT = 'masid_draft_content_overrides';
export const STORAGE_KEY_LEGACY_CONTENT = 'masid_content_overrides';
export const STORAGE_KEY_CONTENT_OVERRIDES = STORAGE_KEY_LIVE_CONTENT;

export const EVENT_LIVE_CONTENT_CHANGE = 'engine-live-content-change';
export const EVENT_DRAFT_CONTENT_CHANGE = 'engine-draft-content-change';

let liveMemoryCache: Record<string, string> | null = null;
let draftMemoryCache: Record<string, string> | null = null;

function loadLiveCache(): Record<string, string> {
  if (liveMemoryCache !== null) return liveMemoryCache;
  const storage = getStorage();
  if (!storage) {
    liveMemoryCache = {};
    return liveMemoryCache;
  }
  try {
    // Check canonical live key first
    let raw = storage.getItem(STORAGE_KEY_LIVE_CONTENT);
    // Backward compatibility fallback to legacy key
    if (!raw) {
      raw = storage.getItem(STORAGE_KEY_LEGACY_CONTENT);
    }
    liveMemoryCache = raw ? JSON.parse(raw) : {};
  } catch {
    liveMemoryCache = {};
  }
  return liveMemoryCache as Record<string, string>;
}

function loadDraftCache(): Record<string, string> {
  if (draftMemoryCache !== null) return draftMemoryCache;
  const storage = getStorage();
  if (!storage) {
    draftMemoryCache = {};
    return draftMemoryCache;
  }
  try {
    const raw = storage.getItem(STORAGE_KEY_DRAFT_CONTENT);
    draftMemoryCache = raw ? JSON.parse(raw) : {};
  } catch {
    draftMemoryCache = {};
  }
  return draftMemoryCache as Record<string, string>;
}

function saveLiveCache(): void {
  const storage = getStorage();
  if (!storage || !liveMemoryCache) return;
  try {
    storage.setItem(STORAGE_KEY_LIVE_CONTENT, JSON.stringify(liveMemoryCache));
  } catch {
    // Storage quota exceeded or disabled
  }
}

function saveDraftCache(): void {
  const storage = getStorage();
  if (!storage || !draftMemoryCache) return;
  try {
    storage.setItem(STORAGE_KEY_DRAFT_CONTENT, JSON.stringify(draftMemoryCache));
    setDraftDirty(true);
  } catch {
    // Storage quota exceeded or disabled
  }
}

function notifySubscribers(key: string, value: string | null, isDevMode = false): void {
  if (typeof window === 'undefined') return;
  try {
    const eventName = isDevMode ? EVENT_DRAFT_CONTENT_CHANGE : EVENT_LIVE_CONTENT_CHANGE;
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: { key, value },
      })
    );
  } catch {
    // dispatch failure in non-browser env
  }
}

/**
 * Retrieves the current text for a given key with strict channel isolation.
 * Public visitors (isDevMode = false) strictly read canonical live overrides;
 * Coordinators (isDevMode = true) read draft overrides, falling back to live before hardcoded defaults.
 */
export function getContent(key: string, defaultValue: string, isDevMode = false): string {
  const cache = isDevMode ? loadDraftCache() : loadLiveCache();
  if (Object.prototype.hasOwnProperty.call(cache, key) && typeof cache[key] === 'string') {
    return cache[key];
  }
  // In dev mode, if not in draft, check live cache before falling back to default
  if (isDevMode) {
    const liveCache = loadLiveCache();
    if (Object.prototype.hasOwnProperty.call(liveCache, key) && typeof liveCache[key] === 'string') {
      return liveCache[key];
    }
  }
  return defaultValue;
}

/**
 * Checks whether a specific content key currently has a custom override saved.
 */
export function hasContentOverride(key: string, isDevMode = false): boolean {
  const cache = isDevMode ? loadDraftCache() : loadLiveCache();
  if (Object.prototype.hasOwnProperty.call(cache, key)) {
    return true;
  }
  if (isDevMode) {
    const liveCache = loadLiveCache();
    return Object.prototype.hasOwnProperty.call(liveCache, key);
  }
  return false;
}

/**
 * Persists an edited text override strictly isolated to the specified channel.
 */
export function setContent(key: string, value: string, isDevMode = false): void {
  if (isDevMode) {
    const cache = loadDraftCache();
    cache[key] = value;
    saveDraftCache();
    notifySubscribers(key, value, true);
  } else {
    const cache = loadLiveCache();
    cache[key] = value;
    saveLiveCache();
    notifySubscribers(key, value, false);
  }
}

/**
 * Retrieves structured content (link, image, file, or object) from the DB.
 * Gracefully parses JSON if serialized, falling back to defaultValue.
 */
export function getContentObject<T>(key: string, defaultValue: T, isDevMode = false): T {
  const raw = getContent(key, '', isDevMode);
  if (!raw) return defaultValue;
  try {
    const parsed = JSON.parse(raw);
    // Gracefully handle image object defaults when override is string or partial object
    if (
      defaultValue &&
      typeof defaultValue === 'object' &&
      'src' in (defaultValue as Record<string, unknown>)
    ) {
      if (typeof parsed === 'string') {
        return { ...(defaultValue as Record<string, unknown>), src: parsed } as unknown as T;
      }
      if (parsed && typeof parsed === 'object') {
        return { ...(defaultValue as Record<string, unknown>), ...parsed } as unknown as T;
      }
    }
    return parsed as T;
  } catch {
    // If raw could not be parsed as JSON, but defaultValue has 'src' (e.g. raw URL string stored in DB)
    if (
      defaultValue &&
      typeof defaultValue === 'object' &&
      'src' in (defaultValue as Record<string, unknown>) &&
      typeof raw === 'string' &&
      raw.trim().length > 0
    ) {
      return { ...(defaultValue as Record<string, unknown>), src: raw.trim() } as unknown as T;
    }
    if (typeof defaultValue === 'string') {
      return raw as unknown as T;
    }
    return defaultValue;
  }
}

/**
 * Persists a structured object into the DB by serializing it to JSON.
 */
export function setContentObject<T>(key: string, value: T, isDevMode = false): void {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  setContent(key, serialized, isDevMode);
}

/**
 * Resets a content key back to its default value by removing the override.
 */
export function resetContent(key: string, isDevMode = false): void {
  if (isDevMode) {
    const cache = loadDraftCache();
    if (Object.prototype.hasOwnProperty.call(cache, key)) {
      delete cache[key];
      saveDraftCache();
      notifySubscribers(key, null, true);
    }
  } else {
    const cache = loadLiveCache();
    if (Object.prototype.hasOwnProperty.call(cache, key)) {
      delete cache[key];
      saveLiveCache();
      notifySubscribers(key, null, false);
    }
  }
}

/**
 * Returns a copy of all current content overrides for the targeted channel.
 */
export function getAllContentOverrides(isDevMode = false): Record<string, string> {
  if (isDevMode) {
    return { ...loadLiveCache(), ...loadDraftCache() };
  }
  return { ...loadLiveCache() };
}

/**
 * Resets all content overrides back to system defaults.
 */
export function resetAllContentOverrides(isDevMode = false): void {
  const storage = getStorage();
  if (isDevMode) {
    draftMemoryCache = {};
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY_DRAFT_CONTENT);
      } catch {
        // ignore
      }
    }
    notifySubscribers('*', null, true);
  } else {
    liveMemoryCache = {};
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY_LIVE_CONTENT);
        storage.removeItem(STORAGE_KEY_LEGACY_CONTENT);
      } catch {
        // ignore
      }
    }
    notifySubscribers('*', null, false);
  }
}

/**
 * Replaces all content overrides and notifies all reactive subscribers.
 * Used during historical snapshot restoration.
 */
export function setAllContentOverrides(overrides: Record<string, string>, isDevMode = false): void {
  if (isDevMode) {
    draftMemoryCache = { ...overrides };
    saveDraftCache();
    notifySubscribers('*', null, true);
  } else {
    liveMemoryCache = { ...overrides };
    saveLiveCache();
    notifySubscribers('*', null, false);
  }
}

/**
 * Invalidates the in-memory cache and forces next read from storage.
 */
export function invalidateContentCache(): void {
  liveMemoryCache = null;
  draftMemoryCache = null;
  notifySubscribers('*', null, false);
  notifySubscribers('*', null, true);
}

/**
 * Reads content overrides strictly from the canonical live/published channel.
 */
export function getLiveContentOverrides(): Record<string, string> {
  return { ...loadLiveCache() };
}

/**
 * Persists content overrides strictly to the canonical live/published channel.
 */
export function setLiveContentOverrides(overrides: Record<string, string>): void {
  liveMemoryCache = { ...overrides };
  saveLiveCache();
  notifySubscribers('*', null, false);
}

/**
 * Subscribes to content changes strictly scoped by channel.
 */
export function subscribeToContentChange(
  callback: (detail: { key: string; value: string | null }) => void,
  isDevMode = false
): () => void {
  if (typeof window === 'undefined') return () => {};

  const eventName = isDevMode ? EVENT_DRAFT_CONTENT_CHANGE : EVENT_LIVE_CONTENT_CHANGE;

  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<{ key: string; value: string | null }>;
    if (customEvent.detail) {
      callback(customEvent.detail);
    }
  };

  const storageHandler = (e: StorageEvent) => {
    const targetKey = isDevMode ? STORAGE_KEY_DRAFT_CONTENT : STORAGE_KEY_LIVE_CONTENT;
    if (e.key === targetKey || e.key === null) {
      if (isDevMode) {
        draftMemoryCache = null;
      } else {
        liveMemoryCache = null;
      }
      callback({ key: '*', value: null });
    }
  };

  window.addEventListener(eventName, handler);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(eventName, handler);
    window.removeEventListener('storage', storageHandler);
  };
}

interface ContentSubscriberEntry {
  key: string;
  isDevMode: boolean;
  callback: () => void;
}

const keySubscribers = new Set<ContentSubscriberEntry>();
let contentWindowListenersAttached = false;

function ensureContentWindowListeners(): void {
  if (typeof window === 'undefined' || contentWindowListenersAttached) return;

  const handleLiveWindowChange = (event: Event) => {
    const detail = (event as CustomEvent<{ key: string }>).detail;
    const changedKey = detail?.key || '*';
    keySubscribers.forEach((sub) => {
      if (changedKey === '*' || changedKey === sub.key) {
        sub.callback();
      }
    });
  };

  const handleDraftWindowChange = (event: Event) => {
    const detail = (event as CustomEvent<{ key: string }>).detail;
    const changedKey = detail?.key || '*';
    keySubscribers.forEach((sub) => {
      if (sub.isDevMode && (changedKey === '*' || changedKey === sub.key)) {
        sub.callback();
      }
    });
  };

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY_LIVE_CONTENT || e.key === STORAGE_KEY_LEGACY_CONTENT || e.key === null) {
      liveMemoryCache = null;
      keySubscribers.forEach((sub) => sub.callback());
    } else if (e.key === STORAGE_KEY_DRAFT_CONTENT) {
      draftMemoryCache = null;
      keySubscribers.forEach((sub) => {
        if (sub.isDevMode) sub.callback();
      });
    }
  };

  window.addEventListener(EVENT_LIVE_CONTENT_CHANGE, handleLiveWindowChange);
  window.addEventListener(EVENT_DRAFT_CONTENT_CHANGE, handleDraftWindowChange);
  window.addEventListener('storage', handleStorageChange);
  contentWindowListenersAttached = true;
}

/**
 * Subscribes a listener to updates for a specific content key.
 * Used by useSyncExternalStore for granular, zero-overhead store subscriptions.
 */
export function subscribeContentKey(
  key: string,
  callback: () => void,
  isDevMode = false
): () => void {
  ensureContentWindowListeners();
  const entry: ContentSubscriberEntry = { key, isDevMode, callback };
  keySubscribers.add(entry);
  return () => {
    keySubscribers.delete(entry);
  };
}

/**
 * Snapshot getter for useSyncExternalStore.
 * Guarantees stable raw string snapshots from in-memory cache.
 */
export function getContentSnapshot(key: string, defaultValue: string, isDevMode = false): string {
  return getContent(key, defaultValue, isDevMode);
}

