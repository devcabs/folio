/**
 * Folio Engine - Active Session Undo / Redo Context
 * Location: src/context/UndoRedoContext.tsx
 * Specification: docs/tasks/task9_2_active_session_undo_redo_engine.md
 * Aligned with: docs/00_WORKFLOW.md, docs/03_ARCHITECTURE.md, docs/07_CODING_STANDARDS.md
 *
 * Implements:
 * 1. Global UndoRedoProvider wrapping the application.
 * 2. React 19 startTransition to guarantee non-blocking layout reconciliations (rerender-transitions).
 * 3. Unified keyboard shortcut handling (Cmd+Z / Ctrl+Z / Cmd+Shift+Z / Ctrl+Shift+Z / Ctrl+Y).
 * 4. Resilient input focus guards (isTextInput) to prevent shortcut collisions with native inputs.
 */

import React, { createContext, useState, useCallback, useEffect, useTransition } from 'react';
import type { UndoAction, UndoRedoContextType, UndoRedoState } from '../types/history';
import { undoRedoService, isTextInput } from '../services/undoRedoService';

export const UndoRedoContext = createContext<UndoRedoContextType | null>(null);

export interface UndoRedoProviderProps {
  children: React.ReactNode;
}

export const UndoRedoProvider: React.FC<UndoRedoProviderProps> = ({ children }) => {
  // State synchronized from service engine
  const [state, setState] = useState<UndoRedoState>(() => undoRedoService.getState());
  // Vercel Best Practice: rerender-transitions
  const [, startTransition] = useTransition();

  const syncState = useCallback(() => {
    setState(undoRedoService.getState());
  }, []);

  const pushAction = useCallback((action: Omit<UndoAction, 'id' | 'timestamp'>) => {
    const pushed = undoRedoService.push(action);
    if (pushed) {
      syncState();
    }
  }, [syncState]);

  const undo = useCallback(() => {
    startTransition(() => {
      const popped = undoRedoService.popUndo();
      if (popped) {
        syncState();
      }
    });
  }, [syncState]);

  const redo = useCallback(() => {
    startTransition(() => {
      const popped = undoRedoService.popRedo();
      if (popped) {
        syncState();
      }
    });
  }, [syncState]);

  const clearHistory = useCallback(() => {
    undoRedoService.clear();
    syncState();
  }, [syncState]);

  // Vercel Best Practice: client-event-listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Guard against native input editing
      if (isTextInput(e.target)) {
        return;
      }

      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isModifierActive = isMac ? e.metaKey : e.ctrlKey;

      if (!isModifierActive) {
        return;
      }

      const key = e.key.toLowerCase();

      // Undo: Cmd+Z (Mac) or Ctrl+Z (Win/Linux) without Shift
      if (key === 'z' && !e.shiftKey) {
        if (undoRedoService.getState().canUndo) {
          e.preventDefault();
          undo();
        }
        return;
      }

      // Redo Chords:
      // Option 1: Cmd+Shift+Z (Mac) or Ctrl+Shift+Z (Win/Linux)
      // Option 2: Ctrl+Y (Win/Linux)
      const isRedoChord =
        (key === 'z' && e.shiftKey) ||
        (!isMac && key === 'y' && !e.shiftKey);

      if (isRedoChord) {
        if (undoRedoService.getState().canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo]);

  const contextValue: UndoRedoContextType = {
    ...state,
    pushAction,
    undo,
    redo,
    clearHistory,
  };

  return (
    <UndoRedoContext.Provider value={contextValue}>
      {children}
    </UndoRedoContext.Provider>
  );
};

export default UndoRedoProvider;
