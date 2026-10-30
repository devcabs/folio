import React, { memo, useMemo } from 'react';
import type { GalleryElement } from '../../types/canvas';
import type { SourceItem, NodeItem } from '../../types/node';
import rawNodeData from '../../data/node-nodes.json';
import { SourceGallery } from '../source/SourceGallery';
import styles from './CanvasContainers.module.css';

interface NodeDataShape {
  nodes: NodeItem[];
}

const nodesList: NodeItem[] = Array.isArray(rawNodeData)
  ? (rawNodeData as NodeItem[])
  : ((rawNodeData as unknown as NodeDataShape).nodes || []);

export interface CanvasGalleryProps {
  element: GalleryElement;
  nodeId: string;
  accentColor?: string;
  className?: string;
}

/**
 * CanvasGallery Component
 * Folio Engine — Task 8.9: Canvas Leaf Elements (Photo Gallery)
 *
 * Renders full multi-photo source showcase on the Dynamic Canvas:
 * - Wraps canonical SourceGallery with responsive adaptive collage grid
 * - Integrated Google Drive photo synchronization and full-screen lightbox
 * - Memoized with React.memo for re-render efficiency
 * - 100% token purity and Universal Zero Outline Policy adherence
 */
export const CanvasGallery: React.FC<CanvasGalleryProps> = memo(({
  element,
  nodeId,
  accentColor,
  className,
}) => {
  const sourceItems: SourceItem[] = useMemo(() => {
    const matched = nodesList.find((p) => p.id === nodeId);
    return matched?.sourceItems || [];
  }, [nodeId]);

  return (
    <div className={`${styles.galleryWrapper || ''} ${className || ''}`.trim()}>
      <SourceGallery
        nodeId={nodeId}
        sourceItems={sourceItems}
        accentColor={accentColor}
        editTriggerId={element.id}
      />
    </div>
  );
});

CanvasGallery.displayName = 'CanvasGallery';

export default CanvasGallery;
