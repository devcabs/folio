import React, { useState, useEffect } from 'react';
import type {
  DevActionAffordanceProps,
  DevEditType,
  DevLinkData,
  DevImageData,
  DevFileData,
} from '../../types/developer';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { setContent, resetContent, getContent, getContentObject } from '../../utils/contentDb';
import { Button } from '../ui/Button';
import { UniversalEditModal } from './UniversalEditModal';
import styles from './DevActionAffordance.module.css';

export const DevActionAffordance: React.FC<DevActionAffordanceProps> = ({
  pointId,
  type = 'text',
  onEditText,
  onEditSource,
  driveUrl,
  currentValue,
  defaultValue,
  onSave,
  onReset,
  children,
  className,
  inline = false,
  isSection,
  isNumbered,
  defaultNumbered,
  onNumberedChange,
  editTriggerId,
}) => {
  const { isDevMode, isDesktop, setHasUnpublishedChanges } = useDeveloperMode();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  // Automatically close edit modal if developer mode is exited
  useEffect(() => {
    if ((!isDevMode || !isDesktop) && isEditModalOpen) {
      setIsEditModalOpen(false);
    }
  }, [isDevMode, isDesktop, isEditModalOpen]);

  // Calm View: Return children directly with zero overhead when not in dev mode
  if (!isDevMode || !isDesktop) {
    return <>{children}</>;
  }

  const effectiveCurrent =
    currentValue !== undefined
      ? currentValue
      : pointId
        ? typeof defaultValue === 'object'
          ? getContentObject(pointId, defaultValue, isDevMode)
          : getContent(pointId, typeof defaultValue === 'string' ? defaultValue : '', isDevMode)
        : '';
  const effectiveDefault = defaultValue !== undefined ? defaultValue : effectiveCurrent;

  const handleEditClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (onEditText) {
      onEditText();
    } else if (pointId) {
      setIsEditModalOpen(true);
    }
  };

  const handleSaveModal = (
    newValue: string,
    _editType?: DevEditType,
    _payload?: DevLinkData | DevImageData | DevFileData
  ) => {
    if (onSave) {
      onSave(newValue);
    } else if (pointId) {
      setContent(pointId, newValue, true);
    }
    setHasUnpublishedChanges(true);
  };

  const handleResetModal = () => {
    if (onReset) {
      onReset();
    } else if (pointId) {
      resetContent(pointId, true);
    }
    setHasUnpublishedChanges(true);
  };

  const initialEditType: DevEditType =
    type === 'image'
      ? 'image'
      : type === 'file'
        ? 'file'
        : type === 'link' || type === 'source'
          ? 'link'
          : 'text';

  if (type === 'source') {
    return (
      <div className={`${styles.wrapper} ${className || ''}`}>
        <div className={styles.controlsBar}>
          <Button
            type="button"
            variant="admin"
            size="xs"
            data-dev-edit-trigger="true"
            data-canvas-edit-trigger={editTriggerId}
            onClick={onEditSource || handleEditClick}
            onMouseEnter={() => setIsButtonHovered(true)}
            onMouseLeave={() => setIsButtonHovered(false)}
            title={`Edit source for ${pointId || 'item'}`}
            aria-label={`Edit source for ${pointId || 'item'}`}
          >
            ✎ Edit
          </Button>
          {driveUrl && (
            <Button
              as="a"
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="admin"
              size="xs"
              className={styles.driveButton}
              title="Open linked Google Drive folder"
            >
              Drive Folder ↗
            </Button>
          )}
        </div>
        <div className={`${styles.textContent} ${isButtonHovered ? styles.highlightedTarget : ''}`}>
          {children}
        </div>
        {pointId && (
          <UniversalEditModal
            isOpen={isEditModalOpen}
            pointId={pointId}
            type={initialEditType}
            currentValue={effectiveCurrent}
            defaultValue={effectiveDefault}
            onSave={handleSaveModal}
            onReset={handleResetModal}
            onClose={() => setIsEditModalOpen(false)}
          />
        )}
      </div>
    );
  }

  if (type === 'indicator') {
    return (
      <div className={`${styles.wrapper} ${className || ''}`}>
        <div className={styles.indicatorBox}>
          <div className={styles.controlsBar}>
            <span className={styles.indicatorSlotBadge}>
              Live Slot · Awaiting Official Indicators
            </span>
          </div>
          {children}
        </div>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <div className={`${styles.imageWrapper} ${className || ''}`}>
        <div
          className={styles.imageBadge}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="admin"
            size="xs"
            data-dev-edit-trigger="true"
            data-canvas-edit-trigger={editTriggerId}
            onClick={handleEditClick}
            onMouseEnter={() => setIsButtonHovered(true)}
            onMouseLeave={() => setIsButtonHovered(false)}
            title={`Edit image for ${pointId || 'item'}`}
            aria-label={`Edit image for ${pointId || 'item'}`}
          >
            ✎ Edit
          </Button>
        </div>
        <div className={`${styles.imageContent} ${isButtonHovered ? styles.highlightedTarget : ''}`}>
          {children}
        </div>
        {pointId && (
          <UniversalEditModal
            isOpen={isEditModalOpen}
            pointId={pointId}
            type="image"
            currentValue={effectiveCurrent}
            defaultValue={effectiveDefault}
            onSave={handleSaveModal}
            onReset={handleResetModal}
            onClose={() => setIsEditModalOpen(false)}
          />
        )}
      </div>
    );
  }

  if (type === 'file' || type === 'link') {
    return (
      <div className={`${styles.inlineWrapper} ${className || ''}`}>
        <span className={`${styles.textContentInline} ${isButtonHovered ? styles.highlightedTarget : ''}`}>
          {children}
        </span>
        <Button
          type="button"
          variant="admin"
          size="xs"
          data-dev-edit-trigger="true"
          data-canvas-edit-trigger={editTriggerId}
          onClick={handleEditClick}
          onMouseEnter={() => setIsButtonHovered(true)}
          onMouseLeave={() => setIsButtonHovered(false)}
          title={`Edit ${type} for ${pointId || 'item'}`}
          aria-label={`Edit ${type} for ${pointId || 'item'}`}
        >
          ✎ Edit
        </Button>
        {pointId && (
          <UniversalEditModal
            isOpen={isEditModalOpen}
            pointId={pointId}
            type={initialEditType}
            currentValue={effectiveCurrent}
            defaultValue={effectiveDefault}
            onSave={handleSaveModal}
            onReset={handleResetModal}
            onClose={() => setIsEditModalOpen(false)}
          />
        )}
      </div>
    );
  }

  const hasVisibleChildren = React.Children.toArray(children).some((child) => {
    if (typeof child === 'string') return child.trim().length > 0;
    if (typeof child === 'number') return true;
    if (React.isValidElement(child)) {
      const elProps = (child.props || {}) as { children?: React.ReactNode };
      if (elProps.children) {
        if (typeof elProps.children === 'string') return elProps.children.trim().length > 0;
        return true;
      }
      return true;
    }
    return false;
  });

  const isPlaceholderText =
    typeof effectiveCurrent === 'string' &&
    (effectiveCurrent === 'Click Edit to add narrative text for this section.' ||
      effectiveCurrent === 'Enter narrative text here...' ||
      effectiveCurrent === 'Evidence photograph pending' ||
      effectiveCurrent === 'Narrative text pending');

  const isEmptyText =
    type === 'text' &&
    (!effectiveCurrent || String(effectiveCurrent).trim().length === 0 || isPlaceholderText) &&
    (!hasVisibleChildren || isPlaceholderText);

  // Inline Text Variant
  if (inline) {
    return (
      <span className={`${styles.inlineWrapper} ${className || ''}`}>
        <span className={`${styles.textContentInline} ${isButtonHovered ? styles.highlightedTarget : ''}`}>
          {isEmptyText ? (
            <span className={styles.emptyPlaceholderInline}>
              <span className={styles.emptyTextBadge}>Empty</span>
            </span>
          ) : (
            children
          )}
        </span>
        <Button
          type="button"
          variant="admin"
          size="xs"
          data-dev-edit-trigger="true"
          data-canvas-edit-trigger={editTriggerId}
          onClick={handleEditClick}
          onMouseEnter={() => setIsButtonHovered(true)}
          onMouseLeave={() => setIsButtonHovered(false)}
          title={`Edit ${pointId || 'content'}`}
          aria-label={`Edit ${pointId || 'content'}`}
        >
          ✎ Edit
        </Button>
        {pointId && (
          <UniversalEditModal
            isOpen={isEditModalOpen}
            pointId={pointId}
            type={initialEditType}
            currentValue={isEmptyText ? '' : effectiveCurrent}
            defaultValue={isEmptyText ? '' : effectiveDefault}
            isSection={isSection}
            isNumbered={isNumbered}
            defaultNumbered={defaultNumbered}
            onNumberedChange={onNumberedChange}
            onSave={handleSaveModal}
            onReset={handleResetModal}
            onClose={() => setIsEditModalOpen(false)}
          />
        )}
      </span>
    );
  }

  // Default: type === 'text' (Strictly '✎ Edit' button with zero custom labels)
  return (
    <div className={`${styles.textWrapper} ${className || ''}`}>
      <div className={styles.textBadge}>
        <Button
          type="button"
          variant="admin"
          size="xs"
          data-dev-edit-trigger="true"
          data-canvas-edit-trigger={editTriggerId}
          onClick={handleEditClick}
          onMouseEnter={() => setIsButtonHovered(true)}
          onMouseLeave={() => setIsButtonHovered(false)}
          title={`Edit ${pointId || 'content'}`}
          aria-label={`Edit ${pointId || 'content'}`}
        >
          ✎ Edit
        </Button>
      </div>
      <div className={`${styles.textContent} ${isButtonHovered ? styles.highlightedTarget : ''}`}>
        {isEmptyText ? (
          <div className={styles.emptyPlaceholder}>
            <span className={styles.emptyTextBadge}>Empty</span>
          </div>
        ) : (
          children
        )}
      </div>
      {pointId && (
        <UniversalEditModal
          isOpen={isEditModalOpen}
          pointId={pointId}
          type={initialEditType}
          currentValue={isEmptyText ? '' : effectiveCurrent}
          defaultValue={isEmptyText ? '' : effectiveDefault}
          isSection={isSection}
          isNumbered={isNumbered}
          defaultNumbered={defaultNumbered}
          onNumberedChange={onNumberedChange}
          onSave={handleSaveModal}
          onReset={handleResetModal}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
    </div>
  );
};

export default DevActionAffordance;
