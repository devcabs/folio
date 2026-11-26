import React, { useState, useEffect, useCallback } from 'react';
import type { SyncedDocumentItem } from '../../types/source';
import type { DocumentsLayout } from '../../types/canvas';
import type { DocumentsElementUpdates } from '../canvas/CanvasDocuments';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useDriveDocumentSync } from '../../hooks/useDriveDocumentSync';
import { buildDrivePreviewUrl, buildDriveViewUrl } from '../../utils/mediaUrl';
import { formatDriveSyncError } from '../../utils/driveErrors';
import { EmptyState } from '../feedback/EmptyState';
import { Button } from '../ui/Button';
import { DocumentIcon } from '../ui/Icons';
import { SourceFolderActionBar } from './SourceFolderActionBar';
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
  layout?: DocumentsLayout;
  accentColor?: string;
  className?: string;
  editTriggerId?: string;
  onUpdateDocuments?: (
    updates: DocumentsElementUpdates
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
  onEdit?: () => void;
}

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
  layout = 'list',
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
  const [isEditHovered, setIsEditHovered] = useState(false);

  const { isDevMode, isDesktop, showToast } = useDeveloperMode();
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
          showToast('Sync completed: 0 PDF documents found in the Google Drive folder.', 'info');
        } else if (stats.hasChanged) {
          showToast(`Synced ${stats.total} PDFs (+${stats.added} added, -${stats.removed} removed).`, 'success');
        } else {
          showToast(`Documents are up to date (${stats.total} PDFs verified).`, 'info');
        }
      } else {
        showToast(syncError || 'Sync completed with no changes.', syncError ? 'error' : 'info');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to sync PDFs from Google Drive.';
      showToast(msg, 'error');
    }
  }, [syncDocuments, syncError, showToast]);

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

      showToast(`Updated document: "${trimmedTitle}".`, 'success');
    },
    [syncedDocuments, onUpdateDocuments, showToast]
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
            layout === 'full' ? (
              <div className={styles.documentFullList} role="list" aria-label={currentFolderTitle}>
                {syncedDocuments.map((doc, index) => {
                  const displayDate = doc.date || doc.dateStamp;
                  const viewUrl = doc.viewUrl || buildDriveViewUrl(doc.driveFileId);
                  const previewUrl = doc.previewUrl || buildDrivePreviewUrl(doc.driveFileId);

                  return (
                    <div key={doc.id} role="listitem" className={styles.documentFullCard}>
                      <div className={styles.documentFullHeader}>
                        <div className={styles.rowLeft}>
                          <span className={styles.pdfBadge} aria-hidden="true">
                            <DocumentIcon size={18} />
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
                              onClick={() => setEditingDocument(doc)}
                              aria-label={`Edit ${doc.title}`}
                            >
                              ✎ Edit
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => handleRowClick(index)}
                            aria-label={`Expand ${doc.title} preview`}
                          >
                            Expand ⤢
                          </Button>
                          <Button
                            as="a"
                            variant="secondary"
                            size="xs"
                            href={viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${doc.title} in Google Drive`}
                          >
                            Open ↗
                          </Button>
                        </div>
                      </div>

                      <div className={styles.documentFullFrame}>
                        <iframe
                          src={previewUrl}
                          title={doc.title}
                          className={styles.documentFullIframe}
                          loading="lazy"
                          allow="autoplay"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : layout === 'sm' ? (
              <div className={styles.documentGrid} role="list" aria-label={currentFolderTitle}>
                {syncedDocuments.map((doc, index) => {
                  const displayDate = doc.date || doc.dateStamp;
                  const viewUrl = doc.viewUrl || buildDriveViewUrl(doc.driveFileId);

                  return (
                    <div
                      key={doc.id}
                      role="listitem"
                      className={styles.documentCardSm}
                      tabIndex={0}
                      onClick={() => handleRowClick(index)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(index);
                        }
                      }}
                    >
                      <div className={styles.cardSmTop}>
                        <span className={styles.pdfBadge} aria-hidden="true">
                          <DocumentIcon size={18} />
                        </span>
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
                          <Button
                            as="a"
                            variant="secondary"
                            size="xs"
                            href={viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Open ${doc.title} in Google Drive`}
                          >
                            Open ↗
                          </Button>
                        </div>
                      </div>

                      <div className={styles.cardSmBody}>
                        <span className={styles.cardSmTitle}>{doc.title}</span>
                        {(displayDate || doc.size) && (
                          <div className={styles.rowSubMeta}>
                            {displayDate && <span>{displayDate}</span>}
                            {doc.size && <span>{doc.size}</span>}
                          </div>
                        )}
                      </div>

                      <span className={styles.cardSmCue}>Preview PDF →</span>
                    </div>
                  );
                })}
              </div>
            ) : (
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
                          <DocumentIcon size={18} />
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
                        <Button
                          as="a"
                          variant="secondary"
                          size="xs"
                          href={viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Open ${doc.title} in Google Drive`}
                        >
                          Open ↗
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
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
              description={formatDriveSyncError(effectiveError, 'document')}
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
          <SourceFolderActionBar
            onEdit={() => (onEdit ? onEdit() : setIsSourceModalOpen(true))}
            onSync={handleManualSync}
            isSyncing={isSyncing}
            editTriggerId={editTriggerId}
            editTitle="Edit source document repository"
            syncTitle="Sync documents from Google Drive"
            onHighlightChange={setIsEditHovered}
          />
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
    </div>
  );
};

export default SourceDocuments;
