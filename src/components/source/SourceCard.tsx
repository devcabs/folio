import React, { useCallback } from 'react';
import type { SourceItem, CanonicalPhoto } from '../../types/node';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { SourceImage } from './SourceImage';
import { Button } from '../ui/Button';
import {
  buildEdgeMediaUrl,
  buildEdgeSrcSet,
  extractDriveFileId,
} from '../../utils/mediaUrl';
import styles from './SourceCard.module.css';

export interface SourceCardProps {
  item: SourceItem;
  accentColor?: string;
  onClick?: (item: SourceItem) => void;
  onEditTitle?: (item: SourceItem) => void;
  onEditPhoto?: (item: SourceItem) => void;
  disabled?: boolean;
  className?: string;
  overlayCount?: number;
  aspectRatio?: 'landscape' | 'square' | 'auto';
  hideCaption?: boolean;
}

/**
 * SourceCard Component
 * 
 * Canonical Means of Verification (MOV) Photo Presentation:
 * - Standalone photo card with curved edges
 * - Sourced from official Google Drive repository
 * - Detached editorial caption below the photo (not encased inside the curved edges)
 * - Uniform Administrative Edit Button Standard (strictly '✎ Edit' in Developer Mode)
 * - Restrained typography: photo caption size
 * - 4-State interactive matrix: Default, Hover, Active/Pressed, Focus-Visible, Disabled
 * - Vercel React Best Practices: lazy loading, async decoding, CLS prevention
 * - Universal Zero Outline Policy & zero horizontal divider lines
 * - Optional frosted-glass darkened overlay for collage overflow (+N remaining)
 * - Optional hideCaption to strip filenames/captions and render flush in collage
 */
export const SourceCard: React.FC<SourceCardProps> = ({
  item,
  accentColor,
  onClick,
  onEditTitle,
  onEditPhoto,
  disabled = false,
  className = '',
  overlayCount,
  aspectRatio = 'landscape',
  hideCaption = false,
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();
  const isDevActive = isDevMode && isDesktop;

  const photo: CanonicalPhoto = item.photo ?? {
    src: item.imageSrc || '',
    alt: item.title,
    caption: item.title,
    showCaption: false,
  };

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(item);
    }
  }, [onClick, item]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && onClick) {
        e.preventDefault();
        onClick(item);
      }
    },
    [onClick, item]
  );

  const isClickable = !disabled && Boolean(onClick);
  const hasOverlay = Boolean(overlayCount && overlayCount > 0);
  const captionText = photo.caption ?? item.title;
  const isCaptionVisible = Boolean((hasOverlay || photo.showCaption) && captionText);
  const displayCaption = hasOverlay ? `+${overlayCount} more photos` : captionText;

  const aspectClass =
    aspectRatio === 'square'
      ? styles.aspectSquare
      : aspectRatio === 'auto'
      ? styles.aspectAuto
      : styles.aspectLandscape;

  const cardAriaLabel = isClickable
    ? hasOverlay
      ? `View gallery photos, +${overlayCount} more in archive`
      : `View source photo: ${captionText || item.title}`
    : undefined;

  const customStyle = accentColor
    ? ({ '--card-accent': accentColor } as React.CSSProperties)
    : undefined;

  const driveFileId =
    (item as { driveFileId?: string }).driveFileId ||
    (item.id?.startsWith('drive-') ? item.id.replace(/^drive-/, '') : '') ||
    extractDriveFileId(photo.src || item.imageSrc || '');

  const cardSrc = driveFileId && !photo.src.includes('/api/media/drive/')
    ? buildEdgeMediaUrl(driveFileId, { width: 800 })
    : photo.src;

  const cardSrcSet = driveFileId
    ? buildEdgeSrcSet(driveFileId)
    : undefined;

  const cardSizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px';

  const permanentFallbackSrc = driveFileId
    ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w1600`
    : undefined;

  return (
    <figure
      className={`${styles.sourceFigure} ${hideCaption ? styles.collageItem : ''} ${disabled ? styles.disabled : ''} ${className}`}
      style={customStyle}
    >
      <div
        className={`${styles.photoCard} ${isClickable ? styles.clickable : ''} ${disabled ? styles.disabled : ''}`}
        onClick={isClickable ? handleClick : undefined}
        onKeyDown={isClickable ? handleKeyDown : undefined}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        aria-label={cardAriaLabel}
        aria-disabled={disabled ? true : undefined}
      >
        <div className={`${styles.sourceImageWrapper} ${aspectClass}`}>
          <SourceImage
            src={cardSrc}
            srcSet={cardSrcSet}
            sizes={cardSizes}
            fallbackSrc={permanentFallbackSrc}
            alt={photo.alt || item.title}
            imageClassName={styles.sourceImage}
            loading="lazy"
            decoding="async"
          />
          {hasOverlay && (
            <div className={styles.overflowOverlay} aria-hidden="true">
              <span className={styles.overflowBadge}>+{overlayCount}</span>
            </div>
          )}
        </div>
      </div>

      {!hideCaption && (
        <div className={styles.captionWrapper}>
          {isCaptionVisible && (
            <figcaption className={styles.photoCaption}>
              {displayCaption}
            </figcaption>
          )}

          {isDevActive && (onEditPhoto || onEditTitle) && (
            <Button
              variant="admin"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                if (onEditPhoto) {
                  onEditPhoto(item);
                } else if (onEditTitle) {
                  onEditTitle(item);
                }
              }}
              title="Edit photo details"
              aria-label="Edit photo details"
            >
              ✎ Edit
            </Button>
          )}
        </div>
      )}
    </figure>
  );
};

export default SourceCard;

