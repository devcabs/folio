import { useSyncExternalStore, useMemo, useCallback } from 'react';
import {
  subscribeContentKey,
  getContentSnapshot,
  setContent,
  resetContent,
  hasContentOverride,
} from '../utils/contentDb';
import { useDeveloperMode } from './useDeveloperMode';

export interface UseContentReturn {
  /** The current resolved text content (from DB or default) */
  text: string;
  /** Whether this content key currently has a custom override saved in DB */
  isModified: boolean;
  /** Update the text override in the DB */
  setText: (value: string) => void;
  /** Alias for setText matching useContentObject signature */
  setValue: (value: string) => void;
  /** Revert to the hardcoded system default */
  resetText: () => void;
  /** Alias for resetText matching useContentObject signature */
  resetValue: () => void;
}

/**
 * Reactive hook to dynamically consume and modify text content from the Content DB.
 * Rebuilt on React 19's useSyncExternalStore for zero-overhead, flicker-free updates.
 * Guarantees that wildcard and unrelated notifications trigger zero re-renders.
 */
export function useContent(
  key: string,
  defaultValue: string,
  explicitDevMode?: boolean
): UseContentReturn {
  const { isDevMode: contextDevMode } = useDeveloperMode();
  const isDevMode = explicitDevMode ?? contextDevMode;

  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeContentKey(key, onStoreChange, isDevMode),
    [key, isDevMode]
  );

  const getSnapshot = useCallback(
    () => getContentSnapshot(key, defaultValue, isDevMode),
    [key, defaultValue, isDevMode]
  );

  const text = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isModified = hasContentOverride(key, isDevMode);

  const handleSetText = useCallback(
    (value: string) => {
      setContent(key, value, isDevMode);
    },
    [key, isDevMode]
  );

  const handleResetText = useCallback(() => {
    resetContent(key, isDevMode);
  }, [key, isDevMode]);

  return {
    text,
    isModified,
    setText: handleSetText,
    setValue: handleSetText,
    resetText: handleResetText,
    resetValue: handleResetText,
  };
}

export interface UseContentObjectReturn<T> {
  /** The current resolved object content (from DB or default) */
  value: T;
  /** Whether this content key currently has a custom override saved in DB */
  isModified: boolean;
  /** Update the object override in the DB */
  setValue: (value: T) => void;
  /** Revert to the hardcoded system default */
  resetValue: () => void;
}

/**
 * Reactive hook to dynamically consume and modify structured content (e.g. image payloads) from Content DB.
 * Derives its state from useContent's useSyncExternalStore primitive string snapshots, eliminating ghost re-renders.
 */
export function useContentObject<T>(
  key: string,
  defaultValue: T,
  explicitDevMode?: boolean
): UseContentObjectReturn<T> {
  const { isDevMode: contextDevMode } = useDeveloperMode();
  const isDevMode = explicitDevMode ?? contextDevMode;

  const defaultJson = useMemo(() => JSON.stringify(defaultValue), [defaultValue]);
  const {
    text: rawJson,
    setText: setRawText,
    isModified,
    resetText,
  } = useContent(key, defaultJson, isDevMode);

  const value = useMemo<T>(() => {
    if (!rawJson) return defaultValue;
    try {
      const parsed = JSON.parse(rawJson);
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
      if (
        defaultValue &&
        typeof defaultValue === 'object' &&
        'src' in (defaultValue as Record<string, unknown>) &&
        typeof rawJson === 'string' &&
        rawJson.trim().length > 0
      ) {
        return { ...(defaultValue as Record<string, unknown>), src: rawJson.trim() } as unknown as T;
      }
      if (typeof defaultValue === 'string') {
        return rawJson as unknown as T;
      }
      return defaultValue;
    }
  }, [rawJson, defaultValue]);

  const handleSetValue = useCallback(
    (newValue: T) => {
      const serialized = typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
      setRawText(serialized);
    },
    [setRawText]
  );

  const handleResetValue = useCallback(() => {
    resetText();
  }, [resetText]);

  return {
    value,
    isModified,
    setValue: handleSetValue,
    resetValue: handleResetValue,
  };
}

export default useContent;
