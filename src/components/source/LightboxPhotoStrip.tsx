import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { SourceItem } from '../../types/node';
import { buildEdgeMediaUrl, extractDriveFileId } from '../../utils/mediaUrl';
import styles from './LightboxPhotoStrip.module.css';

export interface LightboxPhotoStripProps {
  items: SourceItem[];
  currentIndex: number;
  accentColor?: string;
  onNavigate: (newIndex: number) => void;
}

/**
 * LightboxPhotoStrip Component
 * 
 * Renders a bottom thumbnail ribbon inside SourceLightbox allowing users to preview
 * all available photographs in the collection, jump directly to any photograph, and
 * maintain smooth scroll tracking with the active slide.
 * 
 * Design Standards Enforced:
 * - Editorial Restraint: Auto-hides when items.length <= 1 (single photo)
 * - Universal Zero Outline Policy: outline: none across all states
 * - Fluid Centering & Auto-Scroll: Active thumbnail smoothly centered on slide change
 * - Full Screen Reader Accessibility: role="tablist" / role="tab" with descriptive labels
 */
export const LightboxPhotoStrip: React.FC<LightboxPhotoStripProps> = ({
  items,
  currentIndex,
  accentColor,
  onNavigate,
}) => {
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const stripRef = useRef<HTMLDivElement | null>(null);
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);

  const [retriedIndices, setRetriedIndices] = useState<Record<number, boolean>>({});

  // Auto-scroll active thumbnail into center of the visible strip
  useEffect(() => {
    if (activeThumbRef.current) {
      activeThumbRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentIndex]);

  const handleImageError = useCallback((index: number, fallbackUrl?: string) => {
    if (fallbackUrl && !retriedIndices[index]) {
      setRetriedIndices((prev) => ({ ...prev, [index]: true }));
    } else {
      setFailedImages((prev) => ({ ...prev, [index]: true }));
    }
  }, [retriedIndices]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (index < items.length - 1) {
          onNavigate(index + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (index > 0) {
          onNavigate(index - 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        e.stopPropagation();
        onNavigate(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        e.stopPropagation();
        onNavigate(items.length - 1);
      }
    },
    [items.length, onNavigate]
  );

  // Editorial Restraint: Do not render photo strip if there is only 1 photo or none
  if (items.length <= 1) {
    return null;
  }

  return (
    <div
      ref={stripRef}
      role="tablist"
      aria-label="Available photographs"
      className={styles.stripContainer}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => {
        const isActive = index === currentIndex;
        const driveFileId =
          (item as { driveFileId?: string }).driveFileId ||
          (item.id?.startsWith('drive-') ? item.id.replace(/^drive-/, '') : '') ||
          extractDriveFileId(item.photo?.src || item.imageSrc || '');

        const existingThumb = (item as { thumbnailUrl?: string }).thumbnailUrl || item.photo?.src || item.imageSrc || '';
        const baseSrc = driveFileId && !existingThumb.includes('/api/media/drive/')
          ? buildEdgeMediaUrl(driveFileId, { width: 320 })
          : existingThumb;

        const fallbackUrl = driveFileId
          ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w320`
          : undefined;
        const isRetried = retriedIndices[index];
        const effectiveSrc = isRetried && fallbackUrl ? fallbackUrl : baseSrc;
        const captionText = item.photo?.caption || item.title || `Photo ${index + 1}`;
        const hasFailed = failedImages[index];

        return (
          <button
            key={item.id || `thumb-${index}`}
            ref={isActive ? activeThumbRef : null}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Photo ${index + 1} of ${items.length}: ${captionText}`}
            className={`${styles.thumbButton} ${isActive ? styles.thumbActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(index);
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            style={
              isActive && accentColor
                ? ({ '--lightbox-thumb-active-border': accentColor } as React.CSSProperties)
                : undefined
            }
          >
            {effectiveSrc && !hasFailed ? (
              <img
                src={effectiveSrc}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                draggable={false}
                className={styles.thumbImage}
                onError={() => handleImageError(index, fallbackUrl)}
              />
            ) : (
              <span className={styles.thumbFallback} aria-hidden="true">
                {index + 1}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default LightboxPhotoStrip;
