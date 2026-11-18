import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  DeveloperModeContextType,
  PinVerificationState,
  DevSessionLock,
} from '../types/developer';
import {
  isDesktopDevice,
  isSessionValid,
  getRemainingSessionMinutes,
  MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from '../utils/devSecurity';

let inMemoryUnlockTime: number | null = null;
let inMemoryLockoutUntil: number | null = null;
let inMemoryFailedAttempts = 0;

const getSessionUnlockTime = (): number | null => inMemoryUnlockTime;
const setSessionUnlockTime = (ts: number): void => { inMemoryUnlockTime = ts; };
const clearSessionUnlockTime = (): void => { inMemoryUnlockTime = null; };
const getLockoutUntil = (): number | null => inMemoryLockoutUntil;
const setLockoutUntil = (ts: number): void => { inMemoryLockoutUntil = ts; };
const clearLockoutUntil = (): void => { inMemoryLockoutUntil = null; };
const getFailedAttempts = (): number => inMemoryFailedAttempts;
const setFailedAttempts = (count: number): void => { inMemoryFailedAttempts = count; };
const resetFailedAttempts = (): void => { inMemoryFailedAttempts = 0; };
import {
  getSessionId,
  checkDevLockStatus,
  acquireDevLock,
  renewDevLockHeartbeat,
  releaseDevLock,
  releaseDevLockBeacon,
  HEARTBEAT_INTERVAL_MS,
} from '../services/devLockService';
import {
  initDraftSession,
  discardDraftSession,
  dispatchDraftChange,
  subscribeToDraftStatus,
  subscribeToCloudDraftSync,
  getCloudDraftSyncStatus,
} from '../services/draftService';
import type { CloudDraftSyncStatus } from '../types/draft';
import { Toast } from '../components/feedback/Toast';
import { handleBeforeUnloadGuard, clearAllDirtyEditors } from '../services/unsavedChangesService';
import { useMigrationContext } from './MigrationContext';

export interface ToastState {
  id?: string;
  message: string;
  type: 'error' | 'success' | 'info';
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface MigrationToastWatcherProps {
  isDevMode: boolean;
  setToastState: React.Dispatch<React.SetStateAction<ToastState | null>>;
}

const MigrationToastWatcher: React.FC<MigrationToastWatcherProps> = ({
  isDevMode,
  setToastState,
}) => {
  let migration: ReturnType<typeof useMigrationContext> | null = null;
  try {
    migration = useMigrationContext();
  } catch {
    migration = null;
  }

  const pendingReport = migration?.pendingReport ?? null;
  const openMigrationModal = migration?.openMigrationModal;
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (isDevMode && pendingReport?.hasPendingContentChanges && openMigrationModal) {
      if (!hasFiredRef.current) {
        hasFiredRef.current = true;
        const count = pendingReport.pendingContentChanges.length;
        setToastState({
          message: `Folio Engine updated to v${pendingReport.currentEngineVersion}: ${count} content migration(s) pending`,
          type: 'info',
          actionLabel: 'Review',
          onAction: openMigrationModal,
          durationMs: 8000,
        });
      }
    } else if (!isDevMode) {
      hasFiredRef.current = false;
    }
  }, [isDevMode, pendingReport, openMigrationModal, setToastState]);

  return null;
};

const DeveloperModeContext = createContext<DeveloperModeContextType | null>(null);

export interface DeveloperModeProviderProps {
  children?: React.ReactNode;
  securitySalt?: string;
  expectedPinHash?: string;
  initialUnlockedAt?: number | null;
}

