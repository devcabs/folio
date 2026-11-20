import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DocumentCanvas } from '../../src/components/canvas/DocumentCanvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as nodeCanvasHook from '../../src/hooks/useDocumentCanvas';
import type { NodeCanvasDocument, PdfElement } from '../../src/types/canvas';

describe('11.3 Single PDF Authoring & Modal Wiring', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const createDevModeStub = (isDevMode: boolean) => ({
    isDevMode,
    isDesktop: true,
    canUnlock: isDevMode,
    isUnlocked: isDevMode,
    authToken: isDevMode ? 'test-token' : null,
    toggleDevMode: vi.fn(),
    unlockWithPin: vi.fn(),
    lockDevMode: vi.fn(),
    setHasUnpublishedChanges: vi.fn(),
    showToast: vi.fn(),
  });

  const createCanvasHookStub = (
    doc: NodeCanvasDocument,
    overrides: Partial<ReturnType<typeof nodeCanvasHook.useDocumentCanvas>> = {}
  ) => ({
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
    ...overrides,
  });

  const stubButtonRect = (btn: HTMLElement) => {
    (btn as any).getBoundingClientRect = () => ({
      top: 100,
      bottom: 130,
      left: 0,
      right: 100,
      width: 100,
      height: 30,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
  };

  const findById = (root: any, id: string): HTMLInputElement | null => {
    if (!root) return null;
    if (root.id === id || root.props?.id === id || root.getAttribute?.('id') === id) {
      return root as HTMLInputElement;
    }
    for (const child of root.childNodes || []) {
      const found = findById(child, id);
      if (found) return found;
    }
    return null;
  };

  const setInputValue = (el: HTMLInputElement | null, val: string) => {
    if (!el) throw new Error('Input element not found');
    el.value = val;
    el.setAttribute('value', val);
    const propsKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
    const reactProps = propsKey ? (el as any)[propsKey] : null;
    if (reactProps?.onChange) {
      act(() => {
        reactProps.onChange({ target: { value: val } });
      });
      return;
    }
    fireEvent.change(el, { target: { value: val } });
  };

  const baseDoc: NodeCanvasDocument = {
    nodeId: 'access',
    version: 3,
    updatedAt: '2026-11-19T00:00:00.000Z',
    elements: [
      {
        id: 'sec-1',
        type: 'section',
        title: 'Documents & Reports',
        number: '01',
        isNumbered: true,
      },
    ],
  };

  const existingPdfLeaf: PdfElement = {
    id: 'pdf-existing-1',
    type: 'pdf',
    pointId: 'node.access.pdf.pdf-existing-1',
    title: 'Annual Audit Report',
    src: 'https://drive.google.com/file/d/1ABCxyz0123456789/preview',
    driveFileId: '1ABCxyz0123456789',
    driveUrl: 'https://drive.google.com/file/d/1ABCxyz0123456789/view',
    caption: 'FY 2026 Official Submission',
    showCaption: true,
  };

  const docWithPdf: NodeCanvasDocument = {
    ...baseDoc,
    elements: [...baseDoc.elements, existingPdfLeaf],
  };

  it('opens UniversalEditModal ("Add PDF") when clicking + Add Element -> Document and inserts a resolved PdfElement on submit', () => {
    const addElementMock = vi.fn();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as any
    );
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(baseDoc, { addElement: addElementMock })
    );

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    // Open the post-header Add Element bar inside sec-1
    const addButtons = screen.getAllByRole('button', { name: /Add Element/i });
    stubButtonRect(addButtons[1]);
    fireEvent.click(addButtons[1]);

    // Click "Document" in the palette, then "Single PDF" in its submenu
    const docMenuItem = screen.getByRole('menuitem', { name: 'Document' });
    fireEvent.click(docMenuItem);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Single PDF' }));

    // UniversalEditModal opens in Add PDF mode
    expect(screen.getByRole('heading', { name: 'Add PDF' })).toBeTruthy();
    const submitBtn = screen.getByRole('button', { name: 'Add PDF' });
    expect(submitBtn).toBeTruthy();

    // Fill in Document Title and Google Drive PDF URL
    const titleInput = findById(document.body, 'canvas-pdf-title') as HTMLInputElement;
    const urlInput = findById(document.body, 'canvas-pdf-url') as HTMLInputElement;
    expect(titleInput).toBeTruthy();
    expect(urlInput).toBeTruthy();

    setInputValue(titleInput, 'Q1 Financial Report');
    setInputValue(urlInput, 'https://drive.google.com/file/d/1PDFxyz9876543210/view');

    fireEvent.click(submitBtn);

    expect(addElementMock).toHaveBeenCalledTimes(1);
    const [insertedLeaf, targetIdx] = addElementMock.mock.calls[0];
    expect(targetIdx).toBe(1);
    expect(insertedLeaf).toMatchObject({
      type: 'pdf',
      title: 'Q1 Financial Report',
      src: 'https://drive.google.com/file/d/1PDFxyz9876543210/preview',
      driveFileId: '1PDFxyz9876543210',
      driveUrl: 'https://drive.google.com/file/d/1PDFxyz9876543210/view',
    });
  });

  it('shows inline feedback when a Drive folder link or non-Drive URL is pasted in the PDF URL field', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as any
    );
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(baseDoc)
    );

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    const addButtons = screen.getAllByRole('button', { name: /Add Element/i });
    stubButtonRect(addButtons[1]);
    fireEvent.click(addButtons[1]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Document' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Single PDF' }));

    const urlInput = findById(document.body, 'canvas-pdf-url') as HTMLInputElement;
    expect(urlInput).toBeTruthy();

    // Folder link feedback
    setInputValue(urlInput, 'https://drive.google.com/drive/folders/1FolderIdExample');
    expect(screen.getByText(/folder link/i)).toBeTruthy();

    // Non-Drive URL feedback
    setInputValue(urlInput, 'https://example.com/report.pdf');
    expect(screen.getByText(/valid Google Drive file link/i)).toBeTruthy();
  });

  it('opens UniversalEditModal ("Edit PDF") pre-populated from both floating toolbar Edit and side ✎ Edit buttons, and updates AST on save', () => {
    const updateItemMock = vi.fn();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as any
    );
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(docWithPdf, { updateItem: updateItemMock })
    );

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    // 1. Click floating toolbar Edit button on the PDF leaf (index 0 is Section, index 1 is PdfElement)
    const toolbarEditBtns = screen.getAllByRole('button', { name: 'Edit' });
    expect(toolbarEditBtns.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(toolbarEditBtns[1]);

    expect(screen.getByRole('heading', { name: 'Edit PDF' })).toBeTruthy();
    expect((findById(document.body, 'canvas-pdf-title') as HTMLInputElement).value).toBe(
      'Annual Audit Report'
    );
    expect((findById(document.body, 'canvas-pdf-url') as HTMLInputElement).value).toBe(
      'https://drive.google.com/file/d/1ABCxyz0123456789/view'
    );
    expect((findById(document.body, 'canvas-pdf-caption') as HTMLInputElement).value).toBe(
      'FY 2026 Official Submission'
    );

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Edit PDF' })).toBeNull();

    // 2. Click side "✎ Edit" button on <CanvasPdf>
    const sideEditBtn = screen.getByRole('button', { name: /✎ Edit/i });
    fireEvent.click(sideEditBtn);

    expect(screen.getByRole('heading', { name: 'Edit PDF' })).toBeTruthy();
    expect((findById(document.body, 'canvas-pdf-title') as HTMLInputElement).value).toBe(
      'Annual Audit Report'
    );

    // Update title and save
    setInputValue(
      findById(document.body, 'canvas-pdf-title') as HTMLInputElement,
      'Updated Audit Report'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(updateItemMock).toHaveBeenCalledWith(
      'pdf-existing-1',
      expect.objectContaining({
        title: 'Updated Audit Report',
        src: 'https://drive.google.com/file/d/1ABCxyz0123456789/preview',
        driveFileId: '1ABCxyz0123456789',
      })
    );
  });

  it('opens CanvasDeleteConfirmModal with "Delete PDF Document" when clicking Delete on CanvasItemControls', () => {
    const removeItemMock = vi.fn();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(
      createDevModeStub(true) as any
    );
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(docWithPdf, { removeItem: removeItemMock })
    );

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    // Index 0 is Section Delete, Index 1 is PDF leaf Delete
    const deleteBtns = screen.getAllByRole('button', { name: 'Delete' });
    expect(deleteBtns.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(deleteBtns[1]);

    expect(screen.getByRole('heading', { name: 'Delete PDF Document' })).toBeTruthy();
    expect(screen.getByText(/Are you sure you want to delete this PDF document\?/i)).toBeTruthy();

    // Confirm delete (inside modal)
    const confirmDeleteBtns = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(confirmDeleteBtns[confirmDeleteBtns.length - 1]);
    expect(removeItemMock).toHaveBeenCalledWith('pdf-existing-1', 'access');
  });
});
