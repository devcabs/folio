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

import React, { createContext, useState, useCallback, useEffect, useTransition, useRef } from 'react';
import type { UndoAction, UndoRedoContextType, UndoRedoState } from '../types/history';
import { undoRedoService, isTextInput } from '../services/undoRedoService';
import { useDeveloperMode } from '../hooks/useDeveloperMode';
import { EVENT_DRAFT_STATUS_CHANGE } from '../services/draftService';
import { EVENT_HISTORY_CHANGE } from '../services/historyService';

export const UndoRedoContext = createContext<UndoRedoContextType | null>(null);

export interface UndoRedoProviderProps {
  children: React.ReactNode;
}

export const UndoRedoProvider: React.FC<UndoRedoProviderProps> = ({ children }) => {
  const { isDevMode } = useDeveloperMode();
  const prevIsDevModeRef = useRef<boolean>(isDevMode);

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

  const undo = useCallback(async () => {
    const popped = await undoRedoService.popUndoAsync();
    startTransition(() => {
      syncState();
    });
    void popped;
  }, [syncState]);

  const redo = useCallback(async () => {
    const popped = await undoRedoService.popRedoAsync();
    startTransition(() => {
      syncState();
    });
    void popped;
  }, [syncState]);

  const clearHistory = useCallback(() => {
    undoRedoService.clear();
    syncState();
  }, [syncState]);

  const clearScope = useCallback((scope: string) => {
    undoRedoService.clearScope(scope);
    syncState();
  }, [syncState]);

  // Clear active-session undo/redo stacks when Dev Mode exits
  useEffect(() => {
    const wasDevMode = prevIsDevModeRef.current;
    prevIsDevModeRef.current = isDevMode;
    if (wasDevMode && !isDevMode) {
      clearHistory();
    }
  }, [isDevMode, clearHistory]);

  // Clear active-session undo/redo stacks on draft deactivation or history restore/publish
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }

    const handleDraftStatus = (e: Event) => {
      const detail = (e as CustomEvent<{ isActive?: boolean }>).detail;
      if (detail?.isActive === false) {
        clearHistory();
      }
    };

    const handleHistoryChange = () => {
      clearHistory();
    };

    window.addEventListener(EVENT_DRAFT_STATUS_CHANGE, handleDraftStatus);
    window.addEventListener(EVENT_HISTORY_CHANGE, handleHistoryChange);
    return () => {
      window.removeEventListener(EVENT_DRAFT_STATUS_CHANGE, handleDraftStatus);
      window.removeEventListener(EVENT_HISTORY_CHANGE, handleHistoryChange);
    };
  }, [clearHistory]);

  // Vercel Best Practice: client-event-listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 0. Only intercept undo/redo chords while Dev Mode is active
      if (!isDevMode) {
        return;
      }

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
  }, [isDevMode, undo, redo]);

  const contextValue: UndoRedoContextType = {
    ...state,
    pushAction,
    undo,
    redo,
    clearHistory,
    clearScope,
  };

  return (
    <UndoRedoContext.Provider value={contextValue}>
      {children}
    </UndoRedoContext.Provider>
  );
};

export default UndoRedoProvider;
