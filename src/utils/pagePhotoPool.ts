import type { CanvasElement } from '../types/canvas';
import type { PageRegistry } from '../types/page';
import { resolveSingleDrivePhotoUrl } from './mediaUrl';

/** Bundled stock photos used only when a page has no registered photos at all. */
export const STOCK_PAGE_PHOTOS: readonly string[] = [
  '/images/nodes/01-access.webp',
  '/images/nodes/02-equity.webp',
  '/images/nodes/03-quality.webp',
  '/images/nodes/04-resiliency.webp',
  '/images/nodes/05-governance.webp',
];

export const PAGE_PHOTO_SHUFFLE_INTERVAL_MS = 5000;

function resolveUrl(raw?: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return resolveSingleDrivePhotoUrl(trimmed)?.displayUrl ?? trimmed;
}

/** Collects de-duplicated, renderable photo URLs from photo elements and gallery synced photos. */
export function collectPagePhotos(elements: readonly CanvasElement[] | undefined): string[] {
  const seen = new Set<string>();
  const add = (raw?: string) => {
    const url = resolveUrl(raw);
    if (url) seen.add(url);
  };
  for (const el of elements ?? []) {
    if (el.type === 'photo') {
      add(el.src);
    } else if (el.type === 'gallery') {
      for (const p of el.syncedPhotos ?? []) add(p.fullImageUrl || p.thumbnailUrl);
    }
  }
  return [...seen];
}

/** Fisher-Yates shuffle returning a new array. */
export function shuffleList<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Returns the page id followed by all of its descendant page ids (cycle-safe, breadth-first). */
export function getPageAndDescendantIds(pageId: string, pages: PageRegistry): string[] {
  const result = [pageId];
  const seen = new Set(result);
  for (let i = 0; i < result.length; i++) {
    for (const page of Object.values(pages)) {
      if (page.parentId === result[i] && !seen.has(page.id)) {
        seen.add(page.id);
        result.push(page.id);
      }
    }
  }
  return result;
}
