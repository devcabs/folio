import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Toast } from '../../src/components/feedback/Toast';

describe('Toast Component & Multi-Toast Management', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.clearAllTimers();
      cleanup();
    });
    vi.useRealTimers();
    const container = document.getElementById('folio-toast-container');
    if (container) {
      container.remove();
    }
  });

  it('renders a single toast without left icon and without "Close all" button', () => {
    const handleDismiss = vi.fn();
    render(
      <Toast
        message="Changes saved successfully"
        type="success"
        onDismiss={handleDismiss}
        playAudio={false}
      />
    );

    expect(screen.getByText('Changes saved successfully')).toBeDefined();
    // Verify no left icon SVG
    const statusEl = screen.getByRole('status');
    const svgs = statusEl.querySelectorAll('svg');
    expect(svgs.length).toBe(0);

    // Verify "Close all" button does NOT exist for a single toast
    expect(screen.queryByRole('button', { name: /close all/i })).toBeNull();
  });

  it('renders multiple toasts in a shared container without stacking/overlapping', () => {
    const handleDismiss1 = vi.fn();
    const handleDismiss2 = vi.fn();

    const MultiTest = () => (
      <div>
        <Toast
          message="Notification 1"
          type="info"
          onDismiss={handleDismiss1}
          playAudio={false}
        />
        <Toast
          message="Notification 2"
          type="error"
          onDismiss={handleDismiss2}
          playAudio={false}
        />
      </div>
    );

    render(<MultiTest />);

    const container = document.getElementById('folio-toast-container');
    expect(container).not.toBeNull();

    // Verify both toasts exist in the shared container
    const items = screen.getAllByRole('status');
    expect(items.length).toBe(2);
    expect(screen.getByText('Notification 1')).toBeDefined();
    expect(screen.getByText('Notification 2')).toBeDefined();

    // Verify both items are inside the container
    expect(container?.contains(items[0])).toBe(true);
    expect(container?.contains(items[1])).toBe(true);
  });

  it('displays a "Close all" button when multiple toasts are active, and dismisses all on click', () => {
    const handleDismiss1 = vi.fn();
    const handleDismiss2 = vi.fn();
    const handleDismiss3 = vi.fn();

    const MultiTest = () => (
      <div>
        <Toast
          message="First Notice"
          type="info"
          onDismiss={handleDismiss1}
          playAudio={false}
        />
        <Toast
          message="Second Notice"
          type="success"
          onDismiss={handleDismiss2}
          playAudio={false}
        />
        <Toast
          message="Third Notice"
          type="error"
          onDismiss={handleDismiss3}
          playAudio={false}
        />
      </div>
    );

    render(<MultiTest />);

    const closeAllBtn = screen.getByRole('button', { name: /close all/i });
    expect(closeAllBtn).toBeDefined();

    act(() => {
      fireEvent.click(closeAllBtn);
    });

    expect(handleDismiss1).toHaveBeenCalledTimes(1);
    expect(handleDismiss2).toHaveBeenCalledTimes(1);
    expect(handleDismiss3).toHaveBeenCalledTimes(1);
  });

  it('auto-closes toast after defined durationMs without resetting on parent re-render', () => {
    const handleDismiss = vi.fn();

    const ReRenderingParent = () => {
      const [count, setCount] = useState(0);
      return (
        <div>
          <button onClick={() => setCount((c) => c + 1)}>Re-render ({count})</button>
          <Toast
            message="Auto-expiring notice"
            durationMs={3000}
            // Passing a fresh function instance on every render
            onDismiss={() => handleDismiss()}
            playAudio={false}
          />
        </div>
      );
    };

    render(<ReRenderingParent />);

    // Fast-forward 1500ms
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(handleDismiss).not.toHaveBeenCalled();

    // Trigger re-render of parent with fresh onDismiss callback
    const btn = screen.getByRole('button', { name: /re-render/i });
    act(() => {
      fireEvent.click(btn);
    });

    // Advance remaining 1500ms (total 3000ms from start)
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // The toast should dismiss at exactly 3000ms, not restarted by the re-render
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not auto-close when durationMs is 0 or negative', () => {
    const handleDismiss = vi.fn();

    render(
      <Toast
        message="Persistent notice"
        durationMs={0}
        onDismiss={handleDismiss}
        playAudio={false}
      />
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(handleDismiss).not.toHaveBeenCalled();
  });

  it('supports action button and calls both onAction and onDismiss when clicked', () => {
    const handleDismiss = vi.fn();
    const handleAction = vi.fn();

    render(
      <Toast
        message="File removed"
        type="info"
        actionLabel="Undo"
        onAction={handleAction}
        onDismiss={handleDismiss}
        playAudio={false}
      />
    );

    const actionBtn = screen.getByRole('button', { name: 'Undo' });
    expect(actionBtn).toBeDefined();

    act(() => {
      fireEvent.click(actionBtn);
    });

    expect(handleAction).toHaveBeenCalledTimes(1);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
