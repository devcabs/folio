import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

const setInputValue = (el: HTMLElement | null, value: string) => {
  if (!el) throw new Error('Input element not found');
  (el as HTMLInputElement).value = value;
  el.setAttribute('value', value);
  const propsKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  const reactProps = propsKey ? (el as any)[propsKey] : null;
  if (reactProps?.onChange) {
    act(() => {
      reactProps.onChange({ target: { value } });
    });
    return;
  }
  fireEvent.change(el, { target: { value } });
};
import { DocumentCanvas } from '../../src/components/canvas/DocumentCanvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as nodeCanvasHook from '../../src/hooks/useDocumentCanvas';
import * as driveVerificationService from '../../src/services/driveVerificationService';
import * as sheetChartHook from '../../src/hooks/useSheetChartData';
import type {
  NodeCanvasDocument,
  GalleryElement,
  ChartElement,
} from '../../src/types/canvas';
import type { SheetChartConfig } from '../../src/types/chart';

// Mock ChartConfigDrawer so we can inspect its exact props (isOpen, mode, chartId, initialConfig, onDeployed)
const chartDrawerSpy = vi.fn();
vi.mock('../../src/components/chart/ChartConfigDrawer', () => ({
  ChartConfigDrawer: (props: any) => {
    chartDrawerSpy(props);
    if (!props.isOpen) return null;
    return (
      <div
        data-testid="mock-chart-config-drawer"
        data-mode={props.mode}
        data-chart-id={props.chartId}
        data-sheet-url={props.initialConfig?.sheetUrl || ''}
        data-title-override={props.initialConfig?.titleOverride || ''}
      >
        <button
          type="button"
          data-testid="mock-chart-deploy-btn"
          onClick={() =>
            props.onDeployed?.(
              {
                ...(props.initialConfig || {}),
                sheetUrl: 'https://docs.google.com/spreadsheets/d/updated-sheet/edit',
                range: 'A1:C10',
                chartType: 'bar',
                titleOverride: 'Updated Chart Title',
                subtitleOverride: 'Updated Subtitle',
              },
              {
                title: 'Dataset Title',
                subtitle: 'Dataset Subtitle',
                chartType: 'bar',
                labels: ['2025'],
                series: [{ name: 'Value', data: [42] }],
              }
            )
          }
        >
          Deploy Chart
        </button>
        <button
          type="button"
          data-testid="mock-chart-close-btn"
          onClick={() => props.onClose?.()}
        >
          Close
        </button>
      </div>
    );
  },
}));

