/**
 * Folio Engine — Edge KV Pre-Baking Pipeline Service
 * Location: src/services/edgePreBakeService.ts
 * Specification: docs/task/7.6-edge-public-handlers-and-prebake-ssot.md
 *
 * Implements:
 * 1. Publish-time self-contained AST compiler for arbitrary consumer nodes.
 * 2. Deterministic Google Drive URL rewriting to edge proxy endpoints (/api/media/drive/:fileId?w=...).
 * 3. Pre-calculated multi-density responsive srcSet (400w, 800w, 1600w) on PhotoElement & GalleryElement.syncedPhotos.
 * 4. Zero-leak ChartElement.config.sheetUrl sanitization while preserving embedded datasets.
 */

import type {
  PublicNodePayload,
  PublicPortalManifestPayload,
} from '../types/edge';
import {
  VALID_NODES,
  PublicNodePayloadSchema,
  PublicPortalManifestPayloadSchema,
} from '../types/edge';
import type {
  NodeCanvasDocument,
  CanvasElement,
  PhotoElement,
  GalleryElement,
  ChartElement,
  PdfElement,
  CanvasLeafElement,
} from '../types/canvas';
import { normalizeCanvasDocument } from '../utils/canvasDefaults';
import {
  isPhotoElement,
  isGalleryElement,
  isChartElement,
  isPdfElement,
  isDocumentsElement,
  isPageLinkElement,
} from '../types/canvas';
import type { SyncedSourceItem } from '../types/source';
import type { PublishedSnapshot } from '../types/history';
import {
  extractDriveFileId,
  buildEdgeMediaUrl,
  buildEdgeSrcSet,
  buildDrivePreviewUrl,
  buildDriveViewUrl,
} from '../utils/mediaUrl';

export const TRANSFORM_BREAKPOINTS = [400, 800, 1600] as const;
export const DEFAULT_SIZES_ATTRIBUTE = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px';
export const DEFAULT_PHOTO_ASPECT_RATIO = '16/9';

export interface PreBakeCompileOptions {
  nodeIds?: string[];
}

/**
 * Strips private sheetUrl from ChartElement.config for public KV payloads (Zero-Leak Security).
 */
export function sanitizePublicChartConfig<T extends Record<string, unknown>>(
  config: T
): Omit<T, 'sheetUrl'> {
  const { sheetUrl: _stripped, ...publicConfig } = config;
  return publicConfig;
}

/**
 * Transforms an individual PhotoElement into a pre-baked edge responsive photo node.
 */
function transformPhotoElement(photo: PhotoElement): PhotoElement {
  if (!photo.src || typeof photo.src !== 'string') {
    return photo;
  }

  const rawSrc = photo.src.trim();
  const fileId = extractDriveFileId(rawSrc);

  // If not a Google Drive link (e.g. data URL or /images/local.png), leave intact
  if (!fileId) {
    return photo;
  }

  return {
    ...photo,
    src: buildEdgeMediaUrl(fileId, { width: 800 }),
    srcSet: buildEdgeSrcSet(fileId, TRANSFORM_BREAKPOINTS),
    sizes: photo.sizes || DEFAULT_SIZES_ATTRIBUTE,
    aspectRatio: photo.aspectRatio || DEFAULT_PHOTO_ASPECT_RATIO,
    rawDriveUrl: photo.rawDriveUrl || rawSrc,
  };
}

/**
 * Pre-bakes responsive edge proxy URLs on a GalleryElement's syncedPhotos items.
 */
function transformSyncedPhotoItem(item: SyncedSourceItem): SyncedSourceItem {
  const candidate = item.driveFileId || item.fullImageUrl || item.thumbnailUrl || '';
  const fileId = extractDriveFileId(candidate);
  if (!fileId) {
    return item;
  }

  return {
    ...item,
    thumbnailUrl: buildEdgeMediaUrl(fileId, { width: 400 }),
    fullImageUrl: buildEdgeMediaUrl(fileId, { width: 1600 }),
    srcSet: buildEdgeSrcSet(fileId, TRANSFORM_BREAKPOINTS),
    sizes: DEFAULT_SIZES_ATTRIBUTE,
  } as SyncedSourceItem;
}

function transformGalleryElement(gallery: GalleryElement): GalleryElement {
  if (!Array.isArray(gallery.syncedPhotos) || gallery.syncedPhotos.length === 0) {
    return gallery;
  }

  return {
    ...gallery,
    syncedPhotos: gallery.syncedPhotos.map(transformSyncedPhotoItem),
  };
}

