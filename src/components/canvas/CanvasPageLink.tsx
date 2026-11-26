import React, { memo, useState, useEffect, useMemo } from 'react';
import type { PageLinkElement, PageLinkCardSize } from '../../types/canvas';
import type { PageNode } from '../../types/page';
import { usePortalChrome } from '../../context/PortalChromeContext';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { getActiveNodes, getEngineConfig } from '../../config/engine.config';
import { buildPagePath } from '../../services/pageTreeService';
import { getPageAndDescendantIds } from '../../utils/pagePhotoPool';
import { usePageShufflePhoto } from '../../hooks/usePageShufflePhoto';
import { resolveSingleDrivePhotoUrl } from '../../utils/mediaUrl';
import { Button } from '../ui/Button';
import { ParametricShape } from '../ui/ParametricShape';
import { ArrowRightIcon } from '../ui/Icons';
import styles from './CanvasPageLink.module.css';

export interface CanvasPageLinkProps {
  element: PageLinkElement;
  nodeId?: string;
  accentColor?: string;
  mediaPosition?: 'left' | 'right';
  onNavigate?: (pageId: string) => void;
  onEdit?: () => void;
  className?: string;
  cardSize?: PageLinkCardSize;
  page?: PageNode;
  isDevMode?: boolean;
}

function resolveCoverImageSrc(rawUrl?: string): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;
  const resolvedDrive = resolveSingleDrivePhotoUrl(trimmed);
  return resolvedDrive?.displayUrl ?? trimmed;
}

/**
 * CanvasPageLink Component
 * Folio Engine — Subtask 13.12: Alternating Editorial Feature Page-Link Card
 *
 * Renders a large, full-width alternating editorial card linking to a nested PageNode:
 * - Resolves live PageNode.title, optional PageNode.summary, optional coverImage, and canonical
 *   folder URL from PortalChromeContext.pages (single authority, never duplicated in AST)
 * - Alternates media left/right via `mediaPosition` for calm editorial rhythm in sequences
 * - Falls back gracefully to Folio's <ParametricShape /> when no coverImage is set or on load error
 * - Public Mode: hides missing targetPageId links completely (returns null)
 * - Dev Mode: renders a calm non-navigable disabled recovery card for missing targets
 */
