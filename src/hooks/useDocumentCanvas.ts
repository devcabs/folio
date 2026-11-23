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
import type { PageRegistry } from '../types/page';
import type { UndoActionType } from '../types/history';
import {
  renumberCanvasElements,
  insertCanvasElement,
  insertSection,
  insertSubsection,
  insertLeafElement,
  moveCanvasItem,
  relocateCanvasItem,
  removeCanvasItem,
  updateCanvasItem,
  findCanvasItemLocation,
  EVENT_DRAFT_CANVAS_CHANGE,
  EVENT_LIVE_CANVAS_CHANGE,
  type CanvasChangeEventDetail,
} from '../services/canvasLayoutService';
import {
  createDefaultSection,
  createDefaultSubsection,
  createDefaultCanvasDocument,
  normalizeCanvasDocument,
} from '../utils/canvasDefaults';
import {
  EVENT_DRAFT_UPDATED_AT_SYNC,
  dispatchDraftPagesSync,
  dispatchDraftUpdatedAtSync,
  enqueueDraftMutation,
  getLastKnownDraftUpdatedAt,
  setLastKnownDraftUpdatedAt,
} from '../services/draftService';
import { deriveSubpageOrderFromCanvas } from '../services/pageTreeService';
import { createWorkspaceUndoAction, undoRedoService } from '../services/undoRedoService';
import { usePortalChrome } from '../context/PortalChromeContext';
import { useUndoRedo } from './useUndoRedo';
import { useDeveloperMode } from './useDeveloperMode';

