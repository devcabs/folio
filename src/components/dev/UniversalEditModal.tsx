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
import { resolveSingleDrivePhotoUrl, resolveSingleDrivePdfUrl } from '../../utils/mediaUrl';
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
    case 'pdf':
      return 'PDF';
    case 'documents':
      return 'Document Folder';
    default:
      return 'Element';
  }
}

function buildInitialCanvasDraft(
  initialData: CanvasElementFormData | undefined,
  elementType: CanvasModalElementType | null
): CanvasElementFormData {
  if (!initialData) {
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
  }

  let resolvedSrc = initialData.src || '';
  let resolvedDriveUrl = initialData.driveUrl || '';

  if (elementType === 'pdf') {
    const resolvedPdf = initialData.src ? resolveSingleDrivePdfUrl(initialData.src) : null;
    if (resolvedPdf) {
      resolvedSrc = resolvedPdf.previewUrl;
      resolvedDriveUrl = resolvedDriveUrl || initialData.src || '';
    }
  } else {
    const resolvedPhoto = initialData.src ? resolveSingleDrivePhotoUrl(initialData.src) : null;
    if (resolvedPhoto) {
      resolvedSrc = resolvedPhoto.displayUrl;
      resolvedDriveUrl = resolvedDriveUrl || initialData.src || '';
    }
  }

  return {
    title: initialData.title || '',
    isNumbered: initialData.isNumbered !== false,
    content: stripInstructionalPlaceholder(initialData.content),
    as: initialData.as || 'p',
    src: resolvedSrc,
    alt: stripInstructionalPlaceholder(initialData.alt),
    caption: stripInstructionalPlaceholder(initialData.caption),
    showCaption: Boolean(
      initialData.showCaption ||
      (initialData.caption && initialData.caption.trim().length > 0)
    ),
    driveUrl: resolvedDriveUrl,
  };
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
  const isCanvasElement = Boolean(
    isCanvasDomain ||
    (elementType && ['section', 'subsection', 'text', 'photo', 'gallery', 'pdf', 'documents'].includes(elementType)) ||
    (pointId && (
      /^(node\.[^.]+\.(section|subsection|text|photo|gallery|pdf|documents)|canvas\.)/i.test(pointId) ||
      /\.(section|subsection|text|photo|gallery|pdf|documents)(\.|$)/i.test(pointId)
    ))
  );

  // Canvas Draft State
  const [canvasDraft, setCanvasDraft] = useState<CanvasElementFormData>(() =>
    buildInitialCanvasDraft(initialData, elementType)
  );

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
      setCanvasDraft(buildInitialCanvasDraft(initialData, elementType));
    } else {
      const parsed = parseGenericValues(currentValue);
      setTextDraft(parsed.text);
      setLinkDraft(parsed.link);
      setImageDraft(parsed.image);
      setFileDraft(parsed.file);

      if (isSectionItem) {
        if (isNumbered !== undefined) {
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
    elementType,
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
      const init = buildInitialCanvasDraft(initialData, elementType);

      return (
        (canvasDraft.title || '') !== (init.title || '') ||
        (canvasDraft.content || '') !== (init.content || '') ||
        (canvasDraft.src || '') !== (init.src || '') ||
        (canvasDraft.alt || '') !== (init.alt || '') ||
        (canvasDraft.caption || '') !== (init.caption || '') ||
        Boolean(canvasDraft.showCaption) !== Boolean(init.showCaption) ||
        (canvasDraft.driveUrl || '') !== (init.driveUrl || '') ||
        canvasDraft.isNumbered !== init.isNumbered
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
    elementType,
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

  // Single-photo URL change handler with automatic Drive resolution
  const handlePhotoUrlChange = useCallback((val: string) => {
    const resolved = resolveSingleDrivePhotoUrl(val);
    if (resolved) {
      setCanvasDraft((prev) => ({
        ...prev,
        src: resolved.displayUrl,
        driveUrl: resolved.rawUrl,
      }));
    } else {
      setCanvasDraft((prev) => ({
        ...prev,
        src: val,
        driveUrl: '',
      }));
    }
  }, []);

  // Single-PDF URL change handler with automatic Drive /preview resolution
  const handlePdfUrlChange = useCallback((val: string) => {
    const resolved = resolveSingleDrivePdfUrl(val);
    if (resolved) {
      setCanvasDraft((prev) => ({
        ...prev,
        src: resolved.previewUrl,
        driveUrl: resolved.rawUrl,
      }));
    } else {
      setCanvasDraft((prev) => ({
        ...prev,
        src: val,
        driveUrl: val,
      }));
    }
  }, []);

  const pdfUrlFeedback = useMemo(() => {
    if (!isCanvasDomain || elementType !== 'pdf') return null;
    const raw = (canvasDraft.driveUrl || canvasDraft.src || '').trim();
    if (!raw) return null;
    if (resolveSingleDrivePdfUrl(raw)) return null;
    if (raw.includes('/folders/') || raw.includes('/folders')) {
      return 'This looks like a Google Drive folder link. Paste a single PDF file link (/file/d/...) instead.';
    }
    return 'Paste a valid Google Drive file link (e.g. https://drive.google.com/file/d/.../view).';
  }, [isCanvasDomain, elementType, canvasDraft.driveUrl, canvasDraft.src]);

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

    // Notify parent of section numbering change (Canvas AST is SSOT; zero ContentDB .isNumbered writes)
    if (isSectionItem && onNumberedChange) {
      onNumberedChange(isNumberedDraft);
    }

    // Persist content override strictly in draft sandbox
    // Subtask 3.7: Canvas AST is the sole authority for canvas items — strip ContentDB writes for canvas elements
    if (pointId && !isCanvasElement) {
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
    if (isCanvasDomain || isCanvasElement) {
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

    if (isSectionItem) {
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
      onConfirm={handleSave}
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
              <label className={styles.fieldLabel} htmlFor="canvas-photo-url">
                Photo URL <span className={styles.requiredMark}>*</span>
              </label>
              <input
                id="canvas-photo-url"
                ref={(el) => { initialFocusRef.current = el; }}
                type="text"
                className={styles.input}
                value={canvasDraft.driveUrl || canvasDraft.src || ''}
                onChange={(e) => handlePhotoUrlChange(e.target.value)}
                placeholder="Paste any Google Drive photo link (e.g. https://drive.google.com/file/d/.../view)"
                aria-label="Photo URL"
              />
            </div>

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

        {isCanvasDomain && elementType === 'pdf' && (
          <div className={styles.panel}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="canvas-pdf-title">
                Document Title
              </label>
              <input
                id="canvas-pdf-title"
                ref={(el) => { initialFocusRef.current = el; }}
                type="text"
                className={styles.input}
                value={canvasDraft.title || ''}
                onChange={(e) => setCanvasDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Q1 Financial Report"
                aria-label="Document Title"
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel} htmlFor="canvas-pdf-url">
                Google Drive PDF URL <span className={styles.requiredMark}>*</span>
              </label>
              <input
                id="canvas-pdf-url"
                type="text"
                className={styles.input}
                value={canvasDraft.driveUrl || canvasDraft.src || ''}
                onChange={(e) => handlePdfUrlChange(e.target.value)}
                placeholder="Paste Google Drive PDF link (https://drive.google.com/file/d/.../view)"
                aria-label="Google Drive PDF URL"
              />
              {pdfUrlFeedback ? (
                <p className={styles.fieldWarning} role="status">
                  {pdfUrlFeedback}
                </p>
              ) : null}
            </div>

            <div className={styles.formField}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={Boolean(canvasDraft.showCaption)}
                  onChange={(e) => setCanvasDraft((prev) => ({ ...prev, showCaption: e.target.checked }))}
                />
                <span>Show caption below document</span>
              </label>
            </div>

            {canvasDraft.showCaption ? (
              <div className={styles.formField}>
                <label className={styles.fieldLabel} htmlFor="canvas-pdf-caption">
                  Caption
                </label>
                <input
                  id="canvas-pdf-caption"
                  type="text"
                  className={styles.input}
                  value={canvasDraft.caption || ''}
                  onChange={(e) => setCanvasDraft((prev) => ({ ...prev, caption: e.target.value }))}
                  placeholder="Optional document caption or context"
                  aria-label="Caption"
                />
              </div>
            ) : null}
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
              <label className={styles.fieldLabel} htmlFor="dev-modal-image-url">
                Photo URL <span className={styles.requiredMark}>*</span>
              </label>
              <input
                id="dev-modal-image-url"
                ref={(el) => { initialFocusRef.current = el; }}
                type="text"
                className={styles.input}
                value={imageDraft.src}
                onChange={(e) => {
                  const val = e.target.value;
                  const resolved = resolveSingleDrivePhotoUrl(val);
                  setImageDraft((prev) => ({
                    ...prev,
                    src: resolved ? resolved.displayUrl : val,
                  }));
                }}
                placeholder="Paste any Google Drive photo link (e.g. https://drive.google.com/file/d/.../view)"
                aria-label="Photo URL"
              />
            </div>

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
              <span className={styles.fileStatus}>
                {fileDraft.url ? 'Document URL linked' : 'Enter an external or Google Drive document URL above'}
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
            >
              {submitButtonLabel}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default UniversalEditModal;
