/**
 * Folio Engine - Media & Asset Pipeline Contracts
 * Location: src/types/media.ts
 * Specification: docs/tasks/task11_2g_db_draft_and_blob_storage_pipeline.md
 */

export interface UploadMediaResult {
  url: string;
  sizeBytes: number;
  format: string;
}

export type MediaFolder = 'photos' | 'documents' | 'source';

export interface ImageDownscaleOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: 'image/webp' | 'image/jpeg' | 'image/png';
}
