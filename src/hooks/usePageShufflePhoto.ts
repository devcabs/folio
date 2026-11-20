import { useEffect, useMemo, useState } from 'react';
import { useDeveloperMode } from './useDeveloperMode';
import {
  PAGE_PHOTO_SHUFFLE_INTERVAL_MS,
  STOCK_PAGE_PHOTOS,
  collectPagePhotos,
  shuffleList,
} from '../utils/pagePhotoPool';
import type { NodeCanvasDocument } from '../types/canvas';

/**
 * Resolves a shuffling photo for a page-link card without a cover image.
 * Pool: photos registered on the target page and all its subpages; stock photos if none exist.
 * Advances every 5s through a shuffled order, no repeats until exhausted.
 * Pauses while the tab is hidden or when reduced motion is preferred.
 */
export function usePageShufflePhoto(pageIds: readonly string[], enabled: boolean): string | null {
  const { isDevMode, lockToken } = useDeveloperMode();
  const [pagePhotos, setPagePhotos] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);

  const idsKey = pageIds.join('|');

  useEffect(() => {
    setPagePhotos(null);
    const ids = idsKey ? idsKey.split('|') : [];
    if (!enabled || ids.length === 0 || typeof fetch !== 'function') return;
    let cancelled = false;
    const headers: Record<string, string> = {};
    if (isDevMode && lockToken) headers.Authorization = `Bearer ${lockToken}`;

    const fetchJson = async (url: string) => {
      const res = await fetch(url, {
        cache: 'no-store',
        ...(Object.keys(headers).length ? { headers } : {}),
      });
      if (!res?.ok) throw new Error('fetch failed');
      return res.json();
    };

    (async () => {
      try {
        let canvases: Array<NodeCanvasDocument | undefined>;
        if (isDevMode) {
          const data = await fetchJson('/api/draft');
          canvases = ids.map((id) => data?.canvases?.[id]);
        } else {
          const results = await Promise.all(
            ids.map((id) => fetchJson(`/api/public/node/${id}`).catch(() => null))
          );
          canvases = results.map((d) => d?.canvas);
        }
        const photos = collectPagePhotos(canvases.flatMap((c) => c?.elements ?? []));
        if (!cancelled) setPagePhotos(photos);
      } catch {
        if (!cancelled) setPagePhotos([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idsKey, enabled, isDevMode, lockToken]);

  const order = useMemo(() => {
    if (pagePhotos === null) return [];
    return shuffleList(pagePhotos.length > 0 ? pagePhotos : STOCK_PAGE_PHOTOS);
  }, [pagePhotos]);

  useEffect(() => {
    setIndex(0);
    if (!enabled || order.length < 2) return;
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setIndex((i) => (i + 1) % order.length);
    }, PAGE_PHOTO_SHUFFLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [order, enabled]);

  return order.length > 0 ? order[index % order.length] : null;
}
