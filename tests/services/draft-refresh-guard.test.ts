import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  hasAnyUnsavedChanges,
  handleBeforeUnloadGuard,
  registerDirtyEditor,
  clearAllDirtyEditors,
} from '../../src/services/unsavedChangesService';
import {
  setDraftModeActive,
  setDraftDirty,
  clearDraftStorage,
} from '../../src/services/draftService';

describe('Draft Refresh Prevention Guard', () => {
  beforeEach(() => {
    clearAllDirtyEditors();
    clearDraftStorage();
  });

  afterEach(() => {
    clearAllDirtyEditors();
    clearDraftStorage();
    vi.restoreAllMocks();
  });

  it('allows unload when not on draft and no dirty editors exist', () => {
    expect(hasAnyUnsavedChanges()).toBe(false);

    const mockEvent = {
      preventDefault: vi.fn(),
      returnValue: undefined as any,
    } as unknown as BeforeUnloadEvent;

    const result = handleBeforeUnloadGuard(mockEvent);

    expect(result).toBeUndefined();
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(mockEvent.returnValue).toBeUndefined();
  });

  it('prevents refresh while on draft even if no changes were made (dirty = false)', () => {
    // Activate draft mode without making any changes
    setDraftModeActive(true, 'baseline-snapshot-1');
    setDraftDirty(false);

    expect(hasAnyUnsavedChanges()).toBe(true);

    const mockEvent = {
      preventDefault: vi.fn(),
      returnValue: undefined as any,
    } as unknown as BeforeUnloadEvent;

    const result = handleBeforeUnloadGuard(mockEvent);

    expect(result).toBe('');
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.returnValue).toBe('');
  });

  it('prevents refresh when draft has uncommitted modifications', () => {
    setDraftModeActive(false);
    setDraftDirty(true);

    expect(hasAnyUnsavedChanges()).toBe(true);

    const mockEvent = {
      preventDefault: vi.fn(),
      returnValue: undefined as any,
    } as unknown as BeforeUnloadEvent;

    const result = handleBeforeUnloadGuard(mockEvent);

    expect(result).toBe('');
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.returnValue).toBe('');
  });

  it('prevents refresh when in-flight dirty editor is registered', () => {
    setDraftModeActive(false);
    setDraftDirty(false);
    registerDirtyEditor('test-modal', true);

    expect(hasAnyUnsavedChanges()).toBe(true);

    const mockEvent = {
      preventDefault: vi.fn(),
      returnValue: undefined as any,
    } as unknown as BeforeUnloadEvent;

    const result = handleBeforeUnloadGuard(mockEvent);

    expect(result).toBe('');
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('restores clean unload capability once draft mode is cleared or discarded', () => {
    setDraftModeActive(true);
    expect(hasAnyUnsavedChanges()).toBe(true);

    clearDraftStorage();
    expect(hasAnyUnsavedChanges()).toBe(false);

    const mockEvent = {
      preventDefault: vi.fn(),
      returnValue: undefined as any,
    } as unknown as BeforeUnloadEvent;

    const result = handleBeforeUnloadGuard(mockEvent);
    expect(result).toBeUndefined();
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });
});
