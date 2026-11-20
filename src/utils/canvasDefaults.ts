/**
 * Folio Engine - Default Element Generation Factory
 * Location: src/utils/canvasDefaults.ts
 * Specification: docs/tasks/task8_1_data_models_and_default_factory.md
 * 
 * Rules:
 * 1. Zero parentheses in all default copy, titles, and placeholders.
 * 2. Pure, deterministic factory functions without DOM dependencies.
 * 3. Canonical naming hierarchy for pointIds.
 */

import type {
  CanvasElementType,
  TextElement,
  PhotoElement,
  GalleryElement,
  ChartElement,
  PdfElement,
  DocumentsElement,
  PageLinkElement,
  SubsectionElement,
  SectionElement,
  CanvasElement,
  LegacySectionElement,
  NodeCanvasDocument,
} from '../types/canvas';

export const AUTHORING_PLACEHOLDERS = new Set<string>([
  'Click Edit to add narrative text for this section.',
  'Photo documentation.',
  'Document Title',
  'PDF document attachment.',
  'Document Repository',
  'Supporting PDF documents and references',
  'Milestone initiatives and summary of progress',
  'Subsection details and documentation',
  'Subsection Title',
  'Section Title',
]);

/**
 * Checks whether a text string contains unedited factory authoring placeholder copy.
 */
export function isAuthoringPlaceholder(text?: string | null): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  return trimmed.length === 0 || AUTHORING_PLACEHOLDERS.has(trimmed);
}

/**
 * Generate a unique element ID with type prefix and collision-resistant entropy.
 */
export function generateCanvasId(prefix: CanvasElementType): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate a default narrative Text block.
 */
export function createDefaultText(nodeId: string): TextElement {
  const id = generateCanvasId('text');
  return {
    id,
    type: 'text',
    pointId: `node.${nodeId}.text.${id}`,
    content: 'Click Edit to add narrative text for this section.',
    as: 'p',
  };
}

/**
 * Generate a default photographic source block.
 */
export function createDefaultPhoto(nodeId: string): PhotoElement {
  const id = generateCanvasId('photo');
  return {
    id,
    type: 'photo',
    pointId: `node.${nodeId}.photo.${id}`,
    alt: 'Documentation photo',
    caption: 'Photo documentation.',
  };
}

/**
 * Generate a default photographic Evidence Gallery block.
 */
export function createDefaultGallery(nodeId: string): GalleryElement {
  const id = generateCanvasId('gallery');
  return {
    id,
    type: 'gallery',
    pointId: `node.${nodeId}.gallery.${id}`,
    title: 'Media Gallery',
    titlePointId: `node.${nodeId}.gallery.${id}.title`,
    subtitle: 'Image and document attachments',
    subtitlePointId: `node.${nodeId}.gallery.${id}.subtitle`,
  };
}

/**
 * Generate a default Indicator Chart block with pending state.
 */
export function createDefaultChart(nodeId: string): ChartElement {
  const id = generateCanvasId('chart');
  return {
    id,
    type: 'chart',
    chartId: `chart-${nodeId}-${Date.now().toString(36)}`,
    title: 'Data Chart',
    subtitle: 'Metrics and summary data',
  };
}

/**
 * Generate a default single PDF document viewer block.
 */
export function createDefaultPdf(nodeId: string): PdfElement {
  const id = generateCanvasId('pdf');
  return {
    id,
    type: 'pdf',
    pointId: `node.${nodeId}.pdf.${id}`,
    title: 'Document Title',
    caption: 'PDF document attachment.',
    showCaption: true,
  };
}

/**
 * Generate a default Google Drive PDF Document Repository block.
 */
export function createDefaultDocuments(nodeId: string): DocumentsElement {
  const id = generateCanvasId('documents');
  return {
    id,
    type: 'documents',
    pointId: `node.${nodeId}.documents.${id}`,
    title: 'Document Repository',
    titlePointId: `node.${nodeId}.documents.${id}.title`,
    subtitle: 'Supporting PDF documents and references',
    subtitlePointId: `node.${nodeId}.documents.${id}.subtitle`,
  };
}

