/**
 * Folio Engine - Dynamic Canvas Type Definitions
 * Location: src/types/canvas.ts
 * Specification: docs/tasks/task8_1_data_models_and_default_factory.md
 */

import type { ChartDataset, SheetChartConfig, PublicChartConfig } from './chart';
import type { SyncedSourceItem, SyncedDocumentItem } from './source';

export type CanvasElementType =
  | 'section'
  | 'subsection'
  | 'text'
  | 'photo'
  | 'gallery'
  | 'chart'
  | 'pdf'
  | 'documents';

export interface CanvasElementBase {
  id: string;
  type: CanvasElementType;
}

export interface TextElement extends CanvasElementBase {
  type: 'text';
  pointId: string;
  content: string;
  as?: 'p' | 'blockquote';
}

export interface PhotoElement extends CanvasElementBase {
  type: 'photo';
  pointId: string;
  src?: string;
  /** Responsive image candidate string pre-baked for edge proxy delivery */
  srcSet?: string;
  /** Responsive sizes media query string */
  sizes?: string;
  /** Aspect ratio hint (e.g. "16/9", "4/3") */
  aspectRatio?: string;
  /** Original raw Drive URL preserved for fallback resilience */
  rawDriveUrl?: string;
  alt?: string;
  caption?: string;
  /** Optional Google Drive folder or item link */
  driveUrl?: string;
}

export interface GalleryElement extends CanvasElementBase {
  type: 'gallery';
  pointId: string;
  title?: string;
  titlePointId?: string;
  subtitle?: string;
  subtitlePointId?: string;
  driveUrl?: string;
  description?: string;
  lastVerified?: string;
  syncedPhotos?: SyncedSourceItem[];
}

export interface ChartElement extends CanvasElementBase {
  type: 'chart';
  chartId: string;
  title: string;
  subtitle?: string;
  config?: SheetChartConfig | PublicChartConfig;
  dataset?: ChartDataset;
}

export interface PdfElement extends CanvasElementBase {
  type: 'pdf';
  pointId: string;
  /** Resolved Google Drive embed URL: https://drive.google.com/file/d/{fileId}/preview */
  src?: string;
  /** Extracted alphanumeric Google Drive file ID */
  driveFileId?: string;
  /** Original Google Drive view/share link for "Open in New Tab" fallback */
  driveUrl?: string;
  /** Optional editorial document title */
  title?: string;
  /** Optional caption displayed below the inline viewer */
  caption?: string;
  /** Whether caption is visible below the viewer */
  showCaption?: boolean;
  /** Optional aspect ratio override (defaults to token --pdf-viewer-aspect-ratio, e.g. "4/3") */
  aspectRatio?: string;
}

export interface DocumentsElement extends CanvasElementBase {
  type: 'documents';
  pointId: string;
  title?: string;
  titlePointId?: string;
  subtitle?: string;
  subtitlePointId?: string;
  driveUrl?: string;
  description?: string;
  lastVerified?: string;
  syncedDocuments?: SyncedDocumentItem[];
}

export type CanvasLeafElement =
  | TextElement
  | PhotoElement
  | GalleryElement
  | ChartElement
  | PdfElement
  | DocumentsElement;

export interface SubsectionElement extends CanvasElementBase {
  type: 'subsection';
  title: string;
  titlePointId?: string;
  subtitle?: string;
  subtitlePointId?: string;
  /** Leaf content items within this subsection */
  elements: CanvasLeafElement[];
}

export type CanvasChildElement = SubsectionElement | CanvasLeafElement;

export interface SectionElement extends CanvasElementBase {
  type: 'section';
  /** Two-digit sequential display number, e.g. "01", "02" */
  number?: string;
  /** Whether the section displays a sequential number badge */
  isNumbered?: boolean;
  title: string;
  titlePointId?: string;
  subtitle?: string;
  subtitlePointId?: string;
  /** Child elements and subsections contained within this section */
  elements: CanvasChildElement[];
}

export type CanvasElement = SectionElement | CanvasChildElement;

export interface NodeCanvasDocument {
  nodeId: string;
  version: number;
  sections: SectionElement[];
  updatedAt: string;
}

/**
 * Type Guards for Canvas Elements
 */
export function isSectionElement(el: CanvasElement): el is SectionElement {
  return el.type === 'section';
}

export function isSubsectionElement(el: CanvasElement): el is SubsectionElement {
  return el.type === 'subsection';
}

export function isLeafElement(el: CanvasElement): el is CanvasLeafElement {
  return (
    el.type === 'text' ||
    el.type === 'photo' ||
    el.type === 'gallery' ||
    el.type === 'chart' ||
    el.type === 'pdf' ||
    el.type === 'documents'
  );
}

export function isTextElement(el: CanvasElement): el is TextElement {
  return el.type === 'text';
}

export function isPhotoElement(el: CanvasElement): el is PhotoElement {
  return el.type === 'photo';
}

export function isGalleryElement(el: CanvasElement): el is GalleryElement {
  return el.type === 'gallery';
}

export function isChartElement(el: CanvasElement): el is ChartElement {
  return el.type === 'chart';
}

export function isPdfElement(el: CanvasElement): el is PdfElement {
  return el.type === 'pdf';
}

export function isDocumentsElement(el: CanvasElement): el is DocumentsElement {
  return el.type === 'documents';
}

/**
 * Unified Canvas Add & Edit Modal Contracts
 * Aligned with docs/tasks/task9_8_unified_canvas_add_edit_modal_drawer.md
 */
export type CanvasModalMode = 'add' | 'edit';

export type CanvasModalElementType =
  | 'section'
  | 'subsection'
  | 'text'
  | 'photo'
  | 'gallery'
  | 'pdf'
  | 'documents';

export interface CanvasElementFormData {
  /** For section, subsection, gallery, pdf, documents, or text title */
  title?: string;
  /** For section, subsection, gallery, or documents subtitle */
  subtitle?: string;
  /** For section numbering */
  isNumbered?: boolean;
  /** For narrative text content */
  content?: string;
  /** For text typography style */
  as?: 'p' | 'blockquote';
  /** For photo or pdf source (data URL, preview URL, or external URL) */
  src?: string;
  /** Extracted Google Drive file ID for pdf or photo */
  driveFileId?: string;
  /** For photo image accessibility description */
  alt?: string;
  /** For photo or pdf caption */
  caption?: string;
  /** Whether photo or pdf caption is visible below element */
  showCaption?: boolean;
  /** Optional aspect ratio override for photo or pdf */
  aspectRatio?: string;
  /** For photo, gallery, pdf, or documents Google Drive URL */
  driveUrl?: string;
}
