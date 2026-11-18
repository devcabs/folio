/**
 * Folio Engine - Reactive Dynamic Canvas Hook
 * Location: src/hooks/useDocumentCanvas.ts
 *
 * Epic 7 Subtask 7.3:
 * - Public Mode: reads self-contained NodeCanvasDocument AST directly from GET /api/public/node/:nodeId (fail-stop on error).
 * - Dev Mode: reads draft AST from GET /api/draft and persists every AST mutation directly via PUT /api/draft (fail-stop on error).
 * - Zero localStorage, zero module-level shadow caches, zero sidecar chart/source cache copying.
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
  renumberSections,
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
  createDefaultCanvasDocument,
} from '../utils/canvasDefaults';
import { useUndoRedo } from './useUndoRedo';
import { useDeveloperMode } from './useDeveloperMode';

export interface UseNodeCanvasReturn {
  /** Active in-memory canvas document tree */
  document: NodeCanvasDocument;
  /** True when a canvas layout transition is pending */
  isPending: boolean;
  /** True when edge KV canvas hydration is in flight */
  isHydrating: boolean;
  /** Add a new section container with automatic numbering */
  addSection: (targetIndex?: number) => void;
  /** Add a new subsection container inside a section */
  addSubsection: (sectionId: string, targetIndex?: number) => void;
  /** Add a leaf element (text, photo, chart, gallery) to a section or subsection */
  addElement: (
    sectionId: string,
    element: CanvasLeafElement,
    targetIndex?: number,
    subsectionId?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Restore or insert an existing section at target index (for undo) */
  restoreSection: (
    section: SectionElement,
    targetIndex?: number
  ) => Promise<{ ok: boolean; error?: string }>;
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
  updateItem: <T extends CanvasElement>(
    itemId: string,
    updates: Partial<T>
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Reset node canvas back to default structure */
  resetToDefault: () => void;
  /** @deprecated Removed in Epic 7; kept as no-op for mock compatibility */
  deployToCloud: () => Promise<boolean>;
  /** Error message if saving canvas to KV failed */
  saveError: string | null;
  /** Dismiss the active save error */
  clearSaveError: () => void;
  /** Error message if fetching node canvas from KV failed */
  fetchError: string | null;
  /** Retry fetching node canvas from KV */
  retryFetch: () => void;
}

interface DraftWorkspaceCanvasResponse {
  canvases?: Record<string, NodeCanvasDocument>;
  updatedAt?: string;
}

async function parseKvErrorDetail(res: Response): Promise<string> {
  try {
    if (typeof res.text === 'function') {
      const text = await res.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string };
          return parsed.error || parsed.message || `HTTP ${res.status}`;
        } catch {
          return `${text} (HTTP ${res.status})`;
        }
      }
    } else if (typeof res.json === 'function') {
      const parsed = (await res.json()) as { error?: string; message?: string };
      if (parsed?.error || parsed?.message) {
        return parsed.error || parsed.message || `HTTP ${res.status}`;
      }
    }
  } catch {
    // Ignore body parse errors
  }
  return `HTTP ${res.status}`;
}

/**
 * Hook providing reactive state and atomic dispatchers for managing a node's Dynamic Canvas.
 */
