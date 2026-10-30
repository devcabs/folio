import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import type { CanvasElementType } from '../../types/canvas';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import styles from './CanvasControls.module.css';

export interface CanvasAddBarProps {
  onAddElement: (type: CanvasElementType) => void;
  isInitialStarter?: boolean;
  accentColor?: string;
  className?: string;
  label?: string;
  barId?: string;
  activeBarId?: string | null;
  onToggleActive?: (barId: string, isOpen: boolean) => void;
}

interface PaletteOptionItem {
  type: CanvasElementType;
  label: string;
  IconComponent: React.ComponentType<{ className?: string }>;
}

// Crisp, bespoke SVG Icons adhering to Modern Academic Editorial
const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SectionIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M7 15h10" />
  </svg>
);

const SubsectionIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 5h16" />
    <path d="M9 12h11" />
    <path d="M9 18h8" />
    <polyline points="4 9 4 15 7 15" />
  </svg>
);

const TextIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);

const PhotoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const GalleryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ChartIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

// Hoisted static palette options declared at module scope (Vercel Best Practice: rerender-no-inline-components)
const PALETTE_OPTIONS: readonly PaletteOptionItem[] = [
  { type: 'section', label: 'Section', IconComponent: SectionIcon },
  { type: 'subsection', label: 'Subsection', IconComponent: SubsectionIcon },
  { type: 'text', label: 'Text', IconComponent: TextIcon },
  { type: 'photo', label: 'Photo', IconComponent: PhotoIcon },
  { type: 'chart', label: 'Chart', IconComponent: ChartIcon },
];

/**
 * CanvasAddBar Component
 * Folio Engine — Task 8.9: Coordinated Insertion Bar with Viewport-Aware Submenu
 *
 * Interactive authoring trigger for coordinators in Developer Mode:
 * - When Developer Mode is OFF: Returns null (completely invisible to public visitors)
 * - Initial Starter Mode: Renders an inviting prompt box to add the first section
 * - Between-Element Mode: Gutter that dynamically reveals a subtle accent guide line
 *   and centered "+ Add Element" pill button on hover
 * - 5-Item Palette Popover: Section, Subsection, Text, Photo, Chart (parenthesis-free)
 * - Photo Sub-Menu: Single Photo vs Photo Gallery with viewport detection (dropup vs dropdown)
 * - Coordinated active state suppressing sibling hovers and duplicate menus
 * - Adheres strictly to Universal Zero Outline Policy and design tokens
 */
