import React, { memo, useState, useCallback } from 'react';
import type {
  CanvasElementType,
  CanvasLeafElement,
  CanvasModalMode,
  CanvasModalElementType,
  CanvasElementFormData,
  NodeCanvasDocument,
  SectionElement,
  SubsectionElement,
  TextElement,
  PhotoElement,
  GalleryElement,
  ChartElement,
  PdfElement,
  DocumentsElement,
} from '../../types/canvas';
import type { NodeCode } from '../../types/node';
import type { SheetChartConfig } from '../../types/chart';
import { useDocumentCanvas } from '../../hooks/useNodeCanvas';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { usePortalChrome } from '../../context/PortalChromeContext';
import { getActiveNodes, getEngineConfig } from '../../config/engine.config';
import {
  generateCanvasId,
  createDefaultCanvasDocument,
  createDefaultPageLink,
} from '../../utils/canvasDefaults';
import { insertCanvasElement, removeCanvasItem } from '../../services/canvasLayoutService';
import {
  buildPagePath,
  createPageNode,
  updatePageNodeMetadata,
  deriveSubpageOrderFromCanvas,
  countDescendantPages,
  cascadeDeleteSubtree,
} from '../../services/pageTreeService';
import { getDraftWorkspace } from '../../services/draftService';
import { createWorkspaceUndoAction } from '../../services/undoRedoService';
import { resolveSingleDrivePdfUrl } from '../../utils/mediaUrl';
import { CanvasSection } from './CanvasSection';
import { CanvasSubsection } from './CanvasSubsection';
import { CanvasText } from './CanvasText';
import { CanvasPhoto } from './CanvasPhoto';
import { CanvasGallery, type GalleryElementUpdates } from './CanvasGallery';
import { CanvasChart } from './CanvasChart';
import { CanvasPdf } from './CanvasPdf';
import { CanvasDocuments, type DocumentsElementUpdates } from './CanvasDocuments';
import { CanvasPageLink } from './CanvasPageLink';
import { CanvasAddBar } from './CanvasAddBar';
import { CanvasGhostWireframe } from './CanvasGhostWireframe';
import { CanvasEmptyNotice } from './CanvasEmptyNotice';
import { CanvasItemControls } from './CanvasItemControls';
// CanvasElementModal unified canonically into UniversalEditModal
import { UniversalEditModal } from '../dev/UniversalEditModal';
import { LinkFolderModal } from '../source/LinkFolderModal';
import { ChartConfigDrawer } from '../chart/ChartConfigDrawer';
import { Toast } from '../feedback/Toast';
import { TopErrorBanner } from '../feedback/TopErrorBanner';
import { useDynamicCanvasSectionNumbers } from '../../hooks/use-dynamic-section-numbers';

export interface NodeCanvasProps {
  nodeId: string;
  nodeTitle: string;
  accentColor?: string;
  className?: string;
  onNavigateToPage?: (pageId: string) => void;
}

interface ActiveCanvasModalState {
  isOpen: boolean;
  mode: CanvasModalMode;
  elementType: CanvasModalElementType;
  itemId?: string;
  pointId?: string;
  editingPageId?: string;
  initialData?: CanvasElementFormData;
  targetSectionId?: string;
  targetIndex?: number;
  targetSubsectionId?: string;
}

interface ActiveChartDrawerState {
  isOpen: boolean;
  mode: 'add' | 'edit';
  chartId: string;
  elementId?: string;
  initialConfig?: SheetChartConfig;
  targetSectionId?: string;
  targetIndex?: number;
  targetSubsectionId?: string;
}

interface ActiveGalleryModalState {
  isOpen: boolean;
  mode: 'add' | 'edit';
  elementType: 'gallery' | 'documents';
  itemId?: string;
  pointId: string;
  initialTitle: string;
  initialUrl: string;
  targetSectionId?: string;
  targetIndex?: number;
  targetSubsectionId?: string;
}

/**
 * Helper to render individual canvas leaf elements (Text, Photo, Gallery, Chart)
 * Hoisted to module scope (Vercel Best Practice: rerender-no-inline-components)
 */
