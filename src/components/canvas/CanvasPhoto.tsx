import React, { memo, useState, useCallback, useMemo, useEffect } from 'react';
import type { PhotoElement } from '../../types/canvas';
import type { SourceItem } from '../../types/node';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { SourceLightbox } from '../source/SourceLightbox';
import { LinkFolderModal } from '../source/LinkFolderModal';
import {
  buildEdgeMediaUrl,
  buildEdgeSrcSet,
  extractDriveFileId,
} from '../../utils/mediaUrl';
import styles from './CanvasLeaf.module.css';

export interface CanvasPhotoProps {
  element: PhotoElement;
  nodeId: string;
  accentColor?: string;
  isDevMode?: boolean;
  className?: string;
  onEdit?: () => void;
}

/**
 * CanvasPhoto Component
 * Folio Engine — Task 8.3.2 / Task 10.6 / Task 15.4: Canvas Leaf Elements (Photo)
 *
 * Renders high-resolution source photographic cards on the Dynamic Canvas:
 * - Direct integration with canonical SourceLightbox for full-screen inspection
 * - Responsive edge media proxy delivery (/api/media/drive/:fileId?w=...)
 * - Pre-baked / dynamically derived srcSet and sizes for mobile bandwidth reduction
 * - Loading="lazy", decoding="async", and referrerPolicy="no-referrer"
 * - Graceful fallback to raw Google Drive thumbnail if proxy encounters network interruption
 * - Support for official Google Drive folder link badge ("Drive Folder ↗")
 * - Calm placeholder with camera icon when src is empty
 * - Delegated modal authoring via parent CanvasItemControls toolbar and onEdit prop
 * - Memoized with React.memo (Vercel Best Practice rerender-memo)
 * - Zero parentheses in UI and Universal Zero Outline Policy adherence
 */
