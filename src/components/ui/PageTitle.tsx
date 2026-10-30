import React, { memo } from 'react';
import { EditableText } from './EditableText';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import styles from './PageTitle.module.css';

export interface PageTitleProps {
  /** Main page headline (rendered as a semantic h1) */
  title: string;
  /** Content DB pointId for live editing */
  titlePointId?: string;
  /** Optional institutional eyebrow/kicker above the title */
  kicker?: string;
  /** Content DB pointId for kicker */
  kickerPointId?: string;
  /** Optional descriptive subtitle or summary below the title */
  subtitle?: string;
  /** Content DB pointId for subtitle */
  subtitlePointId?: string;
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
  kicker,
  kickerPointId,
  subtitle,
  subtitlePointId,
  accentColor,
  className,
  children,
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();

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
      ) : (
        <h1 className={styles.title}>{title}</h1>
      )}

      {(subtitle || (isDevMode && isDesktop && subtitlePointId)) ? (
        subtitlePointId ? (
          <EditableText
            pointId={subtitlePointId}
            defaultText={subtitle || ''}
            as="p"
            className={styles.subtitle}
          />
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
