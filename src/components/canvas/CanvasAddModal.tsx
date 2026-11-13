import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { CanvasElementType } from '../../types/canvas';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt';
import { resolveSingleDrivePhotoUrl } from '../../utils/mediaUrl';
import styles from './CanvasAddModal.module.css';

export type AddModalElementType = CanvasElementType | 'gallery';

export interface CanvasAddElementPayload {
  title?: string;
  isNumbered?: boolean;
  content?: string;
  as?: 'p' | 'blockquote';
  src?: string;
  alt?: string;
  caption?: string;
  showCaption?: boolean;
  driveUrl?: string;
  subtitle?: string;
}

export interface CanvasAddModalProps {
  isOpen: boolean;
  type: AddModalElementType | null;
  nodeId: string;
  targetSectionId?: string;
  targetIndex?: number;
  targetSubsectionId?: string;
  onClose: () => void;
  onConfirmAdd: (
    type: AddModalElementType,
    payload: CanvasAddElementPayload,
    targetSectionId?: string,
    targetIndex?: number,
    targetSubsectionId?: string
  ) => void;
}

/**
 * CanvasAddModal Component
 * Folio Engine — Task 8.11: Required Form Fill Before Adding Elements
 *
 * Mandatory creation dialog requiring coordinators in Developer Mode to fill out
 * the necessary fields (titles, narratives, media) before adding elements to the canvas:
 * - Empty by default: Never populates fields with generic dummy values
 * - Enforces required field validation before the Add button is enabled
 * - Consumes canonical Modal and Button components with 100% token purity
 * - Adheres strictly to Universal Zero Outline Policy and Absolute Ban on Dividers
 */
