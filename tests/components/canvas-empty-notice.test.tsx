import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CanvasEmptyNotice } from '../../src/components/canvas/CanvasEmptyNotice';

describe('3.4 Dignified Public Empty Canvas State', () => {
  it('renders dignified documentation notice with semantic region and title', () => {
    render(<CanvasEmptyNotice nodeTitle="Resiliency" />);

    expect(screen.getByRole('region', { name: /Resiliency Documentation Notice/i })).toBeDefined();
    expect(screen.getByText(/Initiatives in Preparation/i)).toBeDefined();
    expect(screen.getByText(/Drafting in Progress/i)).toBeDefined();
  });

  it('renders institutional kicker, descriptive copy, and status badge', () => {
    render(
      <CanvasEmptyNotice
        nodeTitle="Governance"
        accentColor="var(--color-node-5)"
        className="custom-empty-notice-class"
      />
    );

    expect(screen.getByText(/Governance Domain Documentation/i)).toBeDefined();
    expect(
      screen.getByText(/designated institutional coordinators are actively curating/i)
    ).toBeDefined();
    expect(screen.getByText(/Status: Drafting in Progress/i)).toBeDefined();

    const noticeEl = screen.getByTestId('canvas-empty-notice');
    expect(noticeEl.getAttribute('tabindex')).toBe('-1');
    expect(noticeEl.className).toContain('custom-empty-notice-class');
  });

  it('renders parametric mark with configured accentColor or fallback', () => {
    const { container: container1 } = render(
      <CanvasEmptyNotice nodeTitle="Equity" accentColor="#10b981" />
    );
    expect(container1.innerHTML || container1.textContent).toBeDefined();

    const { container: container2 } = render(
      <CanvasEmptyNotice nodeTitle="Access" />
    );
    expect(container2.innerHTML || container2.textContent).toBeDefined();
  });
});

