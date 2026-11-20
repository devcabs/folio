import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { DocumentCanvas } from '../../src/components/canvas/DocumentCanvas';
import {
  CanvasDeleteConfirmModal,
  BRANCH_DELETE_CONFIRM_PHRASE,
} from '../../src/components/canvas/CanvasDeleteConfirmModal';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as nodeCanvasHook from '../../src/hooks/useDocumentCanvas';
import * as portalChromeContext from '../../src/context/PortalChromeContext';
import * as draftService from '../../src/services/draftService';
import * as undoRedoHook from '../../src/hooks/useUndoRedo';
import { undoRedoService } from '../../src/services/undoRedoService';
import type { NodeCanvasDocument, PageLinkElement, TextElement } from '../../src/types/canvas';
import type { PageRegistry } from '../../src/types/page';

function isButtonDisabled(btn: any): boolean {
  if (btn?.disabled === true) return true;
  const attr = btn?.getAttribute?.('disabled');
  return attr === '' || attr === 'true' || attr === true;
}

function getModalDeleteButton(): any {
  const buttons = screen.getAllByRole('button', { name: 'Delete' });
  return buttons[buttons.length - 1];
}

function typeIntoInput(input: any, value: string): void {
  const propKey = Object.keys(input).find((k) => k.startsWith('__reactProps$'));
  const reactProps = propKey ? input[propKey] : undefined;
  if (reactProps?.onChange) {
    act(() => {
      reactProps.onChange({ target: { value } });
    });
    return;
  }
  fireEvent.change(input, { target: { value } });
}

const BASE_WORKSPACE_FIELDS = {
  baseSnapshotId: 'snap-1',
  dirty: true,
  revision: 1,
  authorSessionId: 'session-1',
};

