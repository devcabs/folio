/**
 * Folio Engine - Hybrid Local-First Storage & Layout Synchronization Service
 * Location: src/services/canvasLayoutService.ts
 * Specification: docs/tasks/task8_2_storage_and_sync_service.md
 * Aligned with: docs/00_WORKFLOW.md, docs/03_ARCHITECTURE.md, docs/07_CODING_STANDARDS.md
 *
 * Implements:
 * 1. Synchronous Local-First Storage (`localStorage` under `folio_canvas_${nodeId}`).
 * 2. Cross-Component Event Bus (`engine-canvas-change`).
 * 3. Immutable tree operations with strict section auto-numbering.
 * 4. Resilient schema recovery and optional cloud persistence bridge.
 */

import type {
  CanvasElement,
  CanvasChildElement,
  CanvasLeafElement,
  SectionElement,
  SubsectionElement,
  PhotoElement,
  TextElement,
  GalleryElement,
  NodeCanvasDocument,
} from '../types/canvas';
import { createDefaultCanvasDocument } from '../utils/canvasDefaults';
import {
  getDraftCanvasKey,
  setDraftDirty,
  getInMemoryDraftCanvas,
  setInMemoryDraftCanvas,
  triggerDebouncedCloudDraftSync,
} from './draftService';
import { getStorage } from '../utils/storage';
import { getStorageNamespace } from '../config/engine.config';
import { getSupabaseConfig, isTableAvailable, markTableMissing } from '../utils/supabase-config';

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
export const CANVAS_SCHEMA_VERSION = 2;

export const NODE_IDS = ['access', 'equity', 'quality', 'resiliency', 'governance'] as const;
export type NodeId = (typeof NODE_IDS)[number];

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
  deployNodeCanvasToCloud(nodeId: string): Promise<{ success: boolean; error?: string }>;
}

/**
 * Derives the canonical live localStorage key for a specific node.
 */
export function getCanvasStorageKey(nodeId: string): string {
  return `${getCanvasLiveStoragePrefix()}${nodeId}`;
}

/**
 * Derives the draft localStorage key for a specific node.
 */
export function getDraftCanvasStorageKey(nodeId: string): string {
  return `${getCanvasDraftStoragePrefix()}${nodeId}`;
}

/**
 * Seamlessly migrates legacy folio_canvas_* and folio_content_overrides keys to folio_live_*.
 * Guarantees zero data loss for existing tenant configurations upon system update.
 */
export function migrateLegacyStorageKeys(): void {
  const storage = getStorage();
  if (!storage) return;

  for (const nodeId of NODE_IDS) {
    const legacyKey = `${getCanvasLegacyStoragePrefix()}${nodeId}`;
    const liveKey = `${getCanvasLiveStoragePrefix()}${nodeId}`;
    if (!storage.getItem(liveKey) && storage.getItem(legacyKey)) {
      storage.setItem(liveKey, storage.getItem(legacyKey)!);
    }
  }

  const legacyContent = getStorageNamespace() + '_content_overrides';
  const liveContent = getStorageNamespace() + '_live_content_overrides';
  if (!storage.getItem(liveContent) && storage.getItem(legacyContent)) {
    storage.setItem(liveContent, storage.getItem(legacyContent)!);
  }
}

/**
 * Recursively folds ContentDB overrides into a single Canvas child element (leaf or subsection).
 * Populates empty or modified AST properties from non-empty ContentDB entries.
 */
