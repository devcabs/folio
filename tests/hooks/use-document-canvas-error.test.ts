import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentCanvas } from '../../src/hooks/useDocumentCanvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';

describe('useDocumentCanvas Edge Fetch Error Handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: false,
      isDesktop: true,
      canUnlock: false,
      isUnlocked: false,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('captures network failure and exposes fetchError', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network connection failed'));

    const { result } = renderHook(() => useDocumentCanvas('access'));

    expect(result.current.isHydrating).toBe(true);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isHydrating).toBe(false);
    expect(result.current.fetchError).toBe('Network connection failed');
  });

  it('captures HTTP non-ok status (404/500) and exposes fetchError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'Not found' }),
    });

    const { result } = renderHook(() => useDocumentCanvas('equity'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isHydrating).toBe(false);
    expect(result.current.fetchError).toContain('HTTP 404');
  });

  it('detects non-JSON payload (e.g. Vite dev server HTML fallback) and exposes fetchError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
      text: async () => '<!doctype html><html>...</html>',
      json: async () => {
        throw new SyntaxError("Unexpected token '<'");
      },
    });

    const { result } = renderHook(() => useDocumentCanvas('quality'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isHydrating).toBe(false);
    expect(result.current.fetchError).toContain('expected JSON');
  });

  it('allows retrying fetch via retryFetch', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Temporary edge hiccup'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          nodeId: 'access',
          canvas: {
            nodeId: 'access',
            version: 2,
            sections: [
              {
                id: 'sec-1',
                type: 'section',
                title: 'Recovered Section',
                elements: [],
              },
            ],
            updatedAt: '2026-11-16T09:00:00Z',
          },
        }),
      });
    });

    const { result } = renderHook(() => useDocumentCanvas('access'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.fetchError).toBe('Temporary edge hiccup');
    expect(result.current.document.sections.length).toBe(0);

    // Call retry
    await act(async () => {
      result.current.retryFetch();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.fetchError).toBeNull();
    expect(result.current.document.sections.length).toBe(1);
    expect(result.current.document.sections[0].title).toBe('Recovered Section');
  });
});
