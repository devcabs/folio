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
import styles from './Modal.module.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string | number;
  className?: string;
  cardClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  showCloseButton?: boolean;
  role?: 'dialog' | 'alertdialog';
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

  useEffect(() => {
    if (!isOpen) return;

    acquireScrollLock();
    return () => {
      releaseScrollLock();
    };
  }, [isOpen]);

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

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;

    const timer = window.setTimeout(() => {
      if (!modalRef.current) return;

      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }

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
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElement.current?.focus();
    };
  }, [isOpen, onClose, closeOnEscape, enableCtrlEnter, onConfirm, initialFocusRef]);

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
              <button
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Close dialog"
              >
                ✕
              </button>
            )}
          </div>
        ) : showCloseButton ? (
          <button
            type="button"
            className={styles.absoluteCloseButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        ) : null}

        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
