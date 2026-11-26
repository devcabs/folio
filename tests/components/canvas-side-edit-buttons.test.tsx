import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasSection } from '../../src/components/canvas/CanvasSection';
import { CanvasSubsection } from '../../src/components/canvas/CanvasSubsection';
import { CanvasText } from '../../src/components/canvas/CanvasText';
import { CanvasPhoto } from '../../src/components/canvas/CanvasPhoto';
import type {
  SectionElement,
  SubsectionElement,
  TextElement,
  PhotoElement,
} from '../../src/types/canvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';

describe('Canvas Dev Mode Side ✎ Edit Buttons Verification', () => {
  beforeEach(() => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: true,
      isDesktop: true,
      canUnlock: true,
      isUnlocked: true,
      authToken: 'test-token',
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
      lockDevMode: vi.fn(),
      setHasUnpublishedChanges: vi.fn(),
      showToast: vi.fn(),
    } as any);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const sectionElement: SectionElement = {
    id: 'sec-discovery',
    type: 'section',
    title: 'Baseline Discovery & Scoping',
    number: '01',
    isNumbered: true,
  };

  const subsectionElement: SubsectionElement = {
    id: 'subsec-readiness',
    type: 'subsection',
    title: 'Field Readiness & Documentation',
  };

  const textElement: TextElement = {
    id: 'text-baseline',
    type: 'text',
    pointId: 'node.access.text.baseline',
    content: 'Stage 01 establishes the operational baseline across all participating units.',
  };

  const quoteElement: TextElement = {
    id: 'quote-criteria',
    type: 'text',
    pointId: 'node.access.quote.criteria',
    content: 'Clear baseline criteria reduce downstream rework and keep every unit aligned.',
    as: 'blockquote',
  };

  const photoElement: PhotoElement = {
    id: 'photo-intake',
    type: 'photo',
    pointId: 'node.access.photo.intake',
    src: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
    alt: 'Inspection team photo',
    caption: 'Field readiness inspection',
  };

  it('renders side "✎ Edit" button beside SectionTitle in CanvasSection in Dev Mode and triggers onEdit', () => {
    const onEditMock = vi.fn();
    render(
      <CanvasSection
        section={sectionElement}
        nodeId="access"
        computedNumber="01"
        onEdit={onEditMock}
      />
    );

    const editBtn = screen.getByRole('button', { name: 'Edit section' });
    expect(editBtn).toBeDefined();
    expect(editBtn.textContent?.trim()).toBe('✎ Edit');
    expect(editBtn.getAttribute('data-dev-edit-trigger')).toBe('true');
    expect(editBtn.getAttribute('data-canvas-edit-trigger')).toBe('sec-discovery');

    fireEvent.click(editBtn);
    expect(onEditMock).toHaveBeenCalledTimes(1);
  });

  it('renders side "✎ Edit" button beside SectionTitle in CanvasSubsection in Dev Mode and triggers onEdit', () => {
    const onEditMock = vi.fn();
    render(
      <CanvasSubsection
        subsection={subsectionElement}
        nodeId="access"
        onEdit={onEditMock}
      />
    );

    const editBtn = screen.getByRole('button', { name: 'Edit subsection' });
    expect(editBtn).toBeDefined();
    expect(editBtn.textContent?.trim()).toBe('✎ Edit');
    expect(editBtn.getAttribute('data-dev-edit-trigger')).toBe('true');
    expect(editBtn.getAttribute('data-canvas-edit-trigger')).toBe('subsec-readiness');

    fireEvent.click(editBtn);
    expect(onEditMock).toHaveBeenCalledTimes(1);
  });

  it('renders side "✎ Edit" button beside CanvasText narrative and blockquote in Dev Mode and triggers onEdit', () => {
    const onEditMock = vi.fn();
    const { rerender } = render(
      <CanvasText
        element={textElement}
        nodeId="access"
        onEdit={onEditMock}
      />
    );

    const editBtn = screen.getByRole('button', { name: 'Edit text content' });
    expect(editBtn).toBeDefined();
    expect(editBtn.textContent?.trim()).toBe('✎ Edit');
    expect(editBtn.getAttribute('data-dev-edit-trigger')).toBe('true');
    expect(editBtn.getAttribute('data-canvas-edit-trigger')).toBe('text-baseline');

    fireEvent.click(editBtn);
    expect(onEditMock).toHaveBeenCalledTimes(1);

    // Test blockquote variant
    rerender(
      <CanvasText
        element={quoteElement}
        nodeId="access"
        onEdit={onEditMock}
      />
    );

    const quoteEditBtn = screen.getByRole('button', { name: 'Edit text content' });
    expect(quoteEditBtn).toBeDefined();
    expect(quoteEditBtn.getAttribute('data-canvas-edit-trigger')).toBe('quote-criteria');
    fireEvent.click(quoteEditBtn);
    expect(onEditMock).toHaveBeenCalledTimes(2);
  });

  it('renders side "✎ Edit" button beside CanvasPhoto in Dev Mode and triggers onEdit', () => {
    const onEditMock = vi.fn();
    render(
      <CanvasPhoto
        element={photoElement}
        nodeId="access"
        onEdit={onEditMock}
      />
    );

    const editBtn = screen.getByRole('button', { name: 'Edit photo attachment' });
    expect(editBtn).toBeDefined();
    expect(editBtn.textContent?.trim()).toBe('✎ Edit');
    expect(editBtn.getAttribute('data-dev-edit-trigger')).toBe('true');
    expect(editBtn.getAttribute('data-canvas-edit-trigger')).toBe('photo-intake');

    fireEvent.click(editBtn);
    expect(onEditMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT render side "✎ Edit" button in public mode (!isDevMode)', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: false,
      isDesktop: true,
      canUnlock: false,
      isUnlocked: false,
      authToken: null,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
      lockDevMode: vi.fn(),
      setHasUnpublishedChanges: vi.fn(),
      showToast: vi.fn(),
    } as any);

    render(
      <div>
        <CanvasSection section={sectionElement} nodeId="access" onEdit={vi.fn()} />
        <CanvasSubsection subsection={subsectionElement} nodeId="access" onEdit={vi.fn()} />
        <CanvasText element={textElement} nodeId="access" onEdit={vi.fn()} />
        <CanvasPhoto element={photoElement} nodeId="access" onEdit={vi.fn()} />
      </div>
    );

    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
  });
});
