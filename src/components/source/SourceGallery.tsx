import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { SourceItem } from '../../types/node';
import type { SyncedSourceItem } from '../../types/source';
import { getSourceSource, normalizePointId } from '../../utils/source';
import { upsertLiveSourceSource } from '../../services/sourceService';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useSourcePoint } from '../../hooks/useSourcePoint';
import { useDrivePhotoSync } from '../../hooks/useDrivePhotoSync';
import { Toast } from '../feedback/Toast';
import { EmptyState } from '../feedback/EmptyState';
import { Button } from '../ui/Button';
import { SourceCard } from './SourceCard';
import { SourceLightbox } from './SourceLightbox';
import { SourceFolderAttachment } from './SourceFolderAttachment';
import { LinkFolderModal } from './LinkFolderModal';
import { EditPhotoModal } from './EditPhotoModal';
import styles from './SourceGallery.module.css';

export interface SourceGalleryProps {
  nodeId: string;
  sourceItems?: SourceItem[];
  accentColor?: string;
  className?: string;
  editTriggerId?: string;
  /** Unique element or gallery identifier for element-level ownership */
  pointId?: string;
  /** Unique gallery ID (alias for pointId if pointId not provided) */
  galleryId?: string;
  /** Direct Google Drive folder URL configured on the gallery element */
  driveUrl?: string;
  /** Direct title configured on the gallery element */
  title?: string;
  /** Callback when gallery element properties (e.g. driveUrl, title) are updated */
  onUpdateGallery?: (updates: { driveUrl?: string; title?: string }) => void;
}

/**
 * SourceGallery Component
 * Task 4.5.5 / Task 5.3 / Task 6.3: Dynamic Evidence Gallery Integration & Coexistence Switch
 * 
 * Primary visual showcase of Means of Verification (MOV) on the dedicated Node page:
 * - Deterministic 5-State Coexistence Switch: Retains curated baseline photos during never_synced
 *   and sync_error; seamlessly renders live Google Drive photos when synced_success.
 * - Confirmed Empty State Differentiation: Displays interactive EmptyState with direct
 *   Google Drive upload CTA when Drive explicitly returns 200 OK with 0 images (synced_empty).
 * - Elevated Folder Header Presentation: Authentic folder title without generic 'Source' pill.
 * - Developer Mode '↻ Sync Photos' Affordance: Manual tactile reconciliation trigger with Toast.
 * - Responsive adaptive card grid (1 col mobile, 2 col tablet/desktop).
 * - Full-screen photo inspection via SourceLightbox orchestration.
 * - Universal Zero Outline Policy & zero horizontal dividing lines.
 */
