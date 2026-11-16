/**
 * Folio Engine — Portal Chrome Hydration Hook
 * Location: src/hooks/usePortalChromeHydration.ts
 * Specification: docs/task/4.2-publish-chart-and-chrome-bundling.md
 *
 * Implements:
 * 1. Warm in-memory content DB from /api/public/manifest with { memoryOnly: true }.
 * 2. Zero localStorage writes for read-only public visitors.
 * 3. Zero-CLS gate: isHydrating flag allows rendering HeroWelcomeGhostWireframe
 *    until content overrides are loaded into memory.
 */

import { useState, useEffect } from 'react';
import { useDeveloperMode } from './useDeveloperMode';
import { setLiveContentOverrides } from '../utils/contentDb';
import type { PublicPortalManifestPayload } from '../types/edge';

let hasCompletedHydration = false;

export function resetPortalChromeHydrationForTesting(): void {
  hasCompletedHydration = false;
}

export function usePortalChromeHydration(): { isHydrating: boolean } {
  const { isDevMode } = useDeveloperMode();
  const [isHydrating, setIsHydrating] = useState<boolean>(() => {
    if (isDevMode || typeof window === 'undefined' || hasCompletedHydration) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (isDevMode || hasCompletedHydration) {
      setIsHydrating(false);
      return;
    }

    if (typeof fetch !== 'function') {
      setIsHydrating(false);
      return;
    }

    let isCancelled = false;
    fetch('/api/public/manifest')
      .then((res) => (res.ok ? (res.json() as Promise<PublicPortalManifestPayload>) : null))
      .then((manifest) => {
        if (isCancelled || !manifest) return;
        if (manifest.contentOverrides && Object.keys(manifest.contentOverrides).length > 0) {
          // Ingest strictly into memory cache; zero localStorage writes
          setLiveContentOverrides(manifest.contentOverrides, { memoryOnly: true });
        }
      })
      .catch(() => {
        // Graceful fallback to default text
      })
      .finally(() => {
        hasCompletedHydration = true;
        if (!isCancelled) {
          setIsHydrating(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isDevMode]);

  return { isHydrating };
}