function foldInChildElement(
  el: CanvasChildElement,
  overrides: Record<string, string>,
  consumedKeys: string[]
): boolean {
  let modified = false;

  if (el.type === 'subsection') {
    const sub = el as SubsectionElement;
    const subTitleKey = sub.titlePointId || (sub as unknown as { pointId?: string }).pointId;
    if (subTitleKey && overrides[subTitleKey]) {
      const val = overrides[subTitleKey].trim();
      if (val.length > 0) {
        sub.title = val;
        modified = true;
      }
      consumedKeys.push(subTitleKey);
    }

    if (Array.isArray(sub.elements)) {
      for (const leaf of sub.elements) {
        if (foldInChildElement(leaf, overrides, consumedKeys)) {
          modified = true;
        }
      }
    }
    return modified;
  }

  // Leaf elements
  const leaf = el as CanvasLeafElement;
  const leafPointId = 'pointId' in leaf ? (leaf as { pointId?: string }).pointId : undefined;
  if (leafPointId && overrides[leafPointId]) {
    if (leaf.type === 'photo') {
      try {
        const parsed = JSON.parse(overrides[leafPointId]);
        const photo = leaf as PhotoElement;
        if (parsed.src && typeof parsed.src === 'string' && parsed.src.trim().length > 0) {
          photo.src = parsed.src.trim();
          modified = true;
        }
        if (parsed.alt && typeof parsed.alt === 'string' && parsed.alt.trim().length > 0) {
          photo.alt = parsed.alt.trim();
          modified = true;
        }
        if (parsed.caption && typeof parsed.caption === 'string' && parsed.caption.trim().length > 0) {
          photo.caption = parsed.caption.trim();
          modified = true;
        }
        if (parsed.driveUrl && typeof parsed.driveUrl === 'string' && parsed.driveUrl.trim().length > 0) {
          photo.driveUrl = parsed.driveUrl.trim();
          modified = true;
        }
      } catch {
        // Ignore non-JSON payload
      }
      consumedKeys.push(leafPointId);
    } else if (leaf.type === 'text') {
      const val = overrides[leafPointId].trim();
      if (val.length > 0) {
        (leaf as TextElement).content = val;
        modified = true;
      }
      consumedKeys.push(leafPointId);
    } else if (leaf.type === 'gallery') {
      const val = overrides[leafPointId].trim();
      if (val.length > 0) {
        (leaf as GalleryElement).title = val;
        modified = true;
      }
      consumedKeys.push(leafPointId);
    }
  }

  // Also check gallery titlePointId if distinct
  if (leaf.type === 'gallery') {
    const gal = leaf as GalleryElement;
    if (gal.titlePointId && gal.titlePointId !== leafPointId && overrides[gal.titlePointId]) {
      const val = overrides[gal.titlePointId].trim();
      if (val.length > 0) {
        gal.title = val;
        modified = true;
      }
      consumedKeys.push(gal.titlePointId);
    }
  }

  return modified;
}

/**
 * Folds ContentDB overrides into a single NodeCanvasDocument.
 */
export function foldCanvasOverridesIntoDocument(
  doc: NodeCanvasDocument,
  overrides: Record<string, string>
): { modified: boolean; consumedKeys: string[] } {
  let modified = false;
  const consumedKeys: string[] = [];

  if (!doc.sections || !Array.isArray(doc.sections)) {
    return { modified: false, consumedKeys };
  }

  for (const section of doc.sections) {
    // 1. Fold-in section titles
    const secTitleKey = section.titlePointId || (section as unknown as { pointId?: string }).pointId;
    if (secTitleKey && overrides[secTitleKey]) {
      const val = overrides[secTitleKey].trim();
      if (val.length > 0) {
        section.title = val;
        modified = true;
      }
      consumedKeys.push(secTitleKey);
    }

    // 2. Fold-in section numbering
    if (secTitleKey) {
      const numKey = `${secTitleKey}.isNumbered`;
      if (overrides[numKey]) {
        section.isNumbered = overrides[numKey] === 'true';
        modified = true;
        consumedKeys.push(numKey);
      }
    }

    // 3. Fold-in child elements
    if (Array.isArray(section.elements)) {
      for (const child of section.elements) {
        if (foldInChildElement(child, overrides, consumedKeys)) {
          modified = true;
        }
      }
    }
  }

  return { modified, consumedKeys };
}

/**
 * One-time idempotent migration that merges non-empty ContentDB overrides into the Canvas AST.
 * Deletes consumed ContentDB keys to prevent legacy overrides from lingering.
 */
