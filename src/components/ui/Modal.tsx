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
import { IconButton } from './IconButton';
import styles from './Modal.module.css';

export interface ModalActionsProps {
  children: React.ReactNode;
  left?: React.ReactNode;
  align?: 'end' | 'between' | 'start';
  className?: string;
}

export const ModalActions: React.FC<ModalActionsProps> = ({
  children,
  left,
  align = 'end',
  className,
}) => {
  const effectiveAlign = left ? 'between' : align;
  const alignClass =
    effectiveAlign === 'between'
      ? styles.actionsBetween
      : effectiveAlign === 'start'
        ? styles.actionsStart
        : '';

  if (left) {
    return (
      <div className={`${styles.actions} ${styles.actionsBetween} ${className || ''}`.trim()}>
        <div className={styles.actionsLeft}>{left}</div>
        <div className={styles.actionsRight}>{children}</div>
      </div>
    );
  }

  return (
    <div className={`${styles.actions} ${alignClass} ${className || ''}`.trim()}>
      {children}
    </div>
  );
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string | number;
  className?: string;
  cardClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  showCloseButton?: boolean;
  role?: 'dialog' | 'alertdialog';
  'aria-modal'?: boolean | 'true' | 'false';
  closeOnOutsideClick?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  onConfirm?: () => void | Promise<void>;
  enableCtrlEnter?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth,
  className,
  cardClassName,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  showCloseButton = true,
  role = 'dialog',
  closeOnOutsideClick = false,
  closeOnBackdropClick = false,
  closeOnEscape = true,
  onConfirm,
  enableCtrlEnter = true,
  initialFocusRef,
}) => {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Lock scrolling & isolate background content interaction when modal is open (overflow = 'hidden')
  useEffect(() => {
    if (!isOpen) return;

    acquireScrollLock();
    return () => {
      releaseScrollLock();
    };
  }, [isOpen]);

  // Register open modal into modal stack
  useEffect(() => {
    if (!isOpen) return;

    const el = modalRef.current;
    if (el) {
      registerActiveModal(el);
    }
    return () => {
      if (el) {
        unregisterActiveModal(el);
      }
    };
  }, [isOpen]);

  // Initial focus capture & restoration strictly on open/close transitions
  const initialFocusRefLatest = useRef(initialFocusRef);
  initialFocusRefLatest.current = initialFocusRef;

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;

    // Focus explicit initial element, designated autofocus, first content input, or fallback
    const timer = window.setTimeout(() => {
      if (!modalRef.current) return;

      if (initialFocusRefLatest.current?.current) {
        initialFocusRefLatest.current.current.focus();
        return;
      }

      if (typeof modalRef.current?.querySelector !== 'function') return;

      const designatedAutoFocus = modalRef.current.querySelector<HTMLElement>('[data-autofocus], [autofocus]');
      if (designatedAutoFocus) {
        designatedAutoFocus.focus();
        return;
      }

      const contentInput = modalRef.current.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])'
      );
      if (contentInput) {
        contentInput.focus();
        return;
      }

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        modalRef.current.focus();
      }
    }, 25);

    return () => {
      window.clearTimeout(timer);
      previouslyFocusedElement.current?.focus();
    };
  }, [isOpen]);

  // Keyboard navigation (Escape + Focus Trapping + Positive Action Ctrl+Enter)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isTargeted =
        modalRef.current &&
        (modalRef.current.contains(document.activeElement) || isTopmostModal(modalRef.current));

      if (closeOnEscape && e.key === 'Escape') {
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

          if (modalRef.current) {
            const actionTarget = findPositiveActionElement(modalRef.current);
            if (actionTarget) {
              triggerPositiveAction(actionTarget);
            }
          }
          return;
        }
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, closeOnEscape, enableCtrlEnter, onConfirm]);

  if (!isMounted || !isOpen) {
    return null;
  }

  const shouldCloseOnOutside = closeOnOutsideClick || closeOnBackdropClick;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.target === e.currentTarget && shouldCloseOnOutside) {
      onClose();
    }
  };

  const modalContent = (
    <div
      className={`${styles.backdrop} ${className || ''}`}
      onClick={handleBackdropClick}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`${styles.modalCard} ${cardClassName || ''}`}
        style={maxWidth ? { maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth } : undefined}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
      >
        {title ? (
          <div className={styles.header}>
            <h2 id={ariaLabelledBy} className={styles.title}>
              {title}
            </h2>
            {showCloseButton && (
              <IconButton
                variant="ghost"
                size="sm"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Close dialog"
              >
                ✕
              </IconButton>
            )}
          </div>
        ) : showCloseButton ? (
          <IconButton
            variant="ghost"
            size="sm"
            className={styles.absoluteCloseButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </IconButton>
        ) : null}

        {children}

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