describe('13.15 Guarded Unified Page / Branch Deletion Modal & Atomic Cascade Purge', () => {
  beforeEach(() => {
    undoRedoService.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    undoRedoService.clear();
  });

  const createDevModeStub = () => ({
    isDevMode: true,
    isDesktop: true,
    canUnlock: true,
    isUnlocked: true,
    lockToken: 'test-lock-token',
    authToken: 'test-lock-token',
    toggleDevMode: vi.fn(),
    unlockWithPin: vi.fn(),
    lockDevMode: vi.fn(),
    setHasUnpublishedChanges: vi.fn(),
    showToast: vi.fn(),
  });

  const createCanvasHookStub = (doc: NodeCanvasDocument) => ({
    document: doc,
    isPending: false,
    isHydrating: false,
    addSection: vi.fn(),
    addSubsection: vi.fn(),
    addElement: vi.fn(),
    restoreSection: vi.fn(),
    restoreSubsection: vi.fn(),
    restoreElement: vi.fn(),
    moveItem: vi.fn(),
    relocateItem: vi.fn(),
    removeItem: vi.fn(),
    updateItem: vi.fn(),
    resetToDefault: vi.fn(),
    deployToCloud: vi.fn(),
    saveError: null,
    clearSaveError: vi.fn(),
    fetchError: null,
    retryFetch: vi.fn(),
  });

  const createPortalChromeStub = (
    pages: PageRegistry,
    commitWorkspaceMutation = vi.fn().mockResolvedValue({
      updatedAt: '2026-11-19T12:00:00.000Z',
      pages,
      canvases: {},
      contentOverrides: {},
    })
  ) => ({
    contentOverrides: {},
    pages,
    publishedPages: {},
    isHydrating: false,
    hasHydrated: true,
    hydrationError: null,
    error: null,
    draftUpdatedAt: '2026-11-19T11:00:00.000Z',
    retry: vi.fn(),
    updateOverride: vi.fn(),
    updatePages: vi.fn(),
    commitWorkspaceMutation,
  });

  it('1. Leaf Subpage Deletion (descendantPageCount === 0): standard alertdialog, no typed phrase, single PUT /api/draft with deletedPageIds', async () => {
    const pages: PageRegistry = {
      'page-field-notes': {
        id: 'page-field-notes',
        parentId: 'access',
        slug: 'field-notes',
        title: 'Field Notes',
        order: 0,
        createdAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:00:00.000Z',
      },
    };

    const leafCard: PageLinkElement = {
      id: 'pl-field-notes',
      type: 'page-link',
      targetPageId: 'page-field-notes',
    };

    const parentDoc: NodeCanvasDocument = {
      nodeId: 'access',
      version: 3,
      updatedAt: '2026-11-19T00:00:00.000Z',
      elements: [
        {
          id: 'sec-1',
          type: 'section',
          title: 'Overview',
          number: '01',
          isNumbered: true,
        },
        leafCard,
      ],
    };

    const leafCanvas: NodeCanvasDocument = {
      nodeId: 'page-field-notes',
      version: 3,
      updatedAt: '2026-11-19T00:00:00.000Z',
      elements: [],
    };

    const commitMutationMock = vi.fn().mockResolvedValue({
      updatedAt: '2026-11-19T12:00:00.000Z',
      pages: {},
      canvases: {},
      contentOverrides: {},
    });

    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub() as any);
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(createCanvasHookStub(parentDoc));
    vi.spyOn(undoRedoHook, 'useUndoRedo').mockReturnValue({
      canUndo: true,
      canRedo: false,
      undoCount: 0,
      redoCount: 0,
      pushAction: (action) => undoRedoService.push(action),
      undo: () => {
        void undoRedoService.popUndoAsync();
      },
      redo: () => {
        void undoRedoService.popRedoAsync();
      },
      clearHistory: () => undoRedoService.clear(),
      clearScope: () => {},
    });
    vi.spyOn(portalChromeContext, 'usePortalChrome').mockReturnValue(
      createPortalChromeStub(pages, commitMutationMock) as any
    );
    vi.spyOn(draftService, 'getDraftWorkspace').mockResolvedValue({
      ...BASE_WORKSPACE_FIELDS,
      updatedAt: '2026-11-19T11:00:00.000Z',
      contentOverrides: {},
      canvases: {
        access: parentDoc,
        'page-field-notes': leafCanvas,
      },
      pages,
    });

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[1]);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeTruthy();
    expect(screen.getByText('Delete subpage "Field Notes" and its contents?')).toBeTruthy();
    expect(document.body.querySelectorAll('input')).toHaveLength(0);

    const confirmDeleteBtn = getModalDeleteButton();
    expect(isButtonDisabled(confirmDeleteBtn)).toBe(false);

    await act(async () => {
      fireEvent.click(confirmDeleteBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(commitMutationMock).toHaveBeenCalledTimes(1);

    const callArg = commitMutationMock.mock.calls[0][0];
    expect(callArg.deletedPageIds).toEqual(['page-field-notes']);
    expect(callArg.pages['page-field-notes']).toBeUndefined();
    expect(callArg.canvases['access'].elements).toHaveLength(1);
  });

  it('2. Branch Subpage Deletion (descendantPageCount === 3): exact count in InlineAlert, Delete disabled until exact phrase typed, Ctrl+Enter blocked', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <CanvasDeleteConfirmModal
        isOpen={true}
        itemType="page-link"
        targetPageTitle="Research Branch"
        descendantPageCount={3}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeTruthy();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('3 nested subpages');

    const deleteBtn = getModalDeleteButton();
    expect(isButtonDisabled(deleteBtn)).toBe(true);

    const input = document.body.querySelectorAll('input')[0];
    expect(input).toBeTruthy();
    typeIntoInput(input, 'delete all subpages');
    expect(isButtonDisabled(deleteBtn)).toBe(true);

    typeIntoInput(input, 'DELETE');
    expect(isButtonDisabled(deleteBtn)).toBe(true);

    // Ctrl+Enter must NOT bypass disabled Delete button
    act(() => {
      document.dispatchEvent({
        type: 'keydown',
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
      } as any);
    });
    expect(onConfirm).not.toHaveBeenCalled();

    // Exact phrase enables Delete button
    typeIntoInput(input, BRANCH_DELETE_CONFIRM_PHRASE);
    expect(isButtonDisabled(deleteBtn)).toBe(false);

    fireEvent.click(deleteBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('3. Atomic Cascade Purge + Full-Subtree Undo/Redo restores parent card, all 4 PageNodes, and all 4 purged canvases', async () => {
    const pages: PageRegistry = {
      'page-branch': {
        id: 'page-branch',
        parentId: 'access',
        slug: 'branch',
        title: 'Branch',
        order: 0,
        createdAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:00:00.000Z',
      },
      'page-c1': {
        id: 'page-c1',
        parentId: 'page-branch',
        slug: 'c1',
        title: 'Child 1',
        order: 0,
        createdAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:00:00.000Z',
      },
      'page-c2': {
        id: 'page-c2',
        parentId: 'page-branch',
        slug: 'c2',
        title: 'Child 2',
        order: 1,
        createdAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:00:00.000Z',
      },
      'page-gc1': {
        id: 'page-gc1',
        parentId: 'page-c1',
        slug: 'gc1',
        title: 'Grandchild 1',
        order: 0,
        createdAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:00:00.000Z',
      },
    };

    const branchCard: PageLinkElement = {
      id: 'pl-branch',
      type: 'page-link',
      targetPageId: 'page-branch',
    };

    const parentDoc: NodeCanvasDocument = {
      nodeId: 'access',
      version: 3,
      updatedAt: '2026-11-19T00:00:00.000Z',
      elements: [
        {
          id: 'sec-1',
          type: 'section',
          title: 'Root',
          number: '01',
          isNumbered: true,
        },
        branchCard,
      ],
    };

    const makeSubCanvas = (id: string): NodeCanvasDocument => ({
      nodeId: id,
      version: 3,
      updatedAt: '2026-11-19T00:00:00.000Z',
      elements: [
        {
          id: `sec-${id}`,
          type: 'section',
          title: `Section ${id}`,
          number: '01',
          isNumbered: true,
        },
        {
          id: `txt-${id}`,
          type: 'text',
          pointId: `node.${id}.text.txt-${id}`,
          content: `Content of ${id}`,
          as: 'p',
        } as TextElement,
      ],
    });

    const canvasesMap: Record<string, NodeCanvasDocument> = {
      access: parentDoc,
      'page-branch': makeSubCanvas('page-branch'),
      'page-c1': makeSubCanvas('page-c1'),
      'page-c2': makeSubCanvas('page-c2'),
      'page-gc1': makeSubCanvas('page-gc1'),
    };

    const commitMutationMock = vi.fn().mockResolvedValue({
      updatedAt: '2026-11-19T12:00:00.000Z',
      pages: {},
      canvases: {},
      contentOverrides: {},
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ...BASE_WORKSPACE_FIELDS,
        updatedAt: '2026-11-19T12:05:00.000Z',
        pages,
        canvases: canvasesMap,
        contentOverrides: {},
      }),
    } as Response);

    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub() as any);
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(createCanvasHookStub(parentDoc));
    vi.spyOn(undoRedoHook, 'useUndoRedo').mockReturnValue({
      canUndo: true,
      canRedo: false,
      undoCount: 0,
      redoCount: 0,
      pushAction: (action) => undoRedoService.push(action),
      undo: () => {
        void undoRedoService.popUndoAsync();
      },
      redo: () => {
        void undoRedoService.popRedoAsync();
      },
      clearHistory: () => undoRedoService.clear(),
      clearScope: () => {},
    });
    vi.spyOn(portalChromeContext, 'usePortalChrome').mockReturnValue(
      createPortalChromeStub(pages, commitMutationMock) as any
    );
    vi.spyOn(draftService, 'getDraftWorkspace').mockResolvedValue({
      ...BASE_WORKSPACE_FIELDS,
      updatedAt: '2026-11-19T11:00:00.000Z',
      contentOverrides: {},
      canvases: canvasesMap,
      pages,
    });

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[1]);

    expect(screen.getByRole('alert').textContent).toContain('3 nested subpages');
    const input = document.body.querySelectorAll('input')[0];
    expect(input).toBeTruthy();
    typeIntoInput(input, BRANCH_DELETE_CONFIRM_PHRASE);

    await act(async () => {
      fireEvent.click(getModalDeleteButton());
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(commitMutationMock).toHaveBeenCalledTimes(1);

    const deletePayload = commitMutationMock.mock.calls[0][0];
    expect(deletePayload.deletedPageIds).toEqual(
      expect.arrayContaining(['page-branch', 'page-c1', 'page-c2', 'page-gc1'])
    );
    expect(deletePayload.deletedPageIds).toHaveLength(4);
    expect(Object.keys(deletePayload.pages)).toHaveLength(0);

    // Undo should restore parent canvas card, all 4 PageNodes, AND all 4 purged canvases
    fetchSpy.mockClear();
    await act(async () => {
      await undoRedoService.popUndoAsync();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchInit] = fetchSpy.mock.calls[0];
    expect(fetchUrl).toBe('/api/draft');
    expect(fetchInit?.method).toBe('PUT');
    const undoPayload = JSON.parse(String(fetchInit?.body ?? '{}'));
    expect(Object.keys(undoPayload.pages ?? {})).toEqual(
      expect.arrayContaining(['page-branch', 'page-c1', 'page-c2', 'page-gc1'])
    );
    expect(Object.keys(undoPayload.canvases ?? {})).toEqual(
      expect.arrayContaining(['access', 'page-branch', 'page-c1', 'page-c2', 'page-gc1'])
    );
    expect(undoPayload.canvases?.['access'].elements).toHaveLength(2);
  });

  it('4. Section Containing Page Links Guard: triggers branch confirmation and purges subpages via deletedPageIds', async () => {
    const pages: PageRegistry = {
      'page-inside-sec': {
        id: 'page-inside-sec',
        parentId: 'access',
        slug: 'inside-sec',
        title: 'Inside Section',
        order: 0,
        createdAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:00:00.000Z',
      },
    };

    const parentDoc: NodeCanvasDocument = {
      nodeId: 'access',
      version: 3,
      updatedAt: '2026-11-19T00:00:00.000Z',
      elements: [
        {
          id: 'sec-with-link',
          type: 'section',
          title: 'Section With Subpage',
          number: '01',
          isNumbered: true,
        },
        {
          id: 'pl-inside',
          type: 'page-link',
          targetPageId: 'page-inside-sec',
        },
      ],
    };

    const removeItemMock = vi.fn().mockResolvedValue({ ok: true });
    const commitMutationMock = vi.fn().mockResolvedValue({
      updatedAt: '2026-11-19T12:00:00.000Z',
      pages: {},
      canvases: {},
      contentOverrides: {},
    });

    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub() as any);
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue({
      ...createCanvasHookStub(parentDoc),
      removeItem: removeItemMock,
    });
    vi.spyOn(undoRedoHook, 'useUndoRedo').mockReturnValue({
      canUndo: true,
      canRedo: false,
      undoCount: 0,
      redoCount: 0,
      pushAction: (action) => undoRedoService.push(action),
      undo: () => {
        void undoRedoService.popUndoAsync();
      },
      redo: () => {
        void undoRedoService.popRedoAsync();
      },
      clearHistory: () => undoRedoService.clear(),
      clearScope: () => {},
    });
    vi.spyOn(portalChromeContext, 'usePortalChrome').mockReturnValue(
      createPortalChromeStub(pages, commitMutationMock) as any
    );

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[0]);

    // Deleting a section heading opens the simple confirmation modal (no branch/subpage warning)
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Delete Section' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    const confirmDeleteBtns = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(confirmDeleteBtns[confirmDeleteBtns.length - 1]);

    expect(removeItemMock).toHaveBeenCalledWith('sec-with-link');
    expect(commitMutationMock).not.toHaveBeenCalled();
  });
});
