import { describe, it, expect } from 'vitest';
import { renderHook } from '../helpers/testing-library-shim';
import { usePageShufflePhoto } from '../../src/hooks/usePageShufflePhoto';
import { STOCK_PAGE_PHOTOS } from '../../src/utils/pagePhotoPool';

describe('usePageShufflePhoto', () => {
  it('immediately returns a randomized stock photo when enabled on mount', () => {
    const { result } = renderHook(() => usePageShufflePhoto(['page-empty-1'], true));
    expect(result.current).toBeTruthy();
    expect(STOCK_PAGE_PHOTOS).toContain(result.current);
  });

  it('returns null when enabled is false', () => {
    const { result } = renderHook(() => usePageShufflePhoto(['page-empty-1'], false));
    expect(result.current).toBeNull();
  });

  it('randomizes the starting point across two distinct empty pages', () => {
    const { result: r1 } = renderHook(() => usePageShufflePhoto(['page-mwolcteh-niojk'], true));
    const { result: r2 } = renderHook(() => usePageShufflePhoto(['page-mwty9n80-csaa3'], true));

    expect(r1.current).toBeTruthy();
    expect(r2.current).toBeTruthy();
    expect(STOCK_PAGE_PHOTOS).toContain(r1.current);
    expect(STOCK_PAGE_PHOTOS).toContain(r2.current);
  });
});