describe('9.4 Floating Toolbar & Side Edit Modal Unification', () => {
  beforeEach(() => {
    chartDrawerSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const createDevModeStub = () => ({
    isDevMode: true,
    isDesktop: true,
    canUnlock: true,
    isUnlocked: true,
    authToken: 'test-token',
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
    addElement: vi.fn().mockResolvedValue({ ok: true }),
    restoreSection: vi.fn().mockResolvedValue({ ok: true }),
    restoreSubsection: vi.fn(),
    restoreElement: vi.fn(),
    moveItem: vi.fn(),
    relocateItem: vi.fn(),
    removeItem: vi.fn(),
    updateItem: vi.fn().mockResolvedValue({ ok: true }),
    resetToDefault: vi.fn(),
    deployToCloud: vi.fn(),
    saveError: null,
    clearSaveError: vi.fn(),
    fetchError: null,
    retryFetch: vi.fn(),
    ...overrides,
  });

  const galleryLeaf: GalleryElement = {
    id: 'gal-1',
    type: 'gallery',
    pointId: 'node.access.gallery.gal-1',
    title: 'Initial Evidence Folder',
    titlePointId: 'node.access.gallery.gal-1.title',
    driveUrl: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz',
  };

  const chartConfig: SheetChartConfig = {
    chartId: 'chart-access-1',
    nodeId: 'access',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/original-sheet/edit',
    range: 'A1:B5',
    defaultType: 'bar',
    titleOverride: 'Original Chart Title',
    subtitleOverride: 'Original Subtitle',
  };

  const chartLeaf: ChartElement = {
    id: 'chart-elem-1',
    type: 'chart',
    chartId: 'chart-access-1',
    title: 'Original Chart Title',
    subtitle: 'Original Subtitle',
    config: chartConfig,
    dataset: {
      chartId: 'chart-access-1',
      nodeId: 'access',
      chartType: 'bar',
      title: 'Original Chart Title',
      asOfDate: '2026-11-18',
      categories: ['2024'],
      series: [{ name: 'Metric', data: [10] }],
      sanitizedCsvContent: 'Category,Metric\n2024,10',
    },
  };

  const baseDoc: NodeCanvasDocument = {
    nodeId: 'access',
    version: 1,
    updatedAt: '2026-11-18T00:00:00.000Z',
    sections: [
      {
        id: 'sec-1',
        type: 'section',
        title: 'Evidence & Data',
        number: '01',
        isNumbered: true,
        elements: [galleryLeaf, chartLeaf],
      },
    ],
  };

  it('opens LinkFolderModal with identical initial values from both floating toolbar Edit and side ✎ Edit on a Gallery', async () => {
    const updateItemSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub() as any);
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(baseDoc, { updateItem: updateItemSpy })
    );
    vi.spyOn(driveVerificationService, 'verifyDriveFolderUrl').mockResolvedValue({
      status: 'valid',
      folderId: '1NewFolderId1234567890',
      folderTitle: 'Verified Drive Folder',
    });

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    // 1. Click floating toolbar Edit button for gallery (exact match /^Edit$/: 0=section, 1=gallery, 2=chart)
    const toolbarEditBtns = screen.getAllByRole('button', { name: /^Edit$/ });
    fireEvent.click(toolbarEditBtns[1]);

    // Must open LinkFolderModal (title "Link Folder" + Verify button), NOT UniversalEditModal ("Edit Gallery")
    expect(screen.getByRole('heading', { name: 'Link Folder' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Edit Gallery' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeTruthy();
    expect((document.getElementById('folder-title-input') as HTMLInputElement).value).toBe(
      'Initial Evidence Folder'
    );
    expect((document.getElementById('folder-url-input') as HTMLInputElement).value).toBe(
      'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz'
    );

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Link Folder' })).toBeNull();

    // 2. Click side ✎ Edit button beside the gallery
    const sideEditBtn = screen.getByRole('button', { name: 'Edit source photo repository' });
    fireEvent.click(sideEditBtn);

    expect(screen.getByRole('heading', { name: 'Link Folder' })).toBeTruthy();
    expect((document.getElementById('folder-title-input') as HTMLInputElement).value).toBe(
      'Initial Evidence Folder'
    );
    expect((document.getElementById('folder-url-input') as HTMLInputElement).value).toBe(
      'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz'
    );

    // Update URL & Title and save via LinkFolderModal
    setInputValue(document.getElementById('folder-title-input'), 'Updated Evidence Folder');
    setInputValue(
      document.getElementById('folder-url-input'),
      'https://drive.google.com/drive/folders/1NewFolderId1234567890'
    );

    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));

    await vi.waitFor(() => {
      expect(updateItemSpy).toHaveBeenCalledWith('gal-1', {
        driveUrl: 'https://drive.google.com/drive/folders/1NewFolderId1234567890',
        title: 'Updated Evidence Folder',
      });
    });
  });

  it('opens ChartConfigDrawer with identical initialConfig and persists updates via updateItem from both floating toolbar Edit and side ✎ Edit', async () => {
    const updateItemSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub() as any);
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(baseDoc, { updateItem: updateItemSpy })
    );
    vi.spyOn(sheetChartHook, 'useSheetChartData').mockReturnValue({
      dataset: chartLeaf.dataset!,
      config: chartConfig,
      status: 'success',
      errorMessage: undefined,
      syncLiveSheet: vi.fn(),
      reload: vi.fn(),
      setOverrideConfig: vi.fn(),
    });

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    // 1. Click floating toolbar Edit button for chart (exact match /^Edit$/: 0=section, 1=gallery, 2=chart)
    const toolbarEditBtns = screen.getAllByRole('button', { name: /^Edit$/ });
    fireEvent.click(toolbarEditBtns[2]);

    const drawerFromToolbar = screen.getByTestId('mock-chart-config-drawer');
    expect(drawerFromToolbar.getAttribute('data-mode')).toBe('edit');
    expect(drawerFromToolbar.getAttribute('data-chart-id')).toBe('chart-access-1');
    expect(drawerFromToolbar.getAttribute('data-sheet-url')).toBe(
      'https://docs.google.com/spreadsheets/d/original-sheet/edit'
    );
    expect(drawerFromToolbar.getAttribute('data-title-override')).toBe('Original Chart Title');

    // Close drawer
    fireEvent.click(screen.getByTestId('mock-chart-close-btn'));
    expect(screen.queryByTestId('mock-chart-config-drawer')).toBeNull();

    // 2. Click side ✎ Edit button beside the chart
    const sideEditBtn = screen.getByRole('button', { name: 'Edit chart chart-access-1' });
    fireEvent.click(sideEditBtn);

    const drawerFromSide = screen.getByTestId('mock-chart-config-drawer');
    expect(drawerFromSide.getAttribute('data-mode')).toBe('edit');
    expect(drawerFromSide.getAttribute('data-chart-id')).toBe('chart-access-1');
    expect(drawerFromSide.getAttribute('data-sheet-url')).toBe(
      'https://docs.google.com/spreadsheets/d/original-sheet/edit'
    );
    expect(drawerFromSide.getAttribute('data-title-override')).toBe('Original Chart Title');

    // Deploy updated chart and verify updateItem is called on Canvas AST
    fireEvent.click(screen.getByTestId('mock-chart-deploy-btn'));

    await vi.waitFor(() => {
      expect(updateItemSpy).toHaveBeenCalledWith(
        'chart-elem-1',
        expect.objectContaining({
          title: 'Updated Chart Title',
          subtitle: 'Updated Subtitle',
          config: expect.objectContaining({
            sheetUrl: 'https://docs.google.com/spreadsheets/d/updated-sheet/edit',
            titleOverride: 'Updated Chart Title',
          }),
          dataset: expect.objectContaining({
            title: 'Dataset Title',
          }),
        })
      );
    });
  });

  it('routes adding a new gallery through LinkFolderModal and inserts verified GalleryElement into the AST', async () => {
    const addElementSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue(createDevModeStub() as any);
    vi.spyOn(nodeCanvasHook, 'useDocumentCanvas').mockReturnValue(
      createCanvasHookStub(baseDoc, { addElement: addElementSpy })
    );
    vi.spyOn(driveVerificationService, 'verifyDriveFolderUrl').mockResolvedValue({
      status: 'valid',
      folderId: '1AddedFolder1234567890',
      folderTitle: 'New Verified Folder',
    });

    render(<DocumentCanvas nodeId="access" nodeTitle="Access" />);

    // Open the post-header + Add Element bar (index 1 = sec-top-sec-1), hover Photo submenu, and click Photo Gallery
    const addElementBtns = screen.getAllByRole('button', { name: /Add Element/i });
    (addElementBtns[1] as any).getBoundingClientRect = () => ({
      top: 100,
      bottom: 130,
      left: 0,
      right: 100,
      width: 100,
      height: 30,
    });
    fireEvent.click(addElementBtns[1]);
    const photoMenuTrigger = screen.getByRole('menuitem', { name: /Photo/i });
    fireEvent.click(photoMenuTrigger);
    fireEvent.click(screen.getByRole('menuitem', { name: /Photo Gallery/i }));

    // LinkFolderModal should open in add mode
    expect(screen.getByRole('heading', { name: 'Link Folder' })).toBeTruthy();

    setInputValue(
      document.getElementById('folder-url-input'),
      'https://drive.google.com/drive/folders/1AddedFolder1234567890'
    );
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));

    await vi.waitFor(() => {
      expect(addElementSpy).toHaveBeenCalledWith(
        'sec-1',
        expect.objectContaining({
          type: 'gallery',
          driveUrl: 'https://drive.google.com/drive/folders/1AddedFolder1234567890',
          title: 'New Verified Folder',
        }),
        0,
        undefined
      );
    });
  });
});
