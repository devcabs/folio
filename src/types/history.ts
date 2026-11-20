/**
 * Folio Engine - Active Session Undo / Redo Contracts
 * Location: src/types/history.ts
 * Specification: docs/tasks/task9_2_active_session_undo_redo_engine.md
 * Aligned with: docs/00_WORKFLOW.md, docs/03_ARCHITECTURE.md, docs/07_CODING_STANDARDS.md
 */

export type UndoActionType =
  | 'canvas_insert_section'
  | 'canvas_remove_section'
  | 'canvas_insert_subsection'
  | 'canvas_remove_subsection'
  | 'canvas_insert_leaf'
  | 'canvas_remove_leaf'
  | 'canvas_move_item'
  | 'canvas_relocate_item'
  | 'canvas_update_item'
  | 'content_text_override'
  | 'page_create'
  | 'page_update_metadata'
  | 'page_delete_subtree'
  | 'page_reorder'
  | 'workspace_transaction';

export interface UndoAction {
  id: string;
  type: UndoActionType;
  timestamp: number;
  description: string;
  /** Optional lifecycle scope (e.g. 'canvas:N1') so unmounted surfaces can prune stale closures */
  scope?: string;
  /** Function that reverses the action (return false or throw to abort & roll back stack) */
  undo: () => void | Promise<boolean | void>;
  /** Function that re-applies the action (return false or throw to abort & roll back stack) */
  redo: () => void | Promise<boolean | void>;
}

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  lastActionDescription?: string;
  nextRedoDescription?: string;
}

export interface UndoRedoContextType extends UndoRedoState {
  /** Push a reversible action pair onto the active stack */
  pushAction: (action: Omit<UndoAction, 'id' | 'timestamp'>) => void;
  /** Execute the most recent undo action */
  undo: () => void | Promise<void>;
  /** Execute the most recent redo action */
  redo: () => void | Promise<void>;
  /** Clear both stacks (e.g. on dev mode exit or full restore) */
  clearHistory: () => void;
  /** Clear only actions belonging to a specific scope (e.g. when navigating away from a node canvas) */
  clearScope: (scope: string) => void;
}

import type { NodeCanvasDocument } from './canvas';
import type { PageNode } from './page';

export type SnapshotType = 'milestone' | 'autosave' | 'safety_backup';

export interface SnapshotMetricsSummary {
  totalSections: number;
  totalSubsections: number;
  totalLeafElements: number;
  totalTextOverrides: number;
  totalTextElements?: number;
  totalPhotoElements?: number;
  totalChartElements?: number;
  totalPdfElements?: number;
  totalDocumentElements?: number;
  totalSubpages?: number;
  totalPageLinkElements?: number;
}

export interface UnifiedPortalSnapshot {
  id: string;
  schemaVersion: number;
  type: SnapshotType;
  title: string;
  notes?: string;
  createdAt: string; // ISO 8601
  authorSessionId: string;
  /** Canvas layout documents for all 5 nodes keyed by node ID */
  canvases: Record<string, NodeCanvasDocument>;
  /** Complete key-value registry of all Content DB text overrides */
  contentOverrides: Record<string, string>;
  /** Optional dynamic subpage registry keyed by PageNode.id */
  pages?: Record<string, PageNode>;
  /** Metrics summary for quick scannability in UI */
  summary: SnapshotMetricsSummary;
}

export interface HistoryManifest {
  lastRestoredId?: string;
  activePublishedId?: string;
  activeMilestoneId?: string;
  snapshots: UnifiedPortalSnapshot[];
  updatedAt: string;
}

export interface PublishedSnapshot {
  id: string;
  schemaVersion: number;
  title: string;
  description: string;
  createdAt: string;
  authorSessionId: string;
  isActive: boolean;
  canvases: Record<string, NodeCanvasDocument>;
  contentOverrides: Record<string, string>;
  pages?: Record<string, PageNode>;
  summary: SnapshotMetricsSummary;
}

export interface HistoryIndexEntry {
  id: string;
  schemaVersion: number;
  title: string;
  description: string;
  createdAt: string;
  authorSessionId: string;
  summary: SnapshotMetricsSummary;
}

export interface HistoryIndex {
  activeSnapshotId: string | null;
  updatedAt: string;
  entries: HistoryIndexEntry[];
}

export interface PublishSnapshotResult {
  success: boolean;
  snapshot: PublishedSnapshot;
  edgeDeployed: boolean;
  localSaved?: boolean;
  cloudSynced?: boolean;
  cloudError?: string;
  edgeError?: string;
  error?: string;
}


