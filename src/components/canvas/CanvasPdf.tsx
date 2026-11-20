import React, { memo, useMemo } from 'react';
import type { PdfElement } from '../../types/canvas';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import {
  buildDrivePreviewUrl,
  buildDriveViewUrl,
  extractDriveFileId,
} from '../../utils/mediaUrl';
import { isAuthoringPlaceholder } from '../../utils/canvasDefaults';
import { Button } from '../ui/Button';
import { DocumentIcon } from '../ui/Icons';
import styles from './CanvasPdf.module.css';

export interface CanvasPdfProps {
  element: PdfElement;
  nodeId: string;
  accentColor?: string;
  isDevMode?: boolean;
  className?: string;
  onEdit?: () => void;
}

/**
 * CanvasPdf Component
 * Folio Engine — Subtask 11.2: Inline PDF Viewer & Fallback States
 *
 * Renders a single Google Drive PDF document inline on the Dynamic Canvas:
 * - Embedded Google Drive /preview <iframe> with zero external PDF bundle overhead
 * - Quiet editorial header bar with document title and accessible "Open in New Tab ↗" link
 * - Optional editorial caption below the viewer (suppressing factory placeholders in Public Mode)
 * - Calm, token-styled fallback card when Drive file ID is missing or invalid
 * - Canonical side "✎ Edit" trigger in Developer Mode
 */
export const CanvasPdf: React.FC<CanvasPdfProps> = memo(({
  element,
  isDevMode: isDevProp,
  className,
  onEdit,
}) => {
  const { isDevMode: isDevContext, isDesktop } = useDeveloperMode();
  const isDevActive = isDevProp !== undefined ? isDevProp : Boolean(isDevContext && isDesktop);

  const driveFileId = useMemo(() => {
    return (
      extractDriveFileId(element.driveFileId || '') ||
      extractDriveFileId(element.src || '') ||
      extractDriveFileId(element.driveUrl || '') ||
      null
    );
  }, [element.driveFileId, element.src, element.driveUrl]);

  const previewUrl = useMemo(
    () => (driveFileId ? buildDrivePreviewUrl(driveFileId) : ''),
    [driveFileId]
  );

  const viewUrl = useMemo(
    () => (driveFileId ? buildDriveViewUrl(driveFileId) : (element.driveUrl || '')),
    [driveFileId, element.driveUrl]
  );

  const displayTitle = element.title || 'Official PDF Document';

  const displayCaption = useMemo(() => {
    if (!element.caption || element.showCaption === false) return '';
    if (!isDevActive && isAuthoringPlaceholder(element.caption)) {
      return '';
    }
    return element.caption;
  }, [element.caption, element.showCaption, isDevActive]);

  const isValidPdf = Boolean(driveFileId && previewUrl);

  const renderCardContent = () => {
    if (!isValidPdf) {
      return (
        <div
          className={`${styles.pdfFallbackCard} ${className || ''}`.trim()}
          role="region"
          aria-label="PDF Document Unavailable"
          tabIndex={-1}
        >
          <div className={styles.fallbackInner}>
            <div className={styles.fallbackIconWrapper}>
              <DocumentIcon size={32} />
            </div>

            <p className={styles.fallbackTitle}>
              {element.title || element.caption || 'PDF Document'}
            </p>

            <p className={styles.fallbackNotice}>
              {isDevActive
                ? 'PDF document link missing or invalid. Paste a Google Drive PDF file link (Anyone with the link can view).'
                : 'Official PDF documentation is currently being prepared.'}
            </p>

            {isDevActive && onEdit ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={styles.fallbackEditButton}
                onClick={onEdit}
              >
                ✎ Re-link Document
              </Button>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <div className={`${styles.pdfCard} ${className || ''}`.trim()}>
        <div className={styles.pdfHeader}>
          <div className={styles.pdfTitleGroup}>
            <DocumentIcon className={styles.pdfIcon} size={18} />
            <p className={styles.pdfTitle}>{displayTitle}</p>
          </div>
          <Button
            as="a"
            variant="secondary"
            size="xs"
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open PDF document in new tab: ${displayTitle}`}
          >
            Open in New Tab ↗
          </Button>
        </div>

        <div
          className={styles.iframeFrame}
          style={element.aspectRatio ? { aspectRatio: element.aspectRatio } : undefined}
        >
          <iframe
            src={previewUrl}
            title={displayTitle}
            className={styles.pdfIframe}
            loading="lazy"
            allow="autoplay"
          />
        </div>

        {displayCaption ? (
          <p className={styles.pdfCaption}>{displayCaption}</p>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`${styles.pdfCardContainer} ${className || ''}`.trim()}>
      <div className={styles.pdfCardBody}>
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

CanvasPdf.displayName = 'CanvasPdf';

export default CanvasPdf;