function renderCanvasLeaf(
  leaf: CanvasLeafElement,
  nodeId: string,
  nodeTitle: string,
  accentColor?: string,
  onEditPhoto?: (photo: PhotoElement) => void,
  onEditLeaf?: (leaf: CanvasLeafElement) => void,
  onUpdateGallery?: (
    leafId: string,
    updates: GalleryElementUpdates
  ) => Promise<{ ok: boolean; error?: string } | void> | void,
  onUpdateChart?: (
    leafId: string,
    updates: Partial<ChartElement>
  ) => Promise<{ ok: boolean; error?: string } | void> | void,
  onUpdateDocuments?: (
    leafId: string,
    updates: DocumentsElementUpdates
  ) => Promise<{ ok: boolean; error?: string } | void> | void,
  onNavigateToPage?: (pageId: string) => void
): React.ReactNode {
  switch (leaf.type) {
    case 'text':
      return (
        <CanvasText
          element={leaf}
          nodeId={nodeId}
          accentColor={accentColor}
          onEdit={onEditLeaf ? () => onEditLeaf(leaf) : undefined}
        />
      );
    case 'photo':
      return (
        <CanvasPhoto
          element={leaf}
          nodeId={nodeId}
          accentColor={accentColor}
          onEdit={onEditPhoto ? () => onEditPhoto(leaf) : undefined}
        />
      );
    case 'gallery':
      return (
        <CanvasGallery
          element={leaf}
          nodeId={nodeId}
          accentColor={accentColor}
          onUpdateGallery={
            onUpdateGallery
              ? (updates) => onUpdateGallery(leaf.id, updates)
              : undefined
          }
          onEdit={onEditLeaf ? () => onEditLeaf(leaf) : undefined}
        />
      );
    case 'chart':
      return (
        <CanvasChart
          element={leaf}
          nodeId={nodeId}
          nodeTitle={nodeTitle}
          accentColor={accentColor}
          onUpdateElement={onUpdateChart}
          onEdit={onEditLeaf ? () => onEditLeaf(leaf) : undefined}
        />
      );
    case 'pdf':
      return (
        <CanvasPdf
          element={leaf}
          nodeId={nodeId}
          accentColor={accentColor}
          onEdit={onEditLeaf ? () => onEditLeaf(leaf) : undefined}
        />
      );
    case 'documents':
      return (
        <CanvasDocuments
          element={leaf}
          nodeId={nodeId}
          accentColor={accentColor}
          onUpdateDocuments={
            onUpdateDocuments
              ? (updates) => onUpdateDocuments(leaf.id, updates)
              : undefined
          }
          onEdit={onEditLeaf ? () => onEditLeaf(leaf) : undefined}
        />
      );
    case 'page-link':
      return (
        <CanvasPageLink
          element={leaf}
          nodeId={nodeId}
          accentColor={accentColor}
          onNavigate={onNavigateToPage}
          onEdit={onEditLeaf ? () => onEditLeaf(leaf) : undefined}
        />
      );
    default:
      return null;
  }
}

function buildPdfElementFields(data: CanvasElementFormData): Omit<PdfElement, 'id' | 'type' | 'pointId'> {
  const rawInput = data.driveUrl?.trim() || data.src?.trim() || '';
  const resolved = resolveSingleDrivePdfUrl(rawInput);
  return {
    title: data.title?.trim() || undefined,
    src: resolved ? resolved.previewUrl : (data.src?.trim() || undefined),
    driveFileId: resolved?.fileId,
    driveUrl: resolved ? resolved.rawUrl : (data.driveUrl?.trim() || undefined),
    caption: data.showCaption ? (data.caption?.trim() || undefined) : undefined,
    showCaption: Boolean(data.showCaption),
  };
}



/**
 * DocumentCanvas Component
 * Folio Engine — Task 9.8: Unified Dynamic Canvas Add & Edit Modals and Drawers Architecture
 *
 * Coordinates recursive rendering of dynamic canvas sections, subsections, and leaf elements:
 * - Reads local-first canvas document via useDocumentCanvas(nodeId)
 * - Unified CanvasElementModal for both creating and editing elements with dual-store synchronization
 * - Direct onEdit callbacks eliminating fragile DOM query simulation hacks
 * - Fast-tracks indicator chart creation directly to ChartConfigDrawer in mode="add"
 * - Returns clean layout with 0 authoring chrome in public visitor mode
 */
