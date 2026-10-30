import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { acquireScrollLock, releaseScrollLock } from '../../utils/scrollLock';
import {
  registerActiveModal,
  unregisterActiveModal,
  isTopmostModal,
  isPositiveShortcut,
  findPositiveActionElement,
  triggerPositiveAction,
} from '../../utils/modalActions';
import styles from './Drawer.module.css';

export interface DrawerTabItem {
  id: string | number;
  label: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  completed?: boolean;
}

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  kicker?: React.ReactNode;
  headerActions?: React.ReactNode;
  showCloseButton?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnBackdropClick?: boolean;
  position?: 'right' | 'left';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  tabs?: DrawerTabItem[];
  activeTab?: string | number;
  onTabChange?: (tabId: string | number) => void;
  tabsContent?: React.ReactNode;
  footer?: React.ReactNode;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  onConfirm?: () => void | Promise<void>;
  enableCtrlEnter?: boolean;
  companionContent?: React.ReactNode;
}

/**
 * Drawer Component
 * Folio Engine — Canonical Modern Academic Editorial Slide-Out Drawer
 *
 * Adheres strictly to:
 * 1. Background blur with frosted glass tokens (var(--backdrop-blur), var(--overlay-scrim)).
 * 2. Synchronous body scroll locking with desktop scrollbar jitter compensation.
 * 3. First-class tabbed/stepper layout with accessible ARIA semantics.
 * 4. Sticky drawer footer with flexible button placeholders.
 * 5. Universal Zero Outline Policy & pure token styling.
 * 6. Optional companionContent rendering into remaining viewport area.
 */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  kicker,
  headerActions,
  showCloseButton = true,
  closeOnOutsideClick = true,
  closeOnBackdropClick = true,
  position = 'right',
  size = 'md',
  tabs,
  activeTab,
  onTabChange,
  tabsContent,
  footer,
  footerLeft,
  footerRight,
  children,
  className,
  bodyClassName,
  ariaLabel,
  ariaLabelledBy = 'canonical-drawer-title',
  ariaDescribedBy,
  onConfirm,
  enableCtrlEnter = true,
  companionContent,
}) => {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Lock body scrolling when drawer is open
  useEffect(() => {
    if (!isOpen) return;

    acquireScrollLock();
    return () => {
      releaseScrollLock();
    };
  }, [isOpen]);

  // Register open drawer in modal stack
  useEffect(() => {
    if (!isOpen) return;

    const el = drawerRef.current;
    if (el) {
      registerActiveModal(el);
    }
    return () => {
      if (el) {
        unregisterActiveModal(el);
      }
    };
  }, [isOpen]);

  // Keyboard navigation: Escape + Positive Action (Ctrl+Enter)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isTargeted =
        drawerRef.current &&
        (drawerRef.current.contains(document.activeElement) || isTopmostModal(drawerRef.current));

      if (e.key === 'Escape') {
        if (isTargeted) {
          e.preventDefault();
          onClose();
          return;
        }
      }

      if (enableCtrlEnter && isPositiveShortcut(e)) {
        if (isTargeted) {
          e.preventDefault();
          e.stopPropagation();

          if (onConfirm) {
            onConfirm();
            return;
          }

          if (drawerRef.current) {
            const actionTarget = findPositiveActionElement(drawerRef.current);
            if (actionTarget) {
              triggerPositiveAction(actionTarget);
            }
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, enableCtrlEnter, onConfirm]);

  if (!isMounted || (!isOpen && typeof document !== 'undefined')) {
    return null;
  }

  const canCloseOnOutside = closeOnOutsideClick && closeOnBackdropClick;

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // If closing on outside click is disabled, prevent clicking the backdrop from stealing focus
    if (!canCloseOnOutside && e.target === e.currentTarget) {
      e.preventDefault();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (canCloseOnOutside && e.target === e.currentTarget) {
      onClose();
    }
  };

  const hasFooter = Boolean(footer || footerLeft || footerRight);
  const positionClass = position === 'left' ? styles.positionLeft : styles.positionRight;
  const sizeClass = styles[`size_${size}`] || styles.size_md;

  const drawerContent = (
    <div
      className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ''}`}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      role="presentation"
    >
      {companionContent && (
        <div
          className={`${styles.companionViewport} ${
            position === 'left' ? styles.companionRight : styles.companionLeft
          }`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {companionContent}
        </div>
      )}
      <aside
        ref={drawerRef}
        className={`${styles.drawer} ${positionClass} ${sizeClass} ${
          isOpen ? styles.drawerOpen : ''
        } ${className || ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={title ? ariaLabelledBy : undefined}
        aria-describedby={ariaDescribedBy}
      >
        {/* Header */}
        {(title || kicker || showCloseButton || headerActions) && (
          <div className={styles.header}>
            <div className={styles.headerTitleWrapper}>
              {kicker && <span className={styles.kicker}>{kicker}</span>}
              {title && (
                <h2 id={ariaLabelledBy} className={styles.title}>
                  {title}
                </h2>
              )}
            </div>

            <div className={styles.headerControls}>
              {headerActions}
              {showCloseButton && (
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={onClose}
                  aria-label="Close drawer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tabs Bar */}
        {tabsContent ? (
          <div className={styles.tabsContainer}>{tabsContent}</div>
        ) : tabs && tabs.length > 0 ? (
          <nav className={styles.tabsContainer} role="tablist" aria-label="Drawer sections">
            <div className={styles.tabList}>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={String(tab.id)}
                    type="button"
                    role="tab"
                    id={`drawer-tab-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`drawer-panel-${tab.id}`}
                    className={`${styles.tabButton} ${isActive ? styles.tabActive : ''} ${
                      tab.completed ? styles.tabCompleted : ''
                    }`}
                    onClick={() => {
                      if (!tab.disabled && onTabChange) {
                        onTabChange(tab.id);
                      }
                    }}
                    disabled={tab.disabled}
                  >
                    {tab.badge !== undefined && tab.badge !== null && (
                      <span className={styles.tabBadge}>{tab.badge}</span>
                    )}
                    <span className={styles.tabLabel}>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}

        {/* Scrollable Body */}
        <div className={`${styles.body} ${bodyClassName || ''}`}>{children}</div>

        {/* Drawer Footer with Buttons Placeholder */}
        {hasFooter && (
          <footer className={styles.footer}>
            {footer ? (
              footer
            ) : (
              <>
                <div className={styles.footerLeft}>{footerLeft}</div>
                <div className={styles.footerRight}>{footerRight}</div>
              </>
            )}
          </footer>
        )}
      </aside>
    </div>
  );

  return createPortal(drawerContent, document.body);
};

export default Drawer;
