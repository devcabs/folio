import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal, ModalActions } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DevHelpTooltip } from '../ui/DevHelpTooltip';
import type {
  CanvasModalMode,
  CanvasModalElementType,
  CanvasElementFormData,
} from '../../types/canvas';
import type { PageRegistry } from '../../types/page';
import type {
  DevEditType,
  DevLinkData,
  DevImageData,
  DevFileData,
} from '../../types/developer';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt';
import { usePortalChrome } from '../../context/PortalChromeContext';
import { resolveSingleDrivePhotoUrl, resolveSingleDrivePdfUrl, resolveSingleVideoUrl } from '../../utils/mediaUrl';
import {
  MAX_PAGE_SUMMARY_WORDS,
  countSummaryWords,
  ensureUniqueSiblingSlug,
  sanitizeSlug,
  validateSlug,
} from '../../services/pageTreeService';
import { CanvasElementFields } from '../canvas/CanvasElementFields';
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
  onSubmit?: (data: CanvasElementFormData) => void | Promise<void>;
  onResetToDefault?: () => void;

  // Page Metadata Context Props (Subtask 13.13)
  parentPagePath?: string;
  parentPageId?: string;
  existingPages?: PageRegistry;
  editingPageId?: string;

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
    case 'video':
      return 'Video';
    case 'documents':
      return 'Document Folder';
    case 'page-link':
      return 'Page';
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
      videoUrl: '',
      provider: undefined,
      slug: '',
      summary: '',
      cardSize: 'md',
    };
  }

  let resolvedSrc = initialData.src || '';
  let resolvedDriveUrl = initialData.driveUrl || '';
  let resolvedVideoUrl = initialData.videoUrl || '';
  let resolvedProvider = initialData.provider;

  if (elementType === 'pdf') {
    const resolvedPdf = initialData.src ? resolveSingleDrivePdfUrl(initialData.src) : null;
    if (resolvedPdf) {
      resolvedSrc = resolvedPdf.previewUrl;
      resolvedDriveUrl = resolvedDriveUrl || initialData.src || '';
    }
  } else if (elementType === 'video') {
    const candidateVideo = initialData.videoUrl || initialData.src || '';
    const resolvedVideo = candidateVideo ? resolveSingleVideoUrl(candidateVideo) : null;
    if (resolvedVideo) {
      resolvedSrc = resolvedVideo.embedUrl;
      resolvedVideoUrl = resolvedVideoUrl || resolvedVideo.rawUrl;
      resolvedProvider = resolvedProvider ?? resolvedVideo.provider;
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
    videoUrl: resolvedVideoUrl,
    provider: resolvedProvider,
    slug: initialData.slug || '',
    summary: initialData.summary || '',
    cardSize: initialData.cardSize ?? 'md',
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
  nodeId,
  initialData,
  onSubmit,
  onResetToDefault,
  parentPagePath,
  parentPageId,
  existingPages,
  editingPageId,
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
  const portalChrome = usePortalChrome();

  // Determine operational domain: Canvas AST element vs Generic portal string
  const isCanvasDomain = Boolean(elementType || onSubmit);
  const isCanvasElement = Boolean(
    isCanvasDomain ||
    (elementType && ['section', 'subsection', 'text', 'photo', 'gallery', 'pdf', 'video', 'documents', 'page-link'].includes(elementType)) ||
    (pointId && (
      /^(node\.[^.]+\.(section|subsection|text|photo|gallery|pdf|video|documents|page-link)|canvas\.)/i.test(pointId) ||
      /\.(section|subsection|text|photo|gallery|pdf|video|documents|page-link)(\.|$)/i.test(pointId)
    ))
  );

  // Canvas Draft State
  const [canvasDraft, setCanvasDraft] = useState<CanvasElementFormData>(() =>
    buildInitialCanvasDraft(initialData, elementType)
  );
  const [hasManuallyEditedSlug, setHasManuallyEditedSlug] = useState<boolean>(mode === 'edit');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
      setHasManuallyEditedSlug(mode === 'edit');
      setIsSubmitting(false);
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
        (canvasDraft.slug || '') !== (init.slug || '') ||
        (canvasDraft.summary || '') !== (init.summary || '') ||
        (canvasDraft.cardSize ?? 'md') !== (init.cardSize ?? 'md') ||
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

  // Page-link validation & auto-slug smart defaults (Subtask 13.13)
  const isPageLinkElement = isCanvasDomain && elementType === 'page-link';
  const effectivePages = existingPages ?? portalChrome?.pages ?? {};
  const effectiveParentId = parentPageId ?? nodeId ?? null;
  const sanitizedSlugPreview = isPageLinkElement ? sanitizeSlug(canvasDraft.slug || '') : '';

  const slugValidation = useMemo(() => {
    if (!isPageLinkElement) {
      return { valid: true, sanitized: '', error: null as string | null };
    }
    const rawSlug = (canvasDraft.slug || '').trim();
    if (!rawSlug) {
      return {
        valid: false,
        sanitized: '',
        error: hasManuallyEditedSlug ? 'URL name is required.' : null,
      };
    }
    const result = validateSlug(rawSlug, effectiveParentId, effectivePages, editingPageId);
    return {
      valid: result.valid,
      sanitized: result.sanitized,
      error: result.valid ? null : (result.error ?? 'Invalid URL name.'),
    };
  }, [
    isPageLinkElement,
    canvasDraft.slug,
    hasManuallyEditedSlug,
    effectiveParentId,
    effectivePages,
    editingPageId,
  ]);

  const summaryWordCount = isPageLinkElement ? countSummaryWords(canvasDraft.summary) : 0;
  const summaryError =
    isPageLinkElement && summaryWordCount > MAX_PAGE_SUMMARY_WORDS
      ? `Keep summary to ${MAX_PAGE_SUMMARY_WORDS} words or fewer.`
      : null;

  const canSubmitPageLink =
    !isPageLinkElement ||
    (Boolean(canvasDraft.title?.trim()) &&
      slugValidation.valid &&
      summaryWordCount <= MAX_PAGE_SUMMARY_WORDS);

  const handlePageTitleChange = (nextTitle: string) => {
    if (mode === 'add' && !hasManuallyEditedSlug) {
      const sanitized = sanitizeSlug(nextTitle);
      const nextSlug = sanitized
        ? ensureUniqueSiblingSlug(sanitized, effectiveParentId, effectivePages)
        : '';
      setCanvasDraft((prev) => ({ ...prev, title: nextTitle, slug: nextSlug }));
      return;
    }
    setCanvasDraft((prev) => ({ ...prev, title: nextTitle }));
  };

  const handlePageSlugChange = (nextSlug: string) => {
    setHasManuallyEditedSlug(true);
    setCanvasDraft((prev) => ({ ...prev, slug: nextSlug }));
  };

  const handleResetSlugFromTitle = () => {
    const sanitized = sanitizeSlug(canvasDraft.title || '');
    if (!sanitized) return;
    const uniqueSlug = ensureUniqueSiblingSlug(
      sanitized,
      effectiveParentId,
      effectivePages,
      editingPageId
    );
    setHasManuallyEditedSlug(mode === 'edit');
    setCanvasDraft((prev) => ({ ...prev, slug: uniqueSlug }));
  };

  const isVideoValid =
    !isCanvasDomain ||
    elementType !== 'video' ||
    Boolean(resolveSingleVideoUrl((canvasDraft.videoUrl || canvasDraft.src || '').trim()));

  // Submit Handler
  const handleSave = async () => {
    if (isCanvasDomain && onSubmit) {
      if (!canSubmitPageLink || !isVideoValid || isSubmitting) return;
      const result = onSubmit(canvasDraft);
      if (result && typeof (result as Promise<void>).then === 'function') {
        setIsSubmitting(true);
        try {
          await result;
          setHasUnpublishedChanges(true);
          showToast(
            mode === 'add' ? 'Element added to canvas.' : 'Changes saved to draft successfully.',
            'success'
          );
          onClose();
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : 'Failed to save changes.',
            'error'
          );
        } finally {
          setIsSubmitting(false);
        }
        return;
      }
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

    // Persist content override strictly in draft sandbox via PortalChromeContext (Bearer auth + KV SSOT)
    // Subtask 3.7: Canvas AST is the sole authority for canvas items — strip ContentDB writes for canvas elements
    if (pointId && !isCanvasElement && portalChrome) {
      const hadOverride = Object.prototype.hasOwnProperty.call(
        portalChrome.contentOverrides,
        pointId
      );
      const prevOverrideVal = hadOverride ? portalChrome.contentOverrides[pointId] : undefined;
      const defaultStr =
        typeof defaultValue === 'string'
          ? defaultValue
          : defaultValue
            ? JSON.stringify(defaultValue)
            : '';
      const prevEffectiveVal =
        hadOverride && prevOverrideVal !== undefined ? prevOverrideVal : defaultStr;

      if (prevEffectiveVal !== resultString) {
        pushAction({
          type: 'content_text_override',
          description: `Edit text for ${pointId}`,
          undo: async () => {
            try {
              if (hadOverride && prevOverrideVal !== undefined) {
                await portalChrome.updateOverride(pointId, prevOverrideVal);
              } else {
                await portalChrome.removeOverride(pointId);
              }
              return true;
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Undo failed.', 'error');
              return false;
            }
          },
          redo: async () => {
            try {
              await portalChrome.updateOverride(pointId, resultString);
              return true;
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Redo failed.', 'error');
              return false;
            }
          },
        });
      }

      if (!onSave) {
        void portalChrome.updateOverride(pointId, resultString).catch((err) => {
          showToast(
            err instanceof Error ? err.message : 'Failed to save content override to KV.',
            'error'
          );
        });
      }
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

    if (pointId && portalChrome) {
      const hadOverride = Object.prototype.hasOwnProperty.call(
        portalChrome.contentOverrides,
        pointId
      );
      const prevOverrideVal = hadOverride ? portalChrome.contentOverrides[pointId] : undefined;

      if (!onReset) {
        void portalChrome.removeOverride(pointId).catch((err) => {
          showToast(
            err instanceof Error ? err.message : 'Failed to reset content override in KV.',
            'error'
          );
        });
      }

      if (hadOverride && prevOverrideVal !== undefined) {
        pushAction({
          type: 'content_text_override',
          description: `Reset text for ${pointId}`,
          undo: async () => {
            try {
              await portalChrome.updateOverride(pointId, prevOverrideVal);
              return true;
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Undo failed.', 'error');
              return false;
            }
          },
          redo: async () => {
            try {
              await portalChrome.removeOverride(pointId);
              return true;
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Redo failed.', 'error');
              return false;
            }
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

  const modalFooter = (
    <ModalActions
      left={
        (mode === 'edit' || onResetToDefault || onReset || defaultValue) ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
          >
            Reset to default
          </Button>
        ) : undefined
      }
    >
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onClose}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={handleSave}
        disabled={!canSubmitPageLink || !isVideoValid || isSubmitting}
      >
        {submitButtonLabel}
      </Button>
    </ModalActions>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={canSubmitPageLink && isVideoValid && !isSubmitting ? handleSave : undefined}
      title={modalHeaderTitle}
      maxWidth="500px"
      ariaLabel={modalHeaderTitle}
      footer={modalFooter}
    >
      <div className={styles.container}>
        {/* DOMAIN A: Dynamic Canvas Elements */}
        {isCanvasDomain && elementType && (
          <CanvasElementFields
            elementType={elementType}
            value={canvasDraft}
            onChange={setCanvasDraft}
            initialFocusRef={initialFocusRef}
            pdfUrlFeedback={pdfUrlFeedback}
            requireGalleryDriveUrl
            parentPagePath={parentPagePath}
            slugPreview={sanitizedSlugPreview}
            slugError={slugValidation.error}
            summaryWordCount={summaryWordCount}
            summaryError={summaryError}
            onPageTitleChange={handlePageTitleChange}
            onPageSlugChange={handlePageSlugChange}
            onResetSlugFromTitle={handleResetSlugFromTitle}
          />
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
      </div>
    </Modal>
  );
};

export default UniversalEditModal;
