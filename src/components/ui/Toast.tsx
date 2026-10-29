import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Toast.module.css';

export interface ToastProps {
  message: string;
  type?: 'success' | 'info' | 'error';
  durationMs?: number;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  playAudio?: boolean;
}

/**
 * Synthesize subtle feedback audio using native Web Audio API.
 * Purely synthetic: zero external assets, zero network calls, zero latency.
 */
function playToastAudio(type: 'success' | 'info' | 'error' = 'success'): void {
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

const CheckIcon = (
  <svg className={styles.svgIcon} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const ExclamationIcon = (
  <svg className={styles.svgIcon} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

const InfoIcon = (
  <svg className={styles.svgIcon} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
      clipRule="evenodd"
    />
  </svg>
);

/**
 * Toast Component
 * Lightweight, accessible floating feedback capsule.
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

  useEffect(() => {
    setIsMounted(true);
    if (playAudio) {
      playToastAudio(type);
    }
  }, [type, playAudio]);

  useEffect(() => {
    if (durationMs <= 0) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs, onDismiss]);

  if (!isMounted || typeof document === 'undefined') {
    return null;
  }

  const iconMarkup =
    type === 'success' ? (
      <span className={`${styles.iconWrapper} ${styles.successIcon}`}>{CheckIcon}</span>
    ) : type === 'error' ? (
      <span className={`${styles.iconWrapper} ${styles.errorIcon}`}>{ExclamationIcon}</span>
    ) : (
      <span className={`${styles.iconWrapper} ${styles.infoIcon}`}>{InfoIcon}</span>
    );

  const variantClass =
    type === 'error'
      ? styles.toastError
      : type === 'info'
        ? styles.toastInfo
        : styles.toastSuccess;

  const toastContent = (
    <div
      role="status"
      aria-live="polite"
      className={`${styles.toastPortal} ${variantClass}`}
    >
      {iconMarkup}
      <span className={styles.message}>{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => {
            onAction();
            onDismiss();
          }}
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        className={styles.dismissButton}
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );

  return createPortal(toastContent, document.body);
};

export default Toast;
