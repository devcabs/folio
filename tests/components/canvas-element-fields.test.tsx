import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CanvasAddModal } from '../../src/components/canvas/CanvasAddModal';
import { UniversalEditModal } from '../../src/components/dev/UniversalEditModal';
import { SourceFolderActionBar } from '../../src/components/source/SourceFolderActionBar';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';

describe('12.5 Structural Deduplication: CanvasElementFields & SourceFolderActionBar', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockDevMode = () => {
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
    } as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>);
  };

  it('unifies section isNumbered as a SegmentedControl in both CanvasAddModal and UniversalEditModal', () => {
    mockDevMode();
    const onConfirmAdd = vi.fn();

    render(
      <CanvasAddModal
        isOpen
        type="section"
        nodeId="access"
        onClose={vi.fn()}
        onConfirmAdd={onConfirmAdd}
      />
    );

    const addGroup = screen.getByRole('radiogroup', { name: 'Section Numbering' });
    expect(addGroup).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Unnumbered' }));
    const titleInput = document.getElementById('canvas-section-title') as HTMLInputElement;
    expect(titleInput).toBeTruthy();
    titleInput.value = 'Overview';
    titleInput.setAttribute('value', 'Overview');
    const propsKey = Object.keys(titleInput).find((k) => k.startsWith('__reactProps$'));
    const reactProps = propsKey ? (titleInput as any)[propsKey] : null;
    act(() => {
      reactProps?.onChange?.({ target: { value: 'Overview' } });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Section' }));

    expect(onConfirmAdd).toHaveBeenCalledWith(
      'section',
      expect.objectContaining({ title: 'Overview', isNumbered: false }),
      undefined,
      undefined,
      undefined
    );

    cleanup();

    const onSubmit = vi.fn();
    render(
      <UniversalEditModal
        isOpen
        mode="edit"
        elementType="section"
        initialData={{ title: 'Existing Section', isNumbered: true }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const editGroup = screen.getByRole('radiogroup', { name: 'Section Numbering' });
    expect(editGroup).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Unnumbered' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Existing Section', isNumbered: false })
    );
  });

  it('allows switching between Section and Subsection in both CanvasAddModal and UniversalEditModal', () => {
    mockDevMode();
    const onConfirmAdd = vi.fn();

    render(
      <CanvasAddModal
        isOpen
        type="section"
        nodeId="access"
        onClose={vi.fn()}
        onConfirmAdd={onConfirmAdd}
      />
    );

    const headingGroup = screen.getByRole('radiogroup', { name: 'Heading Level' });
    expect(headingGroup).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Section Numbering' })).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Subsection' }));
    expect(screen.queryByRole('radiogroup', { name: 'Section Numbering' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Add Subsection' })).toBeTruthy();

    const subInput = document.getElementById('canvas-subsection-title') as HTMLInputElement;
    expect(subInput).toBeTruthy();
    const subPropsKey = Object.keys(subInput).find((k) => k.startsWith('__reactProps$'));
    const subReactProps = subPropsKey ? (subInput as any)[subPropsKey] : null;
    act(() => {
      subReactProps?.onChange?.({ target: { value: 'Converted Heading' } });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Subsection' }));
    expect(onConfirmAdd).toHaveBeenCalledWith(
      'subsection',
      expect.objectContaining({ headingType: 'subsection', title: 'Converted Heading' }),
      undefined,
      undefined,
      undefined
    );

    cleanup();

    const onSubmit = vi.fn();
    render(
      <UniversalEditModal
        isOpen
        mode="edit"
        elementType="subsection"
        initialData={{ title: 'Existing Subsection' }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByRole('heading', { name: 'Edit Subsection' })).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Section Numbering' })).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Section' }));
    expect(screen.getByRole('heading', { name: 'Edit Section' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Section Numbering' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        headingType: 'section',
        title: 'Existing Subsection',
        isNumbered: true,
      })
    );
  });

  it('renders SourceFolderActionBar with Edit and Sync triggers and hover highlight callbacks', () => {
    const onEdit = vi.fn();
    const onSync = vi.fn();
    const onHighlightChange = vi.fn();

    render(
      <SourceFolderActionBar
        onEdit={onEdit}
        onSync={onSync}
        editTitle="Edit source photo repository"
        syncTitle="Sync photos from Google Drive"
        onHighlightChange={onHighlightChange}
      />
    );

    const editBtn = screen.getByRole('button', { name: 'Edit source photo repository' });
    const syncBtn = screen.getByRole('button', { name: 'Sync photos from Google Drive' });

    editBtn.dispatchEvent({ type: 'mouseover' } as unknown as Event);
    expect(onHighlightChange).toHaveBeenCalledWith(true);
    editBtn.dispatchEvent({ type: 'mouseout' } as unknown as Event);
    expect(onHighlightChange).toHaveBeenCalledWith(false);

    fireEvent.click(editBtn);
    fireEvent.click(syncBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onSync).toHaveBeenCalledTimes(1);
  });
});