export const CanvasAddModal: React.FC<CanvasAddModalProps> = ({
  isOpen,
  type,
  nodeId: _nodeId,
  targetSectionId,
  targetIndex,
  targetSubsectionId,
  onClose,
  onConfirmAdd,
}) => {
  const { showToast } = useDeveloperMode();
  // Field drafts — initialized clean with zero default placeholder strings
  const [title, setTitle] = useState('');
  const [isNumbered, setIsNumbered] = useState(true);
  const [content, setContent] = useState('');
  const [textRole, setTextRole] = useState<'p' | 'blockquote'>('p');
  const [imageSrc, setImageSrc] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [showCaption, setShowCaption] = useState(false);
  const [driveUrl, setDriveUrl] = useState('');
  const [subtitle, setSubtitle] = useState('');

  const initialFocusRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Reset drafts whenever modal opens or element type changes
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setIsNumbered(true);
      setContent('');
      setTextRole('p');
      setImageSrc('');
      setImageAlt('');
      setImageCaption('');
      setShowCaption(false);
      setDriveUrl('');
      setSubtitle('');

      const timer = setTimeout(() => {
        initialFocusRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, type]);

  // Synchronous dirty state calculation for beforeunload reload protection
  const isFormDirty = useMemo(() => {
    if (!isOpen) return false;
    return Boolean(
      title.trim() ||
      content.trim() ||
      imageSrc.trim() ||
      imageAlt.trim() ||
      imageCaption.trim() ||
      driveUrl.trim() ||
      subtitle.trim()
    );
  }, [isOpen, title, content, imageSrc, imageAlt, imageCaption, driveUrl, subtitle]);

  // Prevent accidental reload or navigation when element form has unsaved entries
  useUnsavedChangesPrompt(isOpen && isFormDirty, 'canvas-add-modal');

  if (!isOpen || !type) return null;

  // Validation rules: require each element to be filled out before enabling Add
  let canSubmit = false;
  let modalTitle = 'Add Element';
  let submitLabel = 'Add Element';

  switch (type) {
    case 'section':
      canSubmit = title.trim().length > 0;
      modalTitle = 'Add Section';
      submitLabel = 'Add Section';
      break;
    case 'subsection':
      canSubmit = title.trim().length > 0;
      modalTitle = 'Add Subsection';
      submitLabel = 'Add Subsection';
      break;
    case 'text':
      canSubmit = content.trim().length > 0;
      modalTitle = 'Add Narrative Text';
      submitLabel = 'Add Text';
      break;
    case 'photo':
      canSubmit = imageSrc.trim().length > 0 && imageAlt.trim().length > 0;
      modalTitle = 'Add Photo Evidence';
      submitLabel = 'Add Photo';
      break;
    case 'gallery':
      canSubmit = title.trim().length > 0;
      modalTitle = 'Add Photo Gallery';
      submitLabel = 'Add Gallery';
      break;
    case 'chart':
      canSubmit = title.trim().length > 0;
      modalTitle = 'Add Indicator Chart';
      submitLabel = 'Add Chart';
      break;
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;

    const payload: CanvasAddElementPayload = {
      title: title.trim(),
      isNumbered,
      content: content.trim(),
      as: textRole,
      src: imageSrc.trim(),
      alt: imageAlt.trim(),
      caption: imageCaption.trim(),
      showCaption,
      driveUrl: driveUrl.trim(),
      subtitle: subtitle.trim(),
    };

    onConfirmAdd(type, payload, targetSectionId, targetIndex, targetSubsectionId);
    showToast('Element added to canvas.', 'success');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={canSubmit ? handleSubmit : undefined}
      title={modalTitle}
      maxWidth="500px"
      ariaLabel={modalTitle}
    >
      <form onSubmit={handleSubmit} className={styles.container}>
        {/* Section Form */}
        {type === 'section' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="add-section-title">
                Section Title <span className={styles.requiredMark}>*</span>
              </label>
              <input
                ref={(el) => { initialFocusRef.current = el; }}
                id="add-section-title"
                type="text"
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Learning Continuity & Remediation"
                required
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Section Numbering</label>
              <div className={styles.segmentedControl} role="radiogroup" aria-label="Section Numbering">
                <button
                  type="button"
                  role="radio"
                  aria-checked={isNumbered}
                  className={`${styles.segmentButton} ${isNumbered ? styles.segmentButtonActive : ''}`}
                  onClick={() => setIsNumbered(true)}
                >
                  Numbered
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!isNumbered}
                  className={`${styles.segmentButton} ${!isNumbered ? styles.segmentButtonActive : ''}`}
                  onClick={() => setIsNumbered(false)}
                >
                  Unnumbered
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subsection Form */}
        {type === 'subsection' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="add-subsec-title">
                Subsection Title <span className={styles.requiredMark}>*</span>
              </label>
              <input
                ref={(el) => { initialFocusRef.current = el; }}
                id="add-subsec-title"
                type="text"
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Grade 7 Catch-Up Fridays & Remediation"
                required
              />
            </div>
          </div>
        )}

        {/* Text Form */}
        {type === 'text' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Typography Style</label>
              <div className={styles.segmentedControl} role="radiogroup" aria-label="Text Typography Style">
                <button
                  type="button"
                  role="radio"
                  aria-checked={textRole === 'p'}
                  className={`${styles.segmentButton} ${textRole === 'p' ? styles.segmentButtonActive : ''}`}
                  onClick={() => setTextRole('p')}
                >
                  Body Paragraph
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={textRole === 'blockquote'}
                  className={`${styles.segmentButton} ${textRole === 'blockquote' ? styles.segmentButtonActive : ''}`}
                  onClick={() => setTextRole('blockquote')}
                >
                  Editorial Quote
                </button>
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="add-text-content">
                Narrative Content <span className={styles.requiredMark}>*</span>
              </label>
              <textarea
                ref={(el) => { initialFocusRef.current = el; }}
                id="add-text-content"
                className={styles.textarea}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type narrative overview, milestone progress, or strategic initiative..."
                rows={5}
                required
              />
            </div>
          </div>
        )}

        {/* Photo Form */}
        {type === 'photo' && (
          <div className={styles.panel}>
            {imageSrc && (
              <div className={styles.imagePreviewWrapper}>
                <img
                  src={imageSrc}
                  alt={imageAlt || 'Selected preview'}
                  className={styles.previewThumb}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="add-photo-url">
                Photo URL <span className={styles.requiredMark}>*</span>
              </label>
              <input
                id="add-photo-url"
                type="text"
                className={styles.input}
                value={imageSrc.startsWith('data:') ? '' : (driveUrl || imageSrc)}
                onChange={(e) => {
                  const val = e.target.value;
                  const resolved = resolveSingleDrivePhotoUrl(val);
                  if (resolved) {
                    setImageSrc(resolved.displayUrl);
                    setDriveUrl(resolved.rawUrl);
                  } else {
                    setImageSrc(val);
                    setDriveUrl('');
                  }
                }}
                placeholder="https://drive.google.com/file/d/.../view"
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="add-photo-alt">
                Alt Text <span className={styles.requiredMark}>*</span>
              </label>
              <input
                ref={(el) => { if (!initialFocusRef.current) initialFocusRef.current = el; }}
                id="add-photo-alt"
                type="text"
                className={styles.input}
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder="Brief visual description for screen readers"
                required
              />
            </div>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={showCaption}
                onChange={(e) => setShowCaption(e.target.checked)}
              />
              <span>Show caption below photo</span>
            </label>

            {showCaption && (
              <div className={styles.formField}>
                <label className={styles.fieldLabel} htmlFor="add-photo-caption">
                  Caption
                </label>
                <input
                  id="add-photo-caption"
                  type="text"
                  className={styles.input}
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  placeholder="Editorial context or story shown beneath photo"
                />
              </div>
            )}
          </div>
        )}

        {/* Gallery Form */}
        {type === 'gallery' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="add-gallery-title">
                Gallery Title <span className={styles.requiredMark}>*</span>
              </label>
              <input
                ref={(el) => { initialFocusRef.current = el; }}
                id="add-gallery-title"
                type="text"
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Photo & Activity Evidence Gallery"
                required
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="add-gallery-drive">
                Google Drive Folder URL (Optional)
              </label>
              <input
                id="add-gallery-drive"
                type="text"
                className={styles.input}
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
              />
            </div>
          </div>
        )}

        {/* Chart Form */}
        {type === 'chart' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="add-chart-title">
                Chart Title <span className={styles.requiredMark}>*</span>
              </label>
              <input
                ref={(el) => { initialFocusRef.current = el; }}
                id="add-chart-title"
                type="text"
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Learner Mastery by Learning Area"
                required
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="add-chart-subtitle">
                Subtitle / Description (Optional)
              </label>
              <input
                id="add-chart-subtitle"
                type="text"
                className={styles.input}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Quarterly performance against benchmark standard"
              />
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

CanvasAddModal.displayName = 'CanvasAddModal';

export default CanvasAddModal;
