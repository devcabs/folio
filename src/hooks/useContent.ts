import { useMemo, useCallback } from 'react';
import {
  resolveContent,
  hasContentOverrideInMap,
  updateDraftContentOverride,
  removeDraftContentOverride,
} from '../utils/contentDb';
import { useDeveloperMode } from './useDeveloperMode';
import { usePortalChrome } from '../context/PortalChromeContext';

export { updateDraftContentOverride, removeDraftContentOverride };

export interface UseContentReturn {
  /** The current resolved text content (from PortalChromeContext KV state or default) */
  text: string;
  /** Whether this content key currently has a custom override saved in KV */
  isModified: boolean;
  /** Update the text override in Cloudflare KV draft:workspace */
  setText: (value: string) => Promise<void>;
  /** Alias for setText matching useContentObject signature */
  setValue: (value: string) => Promise<void>;
  /** Revert to the hardcoded system default by deleting the key from draft:workspace */
  resetText: () => Promise<void>;
  /** Alias for resetText matching useContentObject signature */
  resetValue: () => Promise<void>;
}

/**
 * Reactive hook to dynamically consume and modify text content from PortalChromeContext (Cloudflare KV SSOT).
 */
export function useContent(
  key: string,
  defaultValue: string,
  explicitDevMode?: boolean
): UseContentReturn {
  const { isDevMode: contextDevMode, lockToken } = useDeveloperMode();
  const isDevMode = explicitDevMode ?? contextDevMode;
  const portalChrome = usePortalChrome();

  const contentOverrides = portalChrome?.contentOverrides ?? {};
  const text = resolveContent(contentOverrides, key, defaultValue);
  const isModified = hasContentOverrideInMap(contentOverrides, key);

  const handleSetText = useCallback(
    async (value: string): Promise<void> => {
      if (!isDevMode) {
        throw new Error('Cannot mutate content overrides in Public Mode.');
      }
      if (portalChrome) {
        await portalChrome.updateOverride(key, value);
      } else {
        await updateDraftContentOverride(key, value, contentOverrides, { lockToken });
      }
    },
    [key, isDevMode, portalChrome, contentOverrides, lockToken]
  );

  const handleResetText = useCallback(async (): Promise<void> => {
    if (!isDevMode) {
      throw new Error('Cannot reset content overrides in Public Mode.');
    }
    if (portalChrome) {
      await portalChrome.removeOverride(key);
    } else {
      await removeDraftContentOverride(key, contentOverrides, { lockToken });
    }
  }, [key, isDevMode, portalChrome, contentOverrides, lockToken]);

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
  /** The current resolved object content (from PortalChromeContext KV state or default) */
  value: T;
  /** Whether this content key currently has a custom override saved in KV */
  isModified: boolean;
  /** Update the object override in Cloudflare KV draft:workspace */
  setValue: (value: T) => Promise<void>;
  /** Revert to the hardcoded system default */
  resetValue: () => Promise<void>;
}

/**
 * Reactive hook to dynamically consume and modify structured content from PortalChromeContext.
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
    async (newValue: T): Promise<void> => {
      const serialized = typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
      await setRawText(serialized);
    },
    [setRawText]
  );

  const handleResetValue = useCallback(async (): Promise<void> => {
    await resetText();
  }, [resetText]);

  return {
    value,
    isModified,
    setValue: handleSetValue,
    resetValue: handleResetValue,
  };
}

export default useContent;