export const SourceGallery: React.FC<SourceGalleryProps> = ({
  nodeId,
  sourceItems = [],
  accentColor,
  className = '',
  editTriggerId,
  pointId,
  galleryId,
  driveUrl,
  title,
  onUpdateGallery,
}) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeLightboxIndex, setActiveLightboxIndex] = useState(0);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<SourceItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');
  const [isGalleryEditHovered, setIsGalleryEditHovered] = useState(false);

  const { isDevMode, isDesktop } = useDeveloperMode();
  const isDevActive = isDevMode && isDesktop;

  // Automatically close modals if developer mode is exited
  useEffect(() => {
    if (!isDevActive) {
      if (isSourceModalOpen) setIsSourceModalOpen(false);
      if (editingPhoto) setEditingPhoto(null);
    }
  }, [isDevActive, isSourceModalOpen, editingPhoto]);

  // Determine element-level ownership keys
  const galleryKey = pointId || galleryId || '';
  const effectivePointId = galleryKey || nodeId;
  const isElementLevel = Boolean(galleryKey && galleryKey !== nodeId);

  // Retrieve official Google Drive repository metadata via reactive hook
  const primarySourcePoint = useSourcePoint(effectivePointId);

  // Dynamic Google Drive Photo Sync Engine hook strictly keyed to this gallery (no parent fallback)
  const {
    syncedPhotos,
    syncState,
    isSyncing,
    syncPhotos,
    error: syncError,
  } = useDrivePhotoSync(effectivePointId, {
    folderUrl: driveUrl,
    isElementLevel,
  });

  const defaultSource = useMemo(
    () => (!isElementLevel ? getSourceSource(nodeId) : null),
    [nodeId, isElementLevel]
  );
  const sourcePointId = `source.${normalizePointId(effectivePointId)}.source`;

  const currentFolderUrl =
    (driveUrl && driveUrl.trim()) ||
    primarySourcePoint.folderUrl ||
    (!isElementLevel ? defaultSource?.folderUrl || '' : '');

  const currentFolderTitle =
    title ||
    primarySourcePoint.folderTitle ||
    (!isElementLevel ? defaultSource?.folderTitle || 'Official Google Drive Folder' : 'Gallery Folder');

  const hasDriveLink = Boolean(currentFolderUrl && currentFolderUrl.trim().length > 0);

  // Deterministic 5-State Coexistence Resolution (Task 6.3.1)
  const displayItems: SourceItem[] = useMemo(() => {
    if (syncState === 'synced_success' && syncedPhotos.length > 0) {
      return syncedPhotos;
    }
    // Element-level gallery NEVER falls back to parent node's baseline photos!
    if (isElementLevel) {
      return [];
    }
    // Legacy node-level gallery (non-element): fallback to curated baseline
    return sourceItems;
  }, [syncState, syncedPhotos, isElementLevel, sourceItems]);

  const isConfirmedEmpty = syncState === 'synced_empty';
  const hasItems = !isConfirmedEmpty && displayItems.length > 0;

  // Manual Photo Sync Trigger for Developer Mode with Toast reporting (Task 6.3.3)
  const handleManualSync = useCallback(async () => {
    try {
      const stats = await syncPhotos();
      if (stats) {
        if (stats.total === 0) {
          setToastMessage('Sync completed: 0 photos found in the Google Drive folder.');
          setToastType('info');
        } else if (stats.hasChanged) {
          setToastMessage(`Synced ${stats.total} photos (+${stats.added} added, -${stats.removed} removed).`);
          setToastType('success');
        } else {
          setToastMessage(`Gallery is up to date (${stats.total} photos verified).`);
          setToastType('info');
        }
      } else {
        setToastMessage(syncError || 'Sync completed with no changes.');
        setToastType(syncError ? 'error' : 'info');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to sync photos from Google Drive.';
      setToastMessage(msg);
      setToastType('error');
    }
  }, [syncPhotos, syncError]);

  // Coordinator custom photo title and editorial narrative mutation handler
  const handleSavePhotoTitle = useCallback(
    async (
      photoId: string,
      newTitle: string,
      newDate?: string,
      newCaption?: string
    ) => {
      const trimmedTitle = newTitle.trim();
      if (!trimmedTitle) return;

      if (syncedPhotos && syncedPhotos.length > 0) {
        const updatedPhotos: SyncedSourceItem[] = syncedPhotos.map((p) => {
          if (p.id === photoId || p.driveFileId === photoId) {
            return {
              ...p,
              title: trimmedTitle,
              date: newDate || p.date,
              dateStamp: newDate || p.dateStamp,
              isCustomTitle: true,
              photo: {
                ...p.photo,
                src: p.photo?.src || p.fullImageUrl || p.thumbnailUrl || '',
                alt: trimmedTitle,
                caption: newCaption?.trim() || trimmedTitle,
                showCaption: true,
              },
            };
          }
          return p;
        });

        await upsertLiveSourceSource({
          pointId: effectivePointId,
          folderUrl: currentFolderUrl,
          folderTitle: currentFolderTitle,
          syncedPhotos: updatedPhotos,
          updatedBy: 'Coordinator',
        });

        setToastMessage(`Updated photo: "${trimmedTitle}".`);
        setToastType('success');
      } else {
        const updatedPhotos: SyncedSourceItem[] = displayItems.map((item, index) => {
          const isTarget = item.id === photoId || (item as SyncedSourceItem).driveFileId === photoId;
          const finalTitle = isTarget ? trimmedTitle : item.title;
          const finalDate = (isTarget && newDate) ? newDate : ((item as SyncedSourceItem).date || item.dateStamp || '2026-10-09');
          return {
            id: item.id,
            pointId: effectivePointId,
            driveFileId: (item as SyncedSourceItem).driveFileId || item.id,
            originalFileName: (item as SyncedSourceItem).originalFileName || `${item.id}.jpg`,
            title: finalTitle,
            isCustomTitle: isTarget ? true : ((item as SyncedSourceItem).isCustomTitle ?? false),
            orderIndex: index,
            date: finalDate,
            dateStamp: finalDate,
            thumbnailUrl: item.photo?.src || item.imageSrc || '',
            fullImageUrl: item.photo?.src || item.imageSrc || '',
            imageSrc: item.photo?.src || item.imageSrc || '',
            photo: {
              src: item.photo?.src || item.imageSrc || '',
              alt: finalTitle,
              caption: isTarget ? (newCaption?.trim() || finalTitle) : (item.photo?.caption || finalTitle),
              showCaption: true,
            },
          };
        });

        await upsertLiveSourceSource({
          pointId: effectivePointId,
          folderUrl: currentFolderUrl,
          folderTitle: currentFolderTitle,
          syncedPhotos: updatedPhotos,
          updatedBy: 'Coordinator',
        });

        setToastMessage(`Updated photo: "${trimmedTitle}".`);
        setToastType('success');
      }
    },
    [syncedPhotos, displayItems, effectivePointId, currentFolderUrl, currentFolderTitle]
  );

  // Stable event callbacks for lightbox orchestration
  const handleCardClick = useCallback((index: number) => {
    setActiveLightboxIndex(index);
    setIsLightboxOpen(true);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    setIsLightboxOpen(false);
  }, []);

  const handleNavigateLightbox = useCallback((newIndex: number) => {
    setActiveLightboxIndex(newIndex);
  }, []);

  // Adaptive Facebook Photo Collage Partitioning (2-top, 3-bottom with +N overflow)
  const totalCount = displayItems.length;

  const { topRowItems, bottomRowItems } = useMemo(() => {
    if (totalCount === 0) {
      return { topRowItems: [], bottomRowItems: [] };
    }
    if (totalCount === 1) {
      return {
        topRowItems: [{ item: displayItems[0], originalIndex: 0, aspectRatio: 'landscape' as const }],
        bottomRowItems: [],
      };
    }
    if (totalCount === 2) {
      return {
        topRowItems: [
          { item: displayItems[0], originalIndex: 0, aspectRatio: 'landscape' as const },
          { item: displayItems[1], originalIndex: 1, aspectRatio: 'landscape' as const },
        ],
        bottomRowItems: [],
      };
    }
    if (totalCount === 3) {
      return {
        topRowItems: [{ item: displayItems[0], originalIndex: 0, aspectRatio: 'landscape' as const }],
        bottomRowItems: [
          { item: displayItems[1], originalIndex: 1, aspectRatio: 'landscape' as const },
          { item: displayItems[2], originalIndex: 2, aspectRatio: 'landscape' as const },
        ],
      };
    }
    if (totalCount === 4) {
      return {
        topRowItems: [
          { item: displayItems[0], originalIndex: 0, aspectRatio: 'landscape' as const },
          { item: displayItems[1], originalIndex: 1, aspectRatio: 'landscape' as const },
        ],
        bottomRowItems: [
          { item: displayItems[2], originalIndex: 2, aspectRatio: 'landscape' as const },
          { item: displayItems[3], originalIndex: 3, aspectRatio: 'landscape' as const },
        ],
      };
    }
    // totalCount >= 5: 2 on top row, 3 on bottom row (5th item has +N)
    return {
      topRowItems: [
        { item: displayItems[0], originalIndex: 0, aspectRatio: 'landscape' as const },
        { item: displayItems[1], originalIndex: 1, aspectRatio: 'landscape' as const },
      ],
      bottomRowItems: [
        { item: displayItems[2], originalIndex: 2, aspectRatio: 'square' as const },
        { item: displayItems[3], originalIndex: 3, aspectRatio: 'square' as const },
        {
          item: displayItems[4],
          originalIndex: 4,
          aspectRatio: 'square' as const,
          overlayCount: totalCount - 4,
        },
      ],
    };
  }, [displayItems, totalCount]);

  return (
    <div className={`${styles.container} ${className}`.trim()}>
      {/* Adaptive Facebook Photo Collage Grid with Side Edit & Sync Affordances */}
      <div className={styles.galleryCardContainer}>
        <div className={`${styles.galleryCardBody} ${isGalleryEditHovered ? styles.highlightedGallery : ''}`}>
          {hasItems ? (
            <div className={styles.collageContainer}>
              {topRowItems.length > 0 && (
                <div
                  className={`${styles.topRow} ${
                    topRowItems.length === 1 ? styles.topRowSingle : ''
                  }`.trim()}
                >
                  {topRowItems.map((card) => (
                    <SourceCard
                      key={card.item.id}
                      item={card.item}
                      accentColor={accentColor}
                      aspectRatio={card.aspectRatio}
                      hideCaption={true}
                      onClick={() => handleCardClick(card.originalIndex)}
                      onEditPhoto={(targetItem) => setEditingPhoto(targetItem)}
                    />
                  ))}
                </div>
              )}

              {bottomRowItems.length > 0 && (
                <div
                  className={`${styles.bottomRow} ${
                    bottomRowItems.length === 2 ? styles.bottomRowDuo : ''
                  }`.trim()}
                >
                  {bottomRowItems.map((card) => (
                    <SourceCard
                      key={card.item.id}
                      item={card.item}
                      accentColor={accentColor}
                      aspectRatio={card.aspectRatio}
                      hideCaption={true}
                      overlayCount={'overlayCount' in card ? card.overlayCount : undefined}
                      onClick={() => handleCardClick(card.originalIndex)}
                      onEditPhoto={(targetItem) => setEditingPhoto(targetItem)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : isConfirmedEmpty ? (
            <EmptyState
              variant="card"
              title="No Photos Found in Drive Folder"
              description="The linked Google Drive folder does not contain any image files yet. Upload Means of Verification (MOVs) to Google Drive to display them here."
              actionLabel={currentFolderUrl ? 'Open Google Drive to Upload ↗' : undefined}
              onAction={
                currentFolderUrl
                  ? () => {
                      if (typeof window !== 'undefined') {
                        window.open(currentFolderUrl, '_blank', 'noopener,noreferrer');
                      }
                    }
                  : undefined
              }
            />
          ) : syncState === 'sync_error' ? (
            <EmptyState
              variant="card"
              title="Photo Sync Failed"
              description={syncError || 'Photo synchronization failed for this gallery. Check Google Drive folder permissions or connectivity.'}
            />
          ) : !hasDriveLink && isElementLevel ? (
            <EmptyState
              variant="card"
              title="No Google Drive Folder Linked"
              description="This gallery element does not have a Google Drive folder linked. Attach an official Drive folder to sync and display photos."
            />
          ) : (
            <EmptyState
              variant="card"
              title="Evidence Documentation in Progress"
              description="Official Means of Verification (MOVs), activity photos, and completion reports are currently being compiled for this node."
            />
          )}
        </div>

        {isDevActive && (
          <div className={styles.sideEditWrapper}>
            <Button
              type="button"
              variant="admin"
              size="xs"
              data-dev-edit-trigger="true"
              data-canvas-edit-trigger={editTriggerId}
              onClick={() => setIsSourceModalOpen(true)}
              onMouseEnter={() => setIsGalleryEditHovered(true)}
              onMouseLeave={() => setIsGalleryEditHovered(false)}
              className={styles.sideEditBtn}
              title="Edit source photo repository"
              aria-label="Edit source photo repository"
            >
              ✎ Edit
            </Button>
            <Button
              type="button"
              variant="admin"
              size="xs"
              onClick={handleManualSync}
              onMouseEnter={() => setIsGalleryEditHovered(true)}
              onMouseLeave={() => setIsGalleryEditHovered(false)}
              disabled={isSyncing}
              className={styles.sideSyncBtn}
              title="Sync photos from Google Drive"
              aria-label="Sync photos from Google Drive"
            >
              <span className={`${styles.syncIcon} ${isSyncing ? styles.spinning : ''}`} aria-hidden="true">↻</span>
              <span>{isSyncing ? 'Syncing…' : 'Sync'}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <SourceLightbox
          isOpen={isLightboxOpen}
          items={displayItems}
          currentIndex={activeLightboxIndex}
          driveFolderUrl={currentFolderUrl}
          accentColor={accentColor}
          onClose={handleCloseLightbox}
          onNavigate={handleNavigateLightbox}
          onEditSource={() => setIsSourceModalOpen(true)}
          onEditPhoto={(targetItem) => setEditingPhoto(targetItem)}
        />
      )}

      {/* Footer Action Bar: Elevated Evidence Folder Attachment & Developer Sync Controls Below Gallery */}
      {(hasDriveLink || isDevActive) && (
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <SourceFolderAttachment
              pointId={effectivePointId}
              label={currentFolderTitle}
              folderUrl={currentFolderUrl}
              variant="compact"
              accentColor={accentColor}
            />
          </div>

          {isDevActive && hasDriveLink && (
            <div className={styles.footerRight}>
              <button
                type="button"
                className={`${styles.syncButton} ${isSyncing ? styles.syncing : ''}`}
                onClick={handleManualSync}
                disabled={isSyncing}
                title="Reconcile and sync photos from Google Drive"
                aria-label="Sync photos from Google Drive"
              >
                <span className={styles.syncIcon} aria-hidden="true">↻</span>
                <span>{isSyncing ? 'Syncing...' : 'Sync Photos'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dedicated Link Folder Modal for Drive Source */}
      {sourcePointId && (
        <LinkFolderModal
          isOpen={isSourceModalOpen}
          pointId={effectivePointId}
          initialTitle={currentFolderTitle}
          initialUrl={currentFolderUrl}
          onClose={() => setIsSourceModalOpen(false)}
          onSuccess={(newUrl, newTitle) => {
            primarySourcePoint.updateFolder(newUrl, newTitle);
            onUpdateGallery?.({ driveUrl: newUrl, title: newTitle });
          }}
        />
      )}

      {/* Dedicated Edit Photo Modal for Coordinator Custom Titles & Captions */}
      {editingPhoto && (
        <EditPhotoModal
          isOpen={Boolean(editingPhoto)}
          photoItem={editingPhoto}
          onClose={() => setEditingPhoto(null)}
          onSave={handleSavePhotoTitle}
        />
      )}

      {/* Floating Toast for status & feedback */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onDismiss={() => setToastMessage(null)}
        />
      )}
    </div>
  );
};

export default SourceGallery;


