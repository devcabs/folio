import React, { memo } from 'react';
import type { DocumentsElement, DocumentsLayout } from '../../types/canvas';
import type { SyncedDocumentItem } from '../../types/source';
import { SourceDocuments } from '../source/SourceDocuments';
import styles from './CanvasContainers.module.css';

export interface DocumentsElementUpdates {
  driveUrl?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  lastVerified?: string;
  syncedDocuments?: SyncedDocumentItem[];
  layout?: DocumentsLayout;
}

export interface CanvasDocumentsProps {
  element: DocumentsElement;
  nodeId: string;
  accentColor?: string;
  className?: string;
  onEdit?: () => void;
  onUpdateDocuments?: (
    updates: DocumentsElementUpdates
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
}

/**
 * CanvasDocuments Component
 * Folio Engine — Subtask 11.5: Self-Contained AST PDF Document Folder List
 *
 * Thin AST wrapper binding DocumentsElement to <SourceDocuments>:
 * - Reads driveUrl, title, description, lastVerified, and syncedDocuments strictly from DocumentsElement AST
 * - Persists all mutations directly onto DocumentsElement in NodeCanvasDocument AST (PUT /api/draft)
 */
export const CanvasDocuments: React.FC<CanvasDocumentsProps> = memo(({
  element,
  nodeId,
  accentColor,
  className,
  onEdit,
  onUpdateDocuments,
}) => {
  return (
    <div className={`${styles.galleryWrapper || ''} ${className || ''}`.trim()}>
      <SourceDocuments
        nodeId={nodeId}
        pointId={element.pointId || element.id}
        documentsId={element.id}
        driveUrl={element.driveUrl}
        title={element.title}
        description={element.description}
        lastVerified={element.lastVerified}
        syncedDocuments={element.syncedDocuments}
        layout={element.layout}
        accentColor={accentColor}
        editTriggerId={element.id}
        onUpdateDocuments={onUpdateDocuments}
        onEdit={onEdit}
      />
    </div>
  );
});

CanvasDocuments.displayName = 'CanvasDocuments';

export default CanvasDocuments;
