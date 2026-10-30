import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DevHelpTooltip } from '../ui/DevHelpTooltip';
import type {
  CanvasModalMode,
  CanvasModalElementType,
  CanvasElementFormData,
} from '../../types/canvas';
import type {
  DevEditType,
  DevLinkData,
  DevImageData,
  DevFileData,
} from '../../types/developer';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt';
import { getContent, setContent, resetContent } from '../../utils/contentDb';
import { uploadMediaAsset } from '../../services/mediaService';
import styles from './UniversalEditModal.module.css';

export interface UniversalEditModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Canvas Mode Props
  mode?: CanvasModalMode;
  elementType?: CanvasModalElementType | null;
  nodeId?: string;
  itemId?: string;
  initialData?: CanvasElementFormData;
  targetSectionId?: string;
  targetIndex?: number;
  targetSubsectionId?: string;
  onSubmit?: (data: CanvasElementFormData) => void;
  onResetToDefault?: () => void;

  // Generic Portal String Props
  pointId?: string;
  type?: DevEditType;
  currentValue?: string | DevLinkData | DevImageData | DevFileData;
  defaultValue?: string | DevLinkData | DevImageData | DevFileData;
  title?: string;
  isSection?: boolean;
  isNumbered?: boolean;
  defaultNumbered?: boolean;
  onNumberedChange?: (isNumbered: boolean) => void;
  onSave?: (
    newValue: string,
    type?: DevEditType,
    data?: DevLinkData | DevImageData | DevFileData
  ) => void;
  onReset?: () => void;
}

const INSTRUCTIONAL_PLACEHOLDERS = new Set([
  'Click Edit to add narrative text for this section.',
  'Enter narrative text here...',
  'Evidence photograph pending',
  'Narrative text pending',
  'Evidence documentation photo',
  'Photographic proof for this strategic milestone.',
  'Official Google Drive Folder',
  'Evidence Folder',
]);

function stripInstructionalPlaceholder(str?: string | null): string {
  if (!str) return '';
  const trimmed = str.trim();
  return INSTRUCTIONAL_PLACEHOLDERS.has(trimmed) ? '' : str;
}

function parseGenericValues(
  val?: string | DevLinkData | DevImageData | DevFileData
): {
  text: string;
  link: DevLinkData;
  image: DevImageData;
  file: DevFileData;
} {
  let text = '';
  let link: DevLinkData = { url: '', label: '', openInNewTab: false };
  let image: DevImageData = { src: '', alt: '', caption: '', showCaption: false };
  let file: DevFileData = { name: '', url: '', reference: '', format: 'pdf', size: '' };

  if (!val) {
    return { text, link, image, file };
  }

  if (typeof val === 'object') {
    if ('src' in val) {
      const imgVal = val as DevImageData;
      const isSrcEmpty = !imgVal.src || imgVal.src.trim().length === 0;
      image = {
        src: imgVal.src || '',
        alt: isSrcEmpty ? '' : stripInstructionalPlaceholder(imgVal.alt),
        caption: isSrcEmpty ? '' : stripInstructionalPlaceholder(imgVal.caption),
        showCaption: isSrcEmpty ? false : Boolean(imgVal.showCaption),
      };
      text = isSrcEmpty ? '' : (image.caption || image.alt || image.src);
    } else if ('name' in val || 'format' in val || 'reference' in val) {
      const fileVal = val as DevFileData;
      const isFileEmpty = !fileVal.url || fileVal.url.trim().length === 0;
      file = {
        name: isFileEmpty ? '' : (fileVal.name || ''),
        url: fileVal.url || '',
        reference: isFileEmpty ? '' : (fileVal.reference || ''),
        format: fileVal.format || 'pdf',
        size: isFileEmpty ? '' : (fileVal.size || ''),
      };
      text = isFileEmpty ? '' : (file.name || file.reference || file.url);
    } else if ('url' in val) {
      const linkVal = val as DevLinkData;
      const isUrlEmpty = !linkVal.url || linkVal.url.trim().length === 0;
      link = {
        url: linkVal.url || '',
        label: isUrlEmpty ? '' : stripInstructionalPlaceholder(linkVal.label),
        openInNewTab: isUrlEmpty ? false : Boolean(linkVal.openInNewTab),
      };
      text = isUrlEmpty ? '' : (link.label || link.url);
    }
    return { text, link, image, file };
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if ('src' in parsed) {
          const isSrcEmpty = !parsed.src || String(parsed.src).trim().length === 0;
          image = {
            src: parsed.src || '',
            alt: isSrcEmpty ? '' : stripInstructionalPlaceholder(parsed.alt),
            caption: isSrcEmpty ? '' : stripInstructionalPlaceholder(parsed.caption),
            showCaption: isSrcEmpty ? false : Boolean(parsed.showCaption),
          };
        }
        if ('name' in parsed || 'format' in parsed || 'reference' in parsed) {
          const isFileEmpty = !parsed.url || String(parsed.url).trim().length === 0;
          file = {
            name: isFileEmpty ? '' : (parsed.name || ''),
            url: parsed.url || '',
            reference: isFileEmpty ? '' : (parsed.reference || ''),
            format: parsed.format || 'pdf',
            size: isFileEmpty ? '' : (parsed.size || ''),
          };
        }
        if ('url' in parsed) {
          const isUrlEmpty = !parsed.url || String(parsed.url).trim().length === 0;
          link = {
            url: parsed.url || '',
            label: isUrlEmpty ? '' : stripInstructionalPlaceholder(parsed.label),
            openInNewTab: isUrlEmpty ? false : Boolean(parsed.openInNewTab),
          };
        }
        const parsedText = typeof parsed.text === 'string' ? parsed.text : trimmed;
        text = stripInstructionalPlaceholder(parsedText);
        return { text, link, image, file };
      } catch {
        // Not JSON
      }
    }

    text = stripInstructionalPlaceholder(trimmed);
    link.url = /^(https?:\/\/|#|\/)/i.test(trimmed) ? trimmed : '';
    image.src = /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(trimmed) ? trimmed : '';
    file.url = /\.(pdf|docx?|xlsx?)$/i.test(trimmed) ? trimmed : '';
    if (file.url) {
      file.name = trimmed.split('/').pop() || 'Document';
    }
  }

  return { text, link, image, file };
}

