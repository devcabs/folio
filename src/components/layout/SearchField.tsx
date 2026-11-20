import React from 'react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { SearchIcon, CloseIcon, ArrowRightIcon } from '../ui/Icons';
import styles from './SearchField.module.css';

export interface SearchFieldProps {
  placeholder?: string;
  mobilePlaceholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  placeholder = 'Search nodes, projects, or indicators...',
  mobilePlaceholder = 'Search',
  onSearch,
  className,
}) => {
  const [query, setQuery] = React.useState('');
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(max-width: 640px)').matches;
    }
    return false;
  });
  const inputRef = React.useRef<HTMLInputElement>(null);
  const desktopButtonRef = React.useRef<HTMLButtonElement>(null);
  const mobileButtonRef = React.useRef<HTMLButtonElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)');
    const updateMatches = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    updateMatches(mql);
    mql.addEventListener('change', updateMatches);
    return () => mql.removeEventListener('change', updateMatches);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const isMobileView =
        isMobile ||
        (typeof window !== 'undefined' &&
          window.matchMedia('(max-width: 640px)').matches);

      const targetBtn = isMobileView
        ? mobileButtonRef.current || desktopButtonRef.current
        : desktopButtonRef.current || mobileButtonRef.current;

      if (targetBtn) {
        targetBtn.click();
      } else {
        formRef.current?.requestSubmit();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(query.trim());
    } else {
      const roadmap = document.getElementById('roadmap');
      if (roadmap) {
        roadmap.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <form
      ref={formRef}
      role="search"
      className={`${styles.searchForm} ${className || ''}`}
      onSubmit={handleSubmit}
      aria-label="Search Plan"
    >
      <div className={styles.searchPill}>
        <span className={styles.searchIconWrap} aria-hidden="true">
          <SearchIcon className={styles.searchIcon} size={21} />
        </span>

        <input
          ref={inputRef}
          type="search"
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={isMobile ? mobilePlaceholder : placeholder}
          aria-label={isMobile ? mobilePlaceholder : placeholder}
          autoComplete="off"
          spellCheck="false"
        />

        {query ? (
          <IconButton
            variant="ghost"
            size="xs"
            className={styles.clearBtn}
            onClick={handleClear}
            aria-label="Clear search input"
          >
            <CloseIcon size={14} />
          </IconButton>
        ) : (
          <kbd className={styles.shortcutKbd} aria-hidden="true" title="Press ⌘K or Ctrl+K to search">
            ⌘K
          </kbd>
        )}

        {/* Desktop inline search button */}
        <Button
          ref={desktopButtonRef}
          id="search-submit-btn"
          type="submit"
          variant="revolving-outline"
          outlineWidth={6}
          className={styles.searchSubmitBtn}
          aria-label="Search"
        >
          <span className={styles.searchSubmitText}>Search</span>
          <ArrowRightIcon className={styles.arrowIcon} size={14} />
        </Button>
      </div>

      {/* Mobile full-width sibling bottom button */}
      <Button
        ref={mobileButtonRef}
        id="search-submit-btn-mobile"
        type="submit"
        variant="revolving-outline"
        outlineWidth={6}
        className={styles.searchSubmitBtnBottom}
        aria-label="Search"
      >
        <span className={styles.searchSubmitText}>Search</span>
        <svg
          className={styles.arrowIcon}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </Button>
    </form>
  );
};

export default SearchField;
