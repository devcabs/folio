import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SourceDocuments } from '../../src/components/source/SourceDocuments';
import { CanvasAddBar } from '../../src/components/canvas/CanvasAddBar';
import { DocumentCanvas } from '../../src/components/canvas/DocumentCanvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as driveDocumentSyncHook from '../../src/hooks/useDriveDocumentSync';
import * as nodeCanvasHook from '../../src/hooks/useDocumentCanvas';
import type { SyncedDocumentItem } from '../../src/types/source';
import type { DocumentsElement, NodeCanvasDocument } from '../../src/types/canvas';

describe('11.5 SourceDocuments, PdfPreviewModal, CanvasAddBar Submenu & DocumentCanvas Wiring', () => {
  const findAllByTag = (root: any, tagName: string): HTMLElement[] => {
    const results: HTMLElement[] = [];
    if (!root) return results;
    if (typeof root.tagName === 'string' && root.tagName.toLowerCase() === tagName.toLowerCase()) {
      results.push(root);
    }
    for (const child of root.childNodes || []) {
      results.push(...findAllByTag(child, tagName));
    }
    return results;
  };

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const createDevModeStub = (isDevMode: boolean) =>
    ({
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
    }) as unknown as ReturnType<typeof developerModeHook.useDeveloperMode>;

  const sampleDocs: SyncedDocumentItem[] = [
    {
      id: 'doc-1',
      pointId: 'node.access.documents.1',
      driveFileId: 'drive-file-1',
      originalFileName: '01_Annual_Report.pdf',
      title: 'Annual Accomplishment Report',
      previewUrl: 'https://drive.google.com/file/d/drive-file-1/preview',
      viewUrl: 'https://drive.google.com/file/d/drive-file-1/view',
      isCustomTitle: false,
      orderIndex: 0,
      date: '2026-10-01',
      dateStamp: '2026-10-01',
      size: '1.2 MB',
    },
    {
      id: 'doc-2',
      pointId: 'node.access.documents.1',
      driveFileId: 'drive-file-2',
      originalFileName: '02_Budget_Resolution.pdf',
      title: 'Budget Resolution 2026',
      previewUrl: 'https://drive.google.com/file/d/drive-file-2/preview',
      viewUrl: 'https://drive.google.com/file/d/drive-file-2/view',
      isCustomTitle: false,
      orderIndex: 1,
      date: '2026-10-05',
      dateStamp: '2026-10-05',
      size: '840 KB',
    },
  ];

  const createDocSyncStub = (
    overrides: Partial<ReturnType<typeof driveDocumentSyncHook.useDriveDocumentSync>> = {}
  ) =>
    ({
      syncedDocuments: [],
      syncState: 'never_synced' as const,
      hasSynced: false,
      isSyncing: false,
      isManualSyncing: false,
      isBackgroundSyncing: false,
      error: null,
      backgroundError: null,
      lastStats: null,
      syncDocuments: vi.fn().mockResolvedValue(null),
      ...overrides,
    }) as unknown as ReturnType<typeof driveDocumentSyncHook.useDriveDocumentSync>;

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

  it('renders synced PDF rows with title, date stamp, and Open ↗ link, and opens PdfPreviewModal with prev/next navigation', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub(false));
    vi.spyOn(driveDocumentSyncHook, 'useDriveDocumentSync').mockReturnValue(
      createDocSyncStub({
        syncedDocuments: sampleDocs,
        syncState: 'synced_success',
        hasSynced: true,
      })
    );

    render(
      <SourceDocuments
        nodeId="access"
        pointId="node.access.documents.1"
        driveUrl="https://drive.google.com/drive/folders/folder-123"
        title="Official Resolutions"
        syncedDocuments={sampleDocs}
      />
    );

    expect(screen.getByText('Annual Accomplishment Report')).toBeTruthy();
    expect(screen.getByText('2026-10-01')).toBeTruthy();
    expect(screen.getByText('Budget Resolution 2026')).toBeTruthy();
    expect(screen.getByText('2026-10-05')).toBeTruthy();

    const allLinks = findAllByTag(document.body, 'a');
    const openLinks = allLinks.filter((a) => a.textContent?.includes('Open ↗'));
    expect(openLinks).toHaveLength(2);
    expect(openLinks[0].getAttribute('href')).toBe(
      'https://drive.google.com/file/d/drive-file-1/view'
    );

    // Click first document row to open PdfPreviewModal
    const rows = screen.getAllByRole('listitem');
    await act(async () => {
      fireEvent.click(rows[0]);
    });

    const iframe = findAllByTag(document.body, 'iframe')[0];
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('src')).toBe(
      'https://drive.google.com/file/d/drive-file-1/preview'
    );

    const newTabLink = findAllByTag(document.body, 'a').find((a) =>
      a.textContent?.includes('Open in New Tab ↗')
    );
    expect(newTabLink?.getAttribute('href')).toBe(
      'https://drive.google.com/file/d/drive-file-1/view'
    );

    // Navigate to next document via button
    const nextBtn = screen.getByRole('button', { name: /next document/i });
    fireEvent.click(nextBtn);
    expect(findAllByTag(document.body, 'iframe')[0]?.getAttribute('src')).toBe(
      'https://drive.google.com/file/d/drive-file-2/preview'
    );

    // Navigate back via ArrowLeft keyboard shortcut
    await act(async () => {
      const leftEvt = new Event('keydown') as KeyboardEvent & { key: string };
      Object.defineProperty(leftEvt, 'key', { value: 'ArrowLeft' });
      window.dispatchEvent(leftEvt);
    });
    expect(findAllByTag(document.body, 'iframe')[0]?.getAttribute('src')).toBe(
      'https://drive.google.com/file/d/drive-file-1/preview'
    );

    // Navigate forward via ArrowRight keyboard shortcut
    await act(async () => {
      const rightEvt = new Event('keydown') as KeyboardEvent & { key: string };
      Object.defineProperty(rightEvt, 'key', { value: 'ArrowRight' });
      window.dispatchEvent(rightEvt);
    });
    expect(findAllByTag(document.body, 'iframe')[0]?.getAttribute('src')).toBe(
      'https://drive.google.com/file/d/drive-file-2/preview'
    );
  });

  it('renders EmptyState for synced_empty and sync_error with Open Google Drive Folder ↗ escape hatch', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub(false));
    vi.spyOn(driveDocumentSyncHook, 'useDriveDocumentSync').mockReturnValue(
      createDocSyncStub({
        syncedDocuments: [],
        syncState: 'synced_empty',
        hasSynced: true,
      })
    );

    const { rerender } = render(
      <SourceDocuments
        nodeId="access"
        pointId="node.access.documents.1"
        driveUrl="https://drive.google.com/drive/folders/folder-123"
        title="Official Resolutions"
      />
    );

    expect(screen.getByText('No PDF Documents Found in Drive Folder')).toBeTruthy();

    vi.spyOn(driveDocumentSyncHook, 'useDriveDocumentSync').mockReturnValue(
      createDocSyncStub({
        syncedDocuments: [],
        syncState: 'sync_error',
        error: 'Drive API 403',
      })
    );

    rerender(
      <SourceDocuments
        nodeId="access"
        pointId="node.access.documents.1"
        driveUrl="https://drive.google.com/drive/folders/folder-123"
        title="Official Resolutions"
      />
    );

    expect(screen.getByText('Document Sync Unavailable')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Google Drive Folder ↗' })).toBeTruthy();
  });

  it('renders exactly one Sync button in sideEditWrapper beside Edit in Developer Mode', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub(true));
    const syncDocumentsMock = vi.fn().mockResolvedValue({
      added: 1,
      removed: 0,
      retained: 0,
      total: 1,
      hasChanged: true,
    });
    vi.spyOn(driveDocumentSyncHook, 'useDriveDocumentSync').mockReturnValue(
      createDocSyncStub({
        syncDocuments: syncDocumentsMock,
      })
    );

    render(
      <SourceDocuments
        nodeId="access"
        pointId="node.access.documents.1"
        driveUrl="https://drive.google.com/drive/folders/folder-123"
        title="Official Resolutions"
      />
    );

    const syncButtons = screen.getAllByRole('button', {
      name: 'Sync documents from Google Drive',
    });
    expect(syncButtons).toHaveLength(1);
    expect(syncButtons[0].textContent).toContain('Sync');

    expect(
      screen.getByRole('button', { name: 'Edit source document repository' })
    ).toBeTruthy();

    await act(async () => {
      fireEvent.click(syncButtons[0]);
    });
    expect(syncDocumentsMock).toHaveBeenCalledTimes(1);
  });

  it('expands Document option in CanvasAddBar with Single PDF and PDF Folder submenu', () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub(true));
    const onAddElement = vi.fn();

    render(<CanvasAddBar onAddElement={onAddElement} barId="test-bar" />);

    const addBtn = screen.getByRole('button', { name: /add element/i });
    (addBtn as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({ top: 100, bottom: 130, left: 0, right: 100, width: 100, height: 30, x: 0, y: 100, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(addBtn);
    const docMenuItem = screen.getByRole('menuitem', { name: 'Document' });
    fireEvent.click(docMenuItem);

    const singlePdfBtn = screen.getByRole('menuitem', { name: 'Single PDF' });
    const pdfFolderBtn = screen.getByRole('menuitem', { name: 'PDF Folder' });
    expect(singlePdfBtn).toBeTruthy();
    expect(pdfFolderBtn).toBeTruthy();

    fireEvent.click(pdfFolderBtn);
    expect(onAddElement).toHaveBeenCalledWith('documents');

    // Re-open and test Single PDF
    fireEvent.click(addBtn);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Document' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Single PDF' }));
    expect(onAddElement).toHaveBeenCalledWith('pdf');
  });

  it('opens unified LinkFolderModal from both floating toolbar Edit and side Edit button on CanvasDocuments', async () => {
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub(true));
    vi.spyOn(driveDocumentSyncHook, 'useDriveDocumentSync').mockReturnValue(
      createDocSyncStub({
        syncedDocuments: sampleDocs,
        syncState: 'synced_success',
        hasSynced: true,
      })
    );

    const docsElement: DocumentsElement = {
      id: 'docs-1',
      type: 'documents',
      pointId: 'node.access.documents.docs-1',
      title: 'Official Resolutions',
      driveUrl: 'https://drive.google.com/drive/folders/folder-abc',
      syncedDocuments: sampleDocs,
    };

    const doc: NodeCanvasDocument = {
      nodeId: 'access',
      version: 1,
      updatedAt: '2026-10-01T00:00:00.000Z',
      sections: [
        {
          id: 'sec-1',
          type: 'section',
          title: 'Section 1',
          elements: [docsElement],
        },
      ],
    };

    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(doc) as unknown as ReturnType<typeof nodeCanvasHook.useDocumentCanvas>
    );

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    const findById = (root: any, id: string): (HTMLInputElement & { props?: { value?: string } }) | null => {
      if (!root) return null;
      if (root.id === id || root.props?.id === id || root.getAttribute?.('id') === id) {
        return root;
      }
      for (const child of root.childNodes || []) {
        const found = findById(child, id);
        if (found) return found;
      }
      return null;
    };

    // 1. Click side "✎ Edit" button on CanvasDocuments
    const sideEditBtn = screen.getByRole('button', {
      name: 'Edit source document repository',
    });
    await act(async () => {
      fireEvent.click(sideEditBtn);
    });

    expect(screen.getByRole('dialog')).toBeTruthy();
    const titleInput = findById(document.body, 'folder-title-input');
    const urlInput = findById(document.body, 'folder-url-input');
    expect(titleInput?.value || titleInput?.props?.value || titleInput?.getAttribute('value')).toBe('Official Resolutions');
    expect(urlInput?.value || urlInput?.props?.value || urlInput?.getAttribute('value')).toBe('https://drive.google.com/drive/folders/folder-abc');

    // Close modal
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();

    // 2. Click floating toolbar Edit button (index 0 is Section, index 1 is DocumentsElement)
    const toolbarEditBtns = screen.getAllByRole('button', { name: 'Edit' });
    expect(toolbarEditBtns.length).toBeGreaterThanOrEqual(2);
    await act(async () => {
      fireEvent.click(toolbarEditBtns[1]);
    });

    expect(screen.getByRole('dialog')).toBeTruthy();
    const titleInput2 = findById(document.body, 'folder-title-input');
    const urlInput2 = findById(document.body, 'folder-url-input');
    expect(titleInput2?.value || titleInput2?.props?.value || titleInput2?.getAttribute('value')).toBe('Official Resolutions');
    expect(urlInput2?.value || urlInput2?.props?.value || urlInput2?.getAttribute('value')).toBe('https://drive.google.com/drive/folders/folder-abc');
  });
});