const DeveloperModeProviderComponent: React.FC<DeveloperModeProviderProps> = ({
  children,
  securitySalt: _securitySalt,
  expectedPinHash: _expectedPinHash,
  initialUnlockedAt,
}) => {
  if (initialUnlockedAt !== undefined) {
    inMemoryUnlockTime = initialUnlockedAt;
  }
  const [isDesktop, setIsDesktop] = useState<boolean>(() => isDesktopDevice());
  const [isDevMode, setIsDevMode] = useState<boolean>(() => {
    if (!isDesktopDevice()) return false;
    const unlockTime = getSessionUnlockTime();
    return isSessionValid(unlockTime);
  });
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState<boolean>(false);
  const [pinState, setPinState] = useState<PinVerificationState>(() => {
    const lockoutUntil = getLockoutUntil();
    if (lockoutUntil && Date.now() < lockoutUntil) {
      return 'locked_out';
    }
    return 'idle';
  });
  const [sessionId, setSessionId] = useState<string>(() => getSessionId());
  const [lockToken, setLockToken] = useState<string | null>(null);
  const [isLockBlocked, setIsLockBlocked] = useState<boolean>(false);
  const [activeLockInfo, setActiveLockInfo] = useState<DevSessionLock | null>(null);
  const [isRenewal, setIsRenewal] = useState<boolean>(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(() => {
    return Math.max(0, MAX_ATTEMPTS - getFailedAttempts());
  });
  const [lockoutRemainingSeconds, setLockoutRemainingSeconds] = useState<number>(() => {
    const lockoutUntil = getLockoutUntil();
    if (lockoutUntil && Date.now() < lockoutUntil) {
      return Math.ceil((lockoutUntil - Date.now()) / 1000);
    }
    return 0;
  });
  const [sessionRemainingMinutes, setSessionRemainingMinutes] = useState<number>(() => {
    return getRemainingSessionMinutes(getSessionUnlockTime());
  });
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const setToastState = useCallback<React.Dispatch<React.SetStateAction<ToastState | null>>>(
    (action) => {
      setToasts((prev) => {
        const next = typeof action === 'function' ? action(prev[0] || null) : action;
        if (!next) return [];
        const id = next.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        return [...prev.filter((t) => t.id !== id), { ...next, id }];
      });
    },
    []
  );

  const sessionCheckIntervalRef = useRef<number | null>(null);
  const lockoutIntervalRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const pinSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLockBlockedRef = useRef<boolean>(isLockBlocked);
  const isPinModalOpenRef = useRef<boolean>(isPinModalOpen);
  const isExitConfirmOpenRef = useRef<boolean>(isExitConfirmOpen);
  const isExitingRef = useRef<boolean>(false);
  const hasInitializedDraftRef = useRef<boolean>(false);

  useEffect(() => {
    isLockBlockedRef.current = isLockBlocked;
  }, [isLockBlocked]);

  useEffect(() => {
    isPinModalOpenRef.current = isPinModalOpen;
  }, [isPinModalOpen]);

  useEffect(() => {
    isExitConfirmOpenRef.current = isExitConfirmOpen;
  }, [isExitConfirmOpen]);

  useEffect(() => {
    return () => {
      if (pinSuccessTimerRef.current !== null) {
        clearTimeout(pinSuccessTimerRef.current);
        pinSuccessTimerRef.current = null;
      }
    };
  }, []);

  // Sync draft dirty state with reactive subscription
  useEffect(() => {
    const unsubscribe = subscribeToDraftStatus((status) => {
      setHasUnpublishedChanges(status.isDirty);
    });
    return unsubscribe;
  }, []);

  const isCloudHydrating = false;

  // Track cloud draft sync status (Task 11.2.G2)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudDraftSyncStatus>(() => getCloudDraftSyncStatus());

  useEffect(() => {
    const unsubscribe = subscribeToCloudDraftSync((detail) => {
      setCloudSyncStatus(detail.status);
    });
    return unsubscribe;
  }, []);

  // Initialize draft session whenever Dev Mode is enabled on mount
  useEffect(() => {
    if (!isDevMode) {
      hasInitializedDraftRef.current = false;
      return;
    }
    if (hasInitializedDraftRef.current) {
      return;
    }
    hasInitializedDraftRef.current = true;
    initDraftSession(undefined, lockToken).catch((err) => {
      hasInitializedDraftRef.current = false;
      console.error('Draft initialization failed:', err);
      setToastState({
        message: 'Draft Initialization Failed: Could not initialize draft workspace.',
        type: 'error',
      });
      setIsDevMode(false);
    });
  }, [isDevMode, lockToken]);

  // 1. Desktop & Viewport Responsiveness Audit
  useEffect(() => {
    const handleResizeOrPointer = () => {
      const desktop = isDesktopDevice();
      setIsDesktop(desktop);
      if (!desktop) {
        // Enforce Mobile Lockout: immediately close modal and deactivate dev mode on mobile
        setIsDevMode(false);
        setIsPinModalOpen(false);
        setIsExitConfirmOpen(false);
      }
    };

    window.addEventListener('resize', handleResizeOrPointer);
    return () => window.removeEventListener('resize', handleResizeOrPointer);
  }, []);

  // 2. Lockout Countdown Manager
  useEffect(() => {
    const checkLockout = () => {
      const lockoutUntil = getLockoutUntil();
      if (lockoutUntil) {
        const remainingMs = lockoutUntil - Date.now();
        if (remainingMs > 0) {
          setLockoutRemainingSeconds(Math.ceil(remainingMs / 1000));
          setPinState('locked_out');
          return;
        } else {
          // Lockout elapsed
          clearLockoutUntil();
          resetFailedAttempts();
          setAttemptsRemaining(MAX_ATTEMPTS);
          setLockoutRemainingSeconds(0);
          setPinState('idle');
        }
      } else {
        setLockoutRemainingSeconds(0);
      }
    };

    checkLockout();
    lockoutIntervalRef.current = window.setInterval(checkLockout, 1000);
    return () => {
      if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current);
    };
  }, []);

  // 3. 30-Minute Session Lifecycle & In-Place Renewal Timer
  useEffect(() => {
    if (!isDevMode) {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      return;
    }

    const checkSession = () => {
      const unlockTime = getSessionUnlockTime();
      if (!isSessionValid(unlockTime)) {
        // Session expired during active usage: trigger in-place renewal modal
        setIsRenewal(true);
        setIsPinModalOpen(true);
        setSessionRemainingMinutes(0);
      } else {
        setSessionRemainingMinutes(getRemainingSessionMinutes(unlockTime));
      }
    };

    checkSession();
    sessionCheckIntervalRef.current = window.setInterval(checkSession, 5000);

    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, [isDevMode]);

  // 4. Liveness Heartbeat & Instant Beacon Release while isDevMode is active
  useEffect(() => {
    if (!isDevMode) {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      return;
    }

    // Setup 30-second background heartbeat with automatic eviction
    const runHeartbeat = () => {
      if (!lockToken) return;
      renewDevLockHeartbeat(lockToken).then(async (renewed) => {
        if (!renewed) {
          console.warn('[DeveloperModeContext] Liveness heartbeat rejected: lock held by another coordinator.');
          setIsDevMode(false);
          setLockToken(null);
          clearSessionUnlockTime();
          dispatchDraftChange(false, false);
          setIsLockBlocked(true);
          isLockBlockedRef.current = true;
          const status = await checkDevLockStatus(null);
          setActiveLockInfo(status.currentLock || null);
          setToastState({
            message: 'Developer Mode session ended: another coordinator is currently active.',
            type: 'error',
          });
        }
      });
    };

    heartbeatIntervalRef.current = window.setInterval(runHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Safe beacon release upon actual tab or window dismissal
    const handlePageHide = () => {
      releaseDevLockBeacon(lockToken);
    };

    // Universal guard preventing accidental reload/closure while on draft or when in-flight edits exist
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExitingRef.current) {
        return undefined;
      }
      if (isDevMode) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return handleBeforeUnloadGuard(e);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isDevMode, sessionId]);

  // 4c. Global Reload Interceptor: prevent accidental keyboard refresh (Cmd+R, Ctrl+R, F5) while on draft
  useEffect(() => {
    if (!isDevMode) return;

    const handleReloadKeyDown = (e: KeyboardEvent) => {
      const isReload =
        ((e.metaKey || e.ctrlKey) && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR')) ||
        e.key === 'F5' ||
        e.code === 'F5';

      if (isReload) {
        e.preventDefault();
        e.stopPropagation();
        setToastState({
          message: 'Page reload is disabled while on draft to protect storage integrity.',
          type: 'info',
          durationMs: 4000,
        });
      }
    };

    window.addEventListener('keydown', handleReloadKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleReloadKeyDown, { capture: true });
    };
  }, [isDevMode, lockToken]);

  // 4b. Immediate Mount & Focus Lock Exclusivity Validation
  useEffect(() => {
    if (!isDevMode || !lockToken) return;

    const verifyLockExclusivity = async () => {
      const status = await checkDevLockStatus(lockToken);
      if (!status.canAcquire && status.currentLock && !status.isSelfSession) {
        console.warn('[DeveloperModeContext] Active lock claimed by another coordinator.');
        setIsDevMode(false);
        setLockToken(null);
        clearSessionUnlockTime();
        dispatchDraftChange(false, false);
        setIsLockBlocked(true);
        isLockBlockedRef.current = true;
        setActiveLockInfo(status.currentLock);
        setToastState({
          message: 'Developer Mode session ended: another coordinator is currently active.',
          type: 'error',
        });
      }
    };

    // Verify immediately on mount/activation
    verifyLockExclusivity();

    // Verify on a continuous 10s presence polling loop
    const pollingInterval = window.setInterval(verifyLockExclusivity, 10000);

    // Verify whenever user returns to window tab
    const handleFocus = () => {
      verifyLockExclusivity();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(pollingInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isDevMode, lockToken]);

  const showToast = useCallback(
    (
      message: string,
      type: 'success' | 'error' | 'info' = 'success',
      actionLabel?: string,
      onAction?: () => void,
      durationMs?: number
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type, actionLabel, onAction, durationMs }]);
    },
    []
  );

  // 5. Modal Open & Close Handlers with Pre-Flight Lock Check
  const openPinModal = useCallback(
    (renewal = false, skipLockCheck = false) => {
      setIsRenewal(renewal);
      const lockoutUntil = getLockoutUntil();
      if (lockoutUntil && Date.now() < lockoutUntil) {
        setPinState('locked_out');
        setLockoutRemainingSeconds(Math.ceil((lockoutUntil - Date.now()) / 1000));
        isLockBlockedRef.current = false;
        setIsLockBlocked(false);
        setActiveLockInfo(null);
        isPinModalOpenRef.current = true;
        setIsPinModalOpen(true);
        return;
      }

      if (skipLockCheck) {
        isLockBlockedRef.current = false;
        setIsLockBlocked(false);
        setActiveLockInfo(null);
        setPinState('idle');
        isPinModalOpenRef.current = true;
        setIsPinModalOpen(true);
        return;
      }

      // Pre-flight check: fail stop on error, or block before PIN entry if locked by another coordinator
      checkDevLockStatus(lockToken)
        .then((status) => {
          if (status.error) {
            showToast('Unable to verify coordinator lock status.', 'error');
            return;
          }
          if (!status.canAcquire && status.currentLock && !status.isSelfSession) {
            isLockBlockedRef.current = true;
            setIsLockBlocked(true);
            setActiveLockInfo(status.currentLock);
            isPinModalOpenRef.current = false;
            setIsPinModalOpen(false);
          } else {
            isLockBlockedRef.current = false;
            setIsLockBlocked(false);
            setActiveLockInfo(null);
            setPinState('idle');
            isPinModalOpenRef.current = true;
            setIsPinModalOpen(true);
          }
        })
        .catch(() => {
          showToast('Unable to verify coordinator lock status.', 'error');
        });
    },
    [lockToken, showToast]
  );

  const closePinModal = useCallback(() => {
    isPinModalOpenRef.current = false;
    setIsPinModalOpen(false);
    const lockoutUntil = getLockoutUntil();
    if (lockoutUntil && Date.now() < lockoutUntil) {
      setPinState('locked_out');
    } else {
      setPinState('idle');
    }
    // If renewal modal was canceled or dismissed while session expired, exit dev mode
    if (isRenewal) {
      const unlockTime = getSessionUnlockTime();
      if (!isSessionValid(unlockTime)) {
        clearSessionUnlockTime();
        releaseDevLock(lockToken);
        setLockToken(null);
        setIsDevMode(false);
      }
      setIsRenewal(false);
    }
  }, [isRenewal, lockToken]);

  const closeLockBlockedModal = useCallback(() => {
    isLockBlockedRef.current = false;
    setIsLockBlocked(false);
    setActiveLockInfo(null);
  }, []);

  const refreshLockStatus = useCallback(async () => {
    try {
      const status = await checkDevLockStatus(lockToken);
      if (status.error) {
        return;
      }
      if (status.canAcquire || status.isSelfSession) {
        openPinModal(false, true);
      } else if (status.currentLock) {
        isLockBlockedRef.current = true;
        setIsLockBlocked(true);
        setActiveLockInfo(status.currentLock);
      }
    } catch {
      // Ignore network errors during polling
    }
  }, [lockToken, openPinModal]);

  const exitDevMode = useCallback(
    async (options?: { discard?: boolean }) => {
      if (isExitingRef.current) {
        return;
      }
      isExitingRef.current = true;
      clearAllDirtyEditors();

      const pendingCleanup: Promise<unknown>[] = [];
      if (options?.discard === true) {
        pendingCleanup.push(discardDraftSession(undefined, lockToken).catch(() => { }));
      } else {
        dispatchDraftChange(false, false);
      }
      setHasUnpublishedChanges(false);
      pendingCleanup.push(releaseDevLock(lockToken).catch(() => false));
      setLockToken(null);
      clearSessionUnlockTime();
      setIsDevMode(false);
      isPinModalOpenRef.current = false;
      setIsPinModalOpen(false);
      isExitConfirmOpenRef.current = false;
      setIsExitConfirmOpen(false);
      setIsRenewal(false);
      isLockBlockedRef.current = false;
      setIsLockBlocked(false);
      setActiveLockInfo(null);
      setSessionRemainingMinutes(0);

      // Strip any lingering ?dev=true or ?mode=developer so refresh or query sync does not re-enable
      try {
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          let modified = false;
          if (url.searchParams.has('dev')) {
            url.searchParams.delete('dev');
            modified = true;
          }
          if (url.searchParams.has('mode')) {
            url.searchParams.delete('mode');
            modified = true;
          }
          if (url.hash.includes('dev=true')) {
            url.hash = url.hash.replace(/[?&]dev=true/, '');
            modified = true;
          }
          if (modified) {
            window.history.replaceState(null, '', url.toString());
          }
        }
      } catch {
        // Ignore URL manipulation error in restricted contexts
      }

      await Promise.allSettled(pendingCleanup);

      if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
        window.location.reload();
      }
    },
    [sessionId, lockToken]
  );

  const requestExitDevMode = useCallback(() => {
    if (isDevMode) {
      setIsExitConfirmOpen(true);
      isExitConfirmOpenRef.current = true;
    }
  }, [isDevMode]);

  const closeExitConfirmModal = useCallback(() => {
    setIsExitConfirmOpen(false);
    isExitConfirmOpenRef.current = false;
  }, []);

  const confirmExitDevMode = useCallback(
    (options?: { discard?: boolean }) => {
      closeExitConfirmModal();
      exitDevMode(options);
    },
    [closeExitConfirmModal, exitDevMode]
  );

  const toggleDevMode = useCallback(() => {
    if (isDevMode) {
      requestExitDevMode();
    } else {
      openPinModal(false);
    }
  }, [isDevMode, requestExitDevMode, openPinModal]);

  // 7. Edge-Authenticated PIN Verification & Coordinator Lock Acquisition
  const submitPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (getLockoutUntil() && Date.now() < (getLockoutUntil() ?? 0)) {
        setPinState('locked_out');
        return false;
      }

      setPinState('verifying');

      try {
        const lockRes = await acquireDevLock({
          pin,
          sessionId,
          coordinatorLabel: 'Coordinator',
          forceReacquireWithPin: isRenewal,
        });

        if (lockRes.success && lockRes.lockToken) {
          if (lockRes.sessionId) {
            setSessionId(lockRes.sessionId);
          }

          if (!isRenewal) {
            hasInitializedDraftRef.current = true;
            try {
              await initDraftSession(undefined, lockRes.lockToken);
            } catch (err) {
              hasInitializedDraftRef.current = false;
              console.error('Draft initialization failed:', err);
              await releaseDevLock(lockRes.lockToken).catch(() => false);
              setLockToken(null);
              clearSessionUnlockTime();
              setPinState('error');
              setToastState({
                message: 'Draft Initialization Failed: Could not initialize draft workspace.',
                type: 'error',
              });
              setIsDevMode(false);
              return false;
            }
          }

          setLockToken(lockRes.lockToken);

          const now = Date.now();
          setSessionUnlockTime(now);
          resetFailedAttempts();
          clearLockoutUntil();
          setAttemptsRemaining(MAX_ATTEMPTS);
          setSessionRemainingMinutes(30);
          setPinState('success');
          setIsDevMode(true);
          setIsRenewal(false);
          isLockBlockedRef.current = false;
          setIsLockBlocked(false);
          setActiveLockInfo(null);
          if (pinSuccessTimerRef.current !== null) {
            clearTimeout(pinSuccessTimerRef.current);
          }
          pinSuccessTimerRef.current = setTimeout(() => {
            pinSuccessTimerRef.current = null;
            isPinModalOpenRef.current = false;
            setIsPinModalOpen(false);
            setPinState('idle');
          }, 400);
          return true;
        }

        if (lockRes.status === 409 && lockRes.lock) {
          isPinModalOpenRef.current = false;
          setIsPinModalOpen(false);
          setPinState('idle');
          isLockBlockedRef.current = true;
          setIsLockBlocked(true);
          setActiveLockInfo(lockRes.lock);
          return false;
        }

        if (lockRes.status === 429) {
          const lockoutTime = lockRes.lockoutUntil ?? Date.now() + LOCKOUT_DURATION_MS;
          setLockoutUntil(lockoutTime);
          setAttemptsRemaining(0);
          setLockoutRemainingSeconds(Math.max(1, Math.ceil((lockoutTime - Date.now()) / 1000)));
          setPinState('locked_out');
          return false;
        }

        const remaining =
          typeof lockRes.attemptsRemaining === 'number'
            ? lockRes.attemptsRemaining
            : Math.max(0, MAX_ATTEMPTS - (getFailedAttempts() + 1));
        setFailedAttempts(MAX_ATTEMPTS - remaining);
        setAttemptsRemaining(remaining);

        if (remaining === 0) {
          const lockoutTime = lockRes.lockoutUntil ?? Date.now() + LOCKOUT_DURATION_MS;
          setLockoutUntil(lockoutTime);
          setLockoutRemainingSeconds(60);
          setPinState('locked_out');
        } else {
          setPinState('error');
        }
        return false;
      } catch (err) {
        console.warn('[DeveloperMode] Verification error caught:', err);
        setPinState('error');
        return false;
      }
    },
    [sessionId, isRenewal]
  );

  // 8. Global Desktop Hotkey Trigger (Cmd/Ctrl + Shift + D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifierActive = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;
      const isKeyD = e.key === 'D' || e.key === 'd' || e.code === 'KeyD';

      if (isModifierActive && isShift && isKeyD) {
        e.preventDefault();
        toggleDevMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDevMode]);

  // 9. URL Query Parameter Trigger (?dev=true or ?mode=developer)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hasDevParam =
        searchParams.get('dev') === 'true' || searchParams.get('mode') === 'developer';

      if (hasDevParam) {
        const unlockTime = getSessionUnlockTime();
        if (isSessionValid(unlockTime)) {
          setIsDevMode(true);
        } else {
          openPinModal(false);
        }

        // Clean up URL parameter to prevent repeated modal triggers on refresh
        searchParams.delete('dev');
        if (searchParams.get('mode') === 'developer') searchParams.delete('mode');
        const cleanQuery = searchParams.toString();
        const newUrl =
          window.location.pathname +
          (cleanQuery ? `?${cleanQuery}` : '') +
          window.location.hash;
        window.history.replaceState(null, '', newUrl);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, [openPinModal]);

  const value: DeveloperModeContextType = {
    isDevMode,
    isDesktop,
    isPinModalOpen,
    pinState,
    attemptsRemaining,
    lockoutRemainingSeconds,
    sessionRemainingMinutes,
    isRenewal,
    openPinModal,
    closePinModal,
    submitPin,
    exitDevMode,
    isExitConfirmOpen,
    requestExitDevMode,
    confirmExitDevMode,
    closeExitConfirmModal,
    toggleDevMode,
    sessionId,
    lockToken,
    isLockBlocked,
    activeLockInfo,
    closeLockBlockedModal,
    refreshLockStatus,
    hasUnpublishedChanges,
    setHasUnpublishedChanges: (dirty: boolean) => {
      dispatchDraftChange(isDevMode, dirty);
      setHasUnpublishedChanges(dirty);
    },
    isCloudHydrating,
    cloudSyncStatus,
    showToast,
  };

  return (
    <DeveloperModeContext.Provider value={value}>
      <MigrationToastWatcher isDevMode={isDevMode} setToastState={setToastState} />
      {children}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          durationMs={toast.durationMs}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onDismiss={() => {
            setToasts((prev) => prev.filter((t) => t.id !== toast.id));
          }}
        />
      ))}
    </DeveloperModeContext.Provider>
  );
};

export const DeveloperModeProvider = React.memo(DeveloperModeProviderComponent);

export const useDeveloperMode = (): DeveloperModeContextType => {
  const context = useContext(DeveloperModeContext);
  if (!context) {
    return {
      isDevMode: false,
      isDesktop: false,
      isPinModalOpen: false,
      pinState: 'idle',
      attemptsRemaining: 5,
      lockoutRemainingSeconds: 0,
      sessionRemainingMinutes: 0,
      isRenewal: false,
      openPinModal: () => { },
      closePinModal: () => { },
      submitPin: async () => false,
      exitDevMode: () => { },
      isExitConfirmOpen: false,
      requestExitDevMode: () => { },
      confirmExitDevMode: () => { },
      closeExitConfirmModal: () => { },
      toggleDevMode: () => { },
      sessionId: '',
      lockToken: null,
      isLockBlocked: false,
      activeLockInfo: null,
      closeLockBlockedModal: () => { },
      refreshLockStatus: async () => { },
      hasUnpublishedChanges: false,
      setHasUnpublishedChanges: () => { },
      isCloudHydrating: false,
      cloudSyncStatus: 'saved',
      showToast: () => { },
    };
  }
  return context;
};

export default DeveloperModeContext;
