import React, { useMemo, useCallback, useState, useEffect } from 'react';
import type { NavItem } from '../../types/navigation';
import { useScrollspy } from '../../hooks/use-scrollspy';
import { Button } from '../ui/Button';
import styles from './EditorialSidebar.module.css';

export interface EditorialSidebarProps {
  /** Optional section heading (defaults to "Contents") */
  title?: string;
  /** Navigation anchor items */
  items?: NavItem[];
  /** Controlled active item ID (if not provided, automatically computed via useScrollspy) */
  activeId?: string;
  /** Accent color for the active indicator bar (defaults to var(--folio-primary)) */
  accentColor?: string;
  /** Callback fired when an item is selected */
  onItemClick?: (item: NavItem) => void;
  /** Optional CSS class name override */
  className?: string;
  /** Breadcrumb properties for sticky sidebar integration */
  nodeNumber?: number;
  nodeTitle?: string;
  /** Label for the sticky top back button (defaults to "Roadmap") */
  backLabel?: string;
  onBack?: () => void;
}

/**
 * EditorialSidebar Component (Canonical Layout Primitive)
 * 
 * Reusable side rail navigation for long-form editorial views:
 * - Sticky position pinned below the AppHeader capsule
 * - Outermost last branch breadcrumb on top of the sidebar in sticky mode
 * - Automatic document-order reading-line scrollspy tracking
 * - Smooth scroll with top navigation offset calculation
 * - Active state indicator using calm surface tint (zero outline/left highlight)
 * - Collapses automatically on mobile (< 1024px)
 * - Universal Zero Outline Policy compliant
 */
export const EditorialSidebar: React.FC<EditorialSidebarProps> = ({
  title = 'Contents',
  items = [],
  activeId: controlledActiveId,
  accentColor,
  onItemClick,
  className,
  nodeNumber: _nodeNumber,
  nodeTitle: _nodeTitle,
  backLabel = 'Roadmap',
  onBack,
}) => {
  // Extract element IDs (including nested subsections) in document order for scrollspy monitoring
  const itemIds = useMemo(() => {
    const ids: string[] = [];
    const collectIds = (navItems: NavItem[]) => {
      for (const item of navItems) {
        const id = item.id || (item.href.startsWith('#') ? item.href.slice(1) : '');
        if (id) ids.push(id);
        if (item.children && item.children.length > 0) {
          collectIds(item.children);
        }
      }
    };
    collectIds(items);
    return ids;
  }, [items]);

  const [clickLockedId, setClickLockedId] = useState<string | null>(null);

  const observedActiveId = useScrollspy(itemIds, {
    defaultActiveId: itemIds[0] || '',
    offsetPx: 140,
  });

  const effectiveActiveId = controlledActiveId || clickLockedId || observedActiveId;

  const handleLinkClick = useCallback(
    (e: React.MouseEvent, item: NavItem) => {
      e.preventDefault();
      onItemClick?.(item);

      const targetId = item.id || (item.href.startsWith('#') ? item.href.slice(1) : '');

      if (targetId) {
        setClickLockedId(targetId);
      }

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
    },
    [onItemClick]
  );

  // Clear click-lock when user manually initiates a scroll gesture
  useEffect(() => {
    if (!clickLockedId) return;

    const handleUserScrollInteraction = (e: Event) => {
      // Ignore programmatic clicks on navigation elements
      if ((e.target as HTMLElement)?.closest('button, a')) return;
      setClickLockedId(null);
    };

    window.addEventListener('wheel', handleUserScrollInteraction, { passive: true });
    window.addEventListener('touchmove', handleUserScrollInteraction, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleUserScrollInteraction);
      window.removeEventListener('touchmove', handleUserScrollInteraction);
    };
  }, [clickLockedId]);

  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkSticky = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      setIsSticky(scrollY > 40);
    };

    checkSticky();
    window.addEventListener('scroll', checkSticky, { passive: true });
    return () => window.removeEventListener('scroll', checkSticky);
  }, []);

  return (
    <aside
      className={`${styles.sidebarContainer} ${className || ''}`}
      aria-label={`${title} navigation`}
      style={{ '--sidebar-accent': accentColor } as React.CSSProperties}
    >
      {/* 1. Nearest Location Breadcrumb on Top of Sticky Sidebar (< Roadmap / < Parent) */}
      {onBack && (
        <div
          className={`${styles.sidebarBreadcrumb} ${isSticky ? styles.sidebarBreadcrumbSticky : ''}`}
          aria-hidden={!isSticky}
        >
          <Button
            variant="ghost"
            size="xs"
            className={styles.breadcrumbBackBtn}
            onClick={onBack}
            aria-label={`Return to ${backLabel}`}
            title={`Return to ${backLabel}`}
            tabIndex={isSticky ? 0 : -1}
          >
            <svg
              className={styles.breadcrumbArrow}
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
            <span className={styles.backLabelText}>{backLabel}</span>
          </Button>
        </div>
      )}

      {/* 2. Canonical Contents Section Heading */}
      <div className={styles.sidebarHeading}>{title}</div>

      {/* 3. Navigation List with High-Contrast Active State */}
      <nav>
        <ul className={styles.navList}>
          {items.map((item) => {
            const renderNavLink = (navItem: NavItem, isSubsection: boolean) => {
              const itemId = navItem.id || (navItem.href.startsWith('#') ? navItem.href.slice(1) : '');
              const isActive = navItem.isActive ?? (Boolean(itemId) && effectiveActiveId === itemId);

              return (
                <a
                  href={navItem.href}
                  className={`${styles.navLink} ${isSubsection ? styles.subNavLink : ''} ${isActive ? styles.navLinkActive : ''}`.trim()}
                  onClick={(e) => handleLinkClick(e, navItem)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {navItem.number && <span className={styles.itemNumber}>{navItem.number}</span>}
                  <span className={styles.itemLabel}>{navItem.label}</span>
                </a>
              );
            };

            return (
              <li key={item.id || item.href} className={styles.navItem}>
                {renderNavLink(item, item.level === 'subsection')}
                {item.children && item.children.length > 0 && (
                  <ul className={styles.subNavList}>
                    {item.children.map((subItem) => (
                      <li key={subItem.id || subItem.href} className={styles.subNavItem}>
                        {renderNavLink(subItem, true)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default EditorialSidebar;