function transformChartElement(chart: ChartElement): ChartElement {
  if (!chart.config || typeof chart.config !== 'object') {
    return chart;
  }

  if (!('sheetUrl' in chart.config)) {
    return chart;
  }

  return {
    ...chart,
    config: sanitizePublicChartConfig(
      chart.config as unknown as Record<string, unknown>
    ) as ChartElement['config'],
  };
}

function transformPdfElement(pdf: PdfElement): PdfElement {
  const candidate = pdf.driveFileId || pdf.src || pdf.driveUrl || '';
  const fileId = extractDriveFileId(candidate);
  if (!fileId) {
    return pdf;
  }

  return {
    ...pdf,
    driveFileId: pdf.driveFileId || fileId,
    src: pdf.src && !pdf.src.includes('/api/media/drive/') ? pdf.src : buildDrivePreviewUrl(fileId),
    driveUrl: pdf.driveUrl || buildDriveViewUrl(fileId),
  };
}

function transformLeafElement(leaf: CanvasLeafElement): CanvasLeafElement {
  if (isPhotoElement(leaf)) {
    return transformPhotoElement(leaf);
  }
  if (isGalleryElement(leaf)) {
    return transformGalleryElement(leaf);
  }
  if (isChartElement(leaf)) {
    return transformChartElement(leaf);
  }
  if (isPdfElement(leaf)) {
    return transformPdfElement(leaf);
  }
  if (isDocumentsElement(leaf)) {
    return leaf;
  }
  if (isPageLinkElement(leaf)) {
    return leaf;
  }
  return leaf;
}

/**
 * Recursively walks the Canvas AST and pre-bakes responsive edge proxy URLs
 * (for PhotoElement and GalleryElement.syncedPhotos) and sanitizes ChartElement configs.
 */
export function transformCanvasAst(canvasDoc: NodeCanvasDocument): NodeCanvasDocument {
  if (!canvasDoc) {
    return canvasDoc;
  }

  const normalized = normalizeCanvasDocument(canvasDoc, canvasDoc.nodeId);
  const cloned: NodeCanvasDocument = JSON.parse(JSON.stringify(normalized));

  cloned.elements = cloned.elements.map((el: CanvasElement) => {
    if (el.type === 'section' || el.type === 'subsection') {
      return el;
    }
    return transformLeafElement(el as CanvasLeafElement);
  });

  return cloned;
}

/**
 * Compiles a single node's pre-baked PublicNodePayload ready for KV deployment.
 * Throws if snapshot.canvases[nodeId] is missing.
 */
export function compilePublicNodePayload(
  nodeId: string,
  snapshot: PublishedSnapshot,
  _options?: PreBakeCompileOptions
): PublicNodePayload {
  const rawCanvas = snapshot.canvases?.[nodeId];
  if (!rawCanvas) {
    throw new Error(`Missing canvas in snapshot for node: ${nodeId}`);
  }

  const transformedCanvas = transformCanvasAst(rawCanvas);

  const payload: PublicNodePayload = {
    nodeId,
    snapshotId: snapshot.id,
    version: snapshot.schemaVersion || 1,
    updatedAt: snapshot.createdAt,
    canvas: transformedCanvas,
  };

  PublicNodePayloadSchema.parse(payload);

  return payload;
}

/**
 * Compiles the PublicPortalManifestPayload pointing to the active published snapshot.
 */
export function compilePortalManifest(
  snapshot: PublishedSnapshot,
  nodeIds?: string[]
): PublicPortalManifestPayload {
  const canvasKeys = snapshot.canvases ? Object.keys(snapshot.canvases) : [];
  const activeNodeIds =
    nodeIds && nodeIds.length > 0
      ? Array.from(new Set([...nodeIds, ...canvasKeys]))
      : canvasKeys.length > 0
        ? canvasKeys
        : [...VALID_NODES];

  const manifest: PublicPortalManifestPayload = {
    activeSnapshotId: snapshot.id,
    publishedAt: snapshot.createdAt,
    nodeIds: activeNodeIds,
    schemaVersion: snapshot.schemaVersion || 1,
    contentOverrides: snapshot.contentOverrides || {},
    pages: snapshot.pages ? JSON.parse(JSON.stringify(snapshot.pages)) : {},
  };

  PublicPortalManifestPayloadSchema.parse(manifest);

  return manifest;
}
