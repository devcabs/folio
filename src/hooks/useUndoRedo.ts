/**
 * Folio Engine - Active Session Undo / Redo Hook
 * Location: src/hooks/useUndoRedo.ts
 * Specification: docs/tasks/task9_2_active_session_undo_redo_engine.md
 * Aligned with: docs/00_WORKFLOW.md, docs/03_ARCHITECTURE.md, docs/07_CODING_STANDARDS.md
 */

import { useContext } from 'react';
import { UndoRedoContext } from '../context/UndoRedoContext';
import type { UndoRedoContextType } from '../types/history';

export function useUndoRedo(): UndoRedoContextType {
  const context = useContext(UndoRedoContext);
  if (!context) {
    // Graceful fallback to no-op if consumed outside UndoRedoProvider (e.g. isolated test environments)
    return {
      canUndo: false,
      canRedo: false,
      undoCount: 0,
      redoCount: 0,
      pushAction: () => {},
      undo: () => {},
      redo: () => {},
      clearHistory: () => {},
    };
  }
  return context;
}

export default useUndoRedo;
