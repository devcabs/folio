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
} from '../../types/canvas';
import type { NodeCode } from '../../types/node';
import { useDocumentCanvas } from '../../hooks/useNodeCanvas';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { generateCanvasId, createDefaultSection } from '../../utils/canvasDefaults';
import { CanvasSection } from './CanvasSection';
import { CanvasSubsection } from './CanvasSubsection';
import { CanvasText } from './CanvasText';
import { CanvasPhoto } from './CanvasPhoto';
import { CanvasGallery } from './CanvasGallery';
import { CanvasChart } from './CanvasChart';
import { CanvasAddBar } from './CanvasAddBar';
import { CanvasGhostWireframe } from './CanvasGhostWireframe';
import { CanvasEmptyNotice } from './CanvasEmptyNotice';
import { CanvasItemControls } from './CanvasItemControls';
// CanvasElementModal unified canonically into UniversalEditModal
import { UniversalEditModal } from '../dev/UniversalEditModal';
import { ChartConfigDrawer } from '../chart/ChartConfigDrawer';
import { Toast } from '../feedback/Toast';
import { useDynamicCanvasSectionNumbers } from '../../hooks/use-dynamic-section-numbers';

export interface NodeCanvasProps {
  nodeId: string;
  nodeTitle: string;
  accentColor?: string;
  className?: string;
}