function getSubmitNoun(type: CanvasModalElementType | null): string {
  switch (type) {
    case 'section':
      return 'Section';
    case 'subsection':
      return 'Subsection';
    case 'text':
      return 'Text';
    case 'photo':
      return 'Photo';
    case 'gallery':
      return 'Gallery';
    default:
      return 'Element';
  }
}

/**
 * UniversalEditModal Component
 * Folio Engine — Task 10.6: Universal Edit Modal Unification
 *
 * Unifies all portal and canvas edit affordances into a single canonical modal:
 * - Handles Dynamic Canvas Elements (Section, Subsection, Narrative Text, Photo, Gallery)
 * - Handles Generic Portal Strings (Hero titles, Mission/Vision, Roadmap milestones, Footer, Links, Documents)
 * - Strict Draft-Only persistence: All mutations target the draft sandbox
 * - Universal Zero Outline Policy, 100% Token Purity, Zero Divider Lines
 */
export const UniversalEditModal: React.FC<UniversalEditModalProps> = ({
  isOpen,
  onClose,
  mode = 'edit',
  elementType = null,
  initialData,
  onSubmit,
  onResetToDefault,
  pointId,
  type = 'text',
  currentValue,
  defaultValue,
  title,
  isSection,
  isNumbered,
  defaultNumbered,
  onNumberedChange,
  onSave,
  onReset,
}) => {
  const { isDevMode, isDesktop, setHasUnpublishedChanges, showToast } = useDeveloperMode();
  const { pushAction } = useUndoRedo();

  // Determine operational domain: Canvas AST element vs Generic portal string
  const isCanvasDomain = Boolean(elementType || onSubmit);

  // Canvas Draft State
  const [canvasDraft, setCanvasDraft] = useState<CanvasElementFormData>(() => {
    if (initialData) {
      return {
        title: initialData.title || '',
        isNumbered: initialData.isNumbered !== false,
        content: stripInstructionalPlaceholder(initialData.content),
        as: initialData.as || 'p',
        src: initialData.src || '',
        alt: stripInstructionalPlaceholder(initialData.alt),
        caption: stripInstructionalPlaceholder(initialData.caption),
        showCaption: Boolean(initialData.showCaption || (initialData.caption && initialData.caption.trim().length > 0)),
        driveUrl: initialData.driveUrl || '',
      };
    }
    return {
      title: '',
      isNumbered: true,
      content: '',
      as: 'p',
      src: '',
      alt: '',
      caption: '',
      showCaption: false,
      driveUrl: '',
    };
  });

  // Generic Portal String Draft State
  const [textDraft, setTextDraft] = useState<string>('');
  const [linkDraft, setLinkDraft] = useState<DevLinkData>({ url: '', label: '', openInNewTab: false });
  const [imageDraft, setImageDraft] = useState<DevImageData>({ src: '', alt: '', caption: '', showCaption: false });
  const [fileDraft, setFileDraft] = useState<DevFileData>({
    name: '',
    url: '',
    reference: '',
    format: 'pdf',
    size: '',
  });

  const isSectionItem = Boolean(
    isSection ||
    elementType === 'section' ||
    (pointId && /(^|\.)section(\.|$)/i.test(pointId) && !pointId.endsWith('.subtitle'))
  );
  const isNumberedKey = pointId ? `${pointId}.isNumbered` : '';
  const [isNumberedDraft, setIsNumberedDraft] = useState<boolean>(true);

  // Photo source mode toggle ('upload' | 'url')
  const [photoSourceMode, setPhotoSourceMode] = useState<'upload' | 'url'>('upload');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const initialFocusRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Automatically dismiss modal if developer mode is exited
  useEffect(() => {
    if (isOpen && (!isDevMode || !isDesktop)) {
      onClose();
    }
  }, [isOpen, isDevMode, isDesktop, onClose]);

  // Synchronize drafts when modal opens or input props change
  useEffect(() => {
    if (!isOpen) return;

    if (isCanvasDomain) {
      const draftVal: CanvasElementFormData = {
        title: initialData?.title || '',
        isNumbered: initialData?.isNumbered !== false,
        content: stripInstructionalPlaceholder(initialData?.content),
        as: initialData?.as || 'p',
        src: initialData?.src || '',
        alt: stripInstructionalPlaceholder(initialData?.alt),
        caption: stripInstructionalPlaceholder(initialData?.caption),
        showCaption: Boolean(
          initialData?.showCaption ||
          (initialData?.caption && initialData.caption.trim().length > 0)
        ),
        driveUrl: initialData?.driveUrl || '',
      };
      setCanvasDraft(draftVal);
      const isUrl = Boolean(draftVal.src && !draftVal.src.startsWith('data:'));
      setPhotoSourceMode(isUrl ? 'url' : 'upload');
    } else {
      const parsed = parseGenericValues(currentValue);
      setTextDraft(parsed.text);
      setLinkDraft(parsed.link);
      setImageDraft(parsed.image);
      setFileDraft(parsed.file);
      const isUrl = Boolean(parsed.image.src && !parsed.image.src.startsWith('data:'));
      setPhotoSourceMode(isUrl ? 'url' : 'upload');

      if (isSectionItem && isNumberedKey) {
        const storedNumbered = getContent(isNumberedKey, '', isDevMode);
        if (storedNumbered !== '') {
          setIsNumberedDraft(storedNumbered === 'true');
        } else if (isNumbered !== undefined) {
          setIsNumberedDraft(isNumbered);
        } else if (defaultNumbered !== undefined) {
          setIsNumberedDraft(defaultNumbered);
        } else {
          setIsNumberedDraft(true);
        }
      }
    }

    const timer = setTimeout(() => {
      initialFocusRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    isCanvasDomain,
    initialData,
    currentValue,
    isSectionItem,
    isNumberedKey,
    isNumbered,
    defaultNumbered,
    isDevMode,
  ]);

  // Synchronous dirty state calculation for beforeunload reload protection
  const isFormDirty = useMemo(() => {
    if (!isOpen) return false;
    if (isCanvasDomain) {
      const initTitle = initialData?.title || '';
      const initContent = stripInstructionalPlaceholder(initialData?.content);
      const initSrc = initialData?.src || '';
      const initAlt = stripInstructionalPlaceholder(initialData?.alt);
      const initCaption = stripInstructionalPlaceholder(initialData?.caption);
      const initDriveUrl = initialData?.driveUrl || '';
      const initIsNumbered = initialData?.isNumbered !== false;

      return (
        (canvasDraft.title || '') !== initTitle ||
        (canvasDraft.content || '') !== initContent ||
        (canvasDraft.src || '') !== initSrc ||
        (canvasDraft.alt || '') !== initAlt ||
        (canvasDraft.caption || '') !== initCaption ||
        (canvasDraft.driveUrl || '') !== initDriveUrl ||
        canvasDraft.isNumbered !== initIsNumbered
      );
    } else {
      const parsed = parseGenericValues(currentValue);
      return (
        textDraft !== parsed.text ||
        linkDraft.url !== parsed.link.url ||
        linkDraft.label !== parsed.link.label ||
        imageDraft.src !== parsed.image.src ||
        imageDraft.alt !== parsed.image.alt ||
        imageDraft.caption !== parsed.image.caption ||
        fileDraft.url !== parsed.file.url ||
        fileDraft.name !== parsed.file.name
      );
    }
  }, [
    isOpen,
    isCanvasDomain,
    canvasDraft,
    initialData,
    textDraft,
    linkDraft,
    imageDraft,
    fileDraft,
    currentValue,
  ]);

  // Prevent accidental reload or navigation when active modal has unsaved entries
  useUnsavedChangesPrompt(isOpen && isFormDirty, pointId ? `universal-edit-${pointId}` : 'universal-edit-modal');

  // File picker handler for source photo upload
  const handlePhotoFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const autoAlt = file.name.replace(/\.[^/.]+$/, '');
    setIsUploading(true);
    setUploadError(null);

    try {
      const publicUrl = await uploadMediaAsset(file, 'photos');
      if (isCanvasDomain) {
        setCanvasDraft((prev) => ({
          ...prev,
          src: publicUrl,
          alt: prev.alt || autoAlt,
        }));
      } else {
        setImageDraft((prev) => ({
          ...prev,
          src: publicUrl,
          alt: prev.alt || autoAlt,
        }));
      }
    } catch (err: unknown) {
      console.error('[UniversalEditModal] Photo upload failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [isCanvasDomain]);

  // File picker handler for generic document upload
  const handleDocumentFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    let format: DevFileData['format'] = 'other';
    if (ext === 'pdf') format = 'pdf';
    else if (ext === 'doc' || ext === 'docx') format = 'doc';
    else if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') format = 'sheet';

    setIsUploading(true);
    setUploadError(null);

    try {
      const publicUrl = await uploadMediaAsset(file, 'documents');
      setFileDraft((prev) => ({
        ...prev,
        name: file.name,
        url: publicUrl,
        format,
        size: `${(file.size / 1024).toFixed(1)} KB`,
      }));
    } catch (err: unknown) {
      console.error('[UniversalEditModal] Document upload failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Document upload failed');
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Submit Handler
  const handleSave = () => {
    if (isCanvasDomain && onSubmit) {
      onSubmit(canvasDraft);
      setHasUnpublishedChanges(true);
      showToast(mode === 'add' ? 'Element added to canvas.' : 'Changes saved to draft successfully.', 'success');
      onClose();
      return;
    }

    let resultString = '';
    let payloadData: DevLinkData | DevImageData | DevFileData | undefined;

    switch (type) {
      case 'text':
        resultString = textDraft;
        break;
      case 'link':
        resultString = JSON.stringify(linkDraft);
        payloadData = linkDraft;
        break;
      case 'image':
        resultString = JSON.stringify(imageDraft);
        payloadData = imageDraft;
        break;
      case 'file':
        resultString = JSON.stringify(fileDraft);
        payloadData = fileDraft;
        break;
    }

    // Persist section numbering strictly in draft sandbox
    if (isSectionItem && isNumberedKey) {
      setContent(isNumberedKey, String(isNumberedDraft), true);
      onNumberedChange?.(isNumberedDraft);
    }

    // Persist content override strictly in draft sandbox
    if (pointId) {
      const prevVal = getContent(
        pointId,
        typeof defaultValue === 'string'
          ? defaultValue
          : defaultValue
            ? JSON.stringify(defaultValue)
            : '',
        true
      );

      if (prevVal !== resultString) {
        pushAction({
          type: 'content_text_override',
          description: `Edit text for ${pointId}`,
          undo: () => {
            setContent(pointId, prevVal, true);
          },
          redo: () => {
            setContent(pointId, resultString, true);
          },
        });
      }

      setContent(pointId, resultString, true);
    }

    if (onSave) {
      onSave(resultString, type, payloadData);
    }

    setHasUnpublishedChanges(true);
    showToast('Changes saved to draft successfully.', 'success');
    onClose();
  };

  // Reset Handler
  const handleReset = () => {
    if (isCanvasDomain) {
      if (onResetToDefault) {
        onResetToDefault();
      }
      setHasUnpublishedChanges(true);
      showToast('Reset to default baseline.', 'info');
      onClose();
      return;
    }

    if (pointId) {
      const prevVal = getContent(pointId, '', true);
      const defaultStr =
        typeof defaultValue === 'string'
          ? defaultValue
          : defaultValue
            ? JSON.stringify(defaultValue)
            : '';

      resetContent(pointId, true);

      if (prevVal && prevVal !== defaultStr) {
        pushAction({
          type: 'content_text_override',
          description: `Reset text for ${pointId}`,
          undo: () => {
            setContent(pointId, prevVal, true);
          },
          redo: () => {
            resetContent(pointId, true);
          },
        });
      }
    }

    if (isSectionItem && isNumberedKey) {
      resetContent(isNumberedKey, true);
      const fallback = defaultNumbered !== undefined ? defaultNumbered : true;
      setIsNumberedDraft(fallback);
      onNumberedChange?.(fallback);
    }

    if (onReset) {
      onReset();
    }

    const parsed = parseGenericValues(defaultValue);
    setTextDraft(parsed.text);
    setLinkDraft(parsed.link);
    setImageDraft(parsed.image);
    setFileDraft(parsed.file);
    setHasUnpublishedChanges(true);
    showToast('Reset to default baseline.', 'info');
    onClose();
  };

  // Compute Modal Header Title
  const modalHeaderTitle = useMemo(() => {
    if (title) return title;
    if (isCanvasDomain && elementType) {
      const noun = getSubmitNoun(elementType);
      return mode === 'add' ? `Add ${noun}` : `Edit ${noun}`;
    }
    if (isSectionItem) return 'Edit Section';
    if (type === 'image') return 'Edit Photo';
    if (type === 'link') return 'Edit Link';
    if (type === 'file') return 'Edit Document';
    return 'Edit Text';
  }, [title, isCanvasDomain, elementType, mode, isSectionItem, type]);

  // Compute Submit Button Label
  const submitButtonLabel = useMemo(() => {
    if (isCanvasDomain && mode === 'add') {
      return `Add ${getSubmitNoun(elementType)}`;
    }
    return 'Save Changes';
  }, [isCanvasDomain, mode, elementType]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={isUploading ? undefined : handleSave}
      title={modalHeaderTitle}
      maxWidth="500px"
      ariaLabel={modalHeaderTitle}
    >
      <div className={styles.container}>
        {/* DOMAIN A: Dynamic Canvas Elements */}
        {isCanvasDomain && elementType === 'section' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="edit-modal-section-title">
                Section Title <span className={styles.requiredMark}>*</span>
              </label>
              <input
                id="edit-modal-section-title"
                ref={(el) => { initialFocusRef.current = el; }}
                type="text"
                className={styles.input}
                value={canvasDraft.title || ''}
                onChange={(e) => setCanvasDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Strategic Academic Intervention"
                aria-label="Section Title"
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={canvasDraft.isNumbered !== false}
                  onChange={(e) => setCanvasDraft((prev) => ({ ...prev, isNumbered: e.target.checked }))}
                />
                <span>
                  Numbered section<DevHelpTooltip
                    text="Adds a number before the title, like I or II."
                    label="Numbered section"
                  />
                </span>
              </label>
            </div>
          </div>
        )}

        {isCanvasDomain && elementType === 'subsection' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="canvas-subsection-title">
                Subsection Title <span className={styles.requiredMark}>*</span>
              </label>
              <input
                id="canvas-subsection-title"
                ref={(el) => { initialFocusRef.current = el; }}
                type="text"
                className={styles.input}
                value={canvasDraft.title || ''}
                onChange={(e) => setCanvasDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Implementation Milestones"
                aria-label="Subsection Title"
              />
            </div>
          </div>
        )}

        {isCanvasDomain && elementType === 'text' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Typography Style</label>
              <div className={styles.segmentedControl} role="radiogroup" aria-label="Typography Style">
                <button
                  type="button"
                  role="radio"
                  aria-checked={canvasDraft.as !== 'blockquote'}
                  className={`${styles.segmentButton} ${canvasDraft.as !== 'blockquote' ? styles.segmentButtonActive : ''}`}
                  onClick={() => setCanvasDraft((prev) => ({ ...prev, as: 'p' }))}
                >
                  Paragraph
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={canvasDraft.as === 'blockquote'}
                  className={`${styles.segmentButton} ${canvasDraft.as === 'blockquote' ? styles.segmentButtonActive : ''}`}
                  onClick={() => setCanvasDraft((prev) => ({ ...prev, as: 'blockquote' }))}
                >
                  Quote / Callout
                </button>
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="canvas-text-content">
                Narrative Text<span className={styles.requiredMark}>*</span>
              </label>
              <textarea
                id="canvas-text-content"
                ref={(el) => { initialFocusRef.current = el; }}
                className={styles.textarea}
                value={canvasDraft.content || ''}
                onChange={(e) => setCanvasDraft((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Enter narrative text or editorial testimony..."
                rows={5}
                aria-label="Narrative Text Content"
              />
            </div>
          </div>
        )}

        {isCanvasDomain && elementType === 'photo' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Photo Source</label>
              <div className={styles.segmentedControl} role="radiogroup" aria-label="Photo Source">
                <button
                  type="button"
                  role="radio"
                  aria-checked={photoSourceMode === 'upload'}
                  className={`${styles.segmentButton} ${photoSourceMode === 'upload' ? styles.segmentButtonActive : ''}`}
                  onClick={() => setPhotoSourceMode('upload')}
                >
                  Upload Photo
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={photoSourceMode === 'url'}
                  className={`${styles.segmentButton} ${photoSourceMode === 'url' ? styles.segmentButtonActive : ''}`}
                  onClick={() => setPhotoSourceMode('url')}
                >
                  Photo URL
                </button>
              </div>
            </div>

            {photoSourceMode === 'upload' ? (
              <div className={styles.fileRow}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Photo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className={styles.hiddenFileInput}
                  onChange={handlePhotoFileSelect}
                  aria-label="Upload photo file"
                />
                <span className={styles.fileStatus}>
                  {canvasDraft.src ? 'Photo selected' : 'No photo chosen'}
                </span>
              </div>
            ) : (
              <div className={styles.formField}>
                <label className={styles.fieldLabel} htmlFor="canvas-photo-url">
                  Photo URL <span className={styles.requiredMark}>*</span>
                </label>
                <input
                  id="canvas-photo-url"
                  ref={(el) => { initialFocusRef.current = el; }}
                  type="text"
                  className={styles.input}
                  value={canvasDraft.src || ''}
                  onChange={(e) => setCanvasDraft((prev) => ({ ...prev, src: e.target.value }))}
                  placeholder="https://.../photo.webp"
                  aria-label="Photo URL"
                />
              </div>
            )}

            {canvasDraft.src ? (
              <div className={styles.imagePreviewWrapper}>
                <img
                  src={canvasDraft.src}
                  alt={canvasDraft.alt || 'Preview'}
                  className={styles.previewThumb}
                />
              </div>
            ) : null}

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="canvas-photo-alt">
                Alt Text (Accessibility)
              </label>
              <input
                id="canvas-photo-alt"
                type="text"
                className={styles.input}
                value={canvasDraft.alt || ''}
                onChange={(e) => setCanvasDraft((prev) => ({ ...prev, alt: e.target.value }))}
                placeholder="Descriptive image summary for screen readers"
                aria-label="Photo Alt Text"
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={Boolean(canvasDraft.showCaption)}
                  onChange={(e) => setCanvasDraft((prev) => ({ ...prev, showCaption: e.target.checked }))}
                />
                <span>Show caption below photo</span>
              </label>
            </div>

            {canvasDraft.showCaption ? (
              <div className={styles.formField}>
                <label className={styles.fieldLabel} htmlFor="canvas-photo-caption">
                  Caption
                </label>
                <input
                  id="canvas-photo-caption"
                  type="text"
                  className={styles.input}
                  value={canvasDraft.caption || ''}
                  onChange={(e) => setCanvasDraft((prev) => ({ ...prev, caption: e.target.value }))}
                  placeholder="Photo caption or description"
                  aria-label="Photo Caption"
                />
              </div>
            ) : null}
          </div>
        )}

        {isCanvasDomain && elementType === 'gallery' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="canvas-gallery-title">
                Gallery Title <span className={styles.requiredMark}>*</span>
              </label>
              <input
                id="canvas-gallery-title"
                ref={(el) => { initialFocusRef.current = el; }}
                type="text"
                className={styles.input}
                value={canvasDraft.title || ''}
                onChange={(e) => setCanvasDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Mid-Year Assessment & Verification"
                aria-label="Gallery Title"
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="canvas-gallery-drive">
                Google Drive Repository URL <span className={styles.requiredMark}>*</span>
                <DevHelpTooltip
                  text="A link to an online folder with more photos or files."
                  label="Folder Link"
                />
              </label>
              <input
                id="canvas-gallery-drive"
                type="text"
                className={styles.input}
                value={canvasDraft.driveUrl || ''}
                onChange={(e) => setCanvasDraft((prev) => ({ ...prev, driveUrl: e.target.value }))}
                placeholder="https://drive.google.com/drive/folders/..."
                aria-label="Google Drive URL"
              />
            </div>
          </div>
        )}

        {/* DOMAIN B: Generic Portal Strings (DevActionAffordance) */}
        {!isCanvasDomain && type === 'text' && (
          <div className={styles.panel}>
            {isSectionItem ? (
              <>
                <div className={styles.formField}>
                  <label className={styles.fieldLabel} htmlFor="edit-modal-section-title">
                    Section Title<span className={styles.requiredMark}>*</span>
                  </label>
                  <input
                    id="edit-modal-section-title"
                    ref={(el) => { initialFocusRef.current = el; }}
                    type="text"
                    className={styles.input}
                    value={textDraft}
                    onChange={(e) => setTextDraft(e.target.value)}
                    placeholder="e.g. Strategic Academic Intervention"
                    aria-label="Section Title"
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={isNumberedDraft}
                      onChange={(e) => setIsNumberedDraft(e.target.checked)}
                    />
                    <span>
                      Numbered section<DevHelpTooltip
                        text="Adds a number before the title, like I or II."
                        label="Numbered section"
                      />
                    </span>
                  </label>
                </div>
              </>
            ) : (
              <div className={styles.formField}>
                <label className={styles.fieldLabel} htmlFor="dev-modal-generic-text">
                  Content<span className={styles.requiredMark}>*</span>
                </label>
                <textarea
                  id="dev-modal-generic-text"
                  ref={(el) => { initialFocusRef.current = el; }}
                  className={styles.textarea}
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  placeholder="Enter text, title, or description..."
                  rows={5}
                  aria-label={modalHeaderTitle}
                />
              </div>
            )}
          </div>
        )}

        {!isCanvasDomain && type === 'link' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="dev-modal-link-url">
                URL <span className={styles.requiredMark}>*</span>
              </label>
              <input
                id="dev-modal-link-url"
                ref={(el) => { initialFocusRef.current = el; }}
                type="text"
                className={styles.input}
                value={linkDraft.url}
                onChange={(e) => setLinkDraft((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://... or #overview"
                aria-label="Link URL"
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="dev-modal-link-label">
                Label
              </label>
              <input
                id="dev-modal-link-label"
                type="text"
                className={styles.input}
                value={linkDraft.label}
                onChange={(e) => setLinkDraft((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Button or hyperlink label"
                aria-label="Link Label"
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={Boolean(linkDraft.openInNewTab)}
                  onChange={(e) => setLinkDraft((prev) => ({ ...prev, openInNewTab: e.target.checked }))}
                />
                <span>Open in new tab</span>
              </label>
            </div>
          </div>
        )}

        {!isCanvasDomain && type === 'image' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>
                Photo Source
              </label>
              <div className={styles.segmentedControl} role="radiogroup" aria-label="Photo Source">
                <button
                  type="button"
                  role="radio"
                  aria-checked={photoSourceMode === 'upload'}
                  className={`${styles.segmentButton} ${photoSourceMode === 'upload' ? styles.segmentButtonActive : ''}`}
                  onClick={() => setPhotoSourceMode('upload')}
                >
                  Upload Photo
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={photoSourceMode === 'url'}
                  className={`${styles.segmentButton} ${photoSourceMode === 'url' ? styles.segmentButtonActive : ''}`}
                  onClick={() => setPhotoSourceMode('url')}
                >
                  Photo URL
                </button>
              </div>
            </div>

            {photoSourceMode === 'upload' ? (
              <div className={styles.fileRow}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Photo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className={styles.hiddenFileInput}
                  onChange={handlePhotoFileSelect}
                  aria-label="Upload photo file"
                />
                <span className={styles.fileStatus}>
                  {imageDraft.src ? 'Photo selected' : 'No photo chosen'}
                </span>
              </div>
            ) : (
              <div className={styles.formField}>
                <label className={styles.fieldLabel} htmlFor="dev-modal-image-url">
                  Photo URL <span className={styles.requiredMark}>*</span>
                </label>
                <input
                  id="dev-modal-image-url"
                  ref={(el) => { initialFocusRef.current = el; }}
                  type="text"
                  className={styles.input}
                  value={imageDraft.src}
                  onChange={(e) => setImageDraft((prev) => ({ ...prev, src: e.target.value }))}
                  placeholder="https://.../photo.webp"
                  aria-label="Photo URL"
                />
              </div>
            )}

            {imageDraft.src ? (
              <div className={styles.imagePreviewWrapper}>
                <img
                  src={imageDraft.src}
                  alt={imageDraft.alt || 'Preview'}
                  className={styles.previewThumb}
                />
              </div>
            ) : null}

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="dev-modal-image-alt">
                Alt Text (Accessibility)
              </label>
              <input
                id="dev-modal-image-alt"
                type="text"
                className={styles.input}
                value={imageDraft.alt}
                onChange={(e) => setImageDraft((prev) => ({ ...prev, alt: e.target.value }))}
                placeholder="Descriptive image summary for screen readers"
                aria-label="Photo Alt Text"
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={Boolean(imageDraft.showCaption)}
                  onChange={(e) => setImageDraft((prev) => ({ ...prev, showCaption: e.target.checked }))}
                />
                <span>Show caption below photo</span>
              </label>
            </div>

            {imageDraft.showCaption ? (
              <div className={styles.formField}>
                <label className={styles.fieldLabel} htmlFor="dev-modal-image-caption">
                  Caption
                </label>
                <input
                  id="dev-modal-image-caption"
                  type="text"
                  className={styles.input}
                  value={imageDraft.caption}
                  onChange={(e) => setImageDraft((prev) => ({ ...prev, caption: e.target.value }))}
                  placeholder="Image caption text"
                  aria-label="Photo Caption"
                />
              </div>
            ) : null}
          </div>
        )}

        {!isCanvasDomain && type === 'file' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="dev-modal-file-name">
                Document Name <span className={styles.requiredMark}>*</span>
              </label>
              <input
                id="dev-modal-file-name"
                ref={(el) => { initialFocusRef.current = el; }}
                type="text"
                className={styles.input}
                value={fileDraft.name}
                onChange={(e) => setFileDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Plan 2025-2028"
                aria-label="Document Name"
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="dev-modal-file-url">
                Document URL <span className={styles.requiredMark}>*</span>
              </label>
              <input
                id="dev-modal-file-url"
                type="text"
                className={styles.input}
                value={fileDraft.url}
                onChange={(e) => setFileDraft((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://.../document.pdf or Google Drive link"
                aria-label="Document URL"
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel}>
                Format
              </label>
              <div className={styles.formatPills}>
                {(['pdf', 'doc', 'sheet', 'other'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className={styles.formatPill}
                    data-active={fileDraft.format === fmt ? 'true' : 'false'}
                    onClick={() => setFileDraft((prev) => ({ ...prev, format: fmt }))}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.fileRow}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => docFileInputRef.current?.click()}
              >
                Upload Document
              </Button>
              <input
                ref={docFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                className={styles.hiddenFileInput}
                onChange={handleDocumentFileSelect}
                aria-label="Upload document file"
              />
              <span className={styles.fileStatus}>
                {fileDraft.url ? (fileDraft.url.startsWith('data:') ? 'Local file selected' : 'Document linked') : 'No file chosen'}
              </span>
            </div>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className={styles.actions}>
          <div>
            {(mode === 'edit' || onResetToDefault || onReset || defaultValue) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
              >
                Reset to default
              </Button>
            )}
          </div>

          <div className={styles.actionGroupRight}>
            {uploadError && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-danger, #e11d48)', marginRight: '8px' }}>
                {uploadError}
              </span>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : submitButtonLabel}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default UniversalEditModal;
