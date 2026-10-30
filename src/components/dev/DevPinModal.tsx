import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDeveloperMode } from '../../hooks/useDeveloperMode';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import styles from './DevPinModal.module.css';

export const DevPinModal: React.FC = () => {
  const {
    isPinModalOpen,
    pinState,
    attemptsRemaining,
    lockoutRemainingSeconds,
    isRenewal,
    closePinModal,
    submitPin,
  } = useDeveloperMode();

  const [pin, setPin] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLockedOut = pinState === 'locked_out' || lockoutRemainingSeconds > 0;
  const isVerifying = pinState === 'verifying';

  // Immediate focus & reset when modal opens or closes
  useEffect(() => {
    if (isPinModalOpen) {
      setPin('');
      setIsShaking(false);
      if (!isLockedOut) {
        // Multi-stage focus to guarantee immediate keyboard readiness upon modal opening
        inputRef.current?.focus();
        const raf = requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
        const timer = setTimeout(() => {
          inputRef.current?.focus();
        }, 30);
        return () => {
          cancelAnimationFrame(raf);
          clearTimeout(timer);
        };
      }
    }
  }, [isPinModalOpen, isLockedOut]);

  // Handle shake animation and input reset on error
  useEffect(() => {
    if (pinState === 'error') {
      setIsShaking(true);
      const shakeTimer = setTimeout(() => {
        setIsShaking(false);
        setPin('');
        inputRef.current?.focus();
      }, 450);
      return () => clearTimeout(shakeTimer);
    }
  }, [pinState]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isLockedOut || isVerifying) return;

      const numeric = e.target.value.replace(/\D/g, '').slice(0, 4);
      setPin(numeric);

      if (numeric.length === 4) {
        submitPin(numeric);
      }
    },
    [isLockedOut, isVerifying, submitPin]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        if (pin.length === 4 && !isLockedOut && !isVerifying) {
          e.preventDefault();
          submitPin(pin);
        }
      }
    },
    [pin, isLockedOut, isVerifying, submitPin]
  );

  const handleConfirmPin = useCallback(() => {
    if (pin.length === 4 && !isLockedOut && !isVerifying) {
      submitPin(pin);
    }
  }, [pin, isLockedOut, isVerifying, submitPin]);

  // Helper to format remaining lockout time (e.g. 0:59)
  const formatLockoutSeconds = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <Modal
      isOpen={isPinModalOpen}
      onClose={closePinModal}
      initialFocusRef={inputRef}
      onConfirm={handleConfirmPin}
      maxWidth="440px"
      ariaLabelledBy="dev-pin-title"
      ariaDescribedBy="dev-pin-desc"
    >
      <div className={styles.header}>
        <div className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          <span>{isRenewal ? 'Session Renewal' : 'Developer Access'}</span>
        </div>
        <h2 id="dev-pin-title" className={styles.title}>
          {isRenewal ? 'Renew Developer Session' : 'Developer Authentication'}
        </h2>
        <p id="dev-pin-desc" className={styles.subtitle}>
          {isRenewal
            ? 'Enter PIN to renew session.'
            : 'Enter 4-digit PIN.'}
        </p>
      </div>

      {/* Single Native Input overlaying 4 Tactile Visual Slots */}
      <div
        className={`${styles.pinContainer} ${isShaking ? styles.shake : ''}`}
        onClick={() => {
          if (!isLockedOut && !isVerifying) {
            inputRef.current?.focus();
          }
        }}
      >
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={isLockedOut || isVerifying}
          className={styles.nativeHiddenInput}
          autoComplete="off"
          data-autofocus
          aria-label="4-digit Developer PIN"
        />

        <div className={styles.slotsRow} aria-hidden="true">
          {[0, 1, 2, 3].map((index) => {
            const hasDigit = Boolean(pin[index]);
            const isCurrentSlot =
              isFocused &&
              !isLockedOut &&
              !isVerifying &&
              (pin.length === index || (pin.length === 4 && index === 3));

            return (
              <div
                key={index}
                className={`
                  ${styles.pinSlot}
                  ${hasDigit ? styles.pinSlotFilled : ''}
                  ${isCurrentSlot ? styles.pinSlotActive : ''}
                  ${isLockedOut || isVerifying ? styles.pinSlotDisabled : ''}
                `}
              >
                {hasDigit ? (
                  <span className={styles.pinDot} />
                ) : isCurrentSlot ? (
                  <span className={styles.pinCaret} />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status & Feedback Area */}
      <div className={styles.statusBox}>
        {isLockedOut ? (
          <p className={`${styles.statusText} ${styles.lockoutText}`}>
            Too many failed attempts. Please wait {formatLockoutSeconds(lockoutRemainingSeconds)}
          </p>
        ) : isVerifying ? (
          <p className={`${styles.statusText} ${styles.verifyingText}`}>
            Verifying...
          </p>
        ) : pinState === 'error' ? (
          <p className={`${styles.statusText} ${styles.errorText}`}>
            Incorrect PIN. {attemptsRemaining} {attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining.
          </p>
        ) : pinState === 'success' ? (
          <p className={`${styles.statusText} ${styles.successText}`}>
            Authenticated.
          </p>
        ) : attemptsRemaining < 5 ? (
          <p className={styles.statusText}>
            {attemptsRemaining} attempts remaining.
          </p>
        ) : null}
      </div>

      {/* Modal Actions */}
      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={closePinModal}
        >
          Cancel
        </Button>
      </div>
    </Modal>
  );
};

export default DevPinModal;
