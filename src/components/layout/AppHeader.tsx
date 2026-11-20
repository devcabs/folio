import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { NavItem } from '../../types/navigation';
import { ParametricShape } from '../ui/ParametricShape';
import { IconButton } from '../ui/IconButton';
import { Button } from '../ui/Button';
import { ChevronDownIcon } from '../ui/Icons';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import styles from './AppHeader.module.css';

export type { NavItem };

export interface AppHeaderProps {
  brandTitle?: string;
  /** @deprecated Header retains only the primary title; subtitle is no longer displayed. */
  brandSubtitle?: string;
  brandLetter?: string;
  navItems?: NavItem[];
  mobileOnlyNav?: boolean;
  onNavigatePage?: (pageId: string) => void;
  maxVisibleDesktopItems?: number;
  onRoadmapClick?: (e?: React.MouseEvent) => void;
  onOverviewClick?: (e?: React.MouseEvent) => void;
  onBrandClick?: (e?: React.MouseEvent) => void;
  ctaLabel?: string;
  ctaHref?: string;
  isCtaVisible?: boolean;
  isCtaRevolving?: boolean;
  isCtaPulsing?: boolean;
  onCtaClick?: (e?: React.MouseEvent) => void;
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: 'Roadmap', href: '#sequence-roadmap' },
  { label: 'Overview', href: '#main-content' },
];

const MORE_DROPDOWN_KEY = '__more__';
const LEAVE_GRACE_MS = 180;

