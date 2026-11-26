import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DevPinModal } from '../../src/components/dev/DevPinModal';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';

function mockDevMode(overrides: Partial<ReturnType<typeof developerModeHook.useDeveloperMode>> = {}) {
  const closePinModal = vi.fn();
  const submitPin = vi.fn().mockResolvedValue(false);

  vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
    isDesktop: true,
    isPinModalOpen: true,
    pinState: 'idle',
    attemptsRemaining: 5,
    lockoutRemainingSeconds: 0,
    isRenewal: false,
    closePinModal,
    submitPin,
    ...overrides,
  } as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>);

  return { closePinModal, submitPin };
}

describe('DevPinModal mobile blocking', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(Date.now()), 0) as unknown as number;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows only the blocking message on mobile and omits the usual PIN content', () => {
    const { closePinModal } = mockDevMode({ isDesktop: false, isPinModalOpen: true });

    render(<DevPinModal />);

    expect(screen.getByText('Desktop Required')).toBeTruthy();
    expect(screen.getByText('Developer mode is desktop only')).toBeTruthy();
    expect(
      screen.getByText('Switch to a desktop or laptop browser to authenticate and edit.')
    ).toBeTruthy();

    expect(screen.queryByText('Developer Authentication')).toBeNull();
    expect(screen.queryByText('Enter 4-digit PIN.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(closePinModal).toHaveBeenCalledTimes(1);
  });

  it('shows the usual PIN authentication content on desktop', () => {
    mockDevMode({ isDesktop: true, isPinModalOpen: true });

    render(<DevPinModal />);

    expect(screen.getByText('Developer Authentication')).toBeTruthy();
    expect(screen.getByText('Enter 4-digit PIN.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.queryByText('Developer mode is desktop only')).toBeNull();
  });
});
