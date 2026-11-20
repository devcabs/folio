/**
 * Folio Engine - Hybrid Local-First Storage & Layout Synchronization Service
 * Location: src/services/canvasLayoutService.ts
 * Specification: docs/tasks/task8_2_storage_and_sync_service.md
 * Aligned with: docs/00_WORKFLOW.md, docs/03_ARCHITECTURE.md, docs/07_CODING_STANDARDS.md
 *
 * Implements:
 * 1. Stateless AST transformation functions for NodeCanvasDocument.
 * 2. Cross-Component Event Bus (`engine-draft-canvas-change`).
 * 3. Immutable tree operations with strict section auto-numbering.
 */

import type {
  CanvasElement,
  CanvasLeafElement,
  SectionElement,
  SubsectionElement,
  NodeCanvasDocument,
} from '../types/canvas';
import { createDefaultCanvasDocument, normalizeCanvasDocument } from '../utils/canvasDefaults';
import { dispatchDraftChange } from './draftService';
import { getStorageNamespace } from '../config/engine.config';

export const getCanvasLiveStoragePrefix = (ns?: string) => (ns || getStorageNamespace()) + '_live_canvas_';
export const CANVAS_LIVE_STORAGE_PREFIX = getCanvasLiveStoragePrefix();
export const getCanvasDraftStoragePrefix = (ns?: string) => (ns || getStorageNamespace()) + '_draft_canvas_';
export const CANVAS_DRAFT_STORAGE_PREFIX = getCanvasDraftStoragePrefix();
export const getCanvasLegacyStoragePrefix = (ns?: string) => (ns || getStorageNamespace()) + '_canvas_';
export const CANVAS_LEGACY_STORAGE_PREFIX = getCanvasLegacyStoragePrefix();
// Canonical live prefix
export const CANVAS_STORAGE_PREFIX = CANVAS_LIVE_STORAGE_PREFIX;

export const EVENT_LIVE_CANVAS_CHANGE = 'engine-live-canvas-change';
export const EVENT_DRAFT_CANVAS_CHANGE = 'engine-draft-canvas-change';
export const CANVAS_SCHEMA_VERSION = 3;

export type NodeId = string;

export interface SaveCanvasOptions {
  silent?: boolean;
}

export interface CanvasChangeEventDetail {
  nodeId: string;
  document: NodeCanvasDocument;
}

export interface SaveResult {
  ok: boolean;
  error?: 'quota' | 'unknown';
  document: NodeCanvasDocument;
}

export interface CanvasLayoutService {
  getNodeCanvas(nodeId: string, isDevMode?: boolean): NodeCanvasDocument;
  saveNodeCanvas(doc: NodeCanvasDocument, isDevMode?: boolean): SaveResult;
  resetNodeCanvas(nodeId: string, isDevMode?: boolean): NodeCanvasDocument;
  subscribeToCanvasChange(nodeId: string, callback: (doc: NodeCanvasDocument) => void, isDevMode?: boolean): () => void;
}

/**
 * Derives the canonical live storage key for a specific node.
 */
export function getCanvasStorageKey(nodeId: string): string {
  return `${getCanvasLiveStoragePrefix()}${nodeId}`;
}

/**
 * Derives the draft storage key for a specific node.
 */
export function getDraftCanvasStorageKey(nodeId: string): string {
  return `${getCanvasDraftStoragePrefix()}${nodeId}`;
}

// Legacy ContentDB folding and AST migration removed in Subtask 7.3 (Canvas AST is SSOT).

/**
 * Enforces sequential section numbering ("01", "02", "03"...) immutably across flat canvas elements.
 */
export function renumberCanvasElements(elements: CanvasElement[]): CanvasElement[] {
  let sectionIdx = 0;
  return elements.map((el) => {
    if (el.type !== 'section') return el;
    sectionIdx += 1;
    return {
      ...el,
      number: String(sectionIdx).padStart(2, '0'),
    };
  });
}

/**
 * Inserts any canvas element (section, subsection, or leaf) at targetIndex in flat `doc.elements`.
 */
