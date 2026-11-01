import React, { useState, useEffect, useRef } from 'react';
import type { NavItem } from '../../types/navigation';
import { ParametricShape } from '../ui/ParametricShape';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import styles from './AppHeader.module.css';

export type { NavItem };

export interface AppHeaderProps {
  brandTitle?: string;
  brandSubtitle?: string;
  brandLetter?: string;
  navItems?: NavItem[];
  mobileOnlyNav?: boolean;
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

export const AppHeader: React.FC<AppHeaderProps> = ({
  brandTitle = 'Portal',
  brandSubtitle,
  brandLetter,
  navItems,
  mobileOnlyNav = false,
  onRoadmapClick,
  onOverviewClick,
  onBrandClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const sealClicksRef = useRef<number[]>([]);
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

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    const lower = item.label.toLowerCase();

    // 1. Home Roadmap Navigation
    if (item.href === '#sequence-roadmap' || item.href === '#roadmap' || (lower === 'roadmap' && !item.href.startsWith('#node'))) {
      e.preventDefault();
      setIsOpen(false);
      onRoadmapClick?.(e);
      return;
    }

    // 2. Home Overview Anchor
    if (item.href === '#main-content') {
      e.preventDefault();
      setIsOpen(false);
      onOverviewClick?.(e);
      return;
    }

    // 3. In-page sections and sub-chapters anchor navigation (Node ToC sections)
    if (item.href.startsWith('#')) {
      e.preventDefault();
      setIsOpen(false);
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
      setIsOpen(false);
      onOverviewClick?.(e);
      return;
    }
  };

  // Keyboard accessibility: Escape key closes the open mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click outside listener: clicking outside the header capsule closes the mobile menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <header ref={headerRef} className={styles.siteHeader} role="banner">
      <a href="#roadmap" className={styles.skipLink}>
        Skip to content
      </a>

      {/* Floating Capsule Navbar matching Portrait Inspiration Reference */}
      <nav
        className={`${styles.navCapsule} ${styles.noCta}`}
        aria-label="Main Navigation"
      >
        {/* Brand Group */}
        <a
          href="#"
          className={styles.brandGroup}
          aria-label={`${brandTitle} Home`}
          onClick={(e) => {
            if (onBrandClick) {
              e.preventDefault();
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
            {brandSubtitle && <span className={styles.brandSubtitle}>{brandSubtitle}</span>}
          </div>
        </a>

        {/* Center Navigation Links (Desktop) */}
        {!mobileOnlyNav && effectiveNavItems.length > 0 && (
          <ul className={styles.navLinks}>
            {effectiveNavItems.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className={styles.navLink}
                  onClick={(e) => handleNavClick(item, e)}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* Right Animated Menu Toggle (Mobile) */}
        {effectiveNavItems.length > 0 && (
          <div
            className={`${styles.navAction} ${
              mobileOnlyNav ? styles.navActionMobileOnly : ''
            }`}
          >
            {/* Animated 2-Line Menu Toggle Button (Portrait.so Inspiration) */}
            <button
              type="button"
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
            </button>
          </div>
        )}

        {/* Mobile Dropdown Menu (revealed when animated menu button is open) */}
        {isOpen && effectiveNavItems.length > 0 && (
          <div
            id="app-mobile-nav"
            className={styles.mobileDropdown}
            role="menu"
            aria-label="Mobile Navigation Menu"
          >
            {effectiveNavItems.map((item) => (
              <a
                key={item.id || item.href || item.label}
                href={item.href}
                className={styles.mobileNavLink}
                role="menuitem"
                onClick={(e) => {
                  handleClose();
                  handleNavClick(item, e);
                }}
              >
                {item.number && <span className={styles.itemNumber}>{item.number}</span>}
                <span className={styles.itemLabel}>{item.label}</span>
              </a>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
};

export default AppHeader;

