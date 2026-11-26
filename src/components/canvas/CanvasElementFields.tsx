import React, { useCallback, useState } from 'react';
import {
  Checkbox,
  FormField,
  IconButton,
  Input,
  RefreshIcon,
  SegmentedControl,
  StatusPill,
  Textarea,
} from '../ui';
import {
  resolveSingleDrivePdfUrl,
  resolveSingleDrivePhotoUrl,
  resolveSingleVideoUrl,
} from '../../utils/mediaUrl';
import type { PageLinkCardSize, PdfLayout, VideoProvider } from '../../types/canvas';
import styles from './CanvasElementFields.module.css';

export type CanvasElementFieldType =
  | 'section'
  | 'subsection'
  | 'text'
  | 'photo'
  | 'gallery'
  | 'pdf'
  | 'video'
  | 'chart'
  | 'documents'
  | 'page-link';

export interface CanvasElementFieldsValue {
  headingType?: 'section' | 'subsection';
  title?: string;
  isNumbered?: boolean;
  content?: string;
  as?: 'p' | 'blockquote';
  src?: string;
  alt?: string;
  caption?: string;
  showCaption?: boolean;
  driveUrl?: string;
  videoUrl?: string;
  provider?: VideoProvider;
  subtitle?: string;
  slug?: string;
  summary?: string;
  coverImage?: string;
  cardSize?: PageLinkCardSize;
  layout?: PdfLayout;
}

export interface CanvasElementFieldsProps {
  elementType: CanvasElementFieldType;
  value: CanvasElementFieldsValue;
  onChange: (
    updater: (prev: CanvasElementFieldsValue) => CanvasElementFieldsValue
  ) => void;
  initialFocusRef?: React.MutableRefObject<
    HTMLInputElement | HTMLTextAreaElement | null
  >;
  pdfUrlFeedback?: string | null;
  requirePhotoAlt?: boolean;
  requireGalleryDriveUrl?: boolean;
  parentPagePath?: string;
  slugPreview?: string;
  slugError?: string | null;
  summaryWordCount?: number;
  summaryError?: string | null;
  onPageTitleChange?: (nextTitle: string) => void;
  onPageSlugChange?: (nextSlug: string) => void;
  onResetSlugFromTitle?: () => void;
}

const HEADING_TYPE_OPTIONS = [
  { value: 'section', label: 'Section' },
  { value: 'subsection', label: 'Subsection' },
] as const;

const NUMBERING_OPTIONS = [
  { value: 'numbered', label: 'Numbered' },
  { value: 'unnumbered', label: 'Unnumbered' },
] as const;

const TYPOGRAPHY_OPTIONS = [
  { value: 'p', label: 'Paragraph' },
  { value: 'blockquote', label: 'Quote / Callout' },
] as const;

const CARD_SIZE_OPTIONS = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
] as const;

const PDF_LAYOUT_OPTIONS = [
  { value: 'list', label: 'List' },
  { value: 'sm', label: 'Small' },
  { value: 'full', label: 'Full Page' },
] as const;

/**
 * Shared canonical form fields for dynamic Canvas elements
 * (section, subsection, text, photo, gallery, pdf, chart),
 * consumed by both CanvasAddModal and UniversalEditModal.
 */
