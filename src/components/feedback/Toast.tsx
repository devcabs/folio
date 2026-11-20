import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '../ui/IconButton';
import styles from './Toast.module.css';

export interface ToastProps {
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  durationMs?: number;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  playAudio?: boolean;
}

/**
 * Toast Registry: Coordinates multi-toast instances, prevents DOM stacking,
 * and manages global dismiss-all actions.
 */
type ToastDismissHandler = () => void;

class ToastRegistry {
  private active = new Map<string, ToastDismissHandler>();
  private listeners = new Set<() => void>();

  register(id: string, dismiss: ToastDismissHandler): void {
    this.active.set(id, dismiss);
    this.notify();
  }

  unregister(id: string): void {
    if (this.active.delete(id)) {
      this.notify();
    }
  }

  dismissAll(): void {
    const callbacks = Array.from(this.active.values());
    this.active.clear();
    callbacks.forEach((dismiss) => {
      try {
        dismiss();
      } catch {
        // Safe discard on already unmounted instances
      }
    });
    this.notify();
  }

  getCount(): number {
    return this.active.size;
  }

  getFirstId(): string | null {
    const keys = Array.from(this.active.keys());
    return keys.length > 0 ? keys[0] : null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const toastRegistry = new ToastRegistry();

const CONTAINER_ID = 'folio-toast-container';

function getToastContainer(): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  let container: HTMLElement | null = null;

  if (typeof document.getElementById === 'function') {
    container = document.getElementById(CONTAINER_ID);
  } else if (document.body.childNodes) {
    const found = Array.from(document.body.childNodes).find(
      (c: any) => c.id === CONTAINER_ID || (c.getAttribute && c.getAttribute('id') === CONTAINER_ID)
    );
    if (found) container = found as HTMLElement;
  }

  if (!container) {
    if (typeof document.createElement !== 'function') return null;
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    if (container.setAttribute) {
      container.setAttribute('id', CONTAINER_ID);
    }
    container.className = styles.toastContainer;
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Synthesize subtle feedback audio using native Web Audio API.
 * Purely synthetic: zero external assets, zero network calls, zero latency.
 */
function playToastAudio(type: 'success' | 'info' | 'warning' | 'error' = 'success'): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    if (type === 'success') {
      // Gentle two-tone rising chime (D5 587.33Hz -> A5 880Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(587.33, now);
      osc2.frequency.setValueAtTime(880, now + 0.06);

      gainNode.gain.setValueAtTime(0.05, now);
      gainNode.gain.exponentialRampToValueAtTime(0.07, now + 0.06);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

      osc1.connect(gainNode);
      osc2.connect(gainNode);

      osc1.start(now);
      osc1.stop(now + 0.06);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.26);
    } else if (type === 'error') {
      // Soft low double-tone warning (E4 329.63Hz -> C4 261.63Hz)
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(329.63, now);
      osc.frequency.setValueAtTime(261.63, now + 0.07);

      gainNode.gain.setValueAtTime(0.06, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.2);
    } else {
      // Soft crystal notification chime (E5 659.25Hz)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);

      gainNode.gain.setValueAtTime(0.04, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.18);
    }

    setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        // Safe discard
      }
    }, 320);
  } catch {
    // Gracefully ignore audio errors (e.g. strict autoplay blocking)
  }
}

/**
 * Toast Component
 * Folio Engine — Lightweight, accessible floating feedback capsule:
 * - Rendered in a unified container (#folio-toast-container) to prevent stacking/overlapping
 * - No left icon and no colored glow
 * - Variant-specific token styling (success, error, info, warning)
 * - Auto-dismisses reliably after defined duration without timer resetting on parent re-renders
 * - Affords a "Close all" button whenever multiple toasts exist simultaneously
 * - ARIA role="status" and aria-live="polite"
 * - Universal Zero Outline Policy adherence
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  durationMs = 3500,
  onDismiss,
  actionLabel,
  onAction,
  playAudio = true,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const idRef = useRef<string>(`toast-${Math.random().toString(36).slice(2, 9)}`);

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const [activeCount, setActiveCount] = useState(() => toastRegistry.getCount());
  const [firstId, setFirstId] = useState(() => toastRegistry.getFirstId());

  useEffect(() => {
    setIsMounted(true);
    if (playAudio) {
      playToastAudio(type);
    }
  }, [type, playAudio]);

  useEffect(() => {
    const id = idRef.current;
    toastRegistry.register(id, () => {
      onDismissRef.current();
    });

    const unsubscribe = toastRegistry.subscribe(() => {
      setActiveCount(toastRegistry.getCount());
      setFirstId(toastRegistry.getFirstId());
    });

    return () => {
      unsubscribe();
      toastRegistry.unregister(id);
    };
  }, []);

  // Reliable auto-close timer: does NOT reset when parent re-renders with new onDismiss reference
  useEffect(() => {
    if (durationMs <= 0) return;
    const timer = setTimeout(() => {
      onDismissRef.current();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs]);

  if (!isMounted || typeof document === 'undefined') {
    return null;
  }

  const container = getToastContainer();
  if (!container) {
    return null;
  }

  const isLeader = firstId === idRef.current;
  const showCloseAll = isLeader && activeCount > 1;

  const variantClass =
    type === 'error'
      ? styles.toastError
      : type === 'warning'
        ? styles.toastWarning
        : type === 'info'
          ? styles.toastInfo
          : styles.toastSuccess;

  const toastContent = (
    <>
      <div
        role="status"
        aria-live="polite"
        className={`${styles.toastItem} ${variantClass}`}
      >
        <span className={styles.message}>{message}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => {
              onAction();
              onDismissRef.current();
            }}
          >
            {actionLabel}
          </button>
        )}
        <IconButton
          variant="ghost"
          size="xs"
          className={styles.dismissButton}
          onClick={() => onDismissRef.current()}
          aria-label="Dismiss notification"
        >
          ✕
        </IconButton>
      </div>

      {showCloseAll && (
        <div className={styles.closeAllWrapper}>
          <button
            type="button"
            className={styles.closeAllButton}
            onClick={() => toastRegistry.dismissAll()}
            aria-label="Close all notifications"
          >
            Close all
          </button>
        </div>
      )}
    </>
  );

  return createPortal(toastContent, container);
};

export default Toast;
