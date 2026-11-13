/**
 * Folio Engine - Reactive Dynamic Canvas Hook
 * Location: src/hooks/useNodeCanvas.ts
 * Specification: docs/tasks/task8_2_storage_and_sync_service.md
 * Aligned with: docs/00_WORKFLOW.md, docs/03_ARCHITECTURE.md, docs/07_CODING_STANDARDS.md
 *
 * Implements:
 * 1. Synchronous state initialization from local-first storage.
 * 2. Cross-component synchronization via CustomEvent subscription.
 * 3. Non-blocking UI updates using React 19 startTransition (rerender-transitions).
 * 4. Atomic, immutable CRUD dispatchers for sections, subsections, and leaf elements.
 */

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import type {
  CanvasElement,
  CanvasLeafElement,
  SectionElement,
  SubsectionElement,
  NodeCanvasDocument,
} from '../types/canvas';
import type { PublicNodePayload } from '../types/edge';
import {
  getNodeCanvas,
  saveNodeCanvas,
  saveLiveNodeCanvas,
  resetNodeCanvas,
  subscribeToCanvasChange,
  deployNodeCanvasToCloud,
  insertSection,
  insertSubsection,
  insertLeafElement,
  moveCanvasItem,
  relocateCanvasItem,
  removeCanvasItem,
  updateCanvasItem,
  findCanvasItemLocation,
} from '../services/canvasLayoutService';
import {
  createDefaultSection,
  createDefaultSubsection,
} from '../utils/canvasDefaults';
import { useUndoRedo } from './useUndoRedo';
import { useDeveloperMode } from './useDeveloperMode';
import { parseCsvToMatrix } from '../services/sheetsDataService';
import { setCachedChartConfig } from '../services/chartSourceService';
import { getMatrixCacheKey } from './useSheetChartData';
import type { NodeCode } from '../types/node';

export interface UseNodeCanvasReturn {
  /** Active in-memory canvas document tree */
  document: NodeCanvasDocument;
  /** True when a canvas layout transition is pending */
  isPending: boolean;
  /** True when edge KV canvas hydration is in flight for public visitors */
  isHydrating: boolean;
  /** Add a new section container with automatic numbering */
  addSection: (targetIndex?: number) => void;
  /** Add a new subsection container inside a section */
  addSubsection: (sectionId: string, targetIndex?: number) => void;
  /** Add a leaf element (text, photo, chart) to a section or subsection */
  addElement: (sectionId: string, element: CanvasLeafElement, targetIndex?: number, subsectionId?: string) => void;
  /** Restore or insert an existing section at target index (for undo) */
  restoreSection: (section: SectionElement, targetIndex?: number) => void;
  /** Restore or insert an existing subsection at target index (for undo) */
  restoreSubsection: (sectionId: string, subsection: SubsectionElement, targetIndex?: number) => void;
  /** Restore or insert an existing leaf element at target index (for undo) */
  restoreElement: (sectionId: string, element: CanvasLeafElement, targetIndex?: number, subsectionId?: string) => void;
  /** Move an item up or down within its container */
  moveItem: (itemId: string, direction: 'up' | 'down', parentId?: string) => void;
  /** Relocate an item anywhere across the canvas to a target container */
  relocateItem: (sourceItemId: string, targetContainerId: string, targetIndex?: number) => void;
  /** Remove an item and all its nested children */
  removeItem: (itemId: string, parentId?: string) => void;
  /** Update attributes of an element by ID */
  updateItem: <T extends CanvasElement>(itemId: string, updates: Partial<T>) => void;
  /** Reset node canvas back to default structure */
  resetToDefault: () => void;
  /** Deploy active canvas document to cloud storage (Supabase) */
  deployToCloud: () => Promise<boolean>;
  /** Error message if saving canvas to storage failed (e.g. storage quota exceeded) */
  saveError: string | null;
  /** Dismiss the active save error */
  clearSaveError: () => void;
}

/**
 * Hook providing reactive state and atomic dispatchers for managing a node's Dynamic Canvas.
 */
