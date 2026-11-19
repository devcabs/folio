import React, { useState, useEffect, useCallback } from 'react';
import type { SyncedDocumentItem } from '../../types/source';
import type { DocumentsElementUpdates } from '../canvas/CanvasDocuments';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useDriveDocumentSync } from '../../hooks/useDriveDocumentSync';
import { buildDriveViewUrl } from '../../utils/mediaUrl';
import { Toast } from '../feedback/Toast';
import { EmptyState } from '../feedback/EmptyState';
import { Button } from '../ui/Button';
import { SourceFolderAttachment } from './SourceFolderAttachment';
import { LinkFolderModal } from './LinkFolderModal';
import { PdfPreviewModal } from './PdfPreviewModal';
import { EditDocumentModal } from './EditDocumentModal';
import styles from './SourceDocuments.module.css';

export interface SourceDocumentsProps {
  nodeId: string;
  pointId?: string;
  documentsId?: string;
  driveUrl?: string;
  title?: string;
  description?: string;
  lastVerified?: string;
  syncedDocuments?: SyncedDocumentItem[];
  accentColor?: string;
  className?: string;
  editTriggerId?: string;
  onUpdateDocuments?: (
    updates: DocumentsElementUpdates
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
  onEdit?: () => void;
}

const DocumentBadgeIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

/**
 * SourceDocuments Component
 * Folio Engine — Subtask 11.5: Google Drive PDF Folder Showcase
 *
 * Mirrors SourceGallery for PDF folders:
 * - Deterministic 5-State Coexistence Switch (never_synced, syncing, synced_success, synced_empty, sync_error)
 * - Tactile surface cards separated by gap (zero horizontal dividing lines)
 * - Clicking a row opens <PdfPreviewModal> at that document's index
 * - Single canonical sideEditWrapper in Dev Mode with '✎ Edit' and '↻ Sync'
 */
export const SourceDocuments: React.FC<SourceDocumentsProps> = ({
  nodeId,
  pointId,
  documentsId,
  driveUrl,
  title,
  description,
  syncedDocuments: propSyncedDocuments,
  accentColor,
  className = '',
  editTriggerId,
  onUpdateDocuments,
  onEdit,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<SyncedDocumentItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');
  const [isEditHovered, setIsEditHovered] = useState(false);

  const { isDevMode, isDesktop } = useDeveloperMode();
  const isDevActive = isDevMode && isDesktop;

  useEffect(() => {
    if (!isDevActive) {
      if (isSourceModalOpen) setIsSourceModalOpen(false);
      if (editingDocument) setEditingDocument(null);
    }
  }, [isDevActive, isSourceModalOpen, editingDocument]);

  const docsKey = pointId || documentsId || '';
  const effectivePointId = docsKey || nodeId;
  const isElementLevel = Boolean(docsKey && docsKey !== nodeId);

  const currentFolderUrl = (driveUrl && driveUrl.trim()) || '';
  const currentFolderTitle = title || 'Documents Folder';
  const hasDriveLink = currentFolderUrl.length > 0;

  const handlePersistSyncedDocuments = useCallback(
    (documents: SyncedDocumentItem[], verifiedAt: string) => {
      if (!onUpdateDocuments) return;
      return onUpdateDocuments({
        syncedDocuments: documents,
        lastVerified: verifiedAt,
      });
    },
    [onUpdateDocuments]
  );

  const {
    syncedDocuments,
    syncState,
    isSyncing,
    syncDocuments,
    error: syncError,
    backgroundError,
  } = useDriveDocumentSync(effectivePointId, {
    folderUrl: currentFolderUrl,
    syncedDocuments: propSyncedDocuments,
    isElementLevel,
    autoSync: isDevActive,
    onPersistDocuments: handlePersistSyncedDocuments,
  });

  const effectiveError = syncError || backgroundError;
  const isConfirmedEmpty = syncState === 'synced_empty';
  const hasItems = !isConfirmedEmpty && syncedDocuments.length > 0;

  const handleManualSync = useCallback(async () => {
    try {
      const stats = await syncDocuments();
      if (stats) {
        if (stats.total === 0) {
          setToastMessage('Sync completed: 0 PDF documents found in the Google Drive folder.');
          setToastType('info');
        } else if (stats.hasChanged) {
          setToastMessage(`Synced ${stats.total} PDFs (+${stats.added} added, -${stats.removed} removed).`);
          setToastType('success');
        } else {
          setToastMessage(`Documents are up to date (${stats.total} PDFs verified).`);
          setToastType('info');
        }
      } else {
        setToastMessage(syncError || 'Sync completed with no changes.');
        setToastType(syncError ? 'error' : 'info');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to sync PDFs from Google Drive.';
      setToastMessage(msg);
      setToastType('error');
    }
  }, [syncDocuments, syncError]);

  const handleSaveDocumentDetails = useCallback(
    async (
      documentId: string,
      newTitle: string,
      newDate?: string,
      newCaption?: string
    ) => {
      const trimmedTitle = newTitle.trim();
      if (!trimmedTitle) return;

      const updatedDocuments: SyncedDocumentItem[] = syncedDocuments.map((doc) => {
        if (doc.id === documentId || doc.driveFileId === documentId) {
          return {
            ...doc,
            title: trimmedTitle,
            isCustomTitle: true,
            date: newDate ?? doc.date,
            dateStamp: newDate ?? doc.dateStamp,
            caption: newCaption ?? doc.caption,
          };
        }
        return doc;
      });

      const persistResult = await onUpdateDocuments?.({ syncedDocuments: updatedDocuments });
      if (
        persistResult &&
        typeof persistResult === 'object' &&
        'ok' in persistResult &&
        !persistResult.ok
      ) {
        throw new Error(persistResult.error || 'Failed to save document details to draft KV.');
      }

      setToastMessage(`Updated document: "${trimmedTitle}".`);
      setToastType('success');
    },
    [syncedDocuments, onUpdateDocuments]
  );

  const handleRowClick = useCallback((index: number) => {
    setActivePreviewIndex(index);
    setIsPreviewOpen(true);
  }, []);

  const openFolderInNewTab = useCallback(() => {
    if (currentFolderUrl && typeof window !== 'undefined') {
      window.open(currentFolderUrl, '_blank', 'noopener,noreferrer');
    }
  }, [currentFolderUrl]);

  return (
    <div className={`${styles.container} ${className}`.trim()}>
      <div className={styles.documentsCardContainer}>
        <div
          className={`${styles.documentsCardBody} ${isEditHovered ? styles.highlightedDocuments : ''}`.trim()}
        >
          {hasItems ? (
            <div className={styles.documentList} role="list" aria-label={currentFolderTitle}>
              {syncedDocuments.map((doc, index) => {
                const displayDate = doc.date || doc.dateStamp;
                const viewUrl = doc.viewUrl || buildDriveViewUrl(doc.driveFileId);

                return (
                  <div
                    key={doc.id}
                    role="listitem"
                    className={styles.documentRow}
                    tabIndex={0}
                    onClick={() => handleRowClick(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(index);
                      }
                    }}
                  >
                    <div className={styles.rowLeft}>
                      <span className={styles.pdfBadge} aria-hidden="true">
                        <DocumentBadgeIcon />
                      </span>
                      <div className={styles.rowMeta}>
                        <span className={styles.rowTitle}>{doc.title}</span>
                        {(displayDate || doc.size) && (
                          <div className={styles.rowSubMeta}>
                            {displayDate && <span>{displayDate}</span>}
                            {doc.size && <span>{doc.size}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.rowActions}>
                      {isDevActive && (
                        <Button
                          type="button"
                          variant="admin"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDocument(doc);
                          }}
                          aria-label={`Edit ${doc.title}`}
                        >
                          ✎ Edit
                        </Button>
                      )}
                      <a
                        href={viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.openLink}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Open ${doc.title} in Google Drive`}
                      >
                        Open ↗
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : isSyncing ? (
            <div
              className={styles.skeletonList}
              role="status"
              aria-busy="true"
              aria-label={`Loading documents for ${currentFolderTitle}`}
            >
              <div className={styles.skeletonRow} />
              <div className={styles.skeletonRow} />
              <div className={styles.skeletonRow} />
            </div>
          ) : isConfirmedEmpty ? (
            <EmptyState
              variant="card"
              title="No PDF Documents Found in Drive Folder"
              description="The linked Google Drive folder does not contain any PDF files yet. Upload PDFs to Google Drive to display them here."
              actionLabel={currentFolderUrl ? 'Open Google Drive to Upload ↗' : undefined}
              onAction={currentFolderUrl ? openFolderInNewTab : undefined}
            />
          ) : syncState === 'sync_error' ? (
            <EmptyState
              variant="card"
              title="Document Sync Unavailable"
              description={
                effectiveError?.includes('API Key')
                  ? 'Public Google Drive document synchronization requires an API key or pre-baked snapshot. You can open and view the verified folder directly in Google Drive.'
                  : effectiveError?.includes('403')
                  ? 'Access to this Google Drive folder is restricted. Ensure folder General Access is set to "Anyone with the link can view", or view directly in Google Drive.'
                  : effectiveError?.includes('404')
                  ? 'The linked Google Drive folder could not be found. Check if the folder was moved or deleted.'
                  : effectiveError || 'Document synchronization failed for this folder. Check Google Drive folder permissions or connectivity.'
              }
              actionLabel={currentFolderUrl ? 'Open Google Drive Folder ↗' : undefined}
              onAction={currentFolderUrl ? openFolderInNewTab : undefined}
            />
          ) : !hasDriveLink && isElementLevel ? (
            <EmptyState
              variant="card"
              title="No Google Drive Folder Linked"
              description="This document list does not have a Google Drive folder linked. Attach an official Drive folder to sync and display PDFs."
            />
          ) : (
            <EmptyState
              variant="card"
              title="Google Drive Documents"
              description="Official PDF documents are linked in Google Drive. You can view the verified folder directly."
              actionLabel={currentFolderUrl ? 'Open Google Drive Folder ↗' : undefined}
              onAction={currentFolderUrl ? openFolderInNewTab : undefined}
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
              onClick={() => (onEdit ? onEdit() : setIsSourceModalOpen(true))}
              onMouseEnter={() => setIsEditHovered(true)}
              onMouseLeave={() => setIsEditHovered(false)}
              className={styles.sideEditBtn}
              title="Edit source document repository"
              aria-label="Edit source document repository"
            >
              ✎ Edit
            </Button>
            <Button
              type="button"
              variant="admin"
              size="xs"
              onClick={handleManualSync}
              onMouseEnter={() => setIsEditHovered(true)}
              onMouseLeave={() => setIsEditHovered(false)}
              disabled={isSyncing}
              className={styles.sideSyncBtn}
              title="Sync documents from Google Drive"
              aria-label="Sync documents from Google Drive"
            >
              <span
                className={`${styles.syncIcon} ${isSyncing ? styles.spinning : ''}`.trim()}
                aria-hidden="true"
              >
                ↻
              </span>
              <span>{isSyncing ? 'Syncing…' : 'Sync'}</span>
            </Button>
          </div>
        )}
      </div>

      {isPreviewOpen && (
        <PdfPreviewModal
          isOpen={isPreviewOpen}
          items={syncedDocuments}
          currentIndex={activePreviewIndex}
          driveFolderUrl={currentFolderUrl}
          accentColor={accentColor}
          onClose={() => setIsPreviewOpen(false)}
          onNavigate={setActivePreviewIndex}
          onEditDocument={(targetItem) => setEditingDocument(targetItem)}
        />
      )}

      {(hasDriveLink || isDevActive) && (
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <SourceFolderAttachment
              pointId={effectivePointId}
              label={currentFolderTitle}
              description={description}
              folderUrl={currentFolderUrl}
              folderTitle={currentFolderTitle}
              variant="compact"
              accentColor={accentColor}
              onUpdateFolder={(newUrl, newTitle) =>
                onUpdateDocuments?.({ driveUrl: newUrl, title: newTitle })
              }
              onEdit={onEdit}
            />
          </div>
        </div>
      )}

      {!onEdit && (
        <LinkFolderModal
          isOpen={isSourceModalOpen}
          pointId={effectivePointId}
          initialTitle={currentFolderTitle}
          initialUrl={currentFolderUrl}
          onClose={() => setIsSourceModalOpen(false)}
          onSuccess={(newUrl, newTitle) =>
            onUpdateDocuments?.({ driveUrl: newUrl, title: newTitle })
          }
        />
      )}

      {editingDocument && (
        <EditDocumentModal
          isOpen={Boolean(editingDocument)}
          documentItem={editingDocument}
          onClose={() => setEditingDocument(null)}
          onSave={handleSaveDocumentDetails}
        />
      )}

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

export default SourceDocuments;
