import React, { useEffect, useCallback } from 'react';
import type { SyncedDocumentItem } from '../../types/source';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { buildDrivePreviewUrl, buildDriveViewUrl } from '../../utils/mediaUrl';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import styles from './PdfPreviewModal.module.css';

export interface PdfPreviewModalProps {
  isOpen: boolean;
  items: SyncedDocumentItem[];
  currentIndex: number;
  driveFolderUrl?: string;
  accentColor?: string;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  onEditDocument?: (item: SyncedDocumentItem) => void;
}

/**
 * PdfPreviewModal Component
 * Folio Engine — Subtask 11.5: Multi-PDF Folder Preview Modal
 *
 * Consumes canonical <Modal> to preview Google Drive PDFs via /preview <iframe>
 * with Previous/Next navigation, ArrowLeft/ArrowRight keyboard shortcuts,
 * "Open in New Tab ↗" escape hatch, and Developer Mode "✎ Edit" trigger.
 */
export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  items,
  currentIndex,
  driveFolderUrl: _driveFolderUrl,
  accentColor: _accentColor,
  onClose,
  onNavigate,
  onEditDocument,
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();
  const isDevActive = isDevMode && isDesktop;

  const hasItems = items.length > 0;
  const safeIndex = Math.max(0, Math.min(currentIndex, Math.max(0, items.length - 1)));
  const currentItem = hasItems ? items[safeIndex] : null;
  const hasMultiple = items.length > 1;

  const handlePrev = useCallback(() => {
    if (safeIndex > 0) {
      onNavigate(safeIndex - 1);
    }
  }, [safeIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (safeIndex < items.length - 1) {
      onNavigate(safeIndex + 1);
    }
  }, [safeIndex, items.length, onNavigate]);

  useEffect(() => {
    if (!isOpen || !hasMultiple) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, hasMultiple, handleNext, handlePrev]);

  if (!isOpen || !currentItem) {
    return null;
  }

  const previewUrl =
    currentItem.previewUrl || buildDrivePreviewUrl(currentItem.driveFileId);
  const viewUrl =
    currentItem.viewUrl || buildDriveViewUrl(currentItem.driveFileId);
  const displayDate = currentItem.date || currentItem.dateStamp;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={currentItem.title || currentItem.originalFileName || 'PDF Document'}
      maxWidth="960px"
    >
      <div className={styles.modalBody}>
        <div className={styles.toolbar}>
          <div className={styles.metaGroup}>
            {hasMultiple && (
              <StatusPill
                label={`${safeIndex + 1} / ${items.length}`}
                variant="neutral"
                size="sm"
              />
            )}
            {displayDate && (
              <StatusPill label={displayDate} variant="mono" size="sm" />
            )}
          </div>

          <div className={styles.actionsGroup}>
            {hasMultiple && (
              <div className={styles.navGroup}>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={handlePrev}
                  disabled={safeIndex <= 0}
                  aria-label="Previous document"
                >
                  ← Prev
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={handleNext}
                  disabled={safeIndex >= items.length - 1}
                  aria-label="Next document"
                >
                  Next →
                </Button>
              </div>
            )}

            {isDevActive && onEditDocument && (
              <Button
                type="button"
                variant="admin"
                size="xs"
                onClick={() => onEditDocument(currentItem)}
                aria-label="Edit document metadata"
              >
                ✎ Edit
              </Button>
            )}

            <Button
              as="a"
              variant="secondary"
              size="xs"
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${currentItem.title} in new tab`}
            >
              Open in New Tab ↗
            </Button>
          </div>
        </div>

        <div className={styles.iframeFrame}>
          <iframe
            src={previewUrl}
            title={currentItem.title || 'PDF Document Preview'}
            className={styles.pdfIframe}
            allow="autoplay"
          />
        </div>

        {currentItem.caption && (
          <p className={styles.caption}>{currentItem.caption}</p>
        )}
      </div>
    </Modal>
  );
};

export default PdfPreviewModal;
