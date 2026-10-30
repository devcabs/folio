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
  SubsectionElement,
  SectionElement,
  NodeCanvasDocument,
} from '../types/canvas';

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
    title: 'Evidence Gallery',
    titlePointId: `node.${nodeId}.gallery.${id}.title`,
    subtitle: 'Photo and document gallery',
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
    title: 'Indicator Chart',
    subtitle: 'Performance indicators and metrics data',
  };
}

/**
 * Generate a default mid-level Subsection container.
 */
export function createDefaultSubsection(nodeId?: string): SubsectionElement {
  const id = generateCanvasId('subsection');
  return {
    id,
    type: 'subsection',
    title: 'Subsection Title',
    titlePointId: nodeId ? `node.${nodeId}.subsection.${id}.title` : undefined,
    subtitle: 'Subsection details and source',
    subtitlePointId: nodeId ? `node.${nodeId}.subsection.${id}.subtitle` : undefined,
    elements: [],
  };
}

/**
 * Generate a default top-level Section container with auto-assigned numbering.
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
    subtitle: 'Strategic initiatives and source of progress',
    subtitlePointId: nodeId ? `node.${nodeId}.section.${id}.subtitle` : undefined,
    elements: [],
  };
}

/**
 * Generate a default top-level versioned document for a Node canvas.
 */
export function createDefaultCanvasDocument(nodeId: string): NodeCanvasDocument {
  return {
    nodeId,
    version: 2,
    sections: [],
    updatedAt: new Date().toISOString(),
  };
}
