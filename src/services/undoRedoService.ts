/**
 * Folio Engine - Active Session Undo / Redo Service
 * Location: src/services/undoRedoService.ts
 * Specification: docs/tasks/task9_2_active_session_undo_redo_engine.md
 * Aligned with: docs/00_WORKFLOW.md, docs/03_ARCHITECTURE.md, docs/07_CODING_STANDARDS.md
 *
 * Implements:
 * 1. Double-stack command pattern with capped depth (MAX_STACK_DEPTH = 50).
 * 2. Re-entrancy prevention guard (isExecuting) to prevent nested dispatches during undo/redo.
 * 3. Forward redo clearance on new user actions.
 * 4. Keyboard focus detection utility (isTextInput) for shortcut chord isolation.
 */

import type { UndoAction, UndoRedoState } from '../types/history';

export const MAX_STACK_DEPTH = 50;

export class UndoRedoManager {
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];
  private executingLock = false;

  /**
   * Pushes a reversible action onto the undo stack.
   * Clears the redo stack and enforces the 50-action depth cap.
   * If an undo/redo action is currently executing, this is a no-op to prevent re-entrant loops.
   */
  public push(action: Omit<UndoAction, 'id' | 'timestamp'>): UndoAction | null {
    if (this.executingLock) {
      return null;
    }

    const fullAction: UndoAction = {
      ...action,
      id: `undo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };

    this.undoStack.push(fullAction);

    // Enforce max depth cap (drop oldest)
    if (this.undoStack.length > MAX_STACK_DEPTH) {
      this.undoStack.shift();
    }

    // Standard editor semantics: any new action invalidates forward redo history
    this.redoStack = [];

    return fullAction;
  }

  /**
   * Pops the most recent action from the undo stack, executes action.undo(),
   * and pushes it onto the redo stack.
   */
  public popUndo(): UndoAction | null {
    if (this.executingLock || this.undoStack.length === 0) {
      return null;
    }

    const action = this.undoStack.pop();
    if (!action) return null;

    try {
      this.executingLock = true;
      action.undo();
      this.redoStack.push(action);
      if (this.redoStack.length > MAX_STACK_DEPTH) {
        this.redoStack.shift();
      }
      return action;
    } finally {
      this.executingLock = false;
    }
  }

  /**
   * Pops the most recent action from the redo stack, executes action.redo(),
   * and pushes it onto the undo stack.
   */
  public popRedo(): UndoAction | null {
    if (this.executingLock || this.redoStack.length === 0) {
      return null;
    }

    const action = this.redoStack.pop();
    if (!action) return null;

    try {
      this.executingLock = true;
      action.redo();
      this.undoStack.push(action);
      if (this.undoStack.length > MAX_STACK_DEPTH) {
        this.undoStack.shift();
      }
      return action;
    } finally {
      this.executingLock = false;
    }
  }

  /**
   * Clears both undo and redo stacks (e.g. on dev mode exit or restore).
   */
  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.executingLock = false;
  }

  /**
   * Retrieves current immutable state snapshot.
   */
  public getState(): UndoRedoState {
    const lastUndo = this.undoStack[this.undoStack.length - 1];
    const nextRedo = this.redoStack[this.redoStack.length - 1];

    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      lastActionDescription: lastUndo?.description,
      nextRedoDescription: nextRedo?.description,
    };
  }

  /**
   * Returns true if an undo/redo operation is currently executing.
   */
  public isExecuting(): boolean {
    return this.executingLock;
  }

  /**
   * Diagnostic inspector for testing.
   */
  public getStacks(): { undo: UndoAction[]; redo: UndoAction[] } {
    return {
      undo: [...this.undoStack],
      redo: [...this.redoStack],
    };
  }
}

/**
 * Checks if the target element is an active text input or editable container.
 * Used to avoid hijacking native cursor undo/redo inside text fields.
 */
export function isTextInput(target: EventTarget | null): boolean {
  if (!target) return false;
  if (typeof HTMLElement !== 'undefined' && !(target instanceof HTMLElement)) {
    return false;
  }

  const el = target as {
    tagName?: string;
    type?: string;
    isContentEditable?: boolean;
    getAttribute?: (name: string) => string | null;
  };

  const tagName = el.tagName?.toUpperCase();
  if (tagName === 'INPUT') {
    const type = (el.type || 'text').toLowerCase();
    // Exclude button-like inputs
    return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file'].includes(type);
  }

  if (tagName === 'TEXTAREA') {
    return true;
  }

  if (el.isContentEditable) {
    return true;
  }

  if (typeof el.getAttribute === 'function' && el.getAttribute('role') === 'textbox') {
    return true;
  }

  return false;
}

/**
 * Singleton instance for active session lifetime.
 */
export const undoRedoService = new UndoRedoManager();
