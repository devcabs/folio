import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { SourceItem } from '../../types/node';
import { useLightboxHistory } from '../../hooks/useLightboxHistory';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { Button } from '../ui/Button';
import { SourceImage } from './SourceImage';
import { LightboxPhotoStrip } from './LightboxPhotoStrip';
import { buildEdgeMediaUrl, extractDriveFileId } from '../../utils/mediaUrl';
import styles from './SourceLightbox.module.css';

export interface SourceLightboxProps {
  isOpen: boolean;
  items: SourceItem[];
  currentIndex: number;
  driveFolderUrl?: string;
  accentColor?: string;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  onEditSource?: () => void;
  onEditPhoto?: (item: SourceItem) => void;
}

/**
 * SourceLightbox Component
 * 
 * Canonical Means of Verification (MOV) Photo Lightbox Modal:
 * - Browser & hardware Back button synchronization (returns to source page scroll position)
 * - Native mobile gallery conventions: touch swipe left/right, pull-down dismiss
 * - Double-click / double-tap zoom toggle (1.5x)
 * - Single click chrome toggle for distraction-free inspection
 * - Intrinsic aspect ratio preservation (object-fit: contain)
 * - Scrollbar-compensated body scroll lock
 * - ARIA live region announcing photo changes for screen readers
 * - Universal Zero Outline Policy across all interactive states
 */
