import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasPhoto } from '../../src/components/canvas/CanvasPhoto';
import type { PhotoElement } from '../../src/types/canvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';

describe('3.6 Resilient Image Fallback Card & Latency Elimination', () => {
  const mockDrivePhoto: PhotoElement = {
    id: 'photo-elem-resilience-1',
    type: 'photo',
    pointId: 'node.access.photo.1',
    src: 'https://folio.dev/api/media/drive/1ABCxyz789DEF?w=800',
    rawDriveUrl: 'https://drive.google.com/file/d/1ABCxyz789DEF/view',
    driveUrl: 'https://drive.google.com/drive/folders/folder-123',
    alt: 'Classroom connectivity deployment in progress',
    caption: 'Verified network switch installation in district laboratory',
  };

  const emptyPhoto: PhotoElement = {
    id: 'photo-elem-empty',
    type: 'photo',
    pointId: 'node.access.photo.empty',
    src: '',
    alt: 'Unconfigured documentation photograph',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial image with Edge media proxy and never invokes drive.google.com thumbnail endpoints', () => {
    const { container } = render(
      <CanvasPhoto
        element={mockDrivePhoto}
        nodeId="access"
        isDevMode={false}
      />
    );

    // Initial render must include an <img> element
    const img = screen.getByRole('img');
    expect(img).toBeDefined();
    expect(img.src).toContain('/api/media/drive/1ABCxyz789DEF');
    expect(img.src).not.toContain('drive.google.com/thumbnail');

    // Confirm entire rendered subtree has 0 occurrences of direct drive.google.com thumbnail URLs
    const fullHtml = container.innerHTML || container.textContent || '';
    expect(fullHtml).not.toContain('drive.google.com/thumbnail');
  });

  it('transitions to 16:9 fallback card upon image load error without swapping to thumbnail URL', () => {
    const onEditMock = vi.fn();
    const { container } = render(
      <CanvasPhoto
        element={mockDrivePhoto}
        nodeId="access"
        isDevMode={false}
        onEdit={onEditMock}
      />
    );

    const img = screen.getByRole('img');
    expect(img).toBeDefined();

    // Trigger image loading failure
    fireEvent.error(img);

    // Fallback region must be displayed
    const fallbackRegion = screen.getByRole('region', { name: /Image Unavailable/i });
    expect(fallbackRegion).toBeDefined();
    expect(fallbackRegion.getAttribute('tabindex')).toBe('-1');
    expect(fallbackRegion.className).toContain('photoFallbackCard');

    // Verify <img> element was removed from active DOM
    expect(screen.queryByRole('img')).toBeNull();

    // Verify no fallback swapped to raw Google Drive thumbnail URL
    const afterHtml = container.innerHTML || container.textContent || '';
    expect(afterHtml).not.toContain('drive.google.com/thumbnail');
  });

  it('renders calm institutional documentation notice in public visitor mode', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: false,
      isDesktop: true,
      canUnlock: false,
      isUnlocked: false,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);

    render(
      <CanvasPhoto
        element={emptyPhoto}
        nodeId="access"
        isDevMode={false}
      />
    );

    expect(screen.getByRole('region', { name: /Image Unavailable/i })).toBeDefined();
    expect(
      screen.getByText(/Image documentation is currently being synchronized/i)
    ).toBeDefined();

    // Developer actions must NEVER leak into public mode
    expect(screen.queryByText(/Re-link Photo/i)).toBeNull();
    expect(screen.queryByText(/Verify Google Drive sharing permissions/i)).toBeNull();
  });

  it('renders diagnostic recovery guidance and re-link action in developer mode', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: true,
      isDesktop: true,
      canUnlock: true,
      isUnlocked: true,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);

    const onEditMock = vi.fn();
    render(
      <CanvasPhoto
        element={emptyPhoto}
        nodeId="access"
        isDevMode={true}
        onEdit={onEditMock}
      />
    );

    expect(screen.getByRole('region', { name: /Image Unavailable/i })).toBeDefined();
    expect(screen.getByText(/Unconfigured documentation photograph/i)).toBeDefined();
    expect(screen.getByText(/Source image inaccessible/i)).toBeDefined();

    const relinkBtn = screen.getByRole('button', { name: /Edit photo attachment/i });
    expect(relinkBtn).toBeDefined();

    fireEvent.click(relinkBtn);
    expect(onEditMock).toHaveBeenCalledTimes(1);
  });
});