export const CanvasPageLink: React.FC<CanvasPageLinkProps> = memo(({
  element,
  accentColor,
  mediaPosition = 'left',
  onNavigate,
  onEdit,
  className,
  cardSize,
  page,
  isDevMode: isDevModeProp,
}) => {
  const portalChrome = usePortalChrome();
  const pages = portalChrome?.pages ?? {};
  const targetPage = page ?? pages[element.targetPageId];
  const { isDevMode: devModeFromHook, isDesktop } = useDeveloperMode();
  const effectiveDevMode = isDevModeProp !== undefined ? isDevModeProp : devModeFromHook;
  const isDevActive = Boolean(effectiveDevMode && isDesktop);
  const size = cardSize ?? element.cardSize ?? 'md';

  const coverSrc = resolveCoverImageSrc(targetPage?.coverImage);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [coverSrc]);

  // No cover image: shuffle page photos (stock fallback) every 5s with a crossfade
  const shufflePageIds = useMemo(
    () => getPageAndDescendantIds(element.targetPageId, pages),
    [element.targetPageId, pages]
  );
  const shuffleSrc = usePageShufflePhoto(
    shufflePageIds,
    Boolean(targetPage) && !coverSrc
  );
  const [shuffleState, setShuffleState] = useState<{ current: string | null; previous: string | null }>(() => ({
    current: shuffleSrc,
    previous: null,
  }));
  useEffect(() => {
    setShuffleState((s) =>
      s.current === shuffleSrc ? s : { current: shuffleSrc, previous: s.current }
    );
  }, [shuffleSrc]);

  if (!targetPage) {
    if (!effectiveDevMode) {
      return null;
    }

    return (
      <div className={`${styles.rowWrapper} ${className || ''}`.trim()}>
        <div
          className={`${styles.cardLink} ${styles.cardDisabled}`}
          aria-disabled="true"
          role="region"
          aria-label="Linked subpage unavailable"
        >
          <span className={styles.mediaSlot} aria-hidden="true">
            <ParametricShape
              sides={8}
              waviness={0.12}
              radius={22}
              fill={accentColor || 'var(--folio-primary)'}
            />
          </span>
          <span className={styles.contentSlot}>
            <span className={styles.textBlock}>
              <span className={styles.title}>Linked subpage unavailable</span>
              <span className={styles.summary}>
                Target page no longer exists in draft registry. Remove or undo to restore.
              </span>
            </span>
          </span>
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
  }

  const effectivePages = page ? { ...pages, [page.id]: page } : pages;
  const href = buildPagePath(
    targetPage.id,
    getActiveNodes(),
    effectivePages,
    getEngineConfig()?.basePath || '/'
  );

  if (size === 'sm') {
    return (
      <div className={`${styles.cardSmWrapper} ${className || ''}`.trim()}>
        <a
          href={href}
          className={styles.cardSm}
          onClick={(e) => {
            e.preventDefault();
            onNavigate?.(targetPage.id);
          }}
        >
          {coverSrc && !imageFailed ? (
            <img
              src={coverSrc}
              alt=""
              className={styles.cardSmThumb}
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : shuffleState.current ? (
            <img
              src={shuffleState.current}
              alt=""
              className={styles.cardSmThumb}
              loading="lazy"
              data-shuffle-photo="true"
            />
          ) : (
            <div className={styles.cardSmThumbPlaceholder}>
              <ParametricShape
                sides={8}
                waviness={0.12}
                radius={18}
                fill={accentColor || 'var(--folio-primary)'}
              />
            </div>
          )}

          <div className={styles.cardSmBody}>
            <span className={styles.cardSmTitle}>{targetPage.title}</span>
            {targetPage.summary ? (
              <span className={styles.cardSmSummary}>{targetPage.summary}</span>
            ) : null}
            <span className={styles.cardSmCue}>Read &rarr;</span>
          </div>
        </a>

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
  }

  if (size === 'lg') {
    return (
      <div className={`${styles.cardLgWrapper} ${className || ''}`.trim()}>
        <a
          href={href}
          className={styles.cardLg}
          onClick={(e) => {
            e.preventDefault();
            onNavigate?.(targetPage.id);
          }}
        >
          {coverSrc && !imageFailed ? (
            <img
              src={coverSrc}
              alt=""
              className={styles.cardLgThumb}
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : shuffleState.current ? (
            <img
              src={shuffleState.current}
              alt=""
              className={styles.cardLgThumb}
              loading="lazy"
              data-shuffle-photo="true"
            />
          ) : (
            <div className={styles.cardLgThumbPlaceholder}>
              <ParametricShape
                sides={8}
                waviness={0.12}
                radius={28}
                fill={accentColor || 'var(--folio-primary)'}
              />
            </div>
          )}

          <div className={styles.cardLgBody}>
            <h3 className={styles.cardLgTitle}>{targetPage.title}</h3>
            {targetPage.summary ? (
              <p className={styles.cardLgSummary}>{targetPage.summary}</p>
            ) : null}
          </div>
        </a>

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
  }

  const cardClasses = [
    styles.cardLink,
    mediaPosition === 'right' ? styles.mediaRight : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`${styles.rowWrapper} ${className || ''}`.trim()}>
      <a
        href={href}
        className={cardClasses}
        onClick={(e) => {
          e.preventDefault();
          onNavigate?.(targetPage.id);
        }}
      >
        <span className={styles.mediaSlot} aria-hidden="true">
          {coverSrc && !imageFailed ? (
            <img
              src={coverSrc}
              alt=""
              className={styles.coverImage}
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : shuffleState.current ? (
            <>
              {shuffleState.previous ? (
                <img src={shuffleState.previous} alt="" className={styles.coverImage} />
              ) : null}
              <img
                key={shuffleState.current}
                src={shuffleState.current}
                alt=""
                className={`${styles.coverImage} ${shuffleState.previous ? styles.coverFadeIn : ''}`.trim()}
                data-shuffle-photo="true"
              />
            </>
          ) : (
            <ParametricShape
              sides={8}
              waviness={0.12}
              radius={22}
              fill={accentColor || 'var(--folio-primary)'}
            />
          )}
        </span>

        <span className={styles.contentSlot}>
          <span className={styles.textBlock}>
            <span className={styles.title}>{targetPage.title}</span>
            {targetPage.summary ? (
              <span className={styles.summary}>{targetPage.summary}</span>
            ) : null}
          </span>

          <span className={styles.readCue}>
            <span>Read</span>
            <span className={styles.arrow} aria-hidden="true">
              <ArrowRightIcon size={13} />
            </span>
          </span>
        </span>
      </a>

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

CanvasPageLink.displayName = 'CanvasPageLink';

export default CanvasPageLink;
