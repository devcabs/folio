import React from 'react';
import styles from './PageNotFound.module.css';

export interface PageNotFoundProps {
  onReturn?: () => void;
  title?: string;
  description?: string;
  errorCode?: string;
  returnLabel?: string;
  className?: string;
}

/**
 * PageNotFound Component
 * Dignified 404 Fallback View adhering to the Modern Academic Editorial design.
 */
export const PageNotFound: React.FC<PageNotFoundProps> = ({
  onReturn,
  title = 'Pathway Uncharted in Registry',
  description = 'The requested resource or document view could not be located in this registry.',
  errorCode = '[HTTP 404 · ROUTE UNRESOLVED]',
  returnLabel = 'Return to Overview',
  className,
}) => {
  return (
    <main className={`${styles.notFoundWrapper} ${className ?? ''}`.trim()} role="main">
      <div className={styles.errorCode}>{errorCode}</div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      {onReturn && (
        <button type="button" className={styles.returnButton} onClick={onReturn}>
          <svg
            className={styles.returnIcon}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10 13L5 8l5-5" />
          </svg>
          <span>{returnLabel}</span>
        </button>
      )}
    </main>
  );
};

export default PageNotFound;