export const CanvasPhoto: React.FC<CanvasPhotoProps> = memo(({
  element,
  accentColor,
  isDevMode: isDevProp,
  className,
  onEdit,
}) => {
  const { isDevMode: isDevContext, isDesktop } = useDeveloperMode();
  const isDevActive = Boolean(isDevProp || (isDevContext && isDesktop));

  const currentPhoto = element;

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  // Automatically close folder modal if developer mode is exited
  useEffect(() => {
    if (!isDevActive && isFolderModalOpen) {
      setIsFolderModalOpen(false);
    }
  }, [isDevActive, isFolderModalOpen]);

  const hasPhoto = Boolean(currentPhoto.src && currentPhoto.src.trim().length > 0);
  const hasDrive = Boolean(currentPhoto.driveUrl && currentPhoto.driveUrl.trim().length > 0);

  // Extract Drive alphanumeric ID from rawDriveUrl, src, or folder link
  const driveFileId = useMemo(() => {
    return (
      extractDriveFileId(currentPhoto.rawDriveUrl || '') ||
      extractDriveFileId(currentPhoto.src || '') ||
      extractDriveFileId(currentPhoto.driveUrl || '') ||
      null
    );
  }, [currentPhoto.rawDriveUrl, currentPhoto.src, currentPhoto.driveUrl]);

  // Compute responsive srcSet: consume pre-baked if available, or generate via buildEdgeSrcSet
  const computedSrcSet = useMemo(() => {
    if (currentPhoto.srcSet) return currentPhoto.srcSet;
    if (driveFileId) {
      return buildEdgeSrcSet(driveFileId);
    }
    return undefined;
  }, [currentPhoto.srcSet, driveFileId]);

  const defaultSizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px';
  const computedSizes = currentPhoto.sizes || defaultSizes;

  // Active image src: prefer edge proxy if driveFileId exists and not already edge proxy
  const initialSrc = useMemo(() => {
    if (!currentPhoto.src) return '';
    if (driveFileId && !currentPhoto.src.includes('/api/media/drive/')) {
      return buildEdgeMediaUrl(driveFileId, { width: 800 });
    }
    return currentPhoto.src;
  }, [currentPhoto.src, driveFileId]);

  const [activeImgSrc, setActiveImgSrc] = useState(initialSrc);

  useEffect(() => {
    setActiveImgSrc(initialSrc);
  }, [initialSrc]);

  const handleImageError = useCallback(() => {
    if (driveFileId) {
      const fallbackUrl =
        currentPhoto.rawDriveUrl ||
        `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w1600`;
      if (activeImgSrc !== fallbackUrl) {
        setActiveImgSrc(fallbackUrl);
      }
    }
  }, [driveFileId, currentPhoto.rawDriveUrl, activeImgSrc]);

  const lightboxItems: SourceItem[] = useMemo(() => {
    if (!currentPhoto.src) return [];
    const highResSrc = driveFileId
      ? buildEdgeMediaUrl(driveFileId, { width: 1600 })
      : (currentPhoto.rawDriveUrl || currentPhoto.src);
    return [
      {
        id: element.id,
        driveFileId: driveFileId || undefined,
        title: currentPhoto.caption || currentPhoto.alt || 'Evidence photograph',
        dateStamp: new Date().toISOString().slice(0, 10),
        photo: {
          src: highResSrc,
          alt: currentPhoto.alt || currentPhoto.caption || 'Evidence photograph',
          caption: currentPhoto.caption || '',
          showCaption: Boolean(currentPhoto.caption),
        },
        imageSrc: highResSrc,
      },
    ];
  }, [element.id, driveFileId, currentPhoto.src, currentPhoto.rawDriveUrl, currentPhoto.alt, currentPhoto.caption]);

  const handleOpenLightbox = useCallback(() => {
    if (hasPhoto) {
      setIsLightboxOpen(true);
    }
  }, [hasPhoto]);

  const handleCloseLightbox = useCallback(() => {
    setIsLightboxOpen(false);
  }, []);

  const handleFolderSuccess = useCallback((_newUrl: string) => {
    // Delegated to onEdit and UniversalEditModal
  }, []);

  const renderCardContent = () => {
    if (hasPhoto) {
      return (
        <div className={`${styles.photoCard} ${className || ''}`.trim()}>
          <button
            type="button"
            className={styles.photoButton}
            onClick={handleOpenLightbox}
            aria-label={`View source photograph in full screen: ${currentPhoto.caption || currentPhoto.alt || 'Evidence photo'}`}
          >
            <img
              src={activeImgSrc}
              srcSet={computedSrcSet}
              sizes={computedSizes}
              alt={currentPhoto.alt || currentPhoto.caption || 'Evidence photograph'}
              className={styles.photoImage}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={handleImageError}
              style={currentPhoto.aspectRatio ? { aspectRatio: currentPhoto.aspectRatio } : undefined}
            />
          </button>
          {currentPhoto.caption ? (
            <p className={styles.photoCaption}>{currentPhoto.caption}</p>
          ) : null}
          {hasDrive ? (
            <div className={styles.driveContainer}>
              <a
                href={currentPhoto.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.driveBadge}
                aria-label="Official Google Drive folder"
              >
                Drive Folder ↗
              </a>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div
        className={`${styles.placeholderCard} ${className || ''}`.trim()}
        onClick={isDevActive && onEdit ? onEdit : undefined}
        role={isDevActive && onEdit ? 'button' : undefined}
        tabIndex={isDevActive && onEdit ? 0 : undefined}
        aria-label={isDevActive && onEdit ? 'Click to edit source photo' : undefined}
      >
        <div className={styles.placeholderIconWrapper} aria-hidden="true">
          <svg
            className={styles.cameraIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        <span className={styles.placeholderText}>Evidence photograph pending</span>
        {hasDrive ? (
          <div className={styles.driveContainer}>
            <a
              href={currentPhoto.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.driveBadge}
              aria-label="Official Google Drive folder"
            >
              Drive Folder ↗
            </a>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className={`${styles.photoCardContainer} ${className || ''}`.trim()}>
        <div className={styles.photoCardBody}>
          {renderCardContent()}
        </div>
      </div>

      {hasPhoto && isLightboxOpen ? (
        <SourceLightbox
          isOpen={isLightboxOpen}
          items={lightboxItems}
          currentIndex={0}
          driveFolderUrl={currentPhoto.driveUrl}
          accentColor={accentColor}
          onClose={handleCloseLightbox}
          onNavigate={() => {}}
        />
      ) : null}

      {isDevActive ? (
        <LinkFolderModal
          isOpen={isFolderModalOpen}
          pointId={element.pointId || `canvas.photo.${element.id}`}
          initialTitle={hasDrive ? (currentPhoto.caption || currentPhoto.alt || '') : ''}
          initialUrl={currentPhoto.driveUrl || ''}
          onClose={() => setIsFolderModalOpen(false)}
          onSuccess={handleFolderSuccess}
        />
      ) : null}
    </>
  );
});

CanvasPhoto.displayName = 'CanvasPhoto';

export default CanvasPhoto;
