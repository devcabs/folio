import React, { memo } from 'react';
import type { GalleryElement } from '../../types/canvas';
import type { SyncedSourceItem } from '../../types/source';
import { SourceGallery } from '../source/SourceGallery';
import styles from './CanvasContainers.module.css';

export interface GalleryElementUpdates {
  driveUrl?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  lastVerified?: string;
  syncedPhotos?: SyncedSourceItem[];
}

export interface CanvasGalleryProps {
  element: GalleryElement;
  nodeId: string;
  accentColor?: string;
  className?: string;
  onUpdateGallery?: (
    updates: GalleryElementUpdates
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
}

/**
 * CanvasGallery Component
 * Folio Engine — Subtask 7.8: Self-Contained AST Evidence Gallery
 *
 * Renders full multi-photo source showcase on the Dynamic Canvas:
 * - Reads driveUrl, title, description, lastVerified, and syncedPhotos strictly from GalleryElement AST
 * - Persists all mutations directly onto GalleryElement in NodeCanvasDocument AST (PUT /api/draft)
 * - Zero fallback to static JSON or localStorage
 */
export const CanvasGallery: React.FC<CanvasGalleryProps> = memo(({
  element,
  nodeId,
  accentColor,
  className,
  onUpdateGallery,
}) => {
  return (
    <div className={`${styles.galleryWrapper || ''} ${className || ''}`.trim()}>
      <SourceGallery
        nodeId={nodeId}
        pointId={element.pointId || element.id}
        galleryId={element.id}
        driveUrl={element.driveUrl}
        title={element.title}
        description={element.description}
        lastVerified={element.lastVerified}
        syncedPhotos={element.syncedPhotos}
        accentColor={accentColor}
        editTriggerId={element.id}
        onUpdateGallery={onUpdateGallery}
      />
    </div>
  );
});

CanvasGallery.displayName = 'CanvasGallery';

export default CanvasGallery;