export const useNodeCanvas = useDocumentCanvas;
export function useDocumentCanvas(nodeId: string): UseNodeCanvasReturn {
  const { isDevMode, lockToken } = useDeveloperMode();

  const [document, setDocument] = useState<NodeCanvasDocument>(() =>
    createDefaultCanvasDocument(nodeId)
  );
  const [isPending, startTransition] = useTransition();
  const [isHydrating, setIsHydrating] = useState<boolean>(() => typeof window !== 'undefined' && Boolean(nodeId));
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState<number>(0);

  const retryFetch = useCallback(() => {
    setFetchError(null);
    setFetchTrigger((c) => c + 1);
  }, []);

  const documentRef = useRef(document);
  documentRef.current = document;

  const draftUpdatedAtRef = useRef<string | null>(null);

  // Direct Cloudflare KV hydration:
  // - Public Mode: GET /api/public/node/:nodeId
  // - Dev Mode: GET /api/draft -> canvases[nodeId]
  useEffect(() => {
    if (!nodeId) {
      setIsHydrating(false);
      return;
    }

    let isCancelled = false;
    setIsHydrating(true);
    setFetchError(null);

    const url = isDevMode ? '/api/draft' : `/api/public/node/${nodeId}`;
    const headers: Record<string, string> = {};
    if (isDevMode && lockToken) {
      headers['Authorization'] = `Bearer ${lockToken}`;
    }

    fetch(url, { method: 'GET', ...(Object.keys(headers).length > 0 ? { headers } : {}) })
      .then(async (res) => {
        if (!res.ok) {
          let errorMsg = isDevMode
            ? `Draft workspace KV read failed (HTTP ${res.status})`
            : `Edge node fetch failed (HTTP ${res.status})`;
          const detail = await parseKvErrorDetail(res);
          if (detail && detail !== `HTTP ${res.status}`) {
            errorMsg += `: ${detail}`;
          }
          throw new Error(errorMsg);
        }

        const contentType =
          res.headers && typeof res.headers.get === 'function'
            ? res.headers.get('content-type') || ''
            : '';
        if (
          contentType &&
          !contentType.toLowerCase().includes('application/json') &&
          !contentType.toLowerCase().includes('text/json')
        ) {
          throw new Error(`Edge node fetch failed: expected JSON but received ${contentType}`);
        }

        return res.json();
      })
      .then((data: PublicNodePayload | DraftWorkspaceCanvasResponse | null) => {
        if (isCancelled || !data) return;

        if (isDevMode) {
          const draft = data as DraftWorkspaceCanvasResponse;
          draftUpdatedAtRef.current = typeof draft.updatedAt === 'string' ? draft.updatedAt : null;
          const draftCanvas = draft.canvases?.[nodeId];
          const resolvedDoc: NodeCanvasDocument =
            draftCanvas && Array.isArray(draftCanvas.sections)
              ? { ...draftCanvas, sections: renumberSections(draftCanvas.sections) }
              : createDefaultCanvasDocument(nodeId);

          documentRef.current = resolvedDoc;
          startTransition(() => {
            setDocument(resolvedDoc);
          });
        } else {
          const edgeData = data as PublicNodePayload;
          if (edgeData.nodeId !== nodeId) return;
          if (edgeData.canvas && Array.isArray(edgeData.canvas.sections)) {
            const resolvedDoc: NodeCanvasDocument = {
              ...edgeData.canvas,
              sections: renumberSections(edgeData.canvas.sections),
            };
            documentRef.current = resolvedDoc;
            startTransition(() => {
              setDocument(resolvedDoc);
            });
          }
        }
        setFetchError(null);
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to fetch domain record';
          setFetchError(msg);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsHydrating(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [nodeId, isDevMode, lockToken, fetchTrigger]);

  const { pushAction } = useUndoRedo();
  const [saveError, setSaveError] = useState<string | null>(null);

  const clearSaveError = useCallback(() => {
    setSaveError(null);
  }, []);

  // Direct KV mutation helper: updates AST state and persists to PUT /api/draft (fail-stop on error)
  const mutate = useCallback(
    async (
      mutator: (prev: NodeCanvasDocument) => NodeCanvasDocument
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!isDevMode) {
        const msg = 'Cannot mutate canvas in Public Mode.';
        setSaveError(msg);
        return { ok: false, error: msg };
      }

      const prevDoc = documentRef.current;
      const rawNext = mutator(prevDoc);
      const nextDoc: NodeCanvasDocument = {
        ...rawNext,
        sections: renumberSections(rawNext.sections),
        updatedAt: new Date().toISOString(),
      };

      documentRef.current = nextDoc;
      startTransition(() => {
        setDocument(nextDoc);
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (lockToken) {
        headers['Authorization'] = `Bearer ${lockToken}`;
      }

      const body: Record<string, unknown> = {
        canvases: { [nodeId]: nextDoc },
      };
      if (draftUpdatedAtRef.current) {
        body.expectedUpdatedAt = draftUpdatedAtRef.current;
      }

      try {
        const res = await fetch('/api/draft', {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const detail = await parseKvErrorDetail(res);
          throw new Error(`Draft canvas KV write failed: ${detail} (HTTP ${res.status})`);
        }
        try {
          const data = (await res.json()) as DraftWorkspaceCanvasResponse;
          if (typeof data?.updatedAt === 'string') {
            draftUpdatedAtRef.current = data.updatedAt;
          }
        } catch {
          // Empty 200/204 body
        }
        setSaveError(null);
        return { ok: true };
      } catch (err: unknown) {
        // Fail-stop: revert optimistic AST update to last persisted KV state
        documentRef.current = prevDoc;
        startTransition(() => {
          setDocument(prevDoc);
        });
        const msg = err instanceof Error ? err.message : 'Draft canvas KV write failed';
        setSaveError(msg);
        return { ok: false, error: msg };
      }
    },
    [isDevMode, lockToken, nodeId]
  );

  const restoreSection = useCallback(
    (section: SectionElement, targetIndex?: number) => {
      return mutate((prev) => insertSection(prev, section, targetIndex));
    },
    [mutate]
  );

  const restoreSubsection = useCallback(
    (sectionId: string, subsection: SubsectionElement, targetIndex?: number) => {
      mutate((prev) => insertSubsection(prev, sectionId, subsection, targetIndex));
    },
    [mutate]
  );

  const restoreElement = useCallback(
    (
      sectionId: string,
      element: CanvasLeafElement,
      targetIndex?: number,
      subsectionId?: string
    ) => {
      mutate((prev) => insertLeafElement(prev, sectionId, element, targetIndex, subsectionId));
    },
    [mutate]
  );

  const removeItem = useCallback(
    (itemId: string, parentId?: string) => {
      const loc = findCanvasItemLocation(documentRef.current, itemId);
      mutate((prev) => removeCanvasItem(prev, itemId, parentId));

      if (loc) {
        const itemTitle =
          'title' in loc.item && typeof loc.item.title === 'string' && loc.item.title
            ? loc.item.title
            : loc.kind;
        pushAction({
          type:
            loc.kind === 'section'
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
    },
    [mutate, pushAction, restoreSection, restoreSubsection, restoreElement]
  );

  const addSection = useCallback(
    (targetIndex?: number) => {
      const currentDoc = documentRef.current;
      const newSec = createDefaultSection(currentDoc.sections.length, currentDoc.nodeId);
      const resolvedIndex = typeof targetIndex === 'number' ? targetIndex : currentDoc.sections.length;
      mutate((prev) => insertSection(prev, newSec, resolvedIndex));

      pushAction({
        type: 'canvas_insert_section',
        description: `Add section "${newSec.title}"`,
        undo: () => removeItem(newSec.id),
        redo: () => restoreSection(newSec, resolvedIndex),
      });
    },
    [mutate, pushAction, removeItem, restoreSection]
  );

  const addSubsection = useCallback(
    (sectionId: string, targetIndex?: number) => {
      const currentDoc = documentRef.current;
      const parentSection = currentDoc.sections.find((s) => s.id === sectionId);
      const newSub = createDefaultSubsection(currentDoc.nodeId);
      const resolvedIndex =
        typeof targetIndex === 'number'
          ? targetIndex
          : parentSection
            ? parentSection.elements.length
            : 0;
      mutate((prev) => insertSubsection(prev, sectionId, newSub, resolvedIndex));

      pushAction({
        type: 'canvas_insert_subsection',
        description: `Add subsection "${newSub.title}"`,
        undo: () => removeItem(newSub.id, sectionId),
        redo: () => restoreSubsection(sectionId, newSub, resolvedIndex),
      });
    },
    [mutate, pushAction, removeItem, restoreSubsection]
  );

  const addElement = useCallback(
    (
      sectionId: string,
      element: CanvasLeafElement,
      targetIndex?: number,
      subsectionId?: string
    ) => {
      const promise = mutate((prev) => insertLeafElement(prev, sectionId, element, targetIndex, subsectionId));

      pushAction({
        type: 'canvas_insert_leaf',
        description: `Add ${element.type} element`,
        undo: () => removeItem(element.id, subsectionId || sectionId),
        redo: () => restoreElement(sectionId, element, targetIndex, subsectionId),
      });

      return promise;
    },
    [mutate, pushAction, removeItem, restoreElement]
  );

  const moveItem = useCallback(
    (itemId: string, direction: 'up' | 'down', parentId?: string) => {
      mutate((prev) => moveCanvasItem(prev, itemId, direction, parentId));

      pushAction({
        type: 'canvas_move_item',
        description: `Move item ${direction}`,
        undo: () => moveItem(itemId, direction === 'up' ? 'down' : 'up', parentId),
        redo: () => moveItem(itemId, direction, parentId),
      });
    },
    [mutate, pushAction]
  );

  const relocateItem = useCallback(
    (sourceItemId: string, targetContainerId: string, targetIndex?: number) => {
      const loc = findCanvasItemLocation(documentRef.current, sourceItemId);
      const origContainerId = loc ? loc.subsectionId || loc.sectionId : undefined;
      const origIndex = loc ? loc.index : undefined;

      mutate((prev) => relocateCanvasItem(prev, sourceItemId, targetContainerId, targetIndex));

      if (loc && origContainerId) {
        pushAction({
          type: 'canvas_relocate_item',
          description: 'Relocate item',
          undo: () => relocateItem(sourceItemId, origContainerId, origIndex),
          redo: () => relocateItem(sourceItemId, targetContainerId, targetIndex),
        });
      }
    },
    [mutate, pushAction]
  );

  const updateItem = useCallback(
    <T extends CanvasElement>(itemId: string, updates: Partial<T>) => {
      const loc = findCanvasItemLocation(documentRef.current, itemId);
      const prevAttributes: Record<string, unknown> = {};
      if (loc) {
        const itemRecord = loc.item as unknown as Record<string, unknown>;
        for (const key of Object.keys(updates)) {
          prevAttributes[key] = itemRecord[key];
        }
      }

      const promise = mutate((prev) => updateCanvasItem(prev, itemId, updates));

      if (loc) {
        pushAction({
          type: 'canvas_update_item',
          description: `Update ${loc.kind} properties`,
          undo: () => updateItem(itemId, prevAttributes as Partial<T>),
          redo: () => updateItem(itemId, updates),
        });
      }
      return promise;
    },
    [mutate, pushAction]
  );

  const resetToDefault = useCallback(() => {
    mutate(() => createDefaultCanvasDocument(nodeId));
  }, [mutate, nodeId]);

  const deployToCloud = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

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
    fetchError,
    retryFetch,
  };
}

export default useDocumentCanvas;