export function insertCanvasElement(
  doc: NodeCanvasDocument,
  element: CanvasElement,
  targetIndex?: number
): NodeCanvasDocument {
  const nextElements = [...doc.elements];
  if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= nextElements.length) {
    nextElements.splice(targetIndex, 0, element);
  } else {
    nextElements.push(element);
  }

  return {
    ...doc,
    version: CANVAS_SCHEMA_VERSION,
    elements: renumberCanvasElements(nextElements),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Inserts a section heading into the flat document tree with automatic renumbering.
 */
export function insertSection(
  doc: NodeCanvasDocument,
  section: SectionElement,
  targetIndex?: number
): NodeCanvasDocument {
  return insertCanvasElement(doc, section, targetIndex);
}

/**
 * Inserts a subsection heading into the flat document tree.
 */
export function insertSubsection(
  doc: NodeCanvasDocument,
  subsection: SubsectionElement,
  targetIndex?: number
): NodeCanvasDocument {
  return insertCanvasElement(doc, subsection, targetIndex);
}

/**
 * Inserts a leaf element (text, photo, chart, etc.) into the flat document tree.
 */
export function insertLeafElement(
  doc: NodeCanvasDocument,
  element: CanvasLeafElement,
  targetIndex?: number
): NodeCanvasDocument {
  return insertCanvasElement(doc, element, targetIndex);
}

/**
 * Moves an element (section, subsection, or leaf) one slot up or down in `doc.elements`.
 */
export function moveCanvasItem(
  doc: NodeCanvasDocument,
  itemId: string,
  direction: 'up' | 'down',
  _parentId?: string
): NodeCanvasDocument {
  const delta = direction === 'up' ? -1 : 1;
  const idx = doc.elements.findIndex((el) => el.id === itemId);
  if (idx === -1) return doc;

  const targetIndex = idx + delta;
  if (targetIndex < 0 || targetIndex >= doc.elements.length) return doc;

  const nextElements = [...doc.elements];
  const [moved] = nextElements.splice(idx, 1);
  nextElements.splice(targetIndex, 0, moved);

  return {
    ...doc,
    version: CANVAS_SCHEMA_VERSION,
    elements: renumberCanvasElements(nextElements),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Relocates any canvas element (section, subsection, or leaf) to `targetIndex` in `doc.elements`.
 */
export function relocateCanvasItem(
  doc: NodeCanvasDocument,
  sourceItemId: string,
  _targetContainerId: string,
  targetIndex?: number
): NodeCanvasDocument {
  const sourceIdx = doc.elements.findIndex((el) => el.id === sourceItemId);
  if (sourceIdx === -1) return doc;

  const nextElements = [...doc.elements];
  const [extracted] = nextElements.splice(sourceIdx, 1);

  let resolvedTarget =
    typeof targetIndex === 'number' && targetIndex >= 0 ? targetIndex : nextElements.length;
  if (sourceIdx < resolvedTarget) {
    resolvedTarget = Math.max(0, resolvedTarget - 1);
  }
  resolvedTarget = Math.min(resolvedTarget, nextElements.length);

  nextElements.splice(resolvedTarget, 0, extracted);

  return {
    ...doc,
    version: CANVAS_SCHEMA_VERSION,
    elements: renumberCanvasElements(nextElements),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Removes an element by ID from `doc.elements`.
 * Removing a section or subsection heading removes ONLY the heading block;
 * all subsequent elements remain intact and naturally merge upward.
 */
export function removeCanvasItem(
  doc: NodeCanvasDocument,
  itemId: string,
  _parentId?: string
): NodeCanvasDocument {
  const nextElements = doc.elements.filter((el) => el.id !== itemId);
  if (nextElements.length === doc.elements.length) return doc;

  return {
    ...doc,
    version: CANVAS_SCHEMA_VERSION,
    elements: renumberCanvasElements(nextElements),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Immutably updates attributes of any canvas element by ID.
 */
export function updateCanvasItem<T extends CanvasElement>(
  doc: NodeCanvasDocument,
  itemId: string,
  updates: Partial<T>
): NodeCanvasDocument {
  const nextElements = doc.elements.map((el) => {
    if (el.id === itemId) {
      return { ...el, ...updates } as CanvasElement;
    }
    return el;
  });

  return {
    ...doc,
    version: CANVAS_SCHEMA_VERSION,
    elements: nextElements,
    updatedAt: new Date().toISOString(),
  };
}

export interface CanvasItemLocation {
  item: CanvasElement;
  kind: 'section' | 'subsection' | 'leaf';
  index: number;
}

/**
 * Finds any item within the flat canvas document and returns its index and kind.
 */
export function findCanvasItemLocation(
  doc: NodeCanvasDocument,
  itemId: string
): CanvasItemLocation | null {
  const idx = doc.elements.findIndex((el) => el.id === itemId);
  if (idx === -1) return null;

  const item = doc.elements[idx];
  const kind =
    item.type === 'section'
      ? 'section'
      : item.type === 'subsection'
        ? 'subsection'
        : 'leaf';

  return {
    item,
    kind,
    index: idx,
  };
}

/**
 * Synchronous retrieval of a node canvas document.
 * Reads strictly from in-memory draft sandbox if Developer Mode is active (isDevMode === true);
 * for public visitors (isDevMode === false), returns an empty baseline shell.
 * Cloudflare Edge KV is the unconditional single source of truth for public visitors.
 */
export function getNodeCanvas(nodeId: string, _isDevMode = false): NodeCanvasDocument {
  return createDefaultCanvasDocument(nodeId);
}

/**
 * Persists canvas document to draft channel and broadcasts change via scoped CustomEvent.
 */
export function saveNodeCanvas(
  doc: NodeCanvasDocument,
  isDevMode = false,
  options?: SaveCanvasOptions
): SaveResult {
  const normalized = normalizeCanvasDocument(doc, doc.nodeId);
  const docToSave: NodeCanvasDocument = {
    ...normalized,
    version: CANVAS_SCHEMA_VERSION,
    elements: renumberCanvasElements(normalized.elements),
    updatedAt: new Date().toISOString(),
  };

  let ok = true;
  let error: 'quota' | 'unknown' | undefined;

  if (isDevMode) {
    dispatchDraftChange(true, true);
  } else {
    ok = false;
    error = 'unknown';
  }

  if (ok && !options?.silent && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    const eventName = isDevMode ? EVENT_DRAFT_CANVAS_CHANGE : EVENT_LIVE_CANVAS_CHANGE;
    const detail: CanvasChangeEventDetail = {
      nodeId: doc.nodeId,
      document: docToSave,
    };
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  return { ok, error, document: docToSave };
}

/**
 * Dispatches an aggregate canvas change event with nodeId: '*' to notify all node consumers at once.
 */
export function dispatchAggregateCanvasChange(isDevMode = false): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  const eventName = isDevMode ? EVENT_DRAFT_CANVAS_CHANGE : EVENT_LIVE_CANVAS_CHANGE;
  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail: {
        nodeId: '*',
      },
    })
  );
}

/**
 * Resets a node canvas back to factory defaults and broadcasts change via scoped CustomEvent.
 */
export function resetNodeCanvas(nodeId: string, isDevMode = false): NodeCanvasDocument {
  const freshDoc = createDefaultCanvasDocument(nodeId);

  if (isDevMode) {
    dispatchDraftChange(true, true);
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    const eventName = isDevMode ? EVENT_DRAFT_CANVAS_CHANGE : EVENT_LIVE_CANVAS_CHANGE;
    const detail: CanvasChangeEventDetail = {
      nodeId,
      document: freshDoc,
    };
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  return freshDoc;
}

/**
 * Subscribes a listener to canvas change events strictly scoped by channel.
 * Public views (isDevMode === false) never receive uncommitted draft events.
 */
export function subscribeToCanvasChange(
  nodeId: string,
  callback: (doc: NodeCanvasDocument) => void,
  isDevMode = false
): () => void {
  if (typeof window === 'undefined') return () => { };

  const eventName = isDevMode ? EVENT_DRAFT_CANVAS_CHANGE : EVENT_LIVE_CANVAS_CHANGE;

  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<CanvasChangeEventDetail>;
    if (
      customEvent.detail &&
      (customEvent.detail.nodeId === nodeId || customEvent.detail.nodeId === '*')
    ) {
      if (!isDevMode && customEvent.detail.nodeId === '*' && !customEvent.detail.document) {
        return;
      }

      const doc =
        customEvent.detail.nodeId === '*' || !customEvent.detail.document
          ? getNodeCanvas(nodeId, isDevMode)
          : customEvent.detail.document;
      callback(doc);
    }
  };

  window.addEventListener(eventName, handler);
  return () => {
    window.removeEventListener(eventName, handler);
  };
}

export const canvasLayoutService: CanvasLayoutService = {
  getNodeCanvas,
  saveNodeCanvas,
  resetNodeCanvas,
  subscribeToCanvasChange,
};
