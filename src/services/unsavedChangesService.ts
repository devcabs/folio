/**
 * Folio Engine - Centralized Unsaved / Unpublished Changes Registry Service
 * Location: src/services/unsavedChangesService.ts
 * Specification: docs/tasks/task12_0_prevent_refresh_unsaved_changes.md
 * Aligned with: docs/00_WORKFLOW.md, docs/03_ARCHITECTURE.md, docs/07_CODING_STANDARDS.md
 *
 * Implements:
 * 1. Synchronous in-memory registry of active dirty modal/drawer editors.
 * 2. Unified dirty status combining active in-flight forms + draft sandbox dirty state.
 * 3. Canonical beforeunload event guard complying with W3C browser prompt standards.
 */

import { isDraftDirty, isDraftModeActive } from './draftService';

/** In-memory registry of currently active dirty editors (modals, drawers, forms) */
const activeDirtyEditors = new Set<string>();

/**
 * Registers or updates the dirty state of an active editor component.
 */
export function registerDirtyEditor(editorId: string, isDirty: boolean): void {
  if (isDirty) {
    activeDirtyEditors.add(editorId);
  } else {
    activeDirtyEditors.delete(editorId);
  }
}

/**
 * Unregisters an editor upon component unmount or cancellation.
 */
export function unregisterDirtyEditor(editorId: string): void {
  activeDirtyEditors.delete(editorId);
}

/**
 * Clears all active dirty editors (used during tests or whole-session resets).
 */
export function clearAllDirtyEditors(): void {
  activeDirtyEditors.clear();
}

/**
 * Returns true if there are any active in-flight unsaved form inputs,
 * draft sandbox mode is currently active, OR unpublished draft changes exist.
 * Refreshing while on draft breaks ephemeral storage states even if no changes were made.
 */
export function hasAnyUnsavedChanges(): boolean {
  if (activeDirtyEditors.size > 0) {
    return true;
  }
  return isDraftModeActive() || isDraftDirty();
}

/**
 * Canonical W3C-compliant beforeunload guard.
 * Returns empty string and calls preventDefault() if dirty or on draft, otherwise does nothing.
 */
export function handleBeforeUnloadGuard(e: BeforeUnloadEvent): string | undefined {
  if (hasAnyUnsavedChanges()) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
  return undefined;
}