export const useNodeCanvas = useDocumentCanvas;
export function useDocumentCanvas(nodeId: string): UseNodeCanvasReturn {
  const { isDevMode } = useDeveloperMode();

  // Vercel Best Practice: rerender-lazy-state-init
  const [document, setDocument] = useState<NodeCanvasDocument>(() => getNodeCanvas(nodeId, isDevMode));
  // Vercel Best Practice: rerender-transitions
  const [isPending, startTransition] = useTransition();
  const [isHydrating, setIsHydrating] = useState<boolean>(() => !isDevMode && typeof window !== 'undefined');

  // Stable ref for checking latest updatedAt timestamp to prevent recursive event reflection
  const documentRef = useRef(document);
  documentRef.current = document;

  // Track timestamp of locally initiated mutations to prevent self-reflection loop
  const localUpdateTimestampRef = useRef<string | null>(null);

  useEffect(() => {
    // Synchronize initial document if nodeId or isDevMode changed
    const initialDoc = getNodeCanvas(nodeId, isDevMode);
    documentRef.current = initialDoc;
    setDocument(initialDoc);

    // Vercel Best Practice: client-event-listeners with clean unbind
    const unsubscribe = subscribeToCanvasChange(
      nodeId,
      (incomingDoc) => {
        // Ignore reflection of our own mutations
        if (incomingDoc.updatedAt === localUpdateTimestampRef.current) {
          return;
        }
        if (documentRef.current.updatedAt !== incomingDoc.updatedAt) {
          documentRef.current = incomingDoc;
          startTransition(() => {
            setDocument(incomingDoc);
          });
        }
      },
      isDevMode
    );

    return unsubscribe;
  }, [nodeId, isDevMode]);

  // Public visitors: Edge-first hydration ladder (Task 15.4)
  // Non-blocking background fetch hitting Cloudflare KV pre-baked cache (< 30ms)
  useEffect(() => {
    if (!isDevMode && nodeId) {
      let isCancelled = false;
      setIsHydrating(true);

      fetch(`/api/public/node/${nodeId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((edgeData: PublicNodePayload | null) => {
          if (isCancelled || !edgeData || edgeData.nodeId !== nodeId) return;

          // 1. Hydrate prebaked chart datasets into client chart cache
          if (edgeData.chartDatasets && typeof edgeData.chartDatasets === 'object') {
            try {
              for (const [chartId, chartDataset] of Object.entries(edgeData.chartDatasets)) {
                if (chartDataset && typeof chartDataset === 'object') {
                  const dataset = chartDataset as any;
                  if (dataset.sanitizedCsvContent) {
                    const matrix = parseCsvToMatrix(dataset.sanitizedCsvContent);
                    if (matrix && matrix.length > 0 && typeof window !== 'undefined' && window.localStorage) {
                      window.localStorage.setItem(getMatrixCacheKey(chartId), JSON.stringify(matrix));
                    }
                  }
                  setCachedChartConfig({
                    chartId,
                    nodeId: (nodeId || 'access') as NodeCode,
                    sheetUrl: '',
                    defaultType: dataset.chartType || 'bar',
                    titleOverride: dataset.title,
                    subtitleOverride: dataset.subtitle,
                    unitOverride: dataset.unit,
                    visualConfig: dataset.visualConfig,
                    updatedAt: dataset.asOfDate || new Date().toISOString(),
                    updatedBy: 'edge-prebake',
                  });
                }
              }
            } catch {
              // Non-blocking chart cache warming
            }
          }

          // 2. Hydrate canvas AST document
          if (edgeData.canvas && Array.isArray(edgeData.canvas.sections)) {
            if (
              edgeData.canvas.updatedAt !== documentRef.current.updatedAt ||
              edgeData.canvas.sections.length !== documentRef.current.sections.length
            ) {
              documentRef.current = edgeData.canvas;
              // Silently warm local storage cache for subsequent offline / cold boots
              try {
                saveLiveNodeCanvas(edgeData.canvas, { silent: true });
              } catch {
                // Non-blocking storage cache write
              }
              startTransition(() => {
                setDocument(edgeData.canvas);
              });
            }
          }
        })
        .catch(() => {
          // Transparent fallback to local/Supabase baseline
        })
        .finally(() => {
          if (!isCancelled) {
            setIsHydrating(false);
          }
        });

      return () => {
        isCancelled = true;
      };
    } else {
      setIsHydrating(false);
    }
  }, [nodeId, isDevMode]);

  // Hook into active session undo/redo engine
  const { pushAction } = useUndoRedo();

  const [saveError, setSaveError] = useState<string | null>(null);

  const clearSaveError = useCallback(() => {
    setSaveError(null);
  }, []);

  // Internal helper applying immutable updates within transitions and persisting to storage
  const mutate = useCallback((mutator: (prev: NodeCanvasDocument) => NodeCanvasDocument) => {
    const next = mutator(documentRef.current);
    const result = saveNodeCanvas(next, isDevMode);
    if (!result.ok && isDevMode) {
      setSaveError('Edit not saved — browser storage full.');
    } else if (result.ok) {
      setSaveError(null);
    }
    const savedDoc = result.document;
    localUpdateTimestampRef.current = savedDoc.updatedAt;
    documentRef.current = savedDoc;
    startTransition(() => {
      setDocument(savedDoc);
    });
  }, [isDevMode]);

  const restoreSection = useCallback((section: SectionElement, targetIndex?: number) => {
    mutate(prev => insertSection(prev, section, targetIndex));
  }, [mutate]);

  const restoreSubsection = useCallback((sectionId: string, subsection: SubsectionElement, targetIndex?: number) => {
    mutate(prev => insertSubsection(prev, sectionId, subsection, targetIndex));
  }, [mutate]);

  const restoreElement = useCallback((
    sectionId: string,
    element: CanvasLeafElement,
    targetIndex?: number,
    subsectionId?: string
  ) => {
    mutate(prev => insertLeafElement(prev, sectionId, element, targetIndex, subsectionId));
  }, [mutate]);

  const removeItem = useCallback((itemId: string, parentId?: string) => {
    const loc = findCanvasItemLocation(documentRef.current, itemId);
    mutate(prev => removeCanvasItem(prev, itemId, parentId));

    if (loc) {
      const itemTitle = ('title' in loc.item && typeof loc.item.title === 'string' && loc.item.title)
        ? loc.item.title
        : loc.kind;
      pushAction({
        type: loc.kind === 'section'
          ? 'canvas_remove_section'
          : loc.kind === 'subsection'
            ? 'canvas_remove_subsection'
            : 'canvas_remove_leaf',
        description: `Delete ${loc.kind} "${itemTitle}"`,
        undo: () => {
          if (loc.kind === 'section') {
            restoreSection(loc.item as SectionElement, loc.index);
          } else if (loc.kind === 'subsection') {
            restoreSubsection(loc.sectionId, loc.item as SubsectionElement, loc.index);
          } else {
            restoreElement(loc.sectionId, loc.item as CanvasLeafElement, loc.index, loc.subsectionId);
          }
        },
        redo: () => removeItem(itemId, parentId),
      });
    }
  }, [mutate, pushAction, restoreSection, restoreSubsection, restoreElement]);

  const addSection = useCallback((targetIndex?: number) => {
    const currentDoc = documentRef.current;
    const newSec = createDefaultSection(currentDoc.sections.length, currentDoc.nodeId);
    const resolvedIndex = typeof targetIndex === 'number' ? targetIndex : currentDoc.sections.length;
    mutate(prev => insertSection(prev, newSec, resolvedIndex));

    pushAction({
      type: 'canvas_insert_section',
      description: `Add section "${newSec.title}"`,
      undo: () => removeItem(newSec.id),
      redo: () => restoreSection(newSec, resolvedIndex),
    });
  }, [mutate, pushAction, removeItem, restoreSection]);

  const addSubsection = useCallback((sectionId: string, targetIndex?: number) => {
    const currentDoc = documentRef.current;
    const parentSection = currentDoc.sections.find(s => s.id === sectionId);
    const newSub = createDefaultSubsection(currentDoc.nodeId);
    const resolvedIndex = typeof targetIndex === 'number'
      ? targetIndex
      : (parentSection ? parentSection.elements.length : 0);
    mutate(prev => insertSubsection(prev, sectionId, newSub, resolvedIndex));

    pushAction({
      type: 'canvas_insert_subsection',
      description: `Add subsection "${newSub.title}"`,
      undo: () => removeItem(newSub.id, sectionId),
      redo: () => restoreSubsection(sectionId, newSub, resolvedIndex),
    });
  }, [mutate, pushAction, removeItem, restoreSubsection]);

  const addElement = useCallback((
    sectionId: string,
    element: CanvasLeafElement,
    targetIndex?: number,
    subsectionId?: string
  ) => {
    mutate(prev => insertLeafElement(prev, sectionId, element, targetIndex, subsectionId));

    pushAction({
      type: 'canvas_insert_leaf',
      description: `Add ${element.type} element`,
      undo: () => removeItem(element.id, subsectionId || sectionId),
      redo: () => restoreElement(sectionId, element, targetIndex, subsectionId),
    });
  }, [mutate, pushAction, removeItem, restoreElement]);

  const moveItem = useCallback((
    itemId: string,
    direction: 'up' | 'down',
    parentId?: string
  ) => {
    mutate(prev => moveCanvasItem(prev, itemId, direction, parentId));

    pushAction({
      type: 'canvas_move_item',
      description: `Move item ${direction}`,
      undo: () => moveItem(itemId, direction === 'up' ? 'down' : 'up', parentId),
      redo: () => moveItem(itemId, direction, parentId),
    });
  }, [mutate, pushAction]);

  const relocateItem = useCallback((
    sourceItemId: string,
    targetContainerId: string,
    targetIndex?: number
  ) => {
    const loc = findCanvasItemLocation(documentRef.current, sourceItemId);
    const origContainerId = loc ? (loc.subsectionId || loc.sectionId) : undefined;
    const origIndex = loc ? loc.index : undefined;

    mutate(prev => relocateCanvasItem(prev, sourceItemId, targetContainerId, targetIndex));

    if (loc && origContainerId) {
      pushAction({
        type: 'canvas_relocate_item',
        description: 'Relocate item',
        undo: () => relocateItem(sourceItemId, origContainerId, origIndex),
        redo: () => relocateItem(sourceItemId, targetContainerId, targetIndex),
      });
    }
  }, [mutate, pushAction]);

  const updateItem = useCallback(<T extends CanvasElement>(itemId: string, updates: Partial<T>) => {
    const loc = findCanvasItemLocation(documentRef.current, itemId);
    const prevAttributes: Record<string, unknown> = {};
    if (loc) {
      const itemRecord = loc.item as unknown as Record<string, unknown>;
      for (const key of Object.keys(updates)) {
        prevAttributes[key] = itemRecord[key];
      }
    }

    mutate(prev => updateCanvasItem(prev, itemId, updates));

    if (loc) {
      pushAction({
        type: 'canvas_update_item',
        description: `Update ${loc.kind} properties`,
        undo: () => updateItem(itemId, prevAttributes as Partial<T>),
        redo: () => updateItem(itemId, updates),
      });
    }
  }, [mutate, pushAction]);

  const resetToDefault = useCallback(() => {
    startTransition(() => {
      const freshDoc = resetNodeCanvas(nodeId, isDevMode);
      setDocument(freshDoc);
    });
  }, [nodeId, isDevMode]);

  const deployToCloud = useCallback(async (): Promise<boolean> => {
    const result = await deployNodeCanvasToCloud(nodeId);
    return result.success;
  }, [nodeId]);

  return {
    document,
    isPending,
    isHydrating,
    addSection,
    addSubsection,
    addElement,
    restoreSection,
    restoreSubsection,
    restoreElement,
    moveItem,
    relocateItem,
    removeItem,
    updateItem,
    resetToDefault,
    deployToCloud,
    saveError,
    clearSaveError,
  };
}

export default useDocumentCanvas;