export const CanvasAddBar: React.FC<CanvasAddBarProps> = memo(({
  onAddElement,
  isInitialStarter = false,
  accentColor: _accentColor,
  className,
  label = 'Click to add the first Section',
  barId,
  activeBarId,
  onToggleActive,
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isDropup, setIsDropup] = useState(false);
  const [isPhotoSubMenuOpen, setIsPhotoSubMenuOpen] = useState(false);
  const [isPhotoSubMenuPinned, setIsPhotoSubMenuPinned] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const photoLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMenuOpen = barId && activeBarId !== undefined ? activeBarId === barId : internalIsOpen;
  const isSuppressed = Boolean(activeBarId && barId && activeBarId !== barId);

  const clearPhotoLeaveTimer = useCallback(() => {
    if (photoLeaveTimerRef.current) {
      clearTimeout(photoLeaveTimerRef.current);
      photoLeaveTimerRef.current = null;
    }
  }, []);

  const handlePhotoMouseEnter = useCallback(() => {
    clearPhotoLeaveTimer();
    setIsPhotoSubMenuOpen(true);
  }, [clearPhotoLeaveTimer]);

  const handlePhotoMouseLeave = useCallback(() => {
    clearPhotoLeaveTimer();
    if (!isPhotoSubMenuPinned) {
      // 350ms grace period allowing diagonal cursor travel into dropdown or dropup without snapping shut
      photoLeaveTimerRef.current = setTimeout(() => {
        setIsPhotoSubMenuOpen(false);
      }, 350);
    }
  }, [clearPhotoLeaveTimer, isPhotoSubMenuPinned]);

  const handlePhotoClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clearPhotoLeaveTimer();
    setIsPhotoSubMenuPinned(prev => !prev);
    setIsPhotoSubMenuOpen(prev => !prev);
  }, [clearPhotoLeaveTimer]);

  const handleOtherOptionMouseEnter = useCallback(() => {
    if (!isPhotoSubMenuPinned) {
      clearPhotoLeaveTimer();
      setIsPhotoSubMenuOpen(false);
    }
  }, [isPhotoSubMenuPinned, clearPhotoLeaveTimer]);

  const closeMenu = useCallback(() => {
    clearPhotoLeaveTimer();
    setInternalIsOpen(false);
    setIsPhotoSubMenuOpen(false);
    setIsPhotoSubMenuPinned(false);
    if (barId && onToggleActive) {
      onToggleActive(barId, false);
    }
  }, [barId, onToggleActive, clearPhotoLeaveTimer]);

  const toggleMenu = useCallback(() => {
    if (isMenuOpen) {
      closeMenu();
    } else {
      clearPhotoLeaveTimer();
      // Viewport proximity calculation (dropup vs dropdown)
      const rect = buttonRef.current?.getBoundingClientRect();
      const spaceBelow = rect ? window.innerHeight - rect.bottom : 300;
      setIsDropup(spaceBelow < 240);
      setInternalIsOpen(true);
      setIsPhotoSubMenuOpen(false);
      setIsPhotoSubMenuPinned(false);
      if (barId && onToggleActive) {
        onToggleActive(barId, true);
      }
    }
  }, [isMenuOpen, closeMenu, barId, onToggleActive, clearPhotoLeaveTimer]);

  useEffect(() => {
    return () => {
      clearPhotoLeaveTimer();
    };
  }, [clearPhotoLeaveTimer]);

  // Vercel Best Practice: client-event-listeners with clean teardown
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, closeMenu]);

  // Invisible to public visitors or non-desktop viewports
  if (!isDevMode || !isDesktop) {
    return null;
  }

  // Initial starter mode for empty canvas
  if (isInitialStarter) {
    return (
      <div className={`${styles.starterContainer} ${className || ''}`.trim()}>
        <button
          type="button"
          className={styles.starterButton}
          onClick={() => onAddElement('section')}
        >
          <span className={styles.plusIcon}>
            <PlusIcon />
          </span>
          <span>{label}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${styles.addBarGutter} ${isMenuOpen ? styles.addBarActive : ''} ${isSuppressed ? styles.addBarSuppressed : ''} ${className || ''}`.trim()}
      role="region"
      aria-label="Insert element"
    >
      <div className={styles.hoverGuideLine} aria-hidden="true" />
      <button
        ref={buttonRef}
        type="button"
        className={styles.addPillButton}
        onClick={toggleMenu}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
      >
        <span className={styles.plusIcon}>
          <PlusIcon />
        </span>
        <span>Add Element</span>
      </button>

      {isMenuOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Add Element Palette"
          className={`${styles.paletteMenu} ${isDropup ? styles.dropupMenu : styles.dropdownMenu}`}
        >
          {PALETTE_OPTIONS.map((opt) => {
            const Icon = opt.IconComponent;
            if (opt.type === 'photo') {
              return (
                <div
                  key={opt.type}
                  className={styles.paletteOptionWrapper}
                  onMouseEnter={handlePhotoMouseEnter}
                  onMouseLeave={handlePhotoMouseLeave}
                >
                  <button
                    role="menuitem"
                    type="button"
                    className={`${styles.paletteOption} ${isPhotoSubMenuOpen ? styles.paletteOptionActive : ''}`.trim()}
                    onClick={handlePhotoClick}
                    aria-haspopup="menu"
                    aria-expanded={isPhotoSubMenuOpen}
                  >
                    <span className={styles.paletteIcon} aria-hidden="true">
                      <Icon />
                    </span>
                    <span>{opt.label}</span>
                    <span className={styles.chevronIcon} aria-hidden="true">
                      <ChevronRightIcon />
                    </span>
                  </button>

                  {isPhotoSubMenuOpen && (
                    <div
                      role="menu"
                      aria-label="Photo Element Options"
                      className={`${styles.subMenu} ${isDropup ? styles.dropupSubMenu : ''}`}
                      onMouseEnter={handlePhotoMouseEnter}
                      onMouseLeave={handlePhotoMouseLeave}
                    >
                      <button
                        role="menuitem"
                        type="button"
                        className={styles.subOption}
                        onClick={() => {
                          onAddElement('photo');
                          closeMenu();
                        }}
                      >
                        <span className={styles.subOptionIcon} aria-hidden="true">
                          <PhotoIcon />
                        </span>
                        <span>Single Photo</span>
                      </button>
                      <button
                        role="menuitem"
                        type="button"
                        className={styles.subOption}
                        onClick={() => {
                          onAddElement('gallery');
                          closeMenu();
                        }}
                      >
                        <span className={styles.subOptionIcon} aria-hidden="true">
                          <GalleryIcon />
                        </span>
                        <span>Photo Gallery</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={opt.type}
                role="menuitem"
                type="button"
                className={styles.paletteOption}
                onMouseEnter={handleOtherOptionMouseEnter}
                onClick={() => {
                  onAddElement(opt.type);
                  closeMenu();
                }}
              >
                <span className={styles.paletteIcon} aria-hidden="true">
                  <Icon />
                </span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

CanvasAddBar.displayName = 'CanvasAddBar';

export default CanvasAddBar;
