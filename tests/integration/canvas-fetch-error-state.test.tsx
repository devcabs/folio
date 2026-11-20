import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentCanvas } from '../../src/components/canvas/DocumentCanvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';

describe('DocumentCanvas Edge Fetch Error Isolation Gate', () => {
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

  it('renders red TopErrorBanner at top of viewport and suppresses CanvasEmptyNotice when edge fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection to Cloudflare Edge KV failed'));

    const { unmount } = render(
      <DocumentCanvas
        nodeId="access"
        nodeTitle="Project Initiation"
      />
    );

    // Let the async fetch effect run and reject
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // 1. Must mount TopErrorBanner
    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeDefined();
    expect(alertEl.getAttribute('aria-live')).toBe('assertive');
    expect(screen.getByText(/Connection to Cloudflare Edge KV failed/i)).toBeDefined();
    expect(screen.getByText(/Project Initiation/i)).toBeDefined();

    // 2. Must NEVER show CanvasEmptyNotice ("Initiatives in Preparation")
    expect(screen.queryByText(/Initiatives in Preparation/i)).toBeNull();
    expect(screen.queryByTestId('canvas-empty-notice')).toBeNull();

    unmount();
  });

  it('renders CanvasEmptyNotice when edge fetch succeeds with 0 sections and no error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        nodeId: 'access',
        canvas: {
          nodeId: 'access',
          version: 3,
          elements: [],
          updatedAt: '2026-11-16T09:00:00Z',
        },
      }),
    });

    const { unmount } = render(
      <DocumentCanvas
        nodeId="access"
        nodeTitle="Project Initiation"
      />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // 1. Must show CanvasEmptyNotice because node was legitimately published with 0 sections
    const notice = screen.queryByTestId('canvas-empty-notice');
    expect(notice).not.toBeNull();

    // 2. Must NOT show TopErrorBanner
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('top-error-banner')).toBeNull();

    unmount();
  });
});
