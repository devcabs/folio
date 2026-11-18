import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { useDiscreteStepNavigation } from '../../src/hooks/use-discrete-step-navigation';
import { acquireScrollLock, releaseScrollLock, isScrollLocked } from '../../src/utils/scrollLock';

interface HarnessProps {
  onNextStage?: () => void;
  onDirectStage?: (stage: number) => void;
}

const TestHarness: React.FC<HarnessProps> = ({
  onNextStage = vi.fn(),
  onDirectStage = vi.fn(),
}) => {
  useDiscreteStepNavigation({
    enabled: true,
    activeStage: 1,
    scrollZone: 'inside',
    onNextStage,
    onPrevStage: vi.fn(),
    onScrollToTop: vi.fn(),
    onScrollToFooter: vi.fn(),
    onDirectStage,
  });

  return <div data-testid="main-viewport">Main Viewport</div>;
};

describe('useDiscreteStepNavigation overlay & scrollLock yielding', () => {
  beforeEach(() => {
    const makeClassList = () => {
      const classes = new Set<string>();
      return {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        contains: (c: string) => classes.has(c),
      };
    };
    if (!document.documentElement) {
      (document as any).documentElement = {
        style: {},
        clientWidth: 1280,
        classList: makeClassList(),
      };
    } else if (!document.documentElement.classList) {
      (document.documentElement as any).classList = makeClassList();
    }
    if (document.body && !document.body.classList) {
      (document.body as any).classList = makeClassList();
    }
  });

  afterEach(() => {
    cleanup();
    while (isScrollLocked()) {
      releaseScrollLock();
    }
  });

  it('yields wheel and keyboard navigation while scroll lock is active (drawer/modal open)', () => {
    const onNextStage = vi.fn();
    render(<TestHarness onNextStage={onNextStage} />);

    acquireScrollLock();
    expect(isScrollLocked()).toBe(true);

    const wheelEvent = new Event('wheel', { bubbles: true, cancelable: true }) as any;
    wheelEvent.deltaY = 120;
    window.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(false);
    expect(onNextStage).not.toHaveBeenCalled();

    const keyEvent = new Event('keydown', { bubbles: true, cancelable: true }) as any;
    keyEvent.key = 'ArrowDown';
    window.dispatchEvent(keyEvent);

    expect(keyEvent.defaultPrevented).toBe(false);
    expect(onNextStage).not.toHaveBeenCalled();

    // Release lock and verify discrete navigation resumes
    releaseScrollLock();
    expect(isScrollLocked()).toBe(false);

    const unlockedWheel = new Event('wheel', { bubbles: true, cancelable: true }) as any;
    unlockedWheel.deltaY = 120;
    window.dispatchEvent(unlockedWheel);

    expect(unlockedWheel.defaultPrevented).toBe(true);
    expect(onNextStage).toHaveBeenCalledTimes(1);
  });

  it('yields wheel events originating inside a dialog/modal container', () => {
    const onNextStage = vi.fn();
    render(
      <>
        <TestHarness onNextStage={onNextStage} />
        <div role="dialog" aria-modal="true">
          <div>Scrollable content</div>
        </div>
      </>
    );

    const drawerBody = screen.getByText('Scrollable content') as any;
    if (typeof drawerBody.closest !== 'function') {
      drawerBody.closest = (selector: string) =>
        selector.includes('role="dialog"') ? drawerBody : null;
    }
    const wheelEvent = new Event('wheel', { bubbles: true, cancelable: true }) as any;
    wheelEvent.deltaY = 120;
    Object.defineProperty(wheelEvent, 'target', { value: drawerBody });
    window.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(false);
    expect(onNextStage).not.toHaveBeenCalled();
  });
});
