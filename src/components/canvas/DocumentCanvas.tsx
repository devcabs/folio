import React, { memo, useState, useCallback } from 'react';
import type {
  CanvasElementType,
  CanvasLeafElement,
  CanvasModalMode,
  CanvasModalElementType,
  CanvasElementFormData,
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
import { generateCanvasId, createDefaultSection } from '../../utils/canvasDefaults';
import { resolveSingleDrivePdfUrl } from '../../utils/mediaUrl';
import { CanvasSection } from './CanvasSection';
import { CanvasSubsection } from './CanvasSubsection';
import { CanvasText } from './CanvasText';
import { CanvasPhoto } from './CanvasPhoto';
import { CanvasGallery, type GalleryElementUpdates } from './CanvasGallery';
import { CanvasChart } from './CanvasChart';
import { CanvasPdf } from './CanvasPdf';
import { CanvasDocuments, type DocumentsElementUpdates } from './CanvasDocuments';
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
}

interface ActiveCanvasModalState {
  isOpen: boolean;
  mode: CanvasModalMode;
  elementType: CanvasModalElementType;
  itemId?: string;
  pointId?: string;
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
  ) => Promise<{ ok: boolean; error?: string } | void> | void
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
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();
  const isAuthoringActive = isDevMode && isDesktop;

  const {
    document,
    isHydrating,
    addElement,
    restoreSection,
    restoreSubsection,
    moveItem,
    relocateItem,
    removeItem,
    updateItem,
    saveError,
    clearSaveError,
    fetchError,
    retryFetch,
  } = useDocumentCanvas(nodeId);

  const sectionNumbers = useDynamicCanvasSectionNumbers(nodeId, document?.sections || []);
  const { undo } = useUndoRedo();

  const [showUndoToast, setShowUndoToast] = useState(false);
  const [activeAddBarId, setActiveAddBarId] = useState<string | null>(null);

  // Unified modal and drawer state
  const [activeModal, setActiveModal] = useState<ActiveCanvasModalState | null>(null);
  const [activeGalleryModal, setActiveGalleryModal] = useState<ActiveGalleryModalState | null>(null);
  const [activeChartDrawer, setActiveChartDrawer] = useState<ActiveChartDrawerState | null>(null);


  const handleToggleAddBarActive = useCallback((barId: string, isOpen: boolean) => {
    setActiveAddBarId(isOpen ? barId : null);
  }, []);

  // Deletion Handlers with Toast Undo registration (delegated to UndoRedoContext)
  const handleDeleteSection = useCallback((section: SectionElement, _index: number) => {
    removeItem(section.id);
    setShowUndoToast(true);
  }, [removeItem]);

  const handleDeleteSubsection = useCallback((sectionId: string, subsection: SubsectionElement, _index: number) => {
    removeItem(subsection.id, sectionId);
    setShowUndoToast(true);
  }, [removeItem]);

  const handleDeleteLeaf = useCallback((
    sectionId: string,
    leaf: CanvasLeafElement,
    _index: number,
    subsectionId?: string
  ) => {
    removeItem(leaf.id, subsectionId || sectionId);
    setShowUndoToast(true);
  }, [removeItem]);

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
  }, [handleEditPhoto]);

  // Creation Handler executing upon valid submission in Add Mode
  const handleExecuteAdd = useCallback((
    type: CanvasModalElementType,
    payload: CanvasElementFormData,
    targetSectionId?: string,
    targetIndex?: number,
    targetSubsectionId?: string
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
        elements: [],
      };
      if (targetSectionId) {
        const secIdx = document.sections.findIndex((s) => s.id === targetSectionId);
        if (secIdx !== -1) {
          restoreSection(newSec, secIdx + 1);
          return;
        }
      }
      restoreSection(newSec, targetIndex);
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
        elements: [],
      };
      if (targetSectionId) {
        if (targetSubsectionId) {
          const parentSec = document.sections.find((s) => s.id === targetSectionId);
          const subIdx = parentSec
            ? parentSec.elements.findIndex((el) => el.id === targetSubsectionId)
            : -1;
          restoreSubsection(
            targetSectionId,
            newSub,
            subIdx !== -1 ? subIdx + 1 : undefined
          );
        } else {
          restoreSubsection(targetSectionId, newSub, targetIndex);
        }
      } else if (document.sections.length > 0) {
        const targetSec = (typeof targetIndex === 'number' && targetIndex === 0)
          ? document.sections[0]
          : document.sections[Math.min((targetIndex ?? 1) - 1, document.sections.length - 1)];
        restoreSubsection(targetSec.id, newSub);
      } else {
        const secId = generateCanvasId('section');
        const newSec: SectionElement = {
          id: secId,
          type: 'section',
          title: 'Section 1',
          titlePointId: `node.${nodeId}.section.${secId}.title`,
          isNumbered: true,
          elements: [newSub],
        };
        restoreSection(newSec, 0);
      }
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

    if (targetSectionId) {
      addElement(targetSectionId, leaf, targetIndex, targetSubsectionId);
    } else {
      if (document.sections.length === 0) {
        const newSec = createDefaultSection(0, nodeId);
        newSec.elements.push(leaf);
        restoreSection(newSec, 0);
      } else {
        const targetSec = (typeof targetIndex === 'number' && targetIndex === 0)
          ? document.sections[0]
          : document.sections[Math.min((targetIndex ?? 1) - 1, document.sections.length - 1)];
        const insertIdx = (typeof targetIndex === 'number' && targetIndex === 0)
          ? 0
          : undefined;
        addElement(targetSec.id, leaf, insertIdx);
      }
    }
  }, [nodeId, document.sections, restoreSection, restoreSubsection, addElement]);

  // Unified submit dispatcher executing Canvas AST persistence
  const handleModalSubmit = useCallback((data: CanvasElementFormData) => {
    if (!activeModal) return;

    const { mode, elementType, itemId, targetSectionId, targetIndex, targetSubsectionId } = activeModal;

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
  }, [activeModal, updateItem, handleExecuteAdd]);

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


  // Subtask 2.8: Zero Flash-of-Baseline — render calm skeleton wireframe on cold load
  if (isHydrating && (!document || document.sections.length === 0)) {
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
  if (!fetchError && (!document || document.sections.length === 0) && !isAuthoringActive) {
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
      {document.sections.length === 0 ? (
        <CanvasAddBar
          isInitialStarter={true}
          barId="starter-bar"
          activeBarId={activeAddBarId}
          onToggleActive={handleToggleAddBarActive}
          onAddElement={() => handleAddElement('section')}
          label="Click to add the first Section"
          accentColor={accentColor}
        />
      ) : (
        <>
          {/* Top Section Insertion Bar */}
          {isAuthoringActive && (
            <CanvasAddBar
              barId="top-bar"
              activeBarId={activeAddBarId}
              onToggleActive={handleToggleAddBarActive}
              onAddElement={(type) => handleAddElement(type, undefined, 0)}
              accentColor={accentColor}
            />
          )}

          {/* Dynamic Sections Loop */}
          {document.sections.map((section, secIdx) => {
            const canMoveSecUp = secIdx > 0;
            const canMoveSecDown = secIdx < document.sections.length - 1;
            const computedNumber = sectionNumbers[section.id];

            return (
              <React.Fragment key={section.id}>
                <CanvasItemControls
                  itemId={section.id}
                  itemType="section"
                  canMoveUp={canMoveSecUp}
                  canMoveDown={canMoveSecDown}
                  onMoveUp={() => moveItem(section.id, 'up')}
                  onMoveDown={() => moveItem(section.id, 'down')}
                  onDelete={() => handleDeleteSection(section, secIdx)}
                  onEdit={() => handleEditSection(section)}
                  suppressHover={Boolean(activeAddBarId)}
                  sourceParentId={nodeId}
                  sourceIndex={secIdx}
                  hasChildren={section.elements.length > 0}
                  onDropItem={handleDropItem}
                >
                  <CanvasSection
                    section={section}
                    nodeId={nodeId}
                    nodeTitle={nodeTitle}
                    accentColor={accentColor}
                    computedNumber={computedNumber}
                    onEdit={() => handleEditSection(section)}
                  >
                    {/* Section-Level Post-Header Insertion Bar: Always shown in Dev Mode to allow inserting at index 0 */}
                    {isAuthoringActive && (
                      <CanvasAddBar
                        barId={`sec-top-${section.id}`}
                        activeBarId={activeAddBarId}
                        onToggleActive={handleToggleAddBarActive}
                        onAddElement={(type) => handleAddElement(type, section.id, 0)}
                        accentColor={accentColor}
                      />
                    )}

                    {/* Section Child Elements */}
                    {(section.elements || [])
                      .filter((child): child is typeof child => Boolean(child && child.id && child.type))
                      .map((child, childIdx, validChildren) => {
                        const canMoveChildUp = !(secIdx === 0 && childIdx === 0);
                        const canMoveChildDown = !(
                          secIdx === document.sections.length - 1 &&
                          childIdx === validChildren.length - 1
                        );

                        if (child.type === 'subsection') {
                          const validSubLeaves = (child.elements || []).filter(
                            (subLeaf): subLeaf is typeof subLeaf => Boolean(subLeaf && subLeaf.id && subLeaf.type)
                          );
                          return (
                            <React.Fragment key={child.id}>
                              <CanvasItemControls
                                itemId={child.id}
                                itemType="subsection"
                                canMoveUp={canMoveChildUp}
                                canMoveDown={canMoveChildDown}
                                onMoveUp={() => moveItem(child.id, 'up', section.id)}
                                onMoveDown={() => moveItem(child.id, 'down', section.id)}
                                onDelete={() => handleDeleteSubsection(section.id, child, childIdx)}
                                onEdit={() => handleEditSubsection(child)}
                                suppressHover={Boolean(activeAddBarId)}
                                sourceParentId={section.id}
                                sourceIndex={childIdx}
                                hasChildren={validSubLeaves.length > 0}
                                onDropItem={handleDropItem}
                              >
                                <CanvasSubsection
                                  subsection={child}
                                  nodeId={nodeId}
                                  accentColor={accentColor}
                                  onEdit={() => handleEditSubsection(child)}
                                >
                                  {/* Subsection-Level Post-Header Insertion Bar: Always shown in Dev Mode */}
                                  {isAuthoringActive && (
                                    <CanvasAddBar
                                      barId={`sub-top-${child.id}`}
                                      activeBarId={activeAddBarId}
                                      onToggleActive={handleToggleAddBarActive}
                                      onAddElement={(type) => handleAddElement(type, section.id, 0, child.id)}
                                      accentColor={accentColor}
                                    />
                                  )}

                                  {/* Subsection Leaf Elements */}
                                  {validSubLeaves.map((subLeaf, leafIdx) => {
                                    const canMoveLeafUp = !(secIdx === 0 && childIdx === 0 && leafIdx === 0);
                                    const canMoveLeafDown = !(
                                      secIdx === document.sections.length - 1 &&
                                      childIdx === validChildren.length - 1 &&
                                      leafIdx === validSubLeaves.length - 1
                                    );

                                    return (
                                      <React.Fragment key={subLeaf.id}>
                                        <CanvasItemControls
                                          itemId={subLeaf.id}
                                          itemType={subLeaf.type}
                                          canMoveUp={canMoveLeafUp}
                                          canMoveDown={canMoveLeafDown}
                                          onMoveUp={() => moveItem(subLeaf.id, 'up', child.id)}
                                          onMoveDown={() => moveItem(subLeaf.id, 'down', child.id)}
                                          onDelete={() => handleDeleteLeaf(section.id, subLeaf, leafIdx, child.id)}
                                          onEdit={() => handleEditLeaf(subLeaf)}
                                          suppressHover={Boolean(activeAddBarId)}
                                          sourceParentId={child.id}
                                          sourceIndex={leafIdx}
                                          onDropItem={handleDropItem}
                                        >
                                          {renderCanvasLeaf(
                                            subLeaf,
                                            nodeId,
                                            nodeTitle,
                                            accentColor,
                                            handleEditPhoto,
                                            handleEditLeaf,
                                            handleUpdateGallery,
                                            updateItem,
                                            handleUpdateDocuments
                                          )}
                                        </CanvasItemControls>

                                        {isAuthoringActive && (
                                          <CanvasAddBar
                                            barId={`leaf-${subLeaf.id}`}
                                            activeBarId={activeAddBarId}
                                            onToggleActive={handleToggleAddBarActive}
                                            onAddElement={(type) =>
                                              handleAddElement(type, section.id, leafIdx + 1, child.id)
                                            }
                                            accentColor={accentColor}
                                          />
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </CanvasSubsection>
                              </CanvasItemControls>
                            </React.Fragment>
                          );
                        }

                        // Direct Section Leaf Elements
                        return (
                          <React.Fragment key={child.id}>
                            <CanvasItemControls
                              itemId={child.id}
                              itemType={child.type}
                              canMoveUp={canMoveChildUp}
                              canMoveDown={canMoveChildDown}
                              onMoveUp={() => moveItem(child.id, 'up', section.id)}
                              onMoveDown={() => moveItem(child.id, 'down', section.id)}
                              onDelete={() => handleDeleteLeaf(section.id, child, childIdx)}
                              onEdit={() => handleEditLeaf(child)}
                              suppressHover={Boolean(activeAddBarId)}
                              sourceParentId={section.id}
                              sourceIndex={childIdx}
                              onDropItem={handleDropItem}
                            >
                              {renderCanvasLeaf(
                                child,
                                nodeId,
                                nodeTitle,
                                accentColor,
                                handleEditPhoto,
                                handleEditLeaf,
                                handleUpdateGallery,
                                updateItem,
                                handleUpdateDocuments
                              )}
                            </CanvasItemControls>

                            {isAuthoringActive && (
                              <CanvasAddBar
                                barId={`direct-leaf-${child.id}`}
                                activeBarId={activeAddBarId}
                                onToggleActive={handleToggleAddBarActive}
                                onAddElement={(type) => handleAddElement(type, section.id, childIdx + 1)}
                                accentColor={accentColor}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                  </CanvasSection>
                </CanvasItemControls>
              </React.Fragment>
            );
          })}
        </>
      )}

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
              let result: { ok: boolean; error?: string } | undefined;
              if (activeGalleryModal.targetSectionId) {
                result = await addElement(
                  activeGalleryModal.targetSectionId,
                  newLeaf,
                  activeGalleryModal.targetIndex,
                  activeGalleryModal.targetSubsectionId
                );
              } else if (document.sections.length === 0) {
                const newSec = createDefaultSection(0, nodeId);
                newSec.elements.push(newLeaf);
                result = await restoreSection(newSec, 0);
              } else {
                const targetSec = (typeof activeGalleryModal.targetIndex === 'number' && activeGalleryModal.targetIndex === 0)
                  ? document.sections[0]
                  : document.sections[Math.min((activeGalleryModal.targetIndex ?? 1) - 1, document.sections.length - 1)];
                const insertIdx = (typeof activeGalleryModal.targetIndex === 'number' && activeGalleryModal.targetIndex === 0)
                  ? 0
                  : undefined;
                result = await addElement(targetSec.id, newLeaf, insertIdx);
              }
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
              let result: { ok: boolean; error?: string } | undefined;
              if (activeChartDrawer.targetSectionId) {
                result = await addElement(
                  activeChartDrawer.targetSectionId,
                  chartLeaf,
                  activeChartDrawer.targetIndex,
                  activeChartDrawer.targetSubsectionId
                );
              } else {
                if (document.sections.length === 0) {
                  const newSec = createDefaultSection(0, nodeId);
                  newSec.elements.push(chartLeaf);
                  result = await restoreSection(newSec, 0);
                } else {
                  const targetSec = (typeof activeChartDrawer.targetIndex === 'number' && activeChartDrawer.targetIndex === 0)
                    ? document.sections[0]
                    : document.sections[Math.min((activeChartDrawer.targetIndex ?? 1) - 1, document.sections.length - 1)];
                  const insertIdx = (typeof activeChartDrawer.targetIndex === 'number' && activeChartDrawer.targetIndex === 0)
                    ? 0
                    : undefined;
                  result = await addElement(targetSec.id, chartLeaf, insertIdx);
                }
              }
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
