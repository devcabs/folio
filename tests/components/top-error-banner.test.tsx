import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopErrorBanner } from '../../src/components/feedback/TopErrorBanner';

describe('TopErrorBanner Component', () => {
  it('renders with role="alert" and assertive aria-live announcement', () => {
    render(<TopErrorBanner message="Failed to fetch node canvas record" />);

    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeDefined();
    expect(alertEl.getAttribute('aria-live')).toBe('assertive');
    expect(screen.getByText('Failed to fetch node canvas record')).toBeDefined();
  });

  it('renders optional node title and details when provided', () => {
    render(
      <TopErrorBanner
        message="Edge KV connection timed out"
        nodeTitle="Project Initiation"
        details="Endpoint returned status 504"
      />
    );

    expect(screen.getByText(/Project Initiation/i)).toBeDefined();
    expect(screen.getByText(/Edge KV connection timed out/i)).toBeDefined();
    expect(screen.getByText(/Endpoint returned status 504/i)).toBeDefined();
  });

  it('calls onRetry callback when retry action button is clicked', () => {
    const handleRetry = vi.fn();
    render(
      <TopErrorBanner
        message="Network failure"
        onRetry={handleRetry}
      />
    );

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeDefined();
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss callback when dismiss button is clicked', () => {
    const handleDismiss = vi.fn();
    render(
      <TopErrorBanner
        message="Non-critical notice"
        onDismiss={handleDismiss}
      />
    );

    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    expect(dismissBtn).toBeDefined();
    fireEvent.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
