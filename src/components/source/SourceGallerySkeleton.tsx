import React from 'react';
import styles from './SourceGallerySkeleton.module.css';

export interface SourceGallerySkeletonProps {
  className?: string;
  ariaLabel?: string;
}

/**
 * SourceGallerySkeleton Component
 * Folio Engine — Zero Flash-of-Blank Drive Photo Gallery Shimmer
 *
 * Renders an adaptive 5-cell collage wireframe matching the canonical
 * Facebook-style photo collage geometry during initial SWR background fetch.
 */
export const SourceGallerySkeleton: React.FC<SourceGallerySkeletonProps> = ({
  className = '',
  ariaLabel = 'Loading photo gallery from Google Drive',
}) => {
  return (
    <div
      className={`${styles.skeletonContainer} ${className}`.trim()}
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <div className={styles.topRow} aria-hidden="true">
        <div className={`${styles.cell} ${styles.cellLandscape}`}>
          <div className={styles.shimmer} />
        </div>
        <div className={`${styles.cell} ${styles.cellLandscape}`}>
          <div className={styles.shimmer} />
        </div>
      </div>
      <div className={styles.bottomRow} aria-hidden="true">
        <div className={`${styles.cell} ${styles.cellSquare}`}>
          <div className={styles.shimmer} />
        </div>
        <div className={`${styles.cell} ${styles.cellSquare}`}>
          <div className={styles.shimmer} />
        </div>
        <div className={`${styles.cell} ${styles.cellSquare}`}>
          <div className={styles.shimmer} />
        </div>
      </div>
    </div>
  );
};

export default SourceGallerySkeleton;