export function migrateCanvasOverridesIntoAst(channel: 'live' | 'draft'): void {
  const storage = getStorage();
  if (!storage) return;

  const isDevMode = channel === 'draft';
  const contentKey = isDevMode ? (getStorageNamespace() + '_draft_content_overrides') : (getStorageNamespace() + '_live_content_overrides');
  const rawOverrides = storage.getItem(contentKey);
  if (!rawOverrides) return;

  let overrides: Record<string, string>;
  try {
    overrides = JSON.parse(rawOverrides);
  } catch {
    return;
  }

  const allConsumedKeys: string[] = [];

  for (const nodeId of NODE_IDS) {
    const doc = isDevMode ? getNodeCanvas(nodeId, true) : getLiveNodeCanvas(nodeId);
    if (!doc) continue;

    // Skip if already migrated at or above target schema version
    if ((doc.version ?? 1) >= CANVAS_SCHEMA_VERSION) continue;

    const { modified, consumedKeys } = foldCanvasOverridesIntoDocument(doc, overrides);
    allConsumedKeys.push(...consumedKeys);

    if (modified || (doc.version ?? 1) < CANVAS_SCHEMA_VERSION) {
      doc.version = CANVAS_SCHEMA_VERSION;
      if (isDevMode) {
        saveNodeCanvas(doc, true);
      } else {
        saveLiveNodeCanvas(doc);
      }
    }
  }

  // Delete consumed override keys from ContentDB
  if (allConsumedKeys.length > 0) {
    for (const key of allConsumedKeys) {
      delete overrides[key];
    }
    storage.setItem(contentKey, JSON.stringify(overrides));
  }
}

// Auto-migrate on module boot in browser environments
if (typeof window !== 'undefined') {
  try {
    migrateLegacyStorageKeys();
    migrateCanvasOverridesIntoAst('live');
    migrateCanvasOverridesIntoAst('draft');
  } catch {
    // Tolerant in restricted environments
  }
}

/**
 * Validates document schema structure defensively.
 */
function isValidCanvasDocument(data: unknown, nodeId: string): data is NodeCanvasDocument {
  if (typeof data !== 'object' || data === null) return false;
  const doc = data as Record<string, unknown>;
  return (
    doc.nodeId === nodeId &&
    typeof doc.version === 'number' &&
    Array.isArray(doc.sections) &&
    (doc.updatedAt === undefined || typeof doc.updatedAt === 'string')
  );
}

/**
 * Enforces sequential section numbering ("01", "02", "03"...) immutably.
 */
export function renumberSections(sections: SectionElement[]): SectionElement[] {
  return sections.map((sec, idx) => ({
    ...sec,
    number: String(idx + 1).padStart(2, '0'),
  }));
}

/**
 * Inserts a section into the document tree with automatic renumbering.
 */