function getItemKey(item: NavItem): string {
  return item.id || item.pageId || item.label;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  brandTitle = 'Portal',
  brandLetter,
  navItems,
  mobileOnlyNav = false,
  onNavigatePage,
  maxVisibleDesktopItems = 5,
  onRoadmapClick,
  onOverviewClick,
  onBrandClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const sealClicksRef = useRef<number[]>([]);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusFirstOnOpenRef = useRef<string | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { openPinModal } = useDeveloperMode();

  const handleSealClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    sealClicksRef.current = [...sealClicksRef.current.filter((t) => now - t < 3000), now];
    if (sealClicksRef.current.length >= 5) {
      sealClicksRef.current = [];
      openPinModal(false);
    }
  };

  const effectiveNavItems = navItems !== undefined ? navItems : DEFAULT_NAV_ITEMS;

  const hasOverflow =
    maxVisibleDesktopItems > 0 && effectiveNavItems.length > maxVisibleDesktopItems;
  const visibleDesktopItems = hasOverflow
    ? effectiveNavItems.slice(0, Math.max(0, maxVisibleDesktopItems - 1))
    : effectiveNavItems;
  const overflowDesktopItems = hasOverflow
    ? effectiveNavItems.slice(Math.max(0, maxVisibleDesktopItems - 1))
    : [];

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const scheduleCloseDropdown = useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      setOpenDropdownId(null);
    }, LEAVE_GRACE_MS);
  }, [clearLeaveTimer]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleClose = () => {
    setIsOpen(false);
    setOpenDropdownId(null);
  };

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.pageId && onNavigatePage) {
      e.preventDefault();
      setIsOpen(false);
      setOpenDropdownId(null);
      onNavigatePage(item.pageId);
      return;
    }

    const lower = item.label.toLowerCase();

    // 1. Home Roadmap Navigation
    if (
      item.href === '#sequence-roadmap' ||
      item.href === '#roadmap' ||
      (lower === 'roadmap' && !item.href.startsWith('#node'))
    ) {
      e.preventDefault();
      handleClose();
      onRoadmapClick?.(e);
      return;
    }

    // 2. Home Overview Anchor
    if (item.href === '#main-content') {
      e.preventDefault();
      handleClose();
      onOverviewClick?.(e);
      return;
    }

    // 3. In-page sections and sub-chapters anchor navigation (Node ToC sections)
    if (item.href.startsWith('#')) {
      e.preventDefault();
      handleClose();
      const targetId = item.id || item.href.slice(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        const headerOffset = 100;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth',
        });
      }
      return;
    }

    if (lower === 'overview') {
      e.preventDefault();
      handleClose();
      onOverviewClick?.(e);
    }
  };

  const openDropdownAndFocusFirst = useCallback(
    (dropdownKey: string) => {
      clearLeaveTimer();
      focusFirstOnOpenRef.current = dropdownKey;
      setOpenDropdownId(dropdownKey);
    },
    [clearLeaveTimer]
  );

  // Focus first menu item when opened via keyboard ArrowDown
  useEffect(() => {
    if (openDropdownId && focusFirstOnOpenRef.current === openDropdownId) {
      focusFirstOnOpenRef.current = null;
      const menuEl = menuRefs.current[openDropdownId];
      if (menuEl) {
        const items = Array.from(menuEl.querySelectorAll('a')) as HTMLElement[];
        items[0]?.focus();
      }
    }
  }, [openDropdownId]);

  // Cleanup hover timer on unmount
  useEffect(() => {
    return () => clearLeaveTimer();
  }, [clearLeaveTimer]);

  // Keyboard accessibility: Escape key closes open menus and restores trigger focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openDropdownId) {
          const closingKey = openDropdownId;
          setOpenDropdownId(null);
          triggerRefs.current[closingKey]?.focus();
        }
        if (isOpen) {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openDropdownId]);

  // Click outside listener: clicking outside the header capsule closes open menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setOpenDropdownId(null);
      }
    };
    if (isOpen || openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, openDropdownId]);

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, dropdownKey: string) => {
    const menuEl = menuRefs.current[dropdownKey];
    const items = menuEl ? (Array.from(menuEl.querySelectorAll('a')) as HTMLElement[]) : [];
    if (items.length === 0) return;

    const currentIndex = items.findIndex((el) => el === document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % items.length;
      items[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      items[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpenDropdownId(null);
      triggerRefs.current[dropdownKey]?.focus();
    }
  };

  return (
    <header ref={headerRef} className={styles.siteHeader} role="banner">
      <a href="#roadmap" className={styles.skipLink}>
        Skip to content
      </a>

      {/* Floating Capsule Navbar */}
      <nav className={`${styles.navCapsule} ${styles.noCta}`} aria-label="Main Navigation">
        {/* Brand Group */}
        <a
          href="#"
          className={styles.brandGroup}
          aria-label={`${brandTitle} Home`}
          onClick={(e) => {
            if (onBrandClick) {
              e.preventDefault();
              handleClose();
              onBrandClick(e);
            }
          }}
        >
          <span
            onClick={handleSealClick}
            style={{ display: 'inline-flex' }}
            title="Brand Mark"
          >
            <ParametricShape size="sm" letter={brandLetter} />
          </span>
          <div className={styles.brandMeta}>
            <span className={styles.brandTitle}>{brandTitle}</span>
          </div>
        </a>

        {/* Center Navigation Links (Desktop) */}
        {!mobileOnlyNav && effectiveNavItems.length > 0 && (
          <ul className={styles.navLinks}>
            {visibleDesktopItems.map((item) => {
              const key = getItemKey(item);
              const level2Children = item.children ?? [];
              const hasChildren = level2Children.length > 0;
              const isDropdownOpen = openDropdownId === key;
              const dropdownId = `header-dropdown-${key}`;

              return (
                <li
                  key={key}
                  className={styles.navItem}
                  onMouseEnter={() => {
                    if (hasChildren) {
                      clearLeaveTimer();
                      setOpenDropdownId(key);
                    }
                  }}
                  onMouseLeave={() => {
                    if (hasChildren) {
                      scheduleCloseDropdown();
                    }
                  }}
                >
                  {hasChildren ? (
                    <div className={styles.navItemGroup}>
                      <a
                        href={item.href}
                        className={`${styles.navLink} ${
                          item.isActive ? styles.navLinkActive : ''
                        }`}
                        aria-current={item.isActive ? 'page' : undefined}
                        onClick={(e) => handleNavClick(item, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            openDropdownAndFocusFirst(key);
                          }
                        }}
                      >
                        {item.label}
                      </a>
                      <IconButton
                        ref={(el) => {
                          triggerRefs.current[key] = el;
                        }}
                        variant="ghost"
                        size="xs"
                        className={styles.dropdownChevronBtn}
                        aria-label={`${item.label} subpages`}
                        aria-haspopup="menu"
                        aria-expanded={isDropdownOpen}
                        aria-controls={dropdownId}
                        onClick={() => {
                          clearLeaveTimer();
                          setOpenDropdownId((prev) => (prev === key ? null : key));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            openDropdownAndFocusFirst(key);
                          }
                        }}
                      >
                        <span
                          className={`${styles.chevronIcon} ${
                            isDropdownOpen ? styles.chevronIconOpen : ''
                          }`}
                        >
                          <ChevronDownIcon size={12} />
                        </span>
                      </IconButton>

                      {isDropdownOpen && (
                        <div
                          id={dropdownId}
                          ref={(el) => {
                            menuRefs.current[key] = el;
                          }}
                          className={styles.desktopDropdown}
                          role="menu"
                          aria-label={`${item.label} subpages`}
                          onKeyDown={(e) => handleMenuKeyDown(e, key)}
                        >
                          {level2Children.map((child) => (
                            <a
                              key={getItemKey(child)}
                              href={child.href}
                              role="menuitem"
                              className={`${styles.desktopDropdownItem} ${
                                child.isActive ? styles.desktopDropdownItemActive : ''
                              }`}
                              aria-current={child.isActive ? 'page' : undefined}
                              onClick={(e) => handleNavClick(child, e)}
                            >
                              {child.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <a
                      href={item.href}
                      className={`${styles.navLink} ${
                        item.isActive ? styles.navLinkActive : ''
                      }`}
                      aria-current={item.isActive ? 'page' : undefined}
                      onClick={(e) => handleNavClick(item, e)}
                    >
                      {item.label}
                    </a>
                  )}
                </li>
              );
            })}

            {hasOverflow && (
              <li
                className={styles.navItem}
                onMouseEnter={() => {
                  clearLeaveTimer();
                  setOpenDropdownId(MORE_DROPDOWN_KEY);
                }}
                onMouseLeave={scheduleCloseDropdown}
              >
                <Button
                  ref={(el) => {
                    triggerRefs.current[MORE_DROPDOWN_KEY] = el;
                  }}
                  variant="ghost"
                  size="xs"
                  className={styles.moreTrigger}
                  aria-haspopup="menu"
                  aria-expanded={openDropdownId === MORE_DROPDOWN_KEY}
                  aria-controls="header-dropdown-more"
                  onClick={() => {
                    clearLeaveTimer();
                    setOpenDropdownId((prev) =>
                      prev === MORE_DROPDOWN_KEY ? null : MORE_DROPDOWN_KEY
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      openDropdownAndFocusFirst(MORE_DROPDOWN_KEY);
                    }
                  }}
                >
                  <span>More</span>
                  <span
                    className={`${styles.chevronIcon} ${
                      openDropdownId === MORE_DROPDOWN_KEY ? styles.chevronIconOpen : ''
                    }`}
                  >
                    <ChevronDownIcon size={12} />
                  </span>
                </Button>

                {openDropdownId === MORE_DROPDOWN_KEY && (
                  <div
                    id="header-dropdown-more"
                    ref={(el) => {
                      menuRefs.current[MORE_DROPDOWN_KEY] = el;
                    }}
                    className={`${styles.desktopDropdown} ${styles.desktopDropdownRight}`}
                    role="menu"
                    aria-label="More chapters"
                    onKeyDown={(e) => handleMenuKeyDown(e, MORE_DROPDOWN_KEY)}
                  >
                    {overflowDesktopItems.map((chapter) => (
                      <React.Fragment key={getItemKey(chapter)}>
                        <a
                          href={chapter.href}
                          role="menuitem"
                          className={`${styles.desktopDropdownItem} ${
                            chapter.isActive ? styles.desktopDropdownItemActive : ''
                          }`}
                          aria-current={chapter.isActive ? 'page' : undefined}
                          onClick={(e) => handleNavClick(chapter, e)}
                        >
                          {chapter.label}
                        </a>
                        {(chapter.children ?? []).map((sub) => (
                          <a
                            key={getItemKey(sub)}
                            href={sub.href}
                            role="menuitem"
                            className={`${styles.desktopDropdownItem} ${styles.desktopDropdownSubItem} ${
                              sub.isActive ? styles.desktopDropdownItemActive : ''
                            }`}
                            aria-current={sub.isActive ? 'page' : undefined}
                            onClick={(e) => handleNavClick(sub, e)}
                          >
                            {sub.label}
                          </a>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </li>
            )}
          </ul>
        )}

        {/* Right Animated Menu Toggle (Mobile) */}
        {effectiveNavItems.length > 0 && (
          <div
            className={`${styles.navAction} ${
              mobileOnlyNav ? styles.navActionMobileOnly : ''
            }`}
          >
            <IconButton
              variant="ghost"
              size="sm"
              className={styles.menuToggle}
              onClick={handleToggle}
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isOpen}
              aria-controls="app-mobile-nav"
            >
              <div className={styles.menuIcon} aria-hidden="true">
                <span
                  className={`${styles.menuLine} ${styles.menuLineTop} ${
                    isOpen ? styles.menuLineTopOpen : ''
                  }`}
                />
                <span
                  className={`${styles.menuLine} ${styles.menuLineBottom} ${
                    isOpen ? styles.menuLineBottomOpen : ''
                  }`}
                />
              </div>
            </IconButton>
          </div>
        )}

        {/* Mobile Dropdown Menu (Option A: Strictly 2-Level Chapters + Level 2 Subpages) */}
        {isOpen && effectiveNavItems.length > 0 && (
          <div
            id="app-mobile-nav"
            className={`${styles.mobileDropdown} ${
              mobileOnlyNav ? styles.mobileDropdownAlways : ''
            }`}
            role="menu"
            aria-label="Mobile Navigation Menu"
          >
            {effectiveNavItems.map((item) => {
              const level2Children = item.children ?? [];
              return (
                <div key={getItemKey(item)} className={styles.mobileChapterGroup}>
                  <a
                    href={item.href}
                    className={`${styles.mobileNavLink} ${
                      item.isActive ? styles.mobileNavLinkActive : ''
                    }`}
                    role="menuitem"
                    aria-current={item.isActive ? 'page' : undefined}
                    onClick={(e) => {
                      handleClose();
                      handleNavClick(item, e);
                    }}
                  >
                    {item.number && <span className={styles.itemNumber}>{item.number}</span>}
                    <span className={styles.itemLabel}>{item.label}</span>
                  </a>

                  {level2Children.length > 0 && (
                    <div className={styles.mobileSubList}>
                      {level2Children.map((child) => (
                        <a
                          key={getItemKey(child)}
                          href={child.href}
                          className={`${styles.mobileSubNavLink} ${
                            child.isActive ? styles.mobileSubNavLinkActive : ''
                          }`}
                          role="menuitem"
                          aria-current={child.isActive ? 'page' : undefined}
                          onClick={(e) => {
                            handleClose();
                            handleNavClick(child, e);
                          }}
                        >
                          <span className={styles.itemLabel}>{child.label}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>
    </header>
  );
};

export default AppHeader;
