/**
 * Folio Engine - Cloud DB-Draft Contracts
 * Location: src/types/draft.ts
 * Specification: docs/tasks/task11_2g_db_draft_and_blob_storage_pipeline.md
 */

import type { NodeCanvasDocument } from './canvas';

export interface CloudDraftData {
  id: string; // 'active_draft'
  baseSnapshotId: string;
  canvases: Record<string, NodeCanvasDocument>;
  contentOverrides: Record<string, string>;
  updatedAt: string;
  updatedBySession?: string;
  lockedBySession?: string;
}

export type CloudDraftSyncStatus = 'saved' | 'saving' | 'error' | 'offline';

export interface DraftSyncStatusEventDetail {
  status: CloudDraftSyncStatus;
  lastSavedAt?: string;
  error?: string;
}
