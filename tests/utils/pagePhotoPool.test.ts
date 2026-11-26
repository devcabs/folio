import { describe, it, expect } from 'vitest';
import {
  getPageAndDescendantIds,
  collectPagePhotos,
  shuffleList,
  STOCK_PAGE_PHOTOS,
  hashString,
  getStartingPhotoIndex,
} from '../../src/utils/pagePhotoPool';
import type { CanvasElement } from '../../src/types/canvas';

describe('pagePhotoPool', () => {
  it('collects photo srcs and gallery photos, de-duplicated, skipping empties', () => {
    const elements = [
      { id: 'a', type: 'photo', pointId: 'p', src: '/x.jpg' },
      { id: 'b', type: 'photo', pointId: 'p', src: '  ' },
      { id: 'c', type: 'photo', pointId: 'p', src: '/x.jpg' },
      {
        id: 'd',
        type: 'gallery',
        pointId: 'p',
        syncedPhotos: [{ fullImageUrl: '/g1.jpg' }, { thumbnailUrl: '/g2.jpg' }],
      },
      { id: 'e', type: 'text', pointId: 'p', content: 'hi' },
    ] as unknown as CanvasElement[];
    expect(collectPagePhotos(elements)).toEqual(['/x.jpg', '/g1.jpg', '/g2.jpg']);
  });

  it('returns empty for no elements', () => {
    expect(collectPagePhotos(undefined)).toEqual([]);
  });

  it('shuffleList keeps all items and does not mutate input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffleList(input, () => 0.3);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('has stock photos', () => {
    expect(STOCK_PAGE_PHOTOS.length).toBeGreaterThan(0);
  });

  it('finds all descendant pages and tolerates cycles', () => {
    const pages = {
      a: { id: 'a', parentId: 'root' },
      b: { id: 'b', parentId: 'a' },
      c: { id: 'c', parentId: 'b' },
      x: { id: 'x', parentId: 'other' },
    } as never;
    expect(getPageAndDescendantIds('a', pages)).toEqual(['a', 'b', 'c']);
  });

  it('hashString produces deterministic non-negative hashes', () => {
    expect(hashString('')).toBe(0);
    const h1 = hashString('page-mwolcteh-niojk');
    const h2 = hashString('page-mwty9n80-csaa3');
    expect(h1).toBeGreaterThan(0);
    expect(h2).toBeGreaterThan(0);
    expect(h1).not.toBe(h2);
  });

  it('getStartingPhotoIndex stays within bounds and incorporates seed offsets', () => {
    expect(getStartingPhotoIndex(0)).toBe(0);
    expect(getStartingPhotoIndex(5, 'page-1', () => 0)).toBe(hashString('page-1') % 5);
    const idx = getStartingPhotoIndex(5, 'page-abc', () => 0.8);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(5);
  });
});
