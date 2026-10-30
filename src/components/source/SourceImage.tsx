import React, { useEffect } from 'react';
import { useImageLoader } from '../../hooks/useImageLoader';
import styles from './SourceImage.module.css';

export interface SourceImageProps {
  src?: string;
  fallbackSrc?: string;
  srcSet?: string;
  sizes?: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain';
  showRetry?: boolean;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * SourceImage Component
 * 
 * Fault-tolerant image wrapper with shimmer skeleton placeholders,
 * GPU-accelerated opacity decoding transition, and graceful retry error boundaries.
 * Default performance optimization: loading="lazy", decoding="async", responsive srcSet/sizes.
 */
export const SourceImage: React.FC<SourceImageProps> = ({
  src,
  fallbackSrc,
  srcSet,
  sizes,
  alt = '',
  className = '',
  imageClassName = '',
  aspectRatio,
  objectFit = 'cover',
  showRetry = true,
  loading = 'lazy',
  decoding = 'async',
  onLoad,
  onError,
}) => {
  const { status, isLoading, isLoaded, isError, resolvedSrc, retry } = useImageLoader(src, fallbackSrc);

  useEffect(() => {
    if (isLoaded && onLoad) {
      onLoad();
    }
  }, [isLoaded, onLoad]);

  useEffect(() => {
    if (isError && onError) {
      onError();
    }
  }, [isError, onError]);

  const containerStyle: React.CSSProperties = aspectRatio
    ? { aspectRatio }
    : {};

  return (
    <div
      className={`${styles.imageContainer} ${className}`}
      style={containerStyle}
      data-status={status}
    >
      {isLoading && (
        <div
          className={styles.skeletonShimmer}
          aria-hidden="true"
        />
      )}

      {isError && (
        <div className={styles.errorFallback} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            ⚠
          </span>
          <p className={styles.errorMessage}>Failed to load photo</p>
          {showRetry && (
            <button
              type="button"
              className={styles.retryButton}
              onClick={(e) => {
                e.stopPropagation();
                retry();
              }}
              aria-label="Retry loading photograph"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {resolvedSrc && (
        <img
          src={resolvedSrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          referrerPolicy="no-referrer"
          draggable={false}
          className={`${styles.image} ${isLoaded ? styles.imageLoaded : ''} ${imageClassName}`}
          style={{ objectFit }}
          loading={loading}
          decoding={decoding}
        />
      )}
    </div>
  );
};

export default SourceImage;
