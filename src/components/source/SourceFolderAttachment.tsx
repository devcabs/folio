import React, { useState, useEffect } from 'react';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { LinkFolderModal } from './LinkFolderModal';
import { StatusPill } from '../ui/StatusPill';
import styles from './SourceFolderAttachment.module.css';

export interface SourceFolderAttachmentProps {
  /** Canonical point or node identifier (e.g. 'access', 'milestone-1') */
  pointId: string;
  /** Custom label override (defaults to folderTitle or 'Official Google Drive Folder') */
  label?: string;
  /** Optional description for editorial variant */
  description?: string;
  /** Visual presentation variant */
  variant?: 'compact' | 'editorial';
  /** Accent color token or hex for seal tinting */
  accentColor?: string;
  /** Optional container class name */
  className?: string;
  /** Explicit Google Drive folder URL from GalleryElement AST */
  folderUrl?: string;
  /** Explicit Google Drive folder title from GalleryElement AST */
  folderTitle?: string;
  /** Callback to persist folder updates to GalleryElement AST */
  onUpdateFolder?: (
    newUrl: string,
    newTitle: string
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
  /** Optional unified edit handler (e.g. from DocumentCanvas) */
  onEdit?: () => void;
}

/**
 * SourceFolderAttachment Component
 * Folio Engine — Subtask 7.8: Self-Contained AST Evidence Folder Anchor
 *
 * Canonical, accessible Means of Verification (MOV) anchor component:
 * - Reads folderUrl, folderTitle, and description strictly from GalleryElement AST props.
 * - Zero ContentDB or legacy client-side registry coupling.
 */
export const SourceFolderAttachment: React.FC<SourceFolderAttachmentProps> = ({
  pointId,
  label,
  description,
  variant = 'compact',
  accentColor,
  className = '',
  folderUrl = '',
  folderTitle = '',
  onUpdateFolder,
  onEdit,
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();
  const isDevActive = isDevMode && isDesktop;
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  // Automatically close modal if developer mode is exited
  useEffect(() => {
    if (!isDevActive && isLinkModalOpen) {
      setIsLinkModalOpen(false);
    }
  }, [isDevActive, isLinkModalOpen]);

  const activeFolderUrl = folderUrl.trim();
  const activeHasFolder = activeFolderUrl.length > 0;
  const displayLabel = label || folderTitle || 'Official Google Drive Folder';

  // If no folder is linked and Developer Mode is NOT active, render nothing (calm minimalism)
  if (!activeHasFolder && !isDevActive) {
    return null;
  }

  const driveIconSvg = (
    <svg
      className={styles.driveIcon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
    </svg>
  );

  const renderAnchorContent = () => {
    if (!activeHasFolder && isDevActive) {
      return (
        <StatusPill
          variant="neutral"
          size="sm"
          icon={driveIconSvg}
          label="Attach Drive Folder"
          title="No Drive folder configured. Use Edit to link an official folder."
          onClick={() => (onEdit ? onEdit() : setIsLinkModalOpen(true))}
        />
      );
    }

    if (variant === 'editorial') {
      const inlineStyle = accentColor ? ({ '--accent': accentColor } as React.CSSProperties) : undefined;
      return (
        <a
          href={activeFolderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.editorial}
          style={inlineStyle}
          aria-label={`Official Google Drive Folder: ${displayLabel}`}
        >
          <div className={styles.editorialContent}>
            <div className={styles.editorialHeader}>
              <span className={styles.verifiedDot} aria-hidden="true" />
              {driveIconSvg}
              <span className={styles.editorialTitle}>{displayLabel}</span>
            </div>
            {description && <span className={styles.editorialDesc}>{description}</span>}
          </div>
          <span className={styles.editorialAction}>
            Inspect MOV Archive <span className={styles.externalIcon} aria-hidden="true">↗</span>
          </span>
        </a>
      );
    }

    // Default: Compact Pill Variant
    return (
      <StatusPill
        variant="link"
        size="sm"
        href={activeFolderUrl}
        icon={driveIconSvg}
        label={displayLabel}
        ariaLabel={`Official Google Drive Folder: ${displayLabel}`}
      />
    );
  };

  return (
    <div className={`${styles.wrapper} ${className}`.trim()}>
      {renderAnchorContent()}

      {isDevActive && !onEdit && (
        <LinkFolderModal
          isOpen={isLinkModalOpen}
          pointId={pointId}
          initialTitle={activeHasFolder ? folderTitle : ''}
          initialUrl={activeFolderUrl}
          onClose={() => setIsLinkModalOpen(false)}
          onSuccess={(newUrl, newTitle) => onUpdateFolder?.(newUrl, newTitle)}
        />
      )}
    </div>
  );
};