interface UndoBackupRecord {
  type: 'section' | 'subsection' | 'leaf';
  section?: SectionElement;
  subsection?: SubsectionElement;
  leaf?: CanvasLeafElement;
  sectionId?: string;
  subsectionId?: string;
  index: number;
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
  onUpdateGallery?: (leafId: string, updates: { driveUrl?: string; title?: string }) => void
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
        />
      );
    case 'chart':
      return (
        <CanvasChart
          element={leaf}
          nodeId={nodeId}
          nodeTitle={nodeTitle}
          accentColor={accentColor}
        />
      );
    default:
      return null;
  }
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
    restoreElement,
    moveItem,
    relocateItem,
    removeItem,
    updateItem,
    saveError,
    clearSaveError,
  } = useDocumentCanvas(nodeId);

  const sectionNumbers = useDynamicCanvasSectionNumbers(nodeId, document?.sections || []);

  const [undoBackup, setUndoBackup] = useState<UndoBackupRecord | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [activeAddBarId, setActiveAddBarId] = useState<string | null>(null);

  // Unified modal and drawer state
  const [activeModal, setActiveModal] = useState<ActiveCanvasModalState | null>(null);
  const [activeChartDrawer, setActiveChartDrawer] = useState<ActiveChartDrawerState | null>(null);


  const handleToggleAddBarActive = useCallback((barId: string, isOpen: boolean) => {
    setActiveAddBarId(isOpen ? barId : null);
  }, []);

  // Deletion Handlers with Toast Undo registration
  const handleDeleteSection = useCallback((section: SectionElement, index: number) => {
    setUndoBackup({
      type: 'section',
      section,
      index,
    });
    removeItem(section.id);
    setShowUndoToast(true);
  }, [removeItem]);

  const handleDeleteSubsection = useCallback((sectionId: string, subsection: SubsectionElement, index: number) => {
    setUndoBackup({
      type: 'subsection',
      subsection,
      sectionId,
      index,
    });
    removeItem(subsection.id, sectionId);
    setShowUndoToast(true);
  }, [removeItem]);

  const handleDeleteLeaf = useCallback((
    sectionId: string,
    leaf: CanvasLeafElement,
    index: number,
    subsectionId?: string
  ) => {
    setUndoBackup({
      type: 'leaf',
      leaf,
      sectionId,
      subsectionId,
      index,
    });
    removeItem(leaf.id, subsectionId || sectionId);
    setShowUndoToast(true);
  }, [removeItem]);

  // Undo Handler restoring the removed item back to its original slot
  const handleUndoDelete = useCallback(() => {
    if (!undoBackup) return;

    if (undoBackup.type === 'section' && undoBackup.section) {
      restoreSection(undoBackup.section, undoBackup.index);
    } else if (undoBackup.type === 'subsection' && undoBackup.subsection && undoBackup.sectionId) {
      restoreSubsection(undoBackup.sectionId, undoBackup.subsection, undoBackup.index);
    } else if (undoBackup.type === 'leaf' && undoBackup.leaf && undoBackup.sectionId) {
      restoreElement(
        undoBackup.sectionId,
        undoBackup.leaf,
        undoBackup.index,
        undoBackup.subsectionId
      );
    }

    setUndoBackup(null);
    setShowUndoToast(false);
  }, [undoBackup, restoreSection, restoreSubsection, restoreElement]);

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
      });
      return;
    }

    if (leaf.type === 'photo') {
      handleEditPhoto(leaf);
      return;
    }

    let initialData: CanvasElementFormData = {};
    let pointId: string | undefined;

    if (leaf.type === 'text') {
      pointId = leaf.pointId;
      initialData = {
        content: leaf.content,
        as: leaf.as || 'p',
      };
    } else if (leaf.type === 'gallery') {
      pointId = leaf.pointId || leaf.titlePointId;
      initialData = {
        title: leaf.title || '',
        driveUrl: leaf.driveUrl || '',
      };
    }

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
        restoreSubsection(targetSectionId, newSub, targetIndex);
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
    }

    setActiveModal(null);
  }, [activeModal, updateItem, handleExecuteAdd]);

  // Gallery Element dynamic update handler
  const handleUpdateGallery = useCallback(
    (itemId: string, updates: { driveUrl?: string; title?: string }) => {
      updateItem<GalleryElement>(itemId, {
        driveUrl: updates.driveUrl?.trim() || undefined,
        title: updates.title?.trim() || undefined,
      });
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


  // Subtask 2.8: Zero Flash-of-Baseline — render calm skeleton wireframe on cold public load
  if (!isDevMode && isHydrating && (!document || document.sections.length === 0)) {
    return <CanvasGhostWireframe nodeId={nodeId} className={className} />;
  }

  // Subtask 3.4: Dignified Public Empty Canvas State — render dignified notice in public mode once hydrated
  if ((!document || document.sections.length === 0) && !isAuthoringActive) {
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
                    {/* Section-Level Initial Insertion Dropzone: Only shown when section has no elements */}
                    {isAuthoringActive && (section.elements || []).length === 0 && (
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
                                  {/* Subsection-Level Initial Insertion Dropzone: Only shown when subsection is empty */}
                                  {isAuthoringActive && validSubLeaves.length === 0 && (
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
                                            handleUpdateGallery
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

                              {isAuthoringActive && (
                                <CanvasAddBar
                                  barId={`sub-${child.id}`}
                                  activeBarId={activeAddBarId}
                                  onToggleActive={handleToggleAddBarActive}
                                  onAddElement={(type) => handleAddElement(type, section.id, childIdx + 1)}
                                  accentColor={accentColor}
                                />
                              )}
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
                                handleUpdateGallery
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
            setUndoBackup(null);
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

      {/* Fast-Track Indicator Chart Drawer */}
      {activeChartDrawer && (
        <ChartConfigDrawer
          isOpen={activeChartDrawer.isOpen}
          mode={activeChartDrawer.mode}
          chartId={activeChartDrawer.chartId}
          nodeId={nodeId as NodeCode}
          onClose={() => setActiveChartDrawer(null)}
          onDeployed={(config: any) => {
            if (activeChartDrawer.mode === 'add') {
              const chartLeaf: ChartElement = {
                id: generateCanvasId('chart'),
                type: 'chart',
                chartId: activeChartDrawer.chartId,
                title: config.titleOverride || 'Indicator Chart',
                subtitle: config.subtitleOverride,
              };
              if (activeChartDrawer.targetSectionId) {
                addElement(
                  activeChartDrawer.targetSectionId,
                  chartLeaf,
                  activeChartDrawer.targetIndex,
                  activeChartDrawer.targetSubsectionId
                );
              } else {
                if (document.sections.length === 0) {
                  const newSec = createDefaultSection(0, nodeId);
                  newSec.elements.push(chartLeaf);
                  restoreSection(newSec, 0);
                } else {
                  const targetSec = (typeof activeChartDrawer.targetIndex === 'number' && activeChartDrawer.targetIndex === 0)
                    ? document.sections[0]
                    : document.sections[Math.min((activeChartDrawer.targetIndex ?? 1) - 1, document.sections.length - 1)];
                  const insertIdx = (typeof activeChartDrawer.targetIndex === 'number' && activeChartDrawer.targetIndex === 0)
                    ? 0
                    : undefined;
                  addElement(targetSec.id, chartLeaf, insertIdx);
                }
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