export const CanvasElementFields: React.FC<CanvasElementFieldsProps> = ({
  elementType,
  value,
  onChange,
  initialFocusRef,
  pdfUrlFeedback,
  requirePhotoAlt = false,
  requireGalleryDriveUrl = false,
  parentPagePath,
  slugPreview,
  slugError = null,
  summaryWordCount: _summaryWordCount = 0,
  summaryError = null,
  onPageTitleChange,
  onPageSlugChange,
  onResetSlugFromTitle,
}) => {
  const [pageLinkTab, setPageLinkTab] = useState<'general' | 'advanced'>('general');

  const assignFocusRef = useCallback(
    (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      if (initialFocusRef) {
        initialFocusRef.current = el;
      }
    },
    [initialFocusRef]
  );

  const handlePhotoUrlChange = useCallback(
    (rawValue: string) => {
      const resolved = resolveSingleDrivePhotoUrl(rawValue);
      onChange((prev) =>
        resolved
          ? {
            ...prev,
            src: resolved.displayUrl,
            driveUrl: resolved.rawUrl,
          }
          : {
            ...prev,
            src: rawValue,
            driveUrl: '',
          }
      );
    },
    [onChange]
  );

  const handlePdfUrlChange = useCallback(
    (rawValue: string) => {
      const resolved = resolveSingleDrivePdfUrl(rawValue);
      onChange((prev) =>
        resolved
          ? {
            ...prev,
            src: resolved.previewUrl,
            driveUrl: resolved.rawUrl,
          }
          : {
            ...prev,
            src: rawValue,
            driveUrl: rawValue,
          }
      );
    },
    [onChange]
  );

  const handleVideoUrlChange = useCallback(
    (rawValue: string) => {
      const resolved = resolveSingleVideoUrl(rawValue);
      onChange((prev) =>
        resolved
          ? {
            ...prev,
            videoUrl: resolved.rawUrl,
            src: resolved.embedUrl,
            provider: resolved.provider,
          }
          : {
            ...prev,
            videoUrl: rawValue,
            src: rawValue,
            provider: undefined,
          }
      );
    },
    [onChange]
  );

  if (elementType === 'section' || elementType === 'subsection') {
    const activeHeadingType: 'section' | 'subsection' =
      value.headingType ?? (elementType === 'subsection' ? 'subsection' : 'section');
    const isSectionHeading = activeHeadingType === 'section';
    const titleFieldId = isSectionHeading ? 'canvas-section-title' : 'canvas-subsection-title';
    const titleLabel = isSectionHeading ? 'Section Title' : 'Subsection Title';
    const titlePlaceholder = isSectionHeading
      ? 'e.g. Strategic Academic Intervention'
      : 'e.g. Implementation Milestones';

    return (
      <div className={styles.panel}>
        <FormField id="canvas-heading-type" label="Heading Level">
          <SegmentedControl
            aria-label="Heading Level"
            value={activeHeadingType}
            onChange={(next) =>
              onChange((prev) => ({
                ...prev,
                headingType: next as 'section' | 'subsection',
              }))
            }
            options={HEADING_TYPE_OPTIONS}
          />
        </FormField>

        <FormField id={titleFieldId} label={titleLabel} required>
          <Input
            id={titleFieldId}
            ref={assignFocusRef}
            type="text"
            value={value.title || ''}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder={titlePlaceholder}
            aria-label={titleLabel}
            required
          />
        </FormField>

        {isSectionHeading && (
          <FormField
            id="canvas-section-numbering"
            label="Section Numbering"
            tooltip="Adds a number before the title, like I or II."
          >
            <SegmentedControl
              aria-label="Section Numbering"
              value={value.isNumbered !== false ? 'numbered' : 'unnumbered'}
              onChange={(next) =>
                onChange((prev) => ({
                  ...prev,
                  isNumbered: next === 'numbered',
                }))
              }
              options={NUMBERING_OPTIONS}
            />
          </FormField>
        )}
      </div>
    );
  }

  if (elementType === 'text') {
    return (
      <div className={styles.panel}>
        <FormField id="canvas-text-style" label="Typography Style">
          <SegmentedControl
            aria-label="Typography Style"
            value={value.as === 'blockquote' ? 'blockquote' : 'p'}
            onChange={(next) =>
              onChange((prev) => ({ ...prev, as: next }))
            }
            options={TYPOGRAPHY_OPTIONS}
          />
        </FormField>

        <FormField
          id="canvas-text-content"
          label="Narrative Content"
          required
        >
          <Textarea
            id="canvas-text-content"
            ref={assignFocusRef}
            value={value.content || ''}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, content: e.target.value }))
            }
            placeholder="Type narrative overview, milestone progress, or editorial testimony..."
            rows={5}
            aria-label="Narrative Text Content"
            required
          />
        </FormField>
      </div>
    );
  }

  if (elementType === 'photo') {
    const photoInputValue = value.src?.startsWith('data:')
      ? ''
      : value.driveUrl || value.src || '';

    return (
      <div className={styles.panel}>
        <FormField id="canvas-photo-url" label="Photo URL" required>
          <Input
            id="canvas-photo-url"
            ref={assignFocusRef}
            type="text"
            value={photoInputValue}
            onChange={(e) => handlePhotoUrlChange(e.target.value)}
            placeholder="Paste any Google Drive photo link (e.g. https://drive.google.com/file/d/.../view)"
            aria-label="Photo URL"
          />
        </FormField>

        {value.src ? (
          <div className={styles.imagePreviewWrapper}>
            <img
              src={value.src}
              alt={value.alt || 'Selected preview'}
              className={styles.previewThumb}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : null}

        <FormField
          id="canvas-photo-alt"
          label="Alt Text (Accessibility)"
          required={requirePhotoAlt}
        >
          <Input
            id="canvas-photo-alt"
            type="text"
            value={value.alt || ''}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, alt: e.target.value }))
            }
            placeholder="Descriptive image summary for screen readers"
            aria-label="Photo Alt Text"
            required={requirePhotoAlt}
          />
        </FormField>

        <Checkbox
          checked={Boolean(value.showCaption)}
          onChange={(checked) =>
            onChange((prev) => ({ ...prev, showCaption: checked }))
          }
          label="Show caption below photo"
        />

        {value.showCaption ? (
          <FormField id="canvas-photo-caption" label="Caption">
            <Input
              id="canvas-photo-caption"
              type="text"
              value={value.caption || ''}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, caption: e.target.value }))
              }
              placeholder="Photo caption or description"
              aria-label="Photo Caption"
            />
          </FormField>
        ) : null}
      </div>
    );
  }

  if (elementType === 'gallery') {
    return (
      <div className={styles.panel}>
        <FormField id="canvas-gallery-title" label="Gallery Title" required>
          <Input
            id="canvas-gallery-title"
            ref={assignFocusRef}
            type="text"
            value={value.title || ''}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="e.g. Mid-Year Assessment & Verification"
            aria-label="Gallery Title"
            required
          />
        </FormField>

        <FormField
          id="canvas-gallery-drive"
          label={
            requireGalleryDriveUrl
              ? 'Google Drive Repository URL'
              : 'Google Drive Folder URL (Optional)'
          }
          required={requireGalleryDriveUrl}
          tooltip="A link to an online folder with more photos or files."
        >
          <Input
            id="canvas-gallery-drive"
            type="text"
            value={value.driveUrl || ''}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, driveUrl: e.target.value }))
            }
            placeholder="https://drive.google.com/drive/folders/..."
            aria-label="Google Drive URL"
          />
        </FormField>
      </div>
    );
  }

  if (elementType === 'pdf') {
    return (
      <div className={styles.panel}>
        <FormField id="canvas-pdf-title" label="Document Title">
          <Input
            id="canvas-pdf-title"
            ref={assignFocusRef}
            type="text"
            value={value.title || ''}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="e.g. Q1 Financial Report"
            aria-label="Document Title"
          />
        </FormField>

        <FormField id="canvas-pdf-url" label="Google Drive PDF URL" required>
          <Input
            id="canvas-pdf-url"
            type="text"
            value={value.driveUrl || value.src || ''}
            onChange={(e) => handlePdfUrlChange(e.target.value)}
            placeholder="Paste Google Drive PDF link (https://drive.google.com/file/d/.../view)"
            aria-label="Google Drive PDF URL"
          />
        </FormField>

        {pdfUrlFeedback ? (
          <p className={styles.fieldWarning} role="status">
            {pdfUrlFeedback}
          </p>
        ) : null}

        <FormField id="canvas-pdf-layout" label="Display Layout" role="group">
          <SegmentedControl
            label="Display Layout"
            aria-label="Display Layout"
            options={PDF_LAYOUT_OPTIONS}
            value={value.layout ?? 'list'}
            onChange={(nextLayout) =>
              onChange((prev) => ({
                ...prev,
                layout: nextLayout as PdfLayout,
              }))
            }
          />
        </FormField>

        <Checkbox
          checked={Boolean(value.showCaption)}
          onChange={(checked) =>
            onChange((prev) => ({ ...prev, showCaption: checked }))
          }
          label="Show caption below document"
        />

        {value.showCaption ? (
          <FormField id="canvas-pdf-caption" label="Caption">
            <Input
              id="canvas-pdf-caption"
              type="text"
              value={value.caption || ''}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, caption: e.target.value }))
              }
              placeholder="Optional document caption or context"
              aria-label="Caption"
            />
          </FormField>
        ) : null}
      </div>
    );
  }

  if (elementType === 'video') {
    const rawVideoInput = (value.videoUrl ?? value.src ?? '').trim();
    const resolvedVideo = rawVideoInput ? resolveSingleVideoUrl(rawVideoInput) : null;
    const videoUrlError =
      rawVideoInput && !resolvedVideo
        ? 'Paste a valid YouTube or Google Drive video link (folders are not supported).'
        : null;

    return (
      <div className={styles.panel}>
        <FormField
          id="canvas-video-url"
          label="Video Link"
          required
          error={videoUrlError}
          hint={
            resolvedVideo ? (
              <StatusPill
                variant={resolvedVideo.provider === 'youtube' ? 'primary' : 'blue'}
                size="sm"
                label={resolvedVideo.provider === 'youtube' ? 'YouTube' : 'Google Drive'}
              />
            ) : undefined
          }
        >
          <Input
            id="canvas-video-url"
            ref={assignFocusRef}
            type="text"
            invalid={Boolean(videoUrlError)}
            value={value.videoUrl ?? value.src ?? ''}
            onChange={(e) => handleVideoUrlChange(e.target.value)}
            placeholder="Paste a YouTube or Google Drive video link"
            aria-label="Video Link"
            required
          />
        </FormField>

        <FormField id="canvas-video-title" label="Title">
          <Input
            id="canvas-video-title"
            type="text"
            value={value.title || ''}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="e.g. Program Briefing"
            aria-label="Title"
          />
        </FormField>

        <Checkbox
          checked={Boolean(value.showCaption)}
          onChange={(checked) =>
            onChange((prev) => ({ ...prev, showCaption: checked }))
          }
          label="Show caption below video"
        />

        {value.showCaption ? (
          <FormField id="canvas-video-caption" label="Caption">
            <Input
              id="canvas-video-caption"
              type="text"
              value={value.caption || ''}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, caption: e.target.value }))
              }
              placeholder="Optional video caption or context"
              aria-label="Caption"
            />
          </FormField>
        ) : null}
      </div>
    );
  }

  if (elementType === 'chart') {
    return (
      <div className={styles.panel}>
        <FormField id="canvas-chart-title" label="Chart Title" required>
          <Input
            id="canvas-chart-title"
            ref={assignFocusRef}
            type="text"
            value={value.title || ''}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="e.g. Learner Mastery by Learning Area"
            aria-label="Chart Title"
            required
          />
        </FormField>

        <FormField
          id="canvas-chart-subtitle"
          label="Subtitle / Description (Optional)"
        >
          <Input
            id="canvas-chart-subtitle"
            type="text"
            value={value.subtitle || ''}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, subtitle: e.target.value }))
            }
            placeholder="Quarterly performance against benchmark standard"
            aria-label="Chart Subtitle"
          />
        </FormField>
      </div>
    );
  }

  if (elementType === 'page-link') {
    const normalizedParentPath = (parentPagePath || '').replace(/\/+$/, '');
    const previewSegment = slugPreview !== undefined ? slugPreview : (value.slug || '').trim();

    return (
      <div className={styles.panel}>
        <SegmentedControl
          size="sm"
          aria-label="Page settings"
          value={pageLinkTab}
          onChange={setPageLinkTab}
          options={[
            { value: 'general', label: 'General' },
            { value: 'advanced', label: 'Advanced' },
          ]}
        />

        {pageLinkTab === 'general' ? (
          <>
            <FormField id="canvas-page-title" label="Page Title" required>
              <Input
                id="canvas-page-title"
                ref={assignFocusRef}
                type="text"
                value={value.title || ''}
                onChange={(e) => {
                  const nextTitle = e.target.value;
                  if (onPageTitleChange) {
                    onPageTitleChange(nextTitle);
                  } else {
                    onChange((prev) => ({ ...prev, title: nextTitle }));
                  }
                }}
                placeholder="e.g. 2026 Field Research"
                aria-label="Page Title"
                required
              />
            </FormField>

            <FormField id="canvas-page-card-size" label="Card Size" role="group">
              <SegmentedControl
                label="Card Size"
                aria-label="Card Size"
                options={CARD_SIZE_OPTIONS}
                value={value.cardSize ?? 'md'}
                onChange={(size) =>
                  onChange((prev) => ({
                    ...prev,
                    cardSize: size as PageLinkCardSize,
                  }))
                }
              />
            </FormField>
          </>
        ) : (
          <>
            <FormField
              id="canvas-page-slug"
              label="URL Name"
              required
              error={slugError}
              hint={
                <code className={styles.urlPreview}>
                  {`${normalizedParentPath}/${previewSegment || '…'}/`}
                </code>
              }
            >
              <div className={styles.inputWithAction}>
                <Input
                  id="canvas-page-slug"
                  type="text"
                  monospace
                  invalid={Boolean(slugError)}
                  className={styles.inputFlex}
                  value={value.slug || ''}
                  onChange={(e) => {
                    const nextSlug = e.target.value;
                    if (onPageSlugChange) {
                      onPageSlugChange(nextSlug);
                    } else {
                      onChange((prev) => ({ ...prev, slug: nextSlug }));
                    }
                  }}
                  placeholder="e.g. 2026-field-research"
                  aria-label="URL Name"
                  required
                />
                {onResetSlugFromTitle ? (
                  <IconButton
                    variant="secondary"
                    size="sm"
                    shape="square"
                    aria-label="Reset URL name from Page Title"
                    title="Reset URL name from Page Title"
                    disabled={!value.title?.trim()}
                    onClick={onResetSlugFromTitle}
                  >
                    <RefreshIcon size={15} />
                  </IconButton>
                ) : null}
              </div>
            </FormField>

            <FormField
              id="canvas-page-summary"
              label="Summary"
              error={summaryError}
            >
              <Input
                id="canvas-page-summary"
                type="text"
                invalid={Boolean(summaryError)}
                value={value.summary || ''}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, summary: e.target.value }))
                }
                placeholder="Optional 1-line summary"
                aria-label="Summary"
              />
            </FormField>

            <FormField
              id="canvas-page-cover"
              label="Cover Image URL"
            >
              <Input
                id="canvas-page-cover"
                type="url"
                value={value.coverImage || ''}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, coverImage: e.target.value }))
                }
                placeholder="https://..."
                aria-label="Cover Image URL"
              />
            </FormField>
          </>
        )}
      </div>
    );
  }

  return null;
};

export default CanvasElementFields;
