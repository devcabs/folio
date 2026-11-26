import React, { memo, useMemo } from 'react';
import type { VideoElement } from '../../types/canvas';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { resolveSingleVideoUrl } from '../../utils/mediaUrl';
import { isAuthoringPlaceholder } from '../../utils/canvasDefaults';
import { Button } from '../ui/Button';
import { VideoIcon } from '../ui/Icons';
import styles from './CanvasVideo.module.css';

export interface CanvasVideoProps {
  element: VideoElement;
  nodeId: string;
  accentColor?: string;
  isDevMode?: boolean;
  className?: string;
  onEdit?: () => void;
}

/**
 * CanvasVideo Component
 * Folio Engine — Subtask 15.2: Inline Video Player & Fallback States
 *
 * Renders a single YouTube or Google Drive video inline on the Dynamic Canvas:
 * - Embedded youtube-nocookie.com/embed/{id} or Google Drive /preview <iframe>
 * - Quiet editorial header bar with VideoIcon, optional title, and "Open in New Tab ↗" link
 * - Optional editorial caption below the player (suppressing factory placeholders in Public Mode)
 * - Calm, token-styled fallback card in Dev Mode when URL is missing/invalid (hidden in Public Mode)
 * - Canonical side "✎ Edit" trigger in Developer Mode
 */
export const CanvasVideo: React.FC<CanvasVideoProps> = memo(({
  element,
  isDevMode: isDevProp,
  className,
  onEdit,
}) => {
  const { isDevMode: isDevContext, isDesktop } = useDeveloperMode();
  const isDevActive = isDevProp !== undefined ? isDevProp : Boolean(isDevContext && isDesktop);

  const resolvedVideo = useMemo(() => {
    const candidate = element.videoUrl || element.src || '';
    return resolveSingleVideoUrl(candidate);
  }, [element.videoUrl, element.src]);

  const displayTitle = element.title || 'Video';

  const displayCaption = useMemo(() => {
    if (!element.caption || element.showCaption === false) return '';
    if (!isDevActive && isAuthoringPlaceholder(element.caption)) {
      return '';
    }
    return element.caption;
  }, [element.caption, element.showCaption, isDevActive]);

  const isValidVideo = Boolean(resolvedVideo?.embedUrl);

  if (!isValidVideo && !isDevActive) {
    return null;
  }

  const renderCardContent = () => {
    if (!isValidVideo || !resolvedVideo) {
      return (
        <div
          className={`${styles.videoFallbackCard} ${className || ''}`.trim()}
          role="region"
          aria-label="Video Unavailable"
          tabIndex={-1}
        >
          <div className={styles.fallbackInner}>
            <div className={styles.fallbackIconWrapper}>
              <VideoIcon size={32} />
            </div>

            <p className={styles.fallbackTitle}>
              {element.title || element.caption || 'Video'}
            </p>

            <p className={styles.fallbackNotice}>
              Video link missing or invalid. Paste a YouTube or Google Drive video link (Anyone with the link can view).
            </p>

            {onEdit ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={styles.fallbackEditButton}
                onClick={onEdit}
              >
                ✎ Re-link Video
              </Button>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <div className={`${styles.videoCard} ${className || ''}`.trim()}>
        <div className={styles.videoHeader}>
          <div className={styles.videoTitleGroup}>
            <VideoIcon className={styles.videoIcon} size={18} />
            <p className={styles.videoTitle}>{displayTitle}</p>
          </div>
          <Button
            as="a"
            variant="secondary"
            size="xs"
            href={resolvedVideo.viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open video in new tab: ${displayTitle}`}
          >
            Open in New Tab ↗
          </Button>
        </div>

        <div className={styles.iframeFrame}>
          <iframe
            src={resolvedVideo.embedUrl}
            title={displayTitle}
            className={styles.videoIframe}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>

        {displayCaption ? (
          <p className={styles.videoCaption}>{displayCaption}</p>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`${styles.videoCardContainer} ${className || ''}`.trim()}>
      <div className={styles.videoCardBody}>
        {renderCardContent()}
      </div>

      {isDevActive && onEdit ? (
        <div className={styles.sideEditWrapper}>
          <Button
            variant="admin"
            size="xs"
            onClick={onEdit}
            data-dev-edit-trigger="true"
            data-canvas-edit-trigger={element.id}
          >
            ✎ Edit
          </Button>
        </div>
      ) : null}
    </div>
  );
});

CanvasVideo.displayName = 'CanvasVideo';

export default CanvasVideo;