export interface UseNodeCanvasReturn {
  /** Active in-memory canvas document tree */
  document: NodeCanvasDocument;
  /** True when a canvas layout transition is pending */
  isPending: boolean;
  /** True when edge KV canvas hydration is in flight */
  isHydrating: boolean;
  /** Add a new section heading block with automatic numbering (records undo/redo history) */
  addSection: (
    targetIndex?: number,
    customSection?: SectionElement
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Add a new subsection heading block (records undo/redo history) */
  addSubsection: (
    targetIndex?: number,
    customSubsection?: SubsectionElement
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Add a leaf element (text, photo, chart, gallery) to the flat canvas */
  addElement: (
    element: CanvasLeafElement,
    targetIndex?: number
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Restore or insert an existing section at target index (for undo) */
  restoreSection: (
    section: SectionElement,
    targetIndex?: number
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Restore or insert an existing subsection at target index (for undo) */
  restoreSubsection: (
    subsection: SubsectionElement,
    targetIndex?: number
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Restore or insert an existing leaf element at target index (for undo) */
  restoreElement: (
    element: CanvasLeafElement,
    targetIndex?: number
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Move an item up or down within its container */
  moveItem: (
    itemId: string,
    direction: 'up' | 'down',
    parentId?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Relocate an item anywhere across the canvas to a target container */
  relocateItem: (
    sourceItemId: string,
    targetContainerId: string,
    targetIndex?: number
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Remove an item and all its nested children */
  removeItem: (itemId: string, parentId?: string) => Promise<{ ok: boolean; error?: string }>;
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
  pages?: PageRegistry;
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

  const prevNodeIdRef = useRef(nodeId);
  if (prevNodeIdRef.current !== nodeId) {
    prevNodeIdRef.current = nodeId;
    const emptyDoc = createDefaultCanvasDocument(nodeId);
    documentRef.current = emptyDoc;
    setDocument(emptyDoc);
  }

  const draftUpdatedAtRef = useRef<string | null>(null);

  // Subscribe to aggregate draft/live canvas change events (init, discard, history restore, publish)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }
    const eventName = isDevMode ? EVENT_DRAFT_CANVAS_CHANGE : EVENT_LIVE_CANVAS_CHANGE;
    const handleCanvasEvent = (e: Event) => {
      const detail = (e as CustomEvent<CanvasChangeEventDetail>).detail;
      if (!detail) return;
      if (detail.nodeId === '*') {
        retryFetch();
      } else if (detail.nodeId === nodeId && detail.document) {
        const normalized = normalizeCanvasDocument(detail.document, nodeId);
        const nextDoc: NodeCanvasDocument = {
          ...normalized,
          elements: renumberCanvasElements(normalized.elements),
        };
        documentRef.current = nextDoc;
        startTransition(() => {
          setDocument(nextDoc);
        });
      }
    };
    const handleUpdatedAtSync = (e: Event) => {
      const detail = (e as CustomEvent<{ updatedAt?: string }>).detail;
      if (typeof detail?.updatedAt === 'string' && detail.updatedAt) {
        draftUpdatedAtRef.current = detail.updatedAt;
      }
    };
    window.addEventListener(eventName, handleCanvasEvent);
    if (isDevMode) {
      window.addEventListener(EVENT_DRAFT_UPDATED_AT_SYNC, handleUpdatedAtSync);
    }
    return () => {
      window.removeEventListener(eventName, handleCanvasEvent);
      if (isDevMode) {
        window.removeEventListener(EVENT_DRAFT_UPDATED_AT_SYNC, handleUpdatedAtSync);
      }
    };
  }, [nodeId, isDevMode, retryFetch]);

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

    fetch(url, {
      method: 'GET',
      cache: 'no-store',
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    })
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
          if (draftUpdatedAtRef.current) {
            dispatchDraftUpdatedAtSync(draftUpdatedAtRef.current);
          }
          const draftCanvas = draft.canvases?.[nodeId];
          const resolvedDoc: NodeCanvasDocument = draftCanvas
            ? (() => {
              const normalized = normalizeCanvasDocument(draftCanvas, nodeId);
              return {
                ...normalized,
                elements: renumberCanvasElements(normalized.elements),
              };
            })()
            : createDefaultCanvasDocument(nodeId);

          documentRef.current = resolvedDoc;
          startTransition(() => {
            setDocument(resolvedDoc);
          });
        } else {
          const edgeData = data as PublicNodePayload;
          if (edgeData.nodeId !== nodeId) return;
          if (edgeData.canvas) {
            const normalized = normalizeCanvasDocument(edgeData.canvas, nodeId);
            const resolvedDoc: NodeCanvasDocument = {
              ...normalized,
              elements: renumberCanvasElements(normalized.elements),
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
  const portalChrome = usePortalChrome();
  const pagesRef = useRef<PageRegistry | undefined>(portalChrome?.pages);
  pagesRef.current = portalChrome?.pages;
  const canvasScope = `canvas:${nodeId}`;
  const [saveError, setSaveError] = useState<string | null>(null);
  const lockTokenRef = useRef(lockToken);
  lockTokenRef.current = lockToken;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearSaveError = useCallback(() => {
    setSaveError(null);
  }, []);

  // Direct KV mutation helper: serialized via enqueueDraftMutation to prevent HTTP 409 races
  const mutate = useCallback(
    async (
      mutator: (prev: NodeCanvasDocument) => NodeCanvasDocument,
      undoMeta?: { type: UndoActionType; description: string },
      options?: { syncPageOrder?: boolean }
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!isDevMode) {
        const msg = 'Cannot mutate canvas in Public Mode.';
        setSaveError(msg);
        return { ok: false, error: msg };
      }

      return enqueueDraftMutation(async () => {
        const prevDoc = documentRef.current;
        const rawNext = mutator(prevDoc);
        const nextDoc: NodeCanvasDocument = {
          ...rawNext,
          version: 3,
          elements: renumberCanvasElements(rawNext.elements),
          updatedAt: new Date().toISOString(),
        };

        const prevPages = pagesRef.current;
        const orderSync =
          options?.syncPageOrder && prevPages
            ? deriveSubpageOrderFromCanvas(prevPages, nodeId, nextDoc)
            : { pages: prevPages, changed: false };

        documentRef.current = nextDoc;
        startTransition(() => {
          setDocument(nextDoc);
        });

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (lockTokenRef.current) {
          headers['Authorization'] = `Bearer ${lockTokenRef.current}`;
        }

        const expectedUpdatedAt = getLastKnownDraftUpdatedAt() ?? draftUpdatedAtRef.current;
        const body: Record<string, unknown> = {
          canvases: { [nodeId]: nextDoc },
        };
        if (orderSync.changed && orderSync.pages) {
          body.pages = orderSync.pages;
        }
        if (expectedUpdatedAt) {
          body.expectedUpdatedAt = expectedUpdatedAt;
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
          let responseData: DraftWorkspaceCanvasResponse | undefined;
          try {
            responseData = (await res.json()) as DraftWorkspaceCanvasResponse;
            if (typeof responseData?.updatedAt === 'string') {
              draftUpdatedAtRef.current = responseData.updatedAt;
              // Update module-level SSOT synchronously before dispatching the event so the next
              // enqueued mutation in the FIFO queue reads the correct timestamp immediately.
              setLastKnownDraftUpdatedAt(responseData.updatedAt);
              dispatchDraftUpdatedAtSync(responseData.updatedAt);
            }
          } catch {
            // Empty 200/204 body
          }
          if (orderSync.changed && orderSync.pages) {
            const authoritativePages = responseData?.pages ?? orderSync.pages;
            pagesRef.current = authoritativePages;
            dispatchDraftPagesSync(authoritativePages);
          }
          setSaveError(null);

          if (undoMeta && !undoRedoService.isExecuting()) {
            pushAction(
              createWorkspaceUndoAction({
                type: undoMeta.type,
                description: undoMeta.description,
                scope: canvasScope,
                before: {
                  canvases: { [nodeId]: prevDoc },
                  ...(orderSync.changed && prevPages ? { pages: prevPages } : {}),
                },
                after: {
                  canvases: { [nodeId]: nextDoc },
                  ...(orderSync.changed && orderSync.pages ? { pages: orderSync.pages } : {}),
                },
                getLockToken: () => lockTokenRef.current ?? null,
                getExpectedUpdatedAt: () =>
                  getLastKnownDraftUpdatedAt() ?? draftUpdatedAtRef.current,
                onError: (msg) => {
                  if (isMountedRef.current) {
                    setSaveError(msg);
                  }
                },
              })
            );
          }

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
      });
    },
    [isDevMode, nodeId, pushAction, canvasScope]
  );

  const restoreSection = useCallback(
    (section: SectionElement, targetIndex?: number) => {
      return mutate((prev) => insertSection(prev, section, targetIndex));
    },
    [mutate]
  );

  const restoreSubsection = useCallback(
    (subsection: SubsectionElement, targetIndex?: number) => {
      return mutate((prev) => insertSubsection(prev, subsection, targetIndex));
    },
    [mutate]
  );

  const restoreElement = useCallback(
    (element: CanvasLeafElement, targetIndex?: number) => {
      return mutate((prev) => insertLeafElement(prev, element, targetIndex));
    },
    [mutate]
  );

  const removeItem = useCallback(
    (itemId: string, parentId?: string) => {
      const loc = findCanvasItemLocation(documentRef.current, itemId);
      const undoMeta = loc
        ? {
          type: (loc.kind === 'section'
            ? 'canvas_remove_section'
            : loc.kind === 'subsection'
              ? 'canvas_remove_subsection'
              : 'canvas_remove_leaf') as UndoActionType,
          description: `Delete ${loc.kind} "${'title' in loc.item && typeof loc.item.title === 'string' && loc.item.title
            ? loc.item.title
            : loc.kind
            }"`,
        }
        : undefined;
      return mutate((prev) => removeCanvasItem(prev, itemId, parentId), undoMeta);
    },
    [mutate]
  );

  const addSection = useCallback(
    (targetIndex?: number, customSection?: SectionElement) => {
      const currentDoc = documentRef.current;
      const sectionCount = currentDoc.elements.filter((el) => el.type === 'section').length;
      const newSec =
        customSection || createDefaultSection(sectionCount, currentDoc.nodeId);
      const resolvedIndex =
        typeof targetIndex === 'number' ? targetIndex : currentDoc.elements.length;
      return mutate(
        (prev) => insertSection(prev, newSec, resolvedIndex),
        {
          type: 'canvas_insert_section',
          description: `Add section "${newSec.title}"`,
        }
      );
    },
    [mutate]
  );

  const addSubsection = useCallback(
    (targetIndex?: number, customSubsection?: SubsectionElement) => {
      const currentDoc = documentRef.current;
      const newSub = customSubsection || createDefaultSubsection(currentDoc.nodeId);
      const resolvedIndex =
        typeof targetIndex === 'number' ? targetIndex : currentDoc.elements.length;
      return mutate(
        (prev) => insertSubsection(prev, newSub, resolvedIndex),
        {
          type: 'canvas_insert_subsection',
          description: `Add subsection "${newSub.title}"`,
        }
      );
    },
    [mutate]
  );

  const addElement = useCallback(
    (element: CanvasLeafElement, targetIndex?: number) => {
      return mutate(
        (prev) => insertCanvasElement(prev, element, targetIndex),
        {
          type: 'canvas_insert_leaf',
          description: `Add ${element.type} element`,
        },
        element.type === 'page-link' ? { syncPageOrder: true } : undefined
      );
    },
    [mutate]
  );

  const moveItem = useCallback(
    (itemId: string, direction: 'up' | 'down', parentId?: string) => {
      return mutate(
        (prev) => moveCanvasItem(prev, itemId, direction, parentId),
        {
          type: 'canvas_move_item',
          description: `Move item ${direction}`,
        },
        { syncPageOrder: true }
      );
    },
    [mutate]
  );

  const relocateItem = useCallback(
    (sourceItemId: string, targetContainerId: string, targetIndex?: number) => {
      const loc = findCanvasItemLocation(documentRef.current, sourceItemId);
      const undoMeta = loc
        ? {
          type: 'canvas_relocate_item' as UndoActionType,
          description: 'Relocate item',
        }
        : undefined;
      return mutate(
        (prev) => relocateCanvasItem(prev, sourceItemId, targetContainerId, targetIndex),
        undoMeta,
        { syncPageOrder: true }
      );
    },
    [mutate]
  );

  const updateItem = useCallback(
    <T extends CanvasElement>(itemId: string, updates: Partial<T>) => {
      const loc = findCanvasItemLocation(documentRef.current, itemId);
      const undoMeta = loc
        ? {
          type: 'canvas_update_item' as UndoActionType,
          description: `Update ${loc.kind} properties`,
        }
        : undefined;
      return mutate((prev) => updateCanvasItem(prev, itemId, updates), undoMeta);
    },
    [mutate]
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