export function insertSection(
  doc: NodeCanvasDocument,
  section: SectionElement,
  targetIndex?: number
): NodeCanvasDocument {
  const nextSections = [...doc.sections];
  if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= nextSections.length) {
    nextSections.splice(targetIndex, 0, section);
  } else {
    nextSections.push(section);
  }

  return {
    ...doc,
    sections: renumberSections(nextSections),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Inserts a subsection container within a targeted section.
 */
export function insertSubsection(
  doc: NodeCanvasDocument,
  sectionId: string,
  subsection: SubsectionElement,
  targetIndex?: number
): NodeCanvasDocument {
  const nextSections = doc.sections.map(sec => {
    if (sec.id !== sectionId) return sec;
    const elements = [...sec.elements];
    if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= elements.length) {
      elements.splice(targetIndex, 0, subsection);
    } else {
      elements.push(subsection);
    }
    return { ...sec, elements };
  });

  return {
    ...doc,
    sections: nextSections,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Inserts a leaf element (text, photo, or chart) into a section or nested subsection.
 */
export function insertLeafElement(
  doc: NodeCanvasDocument,
  sectionId: string,
  element: CanvasLeafElement,
  targetIndex?: number,
  subsectionId?: string
): NodeCanvasDocument {
  const nextSections = doc.sections.map(sec => {
    if (sec.id !== sectionId) return sec;

    if (subsectionId) {
      const nextElements = sec.elements.map(item => {
        if (item.type !== 'subsection' || item.id !== subsectionId) return item;
        const subElements = [...item.elements];
        if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= subElements.length) {
          subElements.splice(targetIndex, 0, element);
        } else {
          subElements.push(element);
        }
        return { ...item, elements: subElements };
      });
      return { ...sec, elements: nextElements };
    }

    const elements = [...sec.elements];
    if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= elements.length) {
      elements.splice(targetIndex, 0, element);
    } else {
      elements.push(element);
    }
    return { ...sec, elements };
  });

  return {
    ...doc,
    sections: nextSections,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Moves an item up or down within its current container hierarchy.
 */
/**
 * Moves an item up or down, seamlessly traversing section boundaries when reaching the top or bottom of a section.
 */
export function moveCanvasItem(
  doc: NodeCanvasDocument,
  itemId: string,
  direction: 'up' | 'down',
  parentId?: string
): NodeCanvasDocument {
  const delta = direction === 'up' ? -1 : 1;

  // 1. Check if moving a top-level section
  const secIndex = doc.sections.findIndex(s => s.id === itemId);
  if (secIndex !== -1 && (!parentId || doc.sections.some(s => s.id === parentId))) {
    const targetIndex = secIndex + delta;
    if (targetIndex < 0 || targetIndex >= doc.sections.length) return doc;
    const nextSections = [...doc.sections];
    const [moved] = nextSections.splice(secIndex, 1);
    nextSections.splice(targetIndex, 0, moved);
    return {
      ...doc,
      sections: renumberSections(nextSections),
      updatedAt: new Date().toISOString(),
    };
  }

  // 2. Locate the item in the document tree
  let foundSecIdx = -1;
  let foundElemIdx = -1;
  let foundSubIdx = -1;
  let foundLeafIdx = -1;

  for (let sIdx = 0; sIdx < doc.sections.length; sIdx++) {
    const sec = doc.sections[sIdx];
    const eIdx = sec.elements.findIndex(el => el.id === itemId);
    if (eIdx !== -1) {
      foundSecIdx = sIdx;
      foundElemIdx = eIdx;
      break;
    }
    for (let subIndex = 0; subIndex < sec.elements.length; subIndex++) {
      const item = sec.elements[subIndex];
      if (item.type === 'subsection') {
        const lIdx = item.elements.findIndex(l => l.id === itemId);
        if (lIdx !== -1) {
          foundSecIdx = sIdx;
          foundSubIdx = subIndex;
          foundLeafIdx = lIdx;
          break;
        }
      }
    }
    if (foundSecIdx !== -1) break;
  }

  if (foundSecIdx === -1) return doc; // Item not found

  // Case A: Item is a leaf inside a subsection
  if (foundSubIdx !== -1 && foundLeafIdx !== -1) {
    const sec = doc.sections[foundSecIdx];
    const sub = sec.elements[foundSubIdx] as SubsectionElement;
    const targetLeafIndex = foundLeafIdx + delta;

    // Normal move within subsection
    if (targetLeafIndex >= 0 && targetLeafIndex < sub.elements.length) {
      const nextLeaves = [...sub.elements];
      const [moved] = nextLeaves.splice(foundLeafIdx, 1);
      nextLeaves.splice(targetLeafIndex, 0, moved);

      const nextElems = [...sec.elements];
      nextElems[foundSubIdx] = { ...sub, elements: nextLeaves };

      const nextSections = [...doc.sections];
      nextSections[foundSecIdx] = { ...sec, elements: nextElems };
      return { ...doc, sections: nextSections, updatedAt: new Date().toISOString() };
    }

    // Boundary traversal out of subsection:
    // If moving UP from index 0: move out of subsection into section right before subsection
    if (direction === 'up' && foundLeafIdx === 0) {
      const nextLeaves = sub.elements.filter((_, i) => i !== foundLeafIdx);
      const moved = sub.elements[foundLeafIdx];
      const nextElems = [...sec.elements];
      nextElems[foundSubIdx] = { ...sub, elements: nextLeaves };
      nextElems.splice(foundSubIdx, 0, moved);

      const nextSections = [...doc.sections];
      nextSections[foundSecIdx] = { ...sec, elements: nextElems };
      return { ...doc, sections: nextSections, updatedAt: new Date().toISOString() };
    }

    // If moving DOWN from last index: move out of subsection into section right after subsection
    if (direction === 'down' && foundLeafIdx === sub.elements.length - 1) {
      const nextLeaves = sub.elements.filter((_, i) => i !== foundLeafIdx);
      const moved = sub.elements[foundLeafIdx];
      const nextElems = [...sec.elements];
      nextElems[foundSubIdx] = { ...sub, elements: nextLeaves };
      nextElems.splice(foundSubIdx + 1, 0, moved);

      const nextSections = [...doc.sections];
      nextSections[foundSecIdx] = { ...sec, elements: nextElems };
      return { ...doc, sections: nextSections, updatedAt: new Date().toISOString() };
    }

    return doc;
  }

  // Case B: Item is in section.elements
  if (foundElemIdx !== -1) {
    const sec = doc.sections[foundSecIdx];
    const targetElemIndex = foundElemIdx + delta;

    // Within same section
    if (targetElemIndex >= 0 && targetElemIndex < sec.elements.length) {
      const nextElems = [...sec.elements];
      const [moved] = nextElems.splice(foundElemIdx, 1);
      nextElems.splice(targetElemIndex, 0, moved);

      const nextSections = [...doc.sections];
      nextSections[foundSecIdx] = { ...sec, elements: nextElems };
      return { ...doc, sections: nextSections, updatedAt: new Date().toISOString() };
    }

    // Cross-Section Traversal:
    // Moving UP from index 0 into preceding section
    if (direction === 'up' && foundElemIdx === 0) {
      if (foundSecIdx > 0) {
        const prevSec = doc.sections[foundSecIdx - 1];
        const nextCurrentElems = [...sec.elements];
        const [moved] = nextCurrentElems.splice(0, 1);
        const nextPrevElems = [...prevSec.elements, moved];

        const nextSections = [...doc.sections];
        nextSections[foundSecIdx - 1] = { ...prevSec, elements: nextPrevElems };
        nextSections[foundSecIdx] = { ...sec, elements: nextCurrentElems };
        return { ...doc, sections: nextSections, updatedAt: new Date().toISOString() };
      }
      return doc; // Absolute first element in canvas
    }

    // Moving DOWN from last index into succeeding section
    if (direction === 'down' && foundElemIdx === sec.elements.length - 1) {
      if (foundSecIdx < doc.sections.length - 1) {
        const nextSec = doc.sections[foundSecIdx + 1];
        const nextCurrentElems = [...sec.elements];
        const [moved] = nextCurrentElems.splice(foundElemIdx, 1);
        const nextNextElems = [moved, ...nextSec.elements];

        const nextSections = [...doc.sections];
        nextSections[foundSecIdx] = { ...sec, elements: nextCurrentElems };
        nextSections[foundSecIdx + 1] = { ...nextSec, elements: nextNextElems };
        return { ...doc, sections: nextSections, updatedAt: new Date().toISOString() };
      }
      return doc; // Absolute last element in canvas
    }
  }

  return doc;
}

/**
 * Relocates any canvas element (section, subsection, or leaf) from anywhere in the document
 * to a new container and target index (powers cross-section drag-and-drop).
 */
export function relocateCanvasItem(
  doc: NodeCanvasDocument,
  sourceItemId: string,
  targetContainerId: string,
  targetIndex?: number
): NodeCanvasDocument {
  // 1. Locate and extract the item
  let extractedItem: CanvasElement | null = null;
  let nextSections: SectionElement[] = [];

  // Check if it's a section
  const secIdx = doc.sections.findIndex(s => s.id === sourceItemId);
  if (secIdx !== -1) {
    nextSections = [...doc.sections];
    [extractedItem] = nextSections.splice(secIdx, 1);
  } else {
    // Search in section elements or subsection elements
    nextSections = doc.sections.map(sec => {
      const elemIdx = sec.elements.findIndex(el => el.id === sourceItemId);
      if (elemIdx !== -1) {
        const nextElems = [...sec.elements];
        [extractedItem] = nextElems.splice(elemIdx, 1);
        return { ...sec, elements: nextElems };
      }

      // Check inside subsections
      let subModified = false;
      const nextElems = sec.elements.map(item => {
        if (item.type !== 'subsection') return item;
        const leafIdx = item.elements.findIndex(l => l.id === sourceItemId);
        if (leafIdx !== -1) {
          subModified = true;
          const nextLeaves = [...item.elements];
          [extractedItem] = nextLeaves.splice(leafIdx, 1);
          return { ...item, elements: nextLeaves };
        }
        return item;
      });

      if (subModified) {
        return { ...sec, elements: nextElems };
      }
      return sec;
    });
  }

  if (!extractedItem) {
    return doc; // Item not found
  }

  // 2. Insert into targetContainerId
  if (targetContainerId === doc.nodeId || targetContainerId === 'root') {
    if (extractedItem.type === 'section') {
      const idx = typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= nextSections.length
        ? targetIndex
        : nextSections.length;
      nextSections.splice(idx, 0, extractedItem as SectionElement);
    } else {
      if (nextSections.length === 0) {
        const newSec: SectionElement = {
          id: `sec-${Date.now().toString(36)}`,
          type: 'section',
          number: '01',
          title: 'Section Title',
          elements: [extractedItem as CanvasChildElement],
        };
        nextSections.push(newSec);
      } else {
        const targetSecIdx = typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < nextSections.length
          ? targetIndex
          : nextSections.length - 1;
        const targetSec = nextSections[targetSecIdx];
        const nextElems = [...targetSec.elements, extractedItem as CanvasChildElement];
        nextSections[targetSecIdx] = { ...targetSec, elements: nextElems };
      }
    }
    return {
      ...doc,
      sections: renumberSections(nextSections),
      updatedAt: new Date().toISOString(),
    };
  }

  // Target is a section or subsection
  nextSections = nextSections.map(sec => {
    if (sec.id === targetContainerId) {
      const nextElems = [...sec.elements];
      const idx = typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= nextElems.length
        ? targetIndex
        : nextElems.length;
      nextElems.splice(idx, 0, extractedItem as CanvasChildElement);
      return { ...sec, elements: nextElems };
    }

    const subIdx = sec.elements.findIndex(el => el.type === 'subsection' && el.id === targetContainerId);
    if (subIdx !== -1 && extractedItem && extractedItem.type !== 'section' && extractedItem.type !== 'subsection') {
      const targetSub = sec.elements[subIdx] as SubsectionElement;
      const nextLeaves = [...targetSub.elements];
      const idx = typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= nextLeaves.length
        ? targetIndex
        : nextLeaves.length;
      nextLeaves.splice(idx, 0, extractedItem as CanvasLeafElement);
      const nextElems = [...sec.elements];
      nextElems[subIdx] = { ...targetSub, elements: nextLeaves };
      return { ...sec, elements: nextElems };
    }

    return sec;
  });

  return {
    ...doc,
    sections: renumberSections(nextSections),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Removes an item and all its nested children from the canvas document tree.
 */
export function removeCanvasItem(
  doc: NodeCanvasDocument,
  itemId: string,
  parentId?: string
): NodeCanvasDocument {
  // If removing a top-level section
  if (doc.sections.some(s => s.id === itemId) && (!parentId || parentId === doc.nodeId)) {
    const nextSections = doc.sections.filter(s => s.id !== itemId);
    return {
      ...doc,
      sections: renumberSections(nextSections),
      updatedAt: new Date().toISOString(),
    };
  }

  // Otherwise, remove from section elements or subsection elements
  const nextSections = doc.sections.map(sec => {
    const nextElements = sec.elements
      .filter(el => el.id !== itemId)
      .map(item => {
        if (item.type !== 'subsection') return item;
        const nextLeaves = item.elements.filter(leaf => leaf.id !== itemId);
        if (nextLeaves.length === item.elements.length) return item;
        return { ...item, elements: nextLeaves };
      });

    return { ...sec, elements: nextElements };
  });

  return {
    ...doc,
    sections: nextSections,
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
  const nextSections = doc.sections.map(sec => {
    if (sec.id === itemId) {
      return { ...sec, ...updates } as SectionElement;
    }

    const nextElements = sec.elements.map(el => {
      if (el.id === itemId) {
        return { ...el, ...updates } as CanvasChildElement;
      }
      if (el.type === 'subsection') {
        const nextLeaves = el.elements.map(leaf => {
          if (leaf.id === itemId) {
            return { ...leaf, ...updates } as CanvasLeafElement;
          }
          return leaf;
        });
        return { ...el, elements: nextLeaves };
      }
      return el;
    });

    return { ...sec, elements: nextElements };
  });

  return {
    ...doc,
    sections: nextSections,
    updatedAt: new Date().toISOString(),
  };
}

export interface CanvasItemLocation {
  item: CanvasElement;
  kind: 'section' | 'subsection' | 'leaf';
  index: number;
  sectionId: string;
  subsectionId?: string;
}

/**
 * Finds any item within the canvas document and returns its structural location and container.
 */
export function findCanvasItemLocation(
  doc: NodeCanvasDocument,
  itemId: string
): CanvasItemLocation | null {
  const secIdx = doc.sections.findIndex(s => s.id === itemId);
  if (secIdx !== -1) {
    return {
      item: doc.sections[secIdx],
      kind: 'section',
      index: secIdx,
      sectionId: itemId,
    };
  }

  for (const sec of doc.sections) {
    for (let i = 0; i < sec.elements.length; i++) {
      const el = sec.elements[i];
      if (el.id === itemId) {
        return {
          item: el,
          kind: el.type === 'subsection' ? 'subsection' : 'leaf',
          index: i,
          sectionId: sec.id,
        };
      }
      if (el.type === 'subsection') {
        for (let j = 0; j < el.elements.length; j++) {
          const leaf = el.elements[j];
          if (leaf.id === itemId) {
            return {
              item: leaf,
              kind: 'leaf',
              index: j,
              sectionId: sec.id,
              subsectionId: el.id,
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Synchronous retrieval of a node canvas document strictly from the live/published channel.
 */
export function getLiveNodeCanvas(nodeId: string): NodeCanvasDocument {
  const storage = getStorage();
  const key = `${getCanvasLiveStoragePrefix()}${nodeId}`;

  if (storage) {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidCanvasDocument(parsed, nodeId)) {
          return {
            ...parsed,
            sections: renumberSections(parsed.sections),
          };
        }
      }
    } catch {
      // Gracefully recover to default on corrupted JSON
    }
  }

  return createDefaultCanvasDocument(nodeId);
}

/**
 * Persists a canvas document strictly to the live/published channel.
 */
export function saveLiveNodeCanvas(
  doc: NodeCanvasDocument,
  options?: SaveCanvasOptions
): SaveResult {
  const docToSave: NodeCanvasDocument = {
    ...doc,
    sections: renumberSections(doc.sections),
    updatedAt: new Date().toISOString(),
  };

  const storage = getStorage();
  let ok = true;
  let error: 'quota' | 'unknown' | undefined;

  if (storage) {
    try {
      storage.setItem(`${getCanvasLiveStoragePrefix()}${doc.nodeId}`, JSON.stringify(docToSave));
    } catch (err: unknown) {
      console.error('Storage quota exceeded while saving live canvas document:', err);
      ok = false;
      error = 'quota';
    }
  } else {
    ok = false;
    error = 'unknown';
  }

  if (ok && !options?.silent && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    const detail: CanvasChangeEventDetail = {
      nodeId: doc.nodeId,
      document: docToSave,
    };
    window.dispatchEvent(new CustomEvent(EVENT_LIVE_CANVAS_CHANGE, { detail }));
  }

  return { ok, error, document: docToSave };
}

/**
 * Synchronous local-first retrieval of a node canvas document.
 * Reads from draft sandbox if Developer Mode is active (isDevMode === true);
 * otherwise strictly and unconditionally from the canonical live published channel.
 */
export function getNodeCanvas(nodeId: string, isDevMode = false): NodeCanvasDocument {
  const storage = getStorage();

  // If in Dev Mode, read in-memory draft channel first
  if (isDevMode) {
    const memoryDraft = getInMemoryDraftCanvas(nodeId);
    if (memoryDraft && isValidCanvasDocument(memoryDraft, nodeId)) {
      return {
        ...memoryDraft,
        sections: renumberSections(memoryDraft.sections),
      };
    }

    if (storage) {
      try {
        const rawDraft = storage.getItem(getDraftCanvasKey(nodeId));
        if (rawDraft) {
          const parsedDraft = JSON.parse(rawDraft);
          if (isValidCanvasDocument(parsedDraft, nodeId)) {
            return {
              ...parsedDraft,
              sections: renumberSections(parsedDraft.sections),
            };
          }
        }
      } catch {
        // Fall through to live storage
      }
    }
  }

  // Public Mode strictly reads canonical live published canvas
  return getLiveNodeCanvas(nodeId);
}

/**
 * Persists canvas document to storage (draft or live) and broadcasts change via scoped CustomEvent.
 */
export function saveNodeCanvas(
  doc: NodeCanvasDocument,
  isDevMode = false,
  options?: SaveCanvasOptions
): SaveResult {
  const docToSave: NodeCanvasDocument = {
    ...doc,
    sections: renumberSections(doc.sections),
    updatedAt: new Date().toISOString(),
  };

  const storage = getStorage();
  let ok = true;
  let error: 'quota' | 'unknown' | undefined;

  if (isDevMode) {
    // Draft mutations are purely in-memory with debounced background cloud sync.
    // Zero localStorage writes for draft documents!
    setInMemoryDraftCanvas(doc.nodeId, docToSave);
    setDraftDirty(true);
    triggerDebouncedCloudDraftSync();
  } else if (storage) {
    try {
      storage.setItem(`${getCanvasLiveStoragePrefix()}${doc.nodeId}`, JSON.stringify(docToSave));
    } catch (err: unknown) {
      console.error('Storage quota exceeded while saving canvas document:', err);
      ok = false;
      error = 'quota';
    }
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
 * Resets storage for a node back to factory defaults and broadcasts change via scoped CustomEvent.
 */
export function resetNodeCanvas(nodeId: string, isDevMode = false): NodeCanvasDocument {
  const freshDoc = createDefaultCanvasDocument(nodeId);
  const storage = getStorage();

  if (isDevMode) {
    setInMemoryDraftCanvas(nodeId, freshDoc);
    setDraftDirty(true);
    triggerDebouncedCloudDraftSync();
    if (storage) {
      try {
        storage.removeItem(getDraftCanvasKey(nodeId));
      } catch {
        // Ignore
      }
    }
  } else if (storage) {
    try {
      storage.removeItem(`${getCanvasLiveStoragePrefix()}${nodeId}`);
    } catch {
      // Ignore
    }
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
  if (typeof window === 'undefined') return () => {};

  const eventName = isDevMode ? EVENT_DRAFT_CANVAS_CHANGE : EVENT_LIVE_CANVAS_CHANGE;

  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<CanvasChangeEventDetail>;
    if (
      customEvent.detail &&
      (customEvent.detail.nodeId === nodeId || customEvent.detail.nodeId === '*')
    ) {
      const doc =
        customEvent.detail.nodeId === '*' || !customEvent.detail.document
          ? getNodeCanvas(nodeId, isDevMode)
          : customEvent.detail.document;
      callback(doc);
    }
  };

  const storageHandler = (e: StorageEvent) => {
    const targetKey = isDevMode ? getDraftCanvasStorageKey(nodeId) : getCanvasStorageKey(nodeId);
    if ((e.key === targetKey || e.key === null) && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (isValidCanvasDocument(parsed, nodeId)) {
          callback({ ...parsed, sections: renumberSections(parsed.sections) });
        }
      } catch {
        // ignore JSON parse errors
      }
    }
  };

  window.addEventListener(eventName, handler);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(eventName, handler);
    window.removeEventListener('storage', storageHandler);
  };
}

/**
 * Deploys the active canvas document to cloud storage (Supabase).
 */
export async function deployNodeCanvasToCloud(
  nodeId: string
): Promise<{ success: boolean; error?: string }> {
  const doc = getNodeCanvas(nodeId);
  const config = getSupabaseConfig();

  if (!config) {
    // Offline or development mode: simulated success
    return { success: true };
  }

  if (!isTableAvailable('pillar_canvas')) {
    return { success: false, error: 'Table pillar_canvas unavailable in this session' };
  }

  try {
    const res = await fetch(`${config.url}/rest/v1/node_canvas`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        node_id: nodeId,
        document: doc,
        updated_at: doc.updatedAt,
      }),
    });

    if (res.status === 404) {
      markTableMissing('pillar_canvas');
      return {
        success: false,
        error: `Cloud sync responded with status ${res.status}`,
      };
    }

    if (!res.ok) {
      return {
        success: false,
        error: `Cloud sync responded with status ${res.status}`,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const canvasLayoutService: CanvasLayoutService = {
  getNodeCanvas,
  saveNodeCanvas,
  resetNodeCanvas,
  subscribeToCanvasChange,
  deployNodeCanvasToCloud,
};