export const SourceLightbox: React.FC<SourceLightboxProps> = ({
  isOpen,
  items,
  currentIndex,
  driveFolderUrl,
  accentColor,
  onClose,
  onNavigate,
  onEditSource,
  onEditPhoto,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isChromeVisible, setIsChromeVisible] = useState(true);
  const { isDevMode, isDesktop } = useDeveloperMode();
  const isDevActive = isDevMode && isDesktop;
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastClickTimeRef = useRef<number>(0);

  // Synchronize browser history and popstate
  useLightboxHistory({ isOpen, onClose });

  // Safe item bounds check
  const hasItems = items.length > 0;
  const safeIndex = Math.max(0, Math.min(currentIndex, Math.max(0, items.length - 1)));
  const currentItem = hasItems ? items[safeIndex] : null;

  // Reset zoom on slide change
  useEffect(() => {
    setIsZoomed(false);
  }, [safeIndex]);

  // Handle slide navigation
  const handleNext = useCallback(() => {
    if (safeIndex < items.length - 1) {
      onNavigate(safeIndex + 1);
    }
  }, [safeIndex, items.length, onNavigate]);

  const handlePrev = useCallback(() => {
    if (safeIndex > 0) {
      onNavigate(safeIndex - 1);
    }
  }, [safeIndex, onNavigate]);

  // Touch & pointer gesture listeners
  const {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    wasSwipeJustTriggered,
  } = useSwipeGesture({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrev,
    onSwipeDown: onClose,
    minDistance: 45,
    disabled: isZoomed,
  });

  // Body scroll lock with scrollbar compensation
  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element for focus restoration
    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Set focus to the close button
    const focusTimeout = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => {
      window.clearTimeout(focusTimeout);
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;

      // Restore focus
      if (previouslyFocusedElement.current && typeof previouslyFocusedElement.current.focus === 'function') {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isOpen]);

  // Keyboard navigation & Esc dismissal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, handleNext, handlePrev, onClose]);

  const idleTimerRef = useRef<number | null>(null);

  // Auto-hide chrome timer and activity reset
  const resetIdleTimer = useCallback(() => {
    setIsChromeVisible(true);
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = window.setTimeout(() => {
      setIsChromeVisible(false);
    }, 3500);
  }, []);

  // Initialize and clean up idle timer
  useEffect(() => {
    if (!isOpen) return;
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
    };
  }, [isOpen, resetIdleTimer, safeIndex]);

  // Stage interaction: single click toggles chrome, double-click toggles zoom
  const handleStageClick = useCallback((e: React.MouseEvent) => {
    // Suppress click trigger if a swipe was just completed
    if (wasSwipeJustTriggered()) {
      return;
    }

    // Prevent toggle if clicking on interactive buttons or links
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;
    lastClickTimeRef.current = now;

    if (timeSinceLastClick < 300) {
      // Double click: toggle zoom
      setIsZoomed((prev) => !prev);
    } else {
      // Single click: toggle chrome
      setIsChromeVisible((prev) => {
        const next = !prev;
        if (next) {
          resetIdleTimer();
        } else if (idleTimerRef.current) {
          window.clearTimeout(idleTimerRef.current);
        }
        return next;
      });
    }
  }, [resetIdleTimer, wasSwipeJustTriggered]);

  if (!isOpen || !currentItem) {
    return null;
  }

  const imageSrc = currentItem.photo?.src || currentItem.imageSrc || '';
  const imageAlt = currentItem.photo?.alt || currentItem.title;
  const captionText = currentItem.photo?.caption || currentItem.title;

  const driveFileId =
    (currentItem as { driveFileId?: string }).driveFileId ||
    (currentItem.id?.startsWith('drive-') ? currentItem.id.replace(/^drive-/, '') : '') ||
    extractDriveFileId(imageSrc);

  const highResSrc = driveFileId && !imageSrc.includes('/api/media/drive/')
    ? buildEdgeMediaUrl(driveFileId, { width: 1600 })
    : imageSrc;

  const permanentFallbackSrc = driveFileId
    ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w1600`
    : undefined;

  const content = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo Lightbox"
      className={styles.backdrop}
      onMouseMove={resetIdleTimer}
      onPointerMove={(e) => {
        resetIdleTimer();
        onPointerMove(e);
      }}
      onPointerDown={(e) => {
        resetIdleTimer();
        onPointerDown(e);
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onTouchStart={(e) => {
        resetIdleTimer();
        onTouchStart(e);
      }}
      onTouchMove={(e) => {
        resetIdleTimer();
        onTouchMove(e);
      }}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      style={accentColor ? ({ '--lightbox-accent': accentColor } as React.CSSProperties) : undefined}
    >
      {/* Screen Reader Live Announcement */}
      <div aria-live="polite" className={styles.srOnly}>
        Showing photo {safeIndex + 1} of {items.length}: {captionText}
      </div>

      {/* Top Header Bar */}
      <header className={`${styles.headerBar} ${!isChromeVisible ? styles.chromeHidden : ''}`}>
        {items.length > 1 ? (
          <div className={styles.counterPill}>
            <span>{safeIndex + 1}</span>
            <span>/</span>
            <span>{items.length}</span>
          </div>
        ) : (
          <div />
        )}

        <button
          ref={closeButtonRef}
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close photo lightbox"
        >
          <span className={styles.closeIcon} aria-hidden="true">✕</span>
        </button>
      </header>

      {/* Main Photographic Stage */}
      <div
        className={`${styles.stage} ${isZoomed ? styles.stageZoomed : ''}`}
        onClick={handleStageClick}
      >
        {/* Navigation Chevrons */}
        {safeIndex > 0 && (
          <button
            type="button"
            className={`${styles.navButton} ${styles.navPrev} ${!isChromeVisible ? styles.chromeHidden : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            aria-label="Previous photograph"
          >
            <span className={styles.navIcon} aria-hidden="true">‹</span>
          </button>
        )}

        {safeIndex < items.length - 1 && (
          <button
            type="button"
            className={`${styles.navButton} ${styles.navNext} ${!isChromeVisible ? styles.chromeHidden : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            aria-label="Next photograph"
          >
            <span className={styles.navIcon} aria-hidden="true">›</span>
          </button>
        )}

        <div className={`${styles.imageFrame} ${isZoomed ? styles.imageFrameZoomed : ''}`}>
          <div className={styles.lightboxImageWrapper}>
            <SourceImage
              src={highResSrc}
              fallbackSrc={permanentFallbackSrc}
              alt={imageAlt}
              className={styles.lightboxImage}
              imageClassName={styles.lightboxImage}
              objectFit="contain"
              loading="eager"
              decoding="async"
              showRetry={true}
            />
          </div>
        </div>
      </div>

      {/* Bottom Action Bar: Photo Strip, Caption & Source Link */}
      <footer className={`${styles.footerBar} ${!isChromeVisible ? styles.footerHidden : ''}`}>
        {items.length > 1 && (
          <div className={styles.photoStripWrapper}>
            <LightboxPhotoStrip
              items={items}
              currentIndex={safeIndex}
              accentColor={accentColor}
              onNavigate={onNavigate}
            />
          </div>
        )}

        <div className={styles.footerTopRow}>
          <div className={styles.metadataBlock}>
            <div className={styles.titleRow}>
              <h3 className={styles.photoTitle}>{captionText}</h3>
              {isDevActive && onEditPhoto && (
                <Button
                  type="button"
                  variant="admin"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPhoto(currentItem);
                  }}
                  title="Edit photo details"
                  aria-label="Edit photo details"
                >
                  ✎ Edit
                </Button>
              )}
            </div>
          </div>

          <div className={styles.sourceGroup}>
            {driveFolderUrl && (
              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.driveButton}
                aria-label="Open Google Drive source"
              >
                <span>Source</span>
                <span className={styles.driveIcon} aria-hidden="true">↗</span>
              </a>
            )}

            {isDevActive && onEditSource && (
              <Button
                type="button"
                variant="admin"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSource();
                }}
                title="Edit Google Drive source"
                aria-label="Edit Google Drive source"
              >
                ✎ Edit
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );

  if (typeof document === 'undefined') {
    return content;
  }

  return createPortal(content, document.body);
};

export default SourceLightbox;