export const DocumentCanvas: React.FC<NodeCanvasProps> = memo(({
  nodeId,
  nodeTitle,
  accentColor,
  className,
  onNavigateToPage,
}) => {
  const { isDevMode, isDesktop, lockToken } = useDeveloperMode();
  const isAuthoringActive = isDevMode && isDesktop;
  const portalChrome = usePortalChrome();
  const parentPagePath = buildPagePath(
    nodeId,
    getActiveNodes(),
    portalChrome?.pages ?? {},
    getEngineConfig().basePath
  );

  const {
    document,
    isHydrating,
    addSection,
    addSubsection,
    addElement,
    moveItem,
    relocateItem,
    removeItem,
    updateItem,
    saveError,
    clearSaveError,
    fetchError,
    retryFetch,
  } = useDocumentCanvas(nodeId);

  const sectionNumbers = useDynamicCanvasSectionNumbers(nodeId, document?.elements || []);
  const { undo, pushAction } = useUndoRedo();

  const [showUndoToast, setShowUndoToast] = useState(false);
  const [activeAddBarId, setActiveAddBarId] = useState<string | null>(null);

  // Unified modal and drawer state
  const [activeModal, setActiveModal] = useState<ActiveCanvasModalState | null>(null);
  const [activeGalleryModal, setActiveGalleryModal] = useState<ActiveGalleryModalState | null>(null);
  const [activeChartDrawer, setActiveChartDrawer] = useState<ActiveChartDrawerState | null>(null);


  const handleToggleAddBarActive = useCallback((barId: string, isOpen: boolean) => {
    setActiveAddBarId(isOpen ? barId : null);
  }, []);

  const executeAtomicCascadeDelete = useCallback(async (params: {
    itemId: string;
    parentId?: string;
    targetPageIds: string[];
    description: string;
  }) => {
    if (!document || !portalChrome) return;
    const beforeParentCanvas = document;
    const beforePages = portalChrome.pages;

    let prunedPages = beforePages;
    const deletedSet = new Set<string>();
    for (const targetPageId of params.targetPageIds) {
      if (!prunedPages[targetPageId]) continue;
      const res = cascadeDeleteSubtree(prunedPages, targetPageId);
      prunedPages = res.pages;
      for (const id of res.deletedIds) {
        deletedSet.add(id);
      }
    }

    const deletedIds = Array.from(deletedSet);
    if (deletedIds.length === 0) {
      removeItem(params.itemId, params.parentId);
      setShowUndoToast(true);
      return;
    }

    const purgedCanvases: Record<string, NodeCanvasDocument> = {};
    try {
      const draftWorkspace = await getDraftWorkspace(lockToken);
      for (const id of deletedIds) {
        if (draftWorkspace.canvases?.[id]) {
          purgedCanvases[id] = draftWorkspace.canvases[id];
        }
      }
    } catch {
      // Proceed with available state if workspace read fails
    }

    const nextParentCanvas = removeCanvasItem(beforeParentCanvas, params.itemId, params.parentId);
    const { pages: finalPages } = deriveSubpageOrderFromCanvas(
      prunedPages,
      nodeId,
      nextParentCanvas
    );

    await portalChrome.commitWorkspaceMutation({
      canvases: { [nodeId]: nextParentCanvas },
      pages: finalPages,
      deletedPageIds: deletedIds,
    });

    setShowUndoToast(true);
    pushAction(
      createWorkspaceUndoAction({
        type: 'page_delete_subtree',
        description: params.description,
        before: {
          canvases: { [nodeId]: beforeParentCanvas, ...purgedCanvases },
          pages: beforePages,
        },
        after: {
          canvases: { [nodeId]: nextParentCanvas },
          pages: finalPages,
          deletedPageIds: deletedIds,
        },
        getLockToken: () => lockToken ?? null,
      })
    );
  }, [document, lockToken, nodeId, portalChrome, pushAction, removeItem]);

  // Deletion Handlers with Toast Undo registration (delegated to UndoRedoContext)
  // Deleting a Section or Subsection removes ONLY the heading block; lower content merges upward.
  const handleDeleteSection = useCallback((section: SectionElement, _index: number) => {
    removeItem(section.id);
    setShowUndoToast(true);
  }, [removeItem]);

  const handleDeleteSubsection = useCallback((subsection: SubsectionElement, _index: number) => {
    removeItem(subsection.id);
    setShowUndoToast(true);
  }, [removeItem]);

  const handleDeleteLeaf = useCallback((
    sectionId: string,
    leaf: CanvasLeafElement,
    _index: number,
    subsectionId?: string
  ) => {
    if (leaf.type === 'page-link') {
      const pages = portalChrome?.pages ?? {};
      const targetPage = pages[leaf.targetPageId];
      if (!targetPage || !portalChrome || !document) {
        removeItem(leaf.id, subsectionId || sectionId);
        setShowUndoToast(true);
        return;
      }
      const descendantCount = countDescendantPages(pages, targetPage.id);
      void executeAtomicCascadeDelete({
        itemId: leaf.id,
        parentId: subsectionId || sectionId,
        targetPageIds: [targetPage.id],
        description:
          descendantCount > 0
            ? `Delete "${targetPage.title}" and ${descendantCount} nested subpages`
            : `Delete subpage "${targetPage.title}"`,
      });
      return;
    }
    removeItem(leaf.id, subsectionId || sectionId);
    setShowUndoToast(true);
  }, [document, executeAtomicCascadeDelete, portalChrome, removeItem]);

  // Undo Handler popping directly from UndoRedoContext
  const handleUndoDelete = useCallback(() => {
    undo();
    setShowUndoToast(false);
  }, [undo]);

  // Insertion Trigger: Intercepts additions to route through unified modal or fast-track drawer
  const handleAddElement = useCallback((
    type: CanvasElementType,
    targetSectionId?: string,
    targetIndex?: number,
    targetSubsectionId?: string
  ) => {
    if (type === 'chart') {
      const newChartId = 'chart-' + nodeId + '-' + generateCanvasId('chart');
      setActiveChartDrawer({
        isOpen: true,
        mode: 'add',
        chartId: newChartId,
        targetSectionId,
        targetIndex,
        targetSubsectionId,
      });
      return;
    }

    if (type === 'gallery') {
      const newGalleryId = generateCanvasId('gallery');
      setActiveGalleryModal({
        isOpen: true,
        mode: 'add',
        elementType: 'gallery',
        itemId: newGalleryId,
        pointId: `node.${nodeId}.gallery.${newGalleryId}`,
        initialTitle: '',
        initialUrl: '',
        targetSectionId,
        targetIndex,
        targetSubsectionId,
      });
      return;
    }

    if (type === 'documents') {
      const newDocsId = generateCanvasId('documents');
      setActiveGalleryModal({
        isOpen: true,
        mode: 'add',
        elementType: 'documents',
        itemId: newDocsId,
        pointId: `node.${nodeId}.documents.${newDocsId}`,
        initialTitle: '',
        initialUrl: '',
        targetSectionId,
        targetIndex,
        targetSubsectionId,
      });
      return;
    }

    setActiveModal({
      isOpen: true,
      mode: 'add',
      elementType: type,
      targetSectionId,
      targetIndex,
      targetSubsectionId,
    });
  }, [nodeId]);

  // Edit triggers with explicit callbacks eliminating DOM query hacks
  const handleEditSection = useCallback((section: SectionElement) => {
    const titlePointId = section.titlePointId || `node.${nodeId}.section.${section.id}.title`;
    setActiveModal({
      isOpen: true,
      mode: 'edit',
      elementType: 'section',
      itemId: section.id,
      pointId: titlePointId,
      initialData: {
        title: section.title,
        isNumbered: section.isNumbered !== false,
      },
    });
  }, [nodeId]);

  const handleEditSubsection = useCallback((subsection: SubsectionElement) => {
    const titlePointId = subsection.titlePointId || `node.${nodeId}.subsection.${subsection.id}.title`;
    setActiveModal({
      isOpen: true,
      mode: 'edit',
      elementType: 'subsection',
      itemId: subsection.id,
      pointId: titlePointId,
      initialData: {
        title: subsection.title,
      },
    });
  }, [nodeId]);

  const handleEditPhoto = useCallback((photo: PhotoElement) => {
    setActiveModal({
      isOpen: true,
      mode: 'edit',
      elementType: 'photo',
      itemId: photo.id,
      pointId: photo.pointId,
      initialData: {
        src: photo.src,
        alt: photo.alt,
        caption: photo.caption,
        driveUrl: photo.driveUrl,
      },
    });
  }, []);

  const handleEditLeaf = useCallback((leaf: CanvasLeafElement) => {
    if (leaf.type === 'chart') {
      setActiveChartDrawer({
        isOpen: true,
        mode: 'edit',
        chartId: leaf.chartId,
        elementId: leaf.id,
        initialConfig: leaf.config as SheetChartConfig | undefined,
      });
      return;
    }

    if (leaf.type === 'gallery') {
      setActiveGalleryModal({
        isOpen: true,
        mode: 'edit',
        elementType: 'gallery',
        itemId: leaf.id,
        pointId: leaf.pointId || leaf.id,
        initialTitle: leaf.title || '',
        initialUrl: leaf.driveUrl || '',
      });
      return;
    }

    if (leaf.type === 'documents') {
      setActiveGalleryModal({
        isOpen: true,
        mode: 'edit',
        elementType: 'documents',
        itemId: leaf.id,
        pointId: leaf.pointId || leaf.id,
        initialTitle: leaf.title || '',
        initialUrl: leaf.driveUrl || '',
      });
      return;
    }

    if (leaf.type === 'photo') {
      handleEditPhoto(leaf);
      return;
    }

    if (leaf.type === 'page-link') {
      const targetPage = portalChrome?.pages?.[leaf.targetPageId];
      if (!targetPage) return;
      setActiveModal({
        isOpen: true,
        mode: 'edit',
        elementType: 'page-link',
        itemId: leaf.id,
        editingPageId: targetPage.id,
        initialData: {
          title: targetPage.title,
          slug: targetPage.slug,
          summary: targetPage.summary || '',
          coverImage: targetPage.coverImage || '',
        },
      });
      return;
    }

    if (leaf.type !== 'text' && leaf.type !== 'pdf') {
      return;
    }

    const pointId = leaf.pointId;
    const initialData: CanvasElementFormData =
      leaf.type === 'pdf'
        ? {
          title: leaf.title || '',
          src: leaf.src || '',
          driveUrl: leaf.driveUrl || '',
          caption: leaf.caption || '',
          showCaption: Boolean(leaf.showCaption || (leaf.caption && leaf.caption.trim().length > 0)),
        }
        : {
          content: leaf.content,
          as: leaf.as || 'p',
        };

    setActiveModal({
      isOpen: true,
      mode: 'edit',
      elementType: leaf.type,
      itemId: leaf.id,
      pointId,
      initialData,
    });
  }, [handleEditPhoto, portalChrome?.pages]);

  // Creation Handler executing upon valid submission in Add Mode
  const handleExecuteAdd = useCallback((
    type: CanvasModalElementType,
    payload: CanvasElementFormData,
    _targetSectionId?: string,
    targetIndex?: number,
    _targetSubsectionId?: string
  ) => {
    if (type === 'section') {
      const secId = generateCanvasId('section');
      const titlePointId = `node.${nodeId}.section.${secId}.title`;
      const isNumbered = payload.isNumbered !== false;

      const newSec: SectionElement = {
        id: secId,
        type: 'section',
        title: payload.title?.trim() || 'Section',
        titlePointId,
        isNumbered,
      };
      addSection(targetIndex, newSec);
      return;
    }

    if (type === 'subsection') {
      const subId = generateCanvasId('subsection');
      const titlePointId = `node.${nodeId}.subsection.${subId}.title`;
      const newSub: SubsectionElement = {
        id: subId,
        type: 'subsection',
        title: payload.title?.trim() || 'Subsection',
        titlePointId,
      };
      addSubsection(targetIndex, newSub);
      return;
    }

    // Leaf elements: text, photo, gallery
    let leaf: CanvasLeafElement;
    if (type === 'text') {
      const textId = generateCanvasId('text');
      const pointId = `node.${nodeId}.text.${textId}`;
      leaf = {
        id: textId,
        type: 'text',
        pointId,
        content: payload.content?.trim() || '',
        as: payload.as || 'p',
      };
    } else if (type === 'photo') {
      const photoId = generateCanvasId('photo');
      const pointId = `node.${nodeId}.photo.${photoId}`;
      leaf = {
        id: photoId,
        type: 'photo',
        pointId,
        src: payload.src?.trim() || undefined,
        alt: payload.alt?.trim() || undefined,
        caption: payload.caption?.trim() || undefined,
        driveUrl: payload.driveUrl?.trim() || undefined,
      };
    } else if (type === 'pdf') {
      const pdfId = generateCanvasId('pdf');
      const pointId = `node.${nodeId}.pdf.${pdfId}`;
      leaf = {
        id: pdfId,
        type: 'pdf',
        pointId,
        ...buildPdfElementFields(payload),
      };
    } else {
      const galleryId = generateCanvasId('gallery');
      const titlePointId = `node.${nodeId}.gallery.${galleryId}.title`;
      leaf = {
        id: galleryId,
        type: 'gallery',
        pointId: `node.${nodeId}.gallery.${galleryId}`,
        title: payload.title?.trim() || undefined,
        titlePointId,
        driveUrl: payload.driveUrl?.trim() || undefined,
      };
    }

    addElement(leaf, targetIndex);
  }, [nodeId, addSection, addSubsection, addElement]);

  // Unified submit dispatcher executing Canvas AST persistence
  const handleModalSubmit = useCallback(async (data: CanvasElementFormData) => {
    if (!activeModal) return;

    const {
      mode,
      elementType,
      itemId,
      editingPageId,
      targetSectionId,
      targetIndex,
      targetSubsectionId,
    } = activeModal;

    if (elementType === 'page-link') {
      if (!portalChrome) {
        throw new Error('Portal workspace is not ready.');
      }

      if (mode === 'add') {
        const beforeParentCanvas = document;
        const beforePages = portalChrome.pages;
        const trimmedSummary = data.summary?.trim();
        const trimmedCover = data.coverImage?.trim();
        const { pages: createdPages, page: newPage } = createPageNode(beforePages, {
          parentId: nodeId,
          title: data.title?.trim() || 'Untitled Page',
          slug: data.slug?.trim(),
          ...(trimmedSummary ? { summary: trimmedSummary } : {}),
          ...(trimmedCover ? { coverImage: trimmedCover } : {}),
        });
        const newSubpageCanvas = createDefaultCanvasDocument(newPage.id);
        const newCard = createDefaultPageLink(newPage.id);

        const nextParentCanvas = insertCanvasElement(
          beforeParentCanvas,
          newCard,
          targetIndex
        );

        const { pages: finalPages } = deriveSubpageOrderFromCanvas(
          createdPages,
          nodeId,
          nextParentCanvas
        );

        await portalChrome.commitWorkspaceMutation({
          canvases: {
            [nodeId]: nextParentCanvas,
            [newPage.id]: newSubpageCanvas,
          },
          pages: finalPages,
        });

        pushAction(
          createWorkspaceUndoAction({
            type: 'page_create',
            description: `Add page "${newPage.title}"`,
            before: {
              canvases: { [nodeId]: beforeParentCanvas },
              pages: beforePages,
              deletedPageIds: [newPage.id],
            },
            after: {
              canvases: {
                [nodeId]: nextParentCanvas,
                [newPage.id]: newSubpageCanvas,
              },
              pages: finalPages,
            },
            getLockToken: () => lockToken ?? null,
          })
        );

        setActiveModal(null);
        return;
      }

      if (mode === 'edit' && editingPageId) {
        const beforePages = portalChrome.pages;
        const trimmedSummary = data.summary?.trim();
        const trimmedCover = data.coverImage?.trim();
        const { pages: nextPages, page: updatedPage } = updatePageNodeMetadata(
          beforePages,
          editingPageId,
          {
            title: data.title?.trim() || 'Untitled Page',
            slug: data.slug?.trim(),
            summary: trimmedSummary ?? '',
            coverImage: trimmedCover || undefined,
          }
        );

        await portalChrome.commitWorkspaceMutation({
          pages: nextPages,
        });

        pushAction(
          createWorkspaceUndoAction({
            type: 'page_update_metadata',
            description: `Update page "${updatedPage.title}"`,
            before: { pages: beforePages },
            after: { pages: nextPages },
            getLockToken: () => lockToken ?? null,
          })
        );

        setActiveModal(null);
        return;
      }
    }

    if (mode === 'add') {
      handleExecuteAdd(elementType, data, targetSectionId, targetIndex, targetSubsectionId);
      setActiveModal(null);
      return;
    }

    // mode === 'edit': Canvas AST is the sole authority
    if (elementType === 'section' && itemId) {
      updateItem<SectionElement>(itemId, {
        title: data.title?.trim(),
        isNumbered: data.isNumbered !== false,
      });
    } else if (elementType === 'subsection' && itemId) {
      updateItem<SubsectionElement>(itemId, {
        title: data.title?.trim(),
      });
    } else if (elementType === 'text' && itemId) {
      updateItem<TextElement>(itemId, {
        content: data.content?.trim(),
        as: data.as || 'p',
      });
    } else if (elementType === 'photo' && itemId) {
      updateItem<PhotoElement>(itemId, {
        src: data.src?.trim() || undefined,
        alt: data.alt?.trim() || undefined,
        caption: data.caption?.trim() || undefined,
        driveUrl: data.driveUrl?.trim() || undefined,
      });
    } else if (elementType === 'gallery' && itemId) {
      updateItem<GalleryElement>(itemId, {
        title: data.title?.trim() || undefined,
        driveUrl: data.driveUrl?.trim() || undefined,
      });
    } else if (elementType === 'pdf' && itemId) {
      updateItem<PdfElement>(itemId, buildPdfElementFields(data));
    }

    setActiveModal(null);
  }, [activeModal, document, lockToken, nodeId, portalChrome, pushAction, updateItem, handleExecuteAdd]);

  // Gallery Element dynamic update handler (fail-stop KV persistence)
  const handleUpdateGallery = useCallback(
    (itemId: string, updates: GalleryElementUpdates) => {
      const cleanUpdates: Partial<GalleryElement> = {};
      if ('driveUrl' in updates) {
        cleanUpdates.driveUrl = updates.driveUrl?.trim() || undefined;
      }
      if ('title' in updates) {
        cleanUpdates.title = updates.title?.trim() || undefined;
      }
      if ('subtitle' in updates) {
        cleanUpdates.subtitle = updates.subtitle?.trim() || undefined;
      }
      if ('description' in updates) {
        cleanUpdates.description = updates.description?.trim() || undefined;
      }
      if ('lastVerified' in updates) {
        cleanUpdates.lastVerified = updates.lastVerified;
      }
      if ('syncedPhotos' in updates) {
        cleanUpdates.syncedPhotos = updates.syncedPhotos;
      }
      return updateItem<GalleryElement>(itemId, cleanUpdates);
    },
    [updateItem]
  );

  // Documents Element dynamic update handler (fail-stop KV persistence)
  const handleUpdateDocuments = useCallback(
    (itemId: string, updates: DocumentsElementUpdates) => {
      const cleanUpdates: Partial<DocumentsElement> = {};
      if ('driveUrl' in updates) {
        cleanUpdates.driveUrl = updates.driveUrl?.trim() || undefined;
      }
      if ('title' in updates) {
        cleanUpdates.title = updates.title?.trim() || undefined;
      }
      if ('subtitle' in updates) {
        cleanUpdates.subtitle = updates.subtitle?.trim() || undefined;
      }
      if ('description' in updates) {
        cleanUpdates.description = updates.description?.trim() || undefined;
      }
      if ('lastVerified' in updates) {
        cleanUpdates.lastVerified = updates.lastVerified;
      }
      if ('syncedDocuments' in updates) {
        cleanUpdates.syncedDocuments = updates.syncedDocuments;
      }
      return updateItem<DocumentsElement>(itemId, cleanUpdates);
    },
    [updateItem]
  );

  // Reset to default handler for edit mode
  const handleResetModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  // Drag-and-drop relocation handler
  const handleDropItem = useCallback((
    sourceItemId: string,
    targetContainerId: string,
    targetIndex?: number
  ) => {
    relocateItem(sourceItemId, targetContainerId, targetIndex);
  }, [relocateItem]);


  const validElements = (document?.elements || []).filter(
    (el): el is typeof el => Boolean(el && el.id && el.type)
  );

  // Subtask 2.8: Zero Flash-of-Baseline — render calm skeleton wireframe on cold load
  if (isHydrating && validElements.length === 0) {
    return <CanvasGhostWireframe nodeId={nodeId} className={className} />;
  }

  // Edge fetch error state: mount red TopErrorBanner at top of viewport; suppress empty notice
  if (!isDevMode && fetchError) {
    return (
      <TopErrorBanner
        message={fetchError}
        nodeTitle={nodeTitle}
        onRetry={retryFetch}
      />
    );
  }

  // Subtask 3.4: Dignified Public Empty Canvas State — render dignified notice in public mode ONLY once hydrated without error
  if (!fetchError && validElements.length === 0 && !isAuthoringActive) {
    return <CanvasEmptyNotice nodeTitle={nodeTitle} accentColor={accentColor} className={className} />;
  }

  return (
    <div
      className={className}
      style={{
        opacity: 1,
        transition: 'opacity var(--duration-normal) var(--ease-out)',
      }}
    >
      {/* Top Insertion Bar (also serves as the empty-canvas starter in Dev Mode) */}
      {isAuthoringActive && (
        <CanvasAddBar
          barId="top-bar"
          activeBarId={activeAddBarId}
          onToggleActive={handleToggleAddBarActive}
          onAddElement={(type) => handleAddElement(type, undefined, 0)}
          accentColor={accentColor}
        />
      )}

      {/* Flat Canvas Elements Loop */}
      {validElements.map((element, idx) => {
        const canMoveUp = idx > 0;
        const canMoveDown = idx < validElements.length - 1;

          if (element.type === 'section') {
            const computedNumber = sectionNumbers[element.id];
            return (
              <React.Fragment key={element.id}>
                <CanvasItemControls
                  itemId={element.id}
                  itemType="section"
                  canMoveUp={canMoveUp}
                  canMoveDown={canMoveDown}
                  onMoveUp={() => moveItem(element.id, 'up')}
                  onMoveDown={() => moveItem(element.id, 'down')}
                  onDelete={() => handleDeleteSection(element, idx)}
                  onEdit={() => handleEditSection(element)}
                  suppressHover={Boolean(activeAddBarId)}
                  sourceParentId={nodeId}
                  sourceIndex={idx}
                  onDropItem={handleDropItem}
                >
                  <CanvasSection
                    section={element}
                    nodeId={nodeId}
                    nodeTitle={nodeTitle}
                    accentColor={accentColor}
                    computedNumber={computedNumber}
                    onEdit={() => handleEditSection(element)}
                  />
                </CanvasItemControls>

                {isAuthoringActive && (
                  <CanvasAddBar
                    barId={`after-${element.id}`}
                    activeBarId={activeAddBarId}
                    onToggleActive={handleToggleAddBarActive}
                    onAddElement={(type) => handleAddElement(type, undefined, idx + 1)}
                    accentColor={accentColor}
                  />
                )}
              </React.Fragment>
            );
          }

          if (element.type === 'subsection') {
            return (
              <React.Fragment key={element.id}>
                <CanvasItemControls
                  itemId={element.id}
                  itemType="subsection"
                  canMoveUp={canMoveUp}
                  canMoveDown={canMoveDown}
                  onMoveUp={() => moveItem(element.id, 'up')}
                  onMoveDown={() => moveItem(element.id, 'down')}
                  onDelete={() => handleDeleteSubsection(element, idx)}
                  onEdit={() => handleEditSubsection(element)}
                  suppressHover={Boolean(activeAddBarId)}
                  sourceParentId={nodeId}
                  sourceIndex={idx}
                  onDropItem={handleDropItem}
                >
                  <CanvasSubsection
                    subsection={element}
                    nodeId={nodeId}
                    accentColor={accentColor}
                    onEdit={() => handleEditSubsection(element)}
                  />
                </CanvasItemControls>

                {isAuthoringActive && (
                  <CanvasAddBar
                    barId={`after-${element.id}`}
                    activeBarId={activeAddBarId}
                    onToggleActive={handleToggleAddBarActive}
                    onAddElement={(type) => handleAddElement(type, undefined, idx + 1)}
                    accentColor={accentColor}
                  />
                )}
              </React.Fragment>
            );
          }

          const leafTargetPage =
            element.type === 'page-link'
              ? portalChrome?.pages?.[element.targetPageId]
              : undefined;
          const leafDescendantCount = leafTargetPage
            ? countDescendantPages(portalChrome?.pages ?? {}, leafTargetPage.id)
            : 0;

          return (
            <React.Fragment key={element.id}>
              <CanvasItemControls
                itemId={element.id}
                itemType={element.type}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onMoveUp={() => moveItem(element.id, 'up')}
                onMoveDown={() => moveItem(element.id, 'down')}
                onDelete={() => handleDeleteLeaf(nodeId, element, idx)}
                onEdit={() => handleEditLeaf(element)}
                suppressHover={Boolean(activeAddBarId)}
                sourceParentId={nodeId}
                sourceIndex={idx}
                targetPageTitle={leafTargetPage?.title}
                descendantPageCount={leafDescendantCount}
                onDropItem={handleDropItem}
              >
                {renderCanvasLeaf(
                  element,
                  nodeId,
                  nodeTitle,
                  accentColor,
                  handleEditPhoto,
                  handleEditLeaf,
                  handleUpdateGallery,
                  updateItem,
                  handleUpdateDocuments,
                  onNavigateToPage
                )}
              </CanvasItemControls>

              {isAuthoringActive && (
                <CanvasAddBar
                  barId={`after-${element.id}`}
                  activeBarId={activeAddBarId}
                  onToggleActive={handleToggleAddBarActive}
                  onAddElement={(type) => handleAddElement(type, undefined, idx + 1)}
                  accentColor={accentColor}
                />
              )}
            </React.Fragment>
          );
        })}

      {/* Undo Toast Notification */}
      {showUndoToast && (
        <Toast
          message="Item deleted"
          type="info"
          durationMs={5000}
          actionLabel="Undo"
          onAction={handleUndoDelete}
          onDismiss={() => {
            setShowUndoToast(false);
          }}
        />
      )}

      {/* Storage Quota Alert Toast */}
      {saveError && (
        <Toast
          message={saveError}
          type="error"
          durationMs={4000}
          onDismiss={clearSaveError}
        />
      )}

      {/* Unified Universal Edit Modal */}
      <UniversalEditModal
        isOpen={Boolean(activeModal)}
        mode={activeModal?.mode ?? 'add'}
        elementType={activeModal?.elementType ?? null}
        nodeId={nodeId}
        itemId={activeModal?.itemId}
        pointId={activeModal?.pointId}
        initialData={activeModal?.initialData}
        targetSectionId={activeModal?.targetSectionId}
        targetIndex={activeModal?.targetIndex}
        targetSubsectionId={activeModal?.targetSubsectionId}
        parentPagePath={parentPagePath}
        parentPageId={nodeId}
        existingPages={portalChrome?.pages}
        editingPageId={activeModal?.editingPageId}
        onClose={() => setActiveModal(null)}
        onSubmit={handleModalSubmit}
        onResetToDefault={handleResetModal}
      />

      {/* Unified Gallery Link Folder Modal */}
      {activeGalleryModal && (
        <LinkFolderModal
          isOpen={activeGalleryModal.isOpen}
          pointId={activeGalleryModal.pointId}
          initialTitle={activeGalleryModal.initialTitle}
          initialUrl={activeGalleryModal.initialUrl}
          onClose={() => setActiveGalleryModal(null)}
          onSuccess={async (newUrl, newTitle) => {
            if (activeGalleryModal.mode === 'add') {
              const isDocs = activeGalleryModal.elementType === 'documents';
              const newId =
                activeGalleryModal.itemId ||
                generateCanvasId(isDocs ? 'documents' : 'gallery');
              const newLeaf: GalleryElement | DocumentsElement = isDocs
                ? {
                  id: newId,
                  type: 'documents',
                  pointId: activeGalleryModal.pointId,
                  title: newTitle.trim() || undefined,
                  titlePointId: `node.${nodeId}.documents.${newId}.title`,
                  driveUrl: newUrl.trim() || undefined,
                }
                : {
                  id: newId,
                  type: 'gallery',
                  pointId: activeGalleryModal.pointId,
                  title: newTitle.trim() || undefined,
                  titlePointId: `node.${nodeId}.gallery.${newId}.title`,
                  driveUrl: newUrl.trim() || undefined,
                };
              const result = await addElement(
                newLeaf,
                activeGalleryModal.targetIndex
              );
              if (result && !result.ok) {
                return result;
              }
            } else if (activeGalleryModal.itemId) {
              const updater =
                activeGalleryModal.elementType === 'documents'
                  ? handleUpdateDocuments
                  : handleUpdateGallery;
              const result = await updater(activeGalleryModal.itemId, {
                driveUrl: newUrl,
                title: newTitle,
              });
              if (result && !result.ok) {
                return result;
              }
            }
            setActiveGalleryModal(null);
          }}
        />
      )}

      {/* Fast-Track Indicator Chart Drawer */}
      {activeChartDrawer && (
        <ChartConfigDrawer
          isOpen={activeChartDrawer.isOpen}
          mode={activeChartDrawer.mode}
          chartId={activeChartDrawer.chartId}
          nodeId={nodeId as NodeCode}
          initialConfig={activeChartDrawer.initialConfig}
          onClose={() => setActiveChartDrawer(null)}
          onDeployed={async (config, dataset) => {
            if (activeChartDrawer.mode === 'add') {
              const chartLeaf: ChartElement = {
                id: generateCanvasId('chart'),
                type: 'chart',
                chartId: activeChartDrawer.chartId,
                title: config.titleOverride || dataset?.title || 'Indicator Chart',
                subtitle: config.subtitleOverride ?? dataset?.subtitle,
                config,
                dataset,
              };
              const result = await addElement(
                chartLeaf,
                activeChartDrawer.targetIndex
              );
              if (result && !result.ok) {
                return result;
              }
            } else if (activeChartDrawer.mode === 'edit' && activeChartDrawer.elementId) {
              const result = await updateItem<ChartElement>(activeChartDrawer.elementId, {
                config,
                ...(dataset ? { dataset } : {}),
                title: config.titleOverride || dataset?.title || 'Indicator Chart',
                subtitle: config.subtitleOverride ?? dataset?.subtitle,
              });
              if (result && !result.ok) {
                return result;
              }
            }
            setActiveChartDrawer(null);
          }}
        />
      )}
    </div>
  );
});

DocumentCanvas.displayName = 'DocumentCanvas';

export default DocumentCanvas;
