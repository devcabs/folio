import React, { useState, useRef, useEffect, useId } from 'react';
import { indexToColLetter } from '../../utils/chartSanitizer';
import styles from './ColumnSelect.module.css';

export interface DetectedColumnOption {
  index: number;
  label: string;
  type?: 'text' | 'number';
}

export interface ColumnSelectProps {
  id: string;
  label: string;
  value: number;
  onChange: (colIndex: number) => void;
  columns: DetectedColumnOption[];
  expectedType?: 'text' | 'number';
  hint?: string;
  className?: string;
}

export const ColumnSelect: React.FC<ColumnSelectProps> = ({
  id,
  label,
  value,
  onChange,
  columns,
  hint,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const selectedCol = columns.find((c) => c.index === value);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }

      const currentIndex = columns.findIndex((c) => c.index === value);
      const nextIndex =
        e.key === 'ArrowDown'
          ? Math.min(columns.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);

      if (columns[nextIndex]) {
        onChange(columns[nextIndex].index);
      }
    }
  };

  return (
    <div className={`${styles.formGroup} ${className}`.trim()} ref={containerRef}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label} onClick={() => setIsOpen((prev) => !prev)}>
          {label}
        </label>
      </div>

      <div className={styles.selectWrapper}>
        {/* Hidden native select for test assertions & semantic forms */}
        <select
          id={`${id}-native`}
          className={styles.hiddenSelect}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          tabIndex={-1}
          aria-hidden="true"
        >
          {columns.map((col) => {
            const letter = col.index >= 0 ? ` [${indexToColLetter(col.index)}]` : '';
            return (
              <option key={col.index} value={col.index}>
                {col.label}{letter}
              </option>
            );
          })}
        </select>

        {/* Custom interactive trigger button */}
        <button
          type="button"
          id={id}
          className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          onClick={() => setIsOpen((prev) => !prev)}
          onKeyDown={handleKeyDown}
        >
          <div className={styles.triggerValue}>
            <span className={styles.triggerLabel}>
              {selectedCol?.label || 'Select column...'}
            </span>
            {selectedCol && selectedCol.index >= 0 && (
              <span className={styles.colCode}>
                [{indexToColLetter(selectedCol.index)}]
              </span>
            )}
          </div>
          <svg
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Custom styled dropdown menu */}
        {isOpen && (
          <ul
            id={listboxId}
            className={styles.dropdown}
            role="listbox"
            ref={listboxRef}
            aria-label={label}
          >
            {columns.map((col) => {
              const isSelected = col.index === value;
              return (
                <li
                  key={col.index}
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                  onClick={() => {
                    onChange(col.index);
                    setIsOpen(false);
                  }}
                >
                  <span className={styles.checkIcon} aria-hidden="true">
                    {isSelected ? '✓' : ''}
                  </span>
                  <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{col.label}</span>
                    {col.index >= 0 && (
                      <span className={styles.colCode}>
                        [{indexToColLetter(col.index)}]
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
};
