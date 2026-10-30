/**
 * Folio Engine - Reusable Unsaved Changes Prompt Hook
 * Location: src/hooks/useUnsavedChangesPrompt.ts
 * Specification: docs/tasks/task12_0_prevent_refresh_unsaved_changes.md
 * Aligned with: docs/00_WORKFLOW.md, docs/03_ARCHITECTURE.md, docs/07_CODING_STANDARDS.md
 *
 * Implements:
 * 1. Automatic registration into the central unsavedChangesService.
 * 2. Window beforeunload event interception for active dirty editors.
 * 3. Graceful cleanup on unmount or when form resets to clean state.
 */

import { useEffect } from 'react';
import {
  registerDirtyEditor,
  unregisterDirtyEditor,
  handleBeforeUnloadGuard,
} from '../services/unsavedChangesService';

/**
 * Hook to safeguard open modals, drawers, and form editors from accidental browser refresh or closure.
 *
 * @param isDirty Whether the editor currently has unsaved modifications.
 * @param editorId Unique identifier for this editor (e.g. 'universal-edit-modal', 'chart-config-drawer').
 */
export function useUnsavedChangesPrompt(isDirty: boolean, editorId: string): void {
  useEffect(() => {
    registerDirtyEditor(editorId, isDirty);

    if (!isDirty) {
      return () => {
        unregisterDirtyEditor(editorId);
      };
    }

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      handleBeforeUnloadGuard(e);
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      unregisterDirtyEditor(editorId);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [isDirty, editorId]);
}
