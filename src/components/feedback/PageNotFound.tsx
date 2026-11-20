import React from 'react';
import { Button } from '../ui/Button';
import { EditableText } from '../ui/EditableText';
import { PageIcon } from '../ui/PageIcon';
import { ArrowRightIcon } from '../ui/Icons';
import type { PageMatchCandidate } from '../../types/page';
import styles from './PageNotFound.module.css';

export interface PageNotFoundProps {
  onReturn?: () => void;
  title?: string;
  description?: string;
  errorCode?: string;
  returnLabel?: string;
  className?: string;
  nearestParent?: {
    id: string;
    title: string;
    path?: string;
  } | null;
  onReturnToParent?: (pageId: string) => void;
  suggestions?: PageMatchCandidate[];
  onSelectSuggestion?: (pageId: string) => void;
}

/**
 * PageNotFound Component
 * Smart Fuzzy Recovery 404 Fallback View adhering to the Modern Academic Editorial design.
 */
export const PageNotFound: React.FC<PageNotFoundProps> = ({
  onReturn,
  title = 'Page Not Found',
  description = 'The page you are looking for could not be found.',
  errorCode = '404',
  returnLabel = 'Back to Home',
  className,
  suggestions,
  onSelectSuggestion,
}) => {
  const visibleSuggestions = suggestions ? suggestions.slice(0, 5) : [];

  return (
    <main className={`${styles.notFoundWrapper} ${className || ''}`.trim()} role="main">
      <div className={styles.mainArea}>
        <EditableText
          pointId="notFound.errorCode"
          defaultText={errorCode}
          as="div"
          className={styles.errorCode}
        />
        <EditableText
          pointId="notFound.title"
          defaultText={title}
          as="h1"
          className={styles.title}
        />
        <EditableText
          pointId="notFound.description"
          defaultText={description}
          as="p"
          className={styles.description}
        />
        {onReturn && (
          <div className={styles.actionsRow}>
            <Button variant="primary" onClick={onReturn}>
              <EditableText
                pointId="notFound.returnButton"
                defaultText={returnLabel}
                as="span"
                inline={true}
              />
            </Button>
          </div>
        )}
      </div>

      {suggestions && visibleSuggestions.length === 0 && (
        <section className={styles.suggestionsSection} aria-label="Similar pages">
          <p className={styles.noSuggestions} role="status">
            There are no similar pages.
          </p>
        </section>
      )}

      {visibleSuggestions.length > 0 && (
        <section className={styles.suggestionsSection} aria-label="Similar pages">
          <h2 className={styles.suggestionsHeading}>Were you looking for</h2>
          <ul className={styles.suggestionsList}>
            {visibleSuggestions.map((item) => (
              <li key={item.id}>
                <a
                  href={item.path}
                  className={styles.suggestionRow}
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectSuggestion?.(item.id);
                  }}
                >
                  <PageIcon size={16} className={styles.suggestionIcon} />
                  <span className={styles.suggestionMeta}>
                    <span className={styles.suggestionTitle}>{item.title}</span>
                    <span className={styles.suggestionPath}>{item.breadcrumbLabel}</span>
                  </span>
                  <ArrowRightIcon size={14} className={styles.suggestionArrow} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
};

export default PageNotFound;
