import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import type { CanvasElementType } from '../../types/canvas';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { PageIcon } from '../ui/PageIcon';
import { VideoIcon } from '../ui/Icons';
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

interface SubMenuOptionItem {
  type: CanvasElementType;
  label: string;
  IconComponent: React.ComponentType<{ className?: string }>;
}

interface PaletteOptionItem {
  id: string;
  label: string;
  IconComponent: React.ComponentType<{ className?: string }>;
  type?: CanvasElementType;
  children?: readonly SubMenuOptionItem[];
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

const DocumentIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const VideoMenuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <VideoIcon className={className} size={15} />
);

// Hoisted static palette options declared at module scope (Vercel Best Practice: rerender-no-inline-components)
const PALETTE_OPTIONS: readonly PaletteOptionItem[] = [
  {
    id: 'structure',
    label: 'Structure',
    IconComponent: SectionIcon,
    children: [
      { type: 'section', label: 'Section', IconComponent: SectionIcon },
      { type: 'subsection', label: 'Subsection', IconComponent: SubsectionIcon },
      { type: 'page-link', label: 'Page', IconComponent: PageIcon },
    ],
  },
  { id: 'text', type: 'text', label: 'Text', IconComponent: TextIcon },
  {
    id: 'media',
    label: 'Media',
    IconComponent: PhotoIcon,
    children: [
      { type: 'photo', label: 'Single Photo', IconComponent: PhotoIcon },
      { type: 'video', label: 'Single Video', IconComponent: VideoMenuIcon },
      { type: 'gallery', label: 'Media Gallery', IconComponent: GalleryIcon },
    ],
  },
  {
    id: 'docs-data',
    label: 'Docs & Data',
    IconComponent: DocumentIcon,
    children: [
      { type: 'pdf', label: 'Single PDF', IconComponent: DocumentIcon },
      { type: 'documents', label: 'PDF Folder', IconComponent: FolderIcon },
      { type: 'chart', label: 'Chart', IconComponent: ChartIcon },
    ],
  },
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
 * - Compact 4-Item Palette Popover: Structure (Section, Subsection, Page), Text,
 *   Media (Single Photo, Single Video, Media Gallery), Docs & Data (Single PDF, PDF Folder, Chart)
 * - Viewport detection (dropup vs dropdown) and 350ms hover grace period
 * - Coordinated active state suppressing sibling hovers and duplicate menus
 * - Adheres strictly to Universal Zero Outline Policy and design tokens
 */
export const CanvasAddBar: React.FC<CanvasAddBarProps> = memo(({
  onAddElement,
  isInitialStarter: _isInitialStarter = false,
  accentColor: _accentColor,
  className,
  label: _label = 'Click to add the first Section',
  barId,
  activeBarId,
  onToggleActive,
}) => {
  const { isDevMode, isDesktop } = useDeveloperMode();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isDropup, setIsDropup] = useState(false);
  const [openSubMenuId, setOpenSubMenuId] = useState<string | null>(null);
  const [pinnedSubMenuId, setPinnedSubMenuId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMenuOpen = barId && activeBarId !== undefined ? activeBarId === barId : internalIsOpen;
  const isSuppressed = Boolean(activeBarId && barId && activeBarId !== barId);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const handleGroupMouseEnter = useCallback((groupId: string) => {
    clearLeaveTimer();
    setOpenSubMenuId(groupId);
    if (pinnedSubMenuId && pinnedSubMenuId !== groupId) {
      setPinnedSubMenuId(null);
    }
  }, [clearLeaveTimer, pinnedSubMenuId]);

  const handleGroupMouseLeave = useCallback((groupId: string) => {
    clearLeaveTimer();
    if (pinnedSubMenuId !== groupId) {
      // 350ms grace period allowing diagonal cursor travel into dropdown or dropup without snapping shut
      leaveTimerRef.current = setTimeout(() => {
        setOpenSubMenuId((prev) => (prev === groupId ? null : prev));
      }, 350);
    }
  }, [clearLeaveTimer, pinnedSubMenuId]);

  const handleGroupClick = useCallback((e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    clearLeaveTimer();
    const isCurrentlyPinned = pinnedSubMenuId === groupId;
    setPinnedSubMenuId(isCurrentlyPinned ? null : groupId);
    setOpenSubMenuId(isCurrentlyPinned ? null : groupId);
  }, [clearLeaveTimer, pinnedSubMenuId]);

  const handleDirectOptionMouseEnter = useCallback(() => {
    if (!pinnedSubMenuId) {
      clearLeaveTimer();
      setOpenSubMenuId(null);
    }
  }, [pinnedSubMenuId, clearLeaveTimer]);

  const closeMenu = useCallback(() => {
    clearLeaveTimer();
    setInternalIsOpen(false);
    setOpenSubMenuId(null);
    setPinnedSubMenuId(null);
    if (barId && onToggleActive) {
      onToggleActive(barId, false);
    }
  }, [barId, onToggleActive, clearLeaveTimer]);

  const toggleMenu = useCallback(() => {
    if (isMenuOpen) {
      closeMenu();
    } else {
      clearLeaveTimer();
      // Viewport proximity calculation (dropup vs dropdown)
      const rect =
        typeof buttonRef.current?.getBoundingClientRect === 'function'
          ? buttonRef.current.getBoundingClientRect()
          : null;
      const spaceBelow = rect ? window.innerHeight - rect.bottom : 300;
      setIsDropup(spaceBelow < 280);
      setInternalIsOpen(true);
      setOpenSubMenuId(null);
      setPinnedSubMenuId(null);
      if (barId && onToggleActive) {
        onToggleActive(barId, true);
      }
    }
  }, [isMenuOpen, closeMenu, barId, onToggleActive, clearLeaveTimer]);

  useEffect(() => {
    return () => {
      clearLeaveTimer();
    };
  }, [clearLeaveTimer]);

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
            if (opt.children) {
              const isSubMenuOpen = openSubMenuId === opt.id;
              return (
                <div
                  key={opt.id}
                  className={styles.paletteOptionWrapper}
                  onMouseEnter={() => handleGroupMouseEnter(opt.id)}
                  onMouseLeave={() => handleGroupMouseLeave(opt.id)}
                >
                  <button
                    role="menuitem"
                    type="button"
                    className={`${styles.paletteOption} ${isSubMenuOpen ? styles.paletteOptionActive : ''}`.trim()}
                    onClick={(e) => handleGroupClick(e, opt.id)}
                    aria-haspopup="menu"
                    aria-expanded={isSubMenuOpen}
                  >
                    <span className={styles.paletteIcon} aria-hidden="true">
                      <Icon />
                    </span>
                    <span>{opt.label}</span>
                    <span className={styles.chevronIcon} aria-hidden="true">
                      <ChevronRightIcon />
                    </span>
                  </button>

                  {isSubMenuOpen && (
                    <div
                      role="menu"
                      aria-label={`${opt.label} Element Options`}
                      className={`${styles.subMenu} ${isDropup ? styles.dropupSubMenu : ''}`}
                      onMouseEnter={() => handleGroupMouseEnter(opt.id)}
                      onMouseLeave={() => handleGroupMouseLeave(opt.id)}
                    >
                      {opt.children.map((sub) => {
                        const SubIcon = sub.IconComponent;
                        return (
                          <button
                            key={sub.type}
                            role="menuitem"
                            type="button"
                            className={styles.subOption}
                            onClick={() => {
                              onAddElement(sub.type);
                              closeMenu();
                            }}
                          >
                            <span className={styles.subOptionIcon} aria-hidden="true">
                              <SubIcon />
                            </span>
                            <span>{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={opt.id}
                role="menuitem"
                type="button"
                className={styles.paletteOption}
                onMouseEnter={handleDirectOptionMouseEnter}
                onClick={() => {
                  if (opt.type) {
                    onAddElement(opt.type);
                  }
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
