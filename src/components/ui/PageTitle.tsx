import React, { memo } from 'react';
import { EditableText } from './EditableText';
import { DevActionAffordance } from '../dev/DevActionAffordance';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import styles from './PageTitle.module.css';

export interface PageTitleProps {
  /** Main page headline (rendered as a semantic h1) */
  title: string;
  /** Content DB pointId for live editing */
  titlePointId?: string;
  /** Direct save handler for title when backed by an external SSOT record (e.g. PageNode) instead of ContentDB */
  onSaveTitle?: (newTitle: string) => void | Promise<void>;
  /** Optional intercept callback to open a unified metadata modal (e.g. PageNode edit modal) on ✎ Edit */
  onEditTitle?: () => void;
  /** Optional institutional eyebrow/kicker above the title */
  kicker?: string;
  /** Content DB pointId for kicker */
  kickerPointId?: string;
  /** Optional descriptive subtitle or summary below the title */
  subtitle?: string;
  /** Content DB pointId for subtitle */
  subtitlePointId?: string;
  /** Direct save handler for subtitle/summary when backed by an external SSOT record */
  onSaveSubtitle?: (newSubtitle: string) => void | Promise<void>;
  /** Optional intercept callback for subtitle ✎ Edit */
  onEditSubtitle?: () => void;
  /** Optional institutional accent color (defaults to var(--folio-primary)) */
  accentColor?: string;
  /** Optional custom CSS class */
  className?: string;
  /** Optional supplementary elements or action slots */
  children?: React.ReactNode;
}

/**
 * PageTitle Component (Canonical Typography Primitive)
 *
 * Implements Modern Academic Editorial page heading:
 * - Single h1 per page for strict SEO and document outline hierarchy
 * - Elegant serif typography (Fraunces) with tightened editorial tracking
 * - High-contrast readable lead subtitle
 * - Pure token-driven styling
 * - Integrated live editing via Content DB pointIds
 */
export const PageTitle: React.FC<PageTitleProps> = memo(({
  title,
  titlePointId,
  onSaveTitle,
  onEditTitle,
  kicker,
  kickerPointId,
  subtitle,
  subtitlePointId,
  onSaveSubtitle,
  onEditSubtitle,
  accentColor,
  className,
  children,
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();
  const canEditDirectTitle = isDevMode && isDesktop && Boolean(onEditTitle || onSaveTitle);
  const canEditDirectSubtitle = isDevMode && isDesktop && Boolean(onEditSubtitle || onSaveSubtitle);

  return (
    <header
      className={`${styles.pageHeader} ${className || ''}`}
      style={{ '--title-accent': accentColor } as React.CSSProperties}
    >
      {(kicker || (isDevMode && isDesktop && kickerPointId)) ? (
        kickerPointId ? (
          <EditableText
            pointId={kickerPointId}
            defaultText={kicker || ''}
            as="div"
            className={styles.kicker}
          />
        ) : (
          <div className={styles.kicker}>{kicker}</div>
        )
      ) : null}

      {titlePointId ? (
        <EditableText
          pointId={titlePointId}
          defaultText={title}
          as="h1"
          className={styles.title}
        />
      ) : canEditDirectTitle ? (
        <DevActionAffordance
          type="text"
          currentValue={title}
          defaultValue={title}
          onEditText={onEditTitle}
          onSave={onSaveTitle ? (val) => { void onSaveTitle(val); } : undefined}
        >
          <h1 className={styles.title}>{title}</h1>
        </DevActionAffordance>
      ) : (
        <h1 className={styles.title}>{title}</h1>
      )}

      {(subtitle || (isDevMode && isDesktop && subtitlePointId) || canEditDirectSubtitle) ? (
        subtitlePointId ? (
          <EditableText
            pointId={subtitlePointId}
            defaultText={subtitle || ''}
            as="p"
            className={styles.subtitle}
          />
        ) : canEditDirectSubtitle ? (
          <DevActionAffordance
            type="text"
            currentValue={subtitle || ''}
            defaultValue={subtitle || ''}
            onEditText={onEditSubtitle}
            onSave={onSaveSubtitle ? (val) => { void onSaveSubtitle(val); } : undefined}
          >
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : ''}
          </DevActionAffordance>
        ) : (
          <p className={styles.subtitle}>{subtitle}</p>
        )
      ) : null}

      {children && <div className={styles.extra}>{children}</div>}
    </header>
  );
});

PageTitle.displayName = 'PageTitle';

export default PageTitle;