/**
 * Generate a default Page Link card referencing a dynamic subpage.
 */
export function createDefaultPageLink(targetPageId: string): PageLinkElement {
  return {
    id: generateCanvasId('page-link'),
    type: 'page-link',
    targetPageId,
  };
}

/**
 * Generate a default mid-level Subsection heading block.
 */
export function createDefaultSubsection(nodeId?: string): SubsectionElement {
  const id = generateCanvasId('subsection');
  return {
    id,
    type: 'subsection',
    title: 'Subsection Title',
    titlePointId: nodeId ? `node.${nodeId}.subsection.${id}.title` : undefined,
    subtitle: 'Subsection details and documentation',
    subtitlePointId: nodeId ? `node.${nodeId}.subsection.${id}.subtitle` : undefined,
  };
}

/**
 * Generate a default top-level Section heading block with auto-assigned numbering.
 */
export function createDefaultSection(index: number, nodeId?: string): SectionElement {
  const id = generateCanvasId('section');
  return {
    id,
    type: 'section',
    number: String(index + 1).padStart(2, '0'),
    isNumbered: true,
    title: 'Section Title',
    titlePointId: nodeId ? `node.${nodeId}.section.${id}.title` : undefined,
    subtitle: 'Milestone initiatives and summary of progress',
    subtitlePointId: nodeId ? `node.${nodeId}.section.${id}.subtitle` : undefined,
  };
}

/**
 * Generate a default top-level versioned document for a Node canvas.
 */
export function createDefaultCanvasDocument(nodeId: string): NodeCanvasDocument {
  return {
    nodeId,
    version: 3,
    elements: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Normalizes a v2 (nested `sections`) or v3 (flat `elements`) canvas document
 * into the canonical v3 flat `NodeCanvasDocument` shape.
 */
export function normalizeCanvasDocument(
  raw: unknown,
  fallbackNodeId = ''
): NodeCanvasDocument {
  if (!raw || typeof raw !== 'object') {
    return createDefaultCanvasDocument(fallbackNodeId);
  }

  const candidate = raw as Record<string, unknown>;
  const nodeId = typeof candidate.nodeId === 'string' ? candidate.nodeId : fallbackNodeId;
  const updatedAt =
    typeof candidate.updatedAt === 'string'
      ? candidate.updatedAt
      : new Date().toISOString();

  if (Array.isArray(candidate.elements)) {
    const validElements = candidate.elements.filter(
      (el): el is CanvasElement => Boolean(el && typeof el === 'object' && 'id' in el && 'type' in el)
    );
    return {
      nodeId,
      version: Math.max(typeof candidate.version === 'number' ? candidate.version : 3, 3),
      elements: validElements,
      updatedAt,
    };
  }

  const flattened: CanvasElement[] = [];
  if (Array.isArray(candidate.sections)) {
    for (const rawSec of candidate.sections as LegacySectionElement[]) {
      if (!rawSec || typeof rawSec !== 'object' || !rawSec.id) continue;
      const { elements: secChildren, ...secHeading } = rawSec;
      flattened.push({
        ...secHeading,
        type: 'section',
      });

      if (Array.isArray(secChildren)) {
        for (const child of secChildren) {
          if (!child || typeof child !== 'object' || !child.id || !child.type) continue;
          if (child.type === 'subsection') {
            const { elements: subChildren, ...subHeading } = child;
            flattened.push({
              ...subHeading,
              type: 'subsection',
            });
            if (Array.isArray(subChildren)) {
              for (const leaf of subChildren) {
                if (leaf && typeof leaf === 'object' && leaf.id && leaf.type) {
                  flattened.push(leaf);
                }
              }
            }
          } else {
            flattened.push(child);
          }
        }
      }
    }
  }

  return {
    nodeId,
    version: 3,
    elements: flattened,
    updatedAt,
  };
}
