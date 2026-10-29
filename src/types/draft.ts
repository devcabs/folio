import { z } from 'zod';
import type { DocumentCanvas } from './canvas';

export type EntityType = 'node' | 'document' | 'chart' | 'content';

export interface DraftItem<T = unknown> {
  entityType: EntityType;
  entityId: string;
  stagedValue: T;
  updatedAt: string;
}

export interface EngineDraftData {
  id: string; // e.g. 'active_draft'
  baseSnapshotId: string;
  documents: Record<string, DocumentCanvas>;
  contentOverrides: Record<string, string>;
  chartOverrides?: Record<string, unknown>;
  updatedAt: string;
  updatedBySession?: string;
  lockedBySession?: string;
}

export type DraftSyncStatus = 'saved' | 'saving' | 'error' | 'offline';

export interface DraftSyncStatusEventDetail {
  status: DraftSyncStatus;
  lastSavedAt?: string;
  error?: string;
}

export const DraftItemSchema = z.object({
  entityType: z.enum(['node', 'document', 'chart', 'content']),
  entityId: z.string().min(1),
  stagedValue: z.unknown(),
  updatedAt: z.string().min(1),
});
