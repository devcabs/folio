import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  DeveloperModeContextType,
  PinVerificationState,
  DevSessionLock,
} from '../types/developer';
import {
  isDesktopDevice,
  getSessionUnlockTime,
  setSessionUnlockTime,
  clearSessionUnlockTime,
  isSessionValid,
  getRemainingSessionMinutes,
  getLockoutUntil,
  setLockoutUntil,
  clearLockoutUntil,
  getFailedAttempts,
  setFailedAttempts,
  resetFailedAttempts,
  verifyPin,
  MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from '../utils/devSecurity';
import {
  getSessionId,
  regenerateSessionId,
  checkDevLockStatus,
  acquireDevLock,
  renewDevLockHeartbeat,
  releaseDevLock,
  releaseDevLockBeacon,
  subscribeToLockStorage,
  HEARTBEAT_INTERVAL_MS,
  TAB_INSTANCE_ID,
  getSessionBroadcastChannel,
} from '../services/devLockService';
import {
  hydrateActiveVersionFromCloud,
  isInitialHydrationPending,
  subscribeToHydration,
} from '../services/historyService';
import {
  initDraftSession,
  discardDraftSession,
  clearDraftStorage,
  isDraftDirty,
  setDraftDirty,
  subscribeToDraftStatus,
  subscribeToCloudDraftSync,
  getCloudDraftSyncStatus,
} from '../services/draftService';
import type { CloudDraftSyncStatus } from '../types/draft';
import { Toast } from '../components/feedback/Toast';
import { handleBeforeUnloadGuard } from '../services/unsavedChangesService';

const DeveloperModeContext = createContext<DeveloperModeContextType | null>(null);

export interface DeveloperModeProviderProps {
  children: React.ReactNode;
}

export const DeveloperModeProvider: React.FC<DeveloperModeProviderProps> = ({ children }) => {
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
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState<boolean>(() => isDraftDirty());
  const [toastState, setToastState] = useState<{
    message: string;
    type: 'error' | 'success' | 'info';
  } | null>(null);

  const sessionCheckIntervalRef = useRef<number | null>(null);
  const lockoutIntervalRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const isLockBlockedRef = useRef<boolean>(isLockBlocked);
  const isPinModalOpenRef = useRef<boolean>(isPinModalOpen);
  const isExitConfirmOpenRef = useRef<boolean>(isExitConfirmOpen);

  useEffect(() => {
    isLockBlockedRef.current = isLockBlocked;
  }, [isLockBlocked]);

  useEffect(() => {
    isPinModalOpenRef.current = isPinModalOpen;
  }, [isPinModalOpen]);

  useEffect(() => {
    isExitConfirmOpenRef.current = isExitConfirmOpen;
  }, [isExitConfirmOpen]);

  // Cloned / Duplicate Tab Collision Detection via BroadcastChannel
  useEffect(() => {
    const channel = getSessionBroadcastChannel();
    if (!channel) return;

    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'PING_SESSION' && e.data.sessionId === sessionId) {
        if (e.data.tabInstanceId !== TAB_INSTANCE_ID) {
          // Another tab was cloned from this tab or is asserting the same sessionId!
          channel.postMessage({
            type: 'SESSION_OWNED',
            sessionId,
            ownerTabInstanceId: TAB_INSTANCE_ID,
          });
        }
      } else if (
        e.data.type === 'SESSION_OWNED' &&
        e.data.sessionId === sessionId &&
        e.data.ownerTabInstanceId !== TAB_INSTANCE_ID
      ) {
        // We received rejection from the primary tab holding this sessionId!
        console.warn('[DeveloperModeContext] Cloned tab detected! Disengaging inherited Dev Mode.');
        clearSessionUnlockTime();
        const newId = regenerateSessionId();
        setSessionId(newId);
        setIsDevMode(false);
        isPinModalOpenRef.current = false;
        setIsPinModalOpen(false);
        setIsLockBlocked(true);
        isLockBlockedRef.current = true;
        checkDevLockStatus(newId).then((status) => {
          setActiveLockInfo(status.currentLock || null);
        });
      }
    };

    channel.addEventListener('message', handleMessage);

    // Announce this tab's identity
    channel.postMessage({
      type: 'PING_SESSION',
      sessionId,
      tabInstanceId: TAB_INSTANCE_ID,
    });

    return () => {
      channel.removeEventListener('message', handleMessage);
    };
  }, [sessionId]);

  // Sync draft dirty state with reactive subscription
  useEffect(() => {
    const unsubscribe = subscribeToDraftStatus((status) => {
      setHasUnpublishedChanges(status.isDirty);
    });
    return unsubscribe;
  }, []);

  // Track active cloud hydration status (Task 10.7)
  const [isCloudHydrating, setIsCloudHydrating] = useState<boolean>(() => isInitialHydrationPending());

  useEffect(() => {
    const unsubscribe = subscribeToHydration((hydrating) => {
      setIsCloudHydrating(hydrating);
    });
    return unsubscribe;
  }, []);

  // Track cloud draft sync status (Task 11.2.G2)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudDraftSyncStatus>(() => getCloudDraftSyncStatus());

  useEffect(() => {
    const unsubscribe = subscribeToCloudDraftSync((detail) => {
      setCloudSyncStatus(detail.status);
    });
    return unsubscribe;
  }, []);

  // Hydrate active published version from Supabase on startup
  useEffect(() => {
    hydrateActiveVersionFromCloud().catch(() => {});
  }, []);

  // Initialize draft session whenever Dev Mode is enabled or refreshed across F5/Cmd+R
  useEffect(() => {
    if (isDevMode) {
      initDraftSession(false).catch((err) => {
        console.error('Draft initialization failed:', err);
        setToastState({
          message: 'Draft Initialization Failed: Could not initialize draft workspace.',
          type: 'error',
        });
        setIsDevMode(false);
      });
    }
  }, [isDevMode]);

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

    // Immediately acquire/ensure lock for active dev session
    acquireDevLock(sessionId);

    // Setup 30-second background heartbeat with automatic eviction
    const runHeartbeat = () => {
      renewDevLockHeartbeat(sessionId).then(async (renewed) => {
        if (!renewed) {
          console.warn('[DeveloperModeContext] Liveness heartbeat rejected: lock held by another coordinator.');
          setIsDevMode(false);
          clearSessionUnlockTime();
          clearDraftStorage();
          setIsLockBlocked(true);
          isLockBlockedRef.current = true;
          const status = await checkDevLockStatus(sessionId);
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
      releaseDevLockBeacon(sessionId);
    };

    // Universal guard preventing accidental reload/closure when unpublished or in-flight edits exist
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDevMode) {
        handleBeforeUnloadGuard(e);
      }
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

  // 4b. Immediate Mount & Focus Lock Exclusivity Validation
  useEffect(() => {
    if (!isDevMode) return;

    const verifyLockExclusivity = async () => {
      const status = await checkDevLockStatus(sessionId);
      if (!status.canAcquire && status.currentLock && !status.isSelfSession) {
        console.warn('[DeveloperModeContext] Active lock claimed by another coordinator.');
        setIsDevMode(false);
        clearSessionUnlockTime();
        clearDraftStorage();
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
  }, [isDevMode, sessionId]);

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

      // Pre-flight check: block before PIN entry if locked by another coordinator
      checkDevLockStatus(sessionId)
        .then((status) => {
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
          isLockBlockedRef.current = false;
          setIsLockBlocked(false);
          setActiveLockInfo(null);
          setPinState('idle');
          isPinModalOpenRef.current = true;
          setIsPinModalOpen(true);
        });
    },
    [sessionId]
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
        releaseDevLock(sessionId);
        setIsDevMode(false);
      }
      setIsRenewal(false);
    }
  }, [isRenewal, sessionId]);

  const closeLockBlockedModal = useCallback(() => {
    isLockBlockedRef.current = false;
    setIsLockBlocked(false);
    setActiveLockInfo(null);
  }, []);

  const refreshLockStatus = useCallback(async () => {
    try {
      const status = await checkDevLockStatus(sessionId);
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
  }, [sessionId, openPinModal]);

  // 6. Cross-Tab Storage Event Synchronization
  useEffect(() => {
    const unsubscribe = subscribeToLockStorage((lock) => {
      if (lock && lock.isLocked && lock.lockedBySessionId !== sessionId) {
        // Another tab has taken the lock
        if (isDevMode) {
          setIsDevMode(false);
          clearSessionUnlockTime();
        }
        if (isPinModalOpenRef.current) {
          isPinModalOpenRef.current = false;
          setIsPinModalOpen(false);
          isLockBlockedRef.current = true;
          setIsLockBlocked(true);
        }
        setActiveLockInfo(lock);
      } else if (!lock || !lock.isLocked) {
        if (isLockBlockedRef.current) {
          // Another user/tab released the lock while this tab was waiting in the warning modal.
          // Transition directly from the blocked warning modal to the PIN entry modal.
          openPinModal(false, true);
        }
      }
    });

    return unsubscribe;
  }, [isDevMode, sessionId, openPinModal]);

  const exitDevMode = useCallback(
    (options?: { discard?: boolean }) => {
      if (options?.discard === true) {
        discardDraftSession();
      } else {
        clearDraftStorage();
      }
      setHasUnpublishedChanges(false);
      releaseDevLock(sessionId);
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
    },
    [sessionId]
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

  // 7. PIN Verification Submission with Concurrency Lock Acquisition
  const submitPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (getLockoutUntil() && Date.now() < (getLockoutUntil() ?? 0)) {
        setPinState('locked_out');
        return false;
      }

      setPinState('verifying');

      try {
        // 3-second circuit breaker / safety timeout guard
        const verificationPromise = verifyPin(pin);
        const timeoutPromise = new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('PIN verification timed out.')), 3000)
        );

        const isValid = await Promise.race([verificationPromise, timeoutPromise]);

        if (isValid) {
          // Attempt institutional dev lock acquisition
          const lockRes = await acquireDevLock(sessionId);
          if (!lockRes.success && lockRes.lock) {
            // Collision race condition: another coordinator acquired lock right before submission
            isPinModalOpenRef.current = false;
            setIsPinModalOpen(false);
            setPinState('idle');
            isLockBlockedRef.current = true;
            setIsLockBlocked(true);
            setActiveLockInfo(lockRes.lock);
            return false;
          }

          const now = Date.now();
          setSessionUnlockTime(now);
          resetFailedAttempts();
          clearLockoutUntil();
          setAttemptsRemaining(MAX_ATTEMPTS);
          setSessionRemainingMinutes(30);
          setPinState('success');
          try {
            if (isRenewal) {
              initDraftSession(false);
            } else {
              initDraftSession(true);
            }
          } catch (err) {
            console.error('Draft initialization failed:', err);
            setToastState({
              message: 'Draft Initialization Failed: Insufficient browser storage to create draft workspace.',
              type: 'error',
            });
            setIsDevMode(false);
            return false;
          }
          setIsDevMode(true);
          setIsRenewal(false);
          isLockBlockedRef.current = false;
          setIsLockBlocked(false);
          setActiveLockInfo(null);
          setTimeout(() => {
            isPinModalOpenRef.current = false;
            setIsPinModalOpen(false);
            setPinState('idle');
          }, 400);
          return true;
        } else {
          const nextFailures = getFailedAttempts() + 1;
          setFailedAttempts(nextFailures);
          const remaining = Math.max(0, MAX_ATTEMPTS - nextFailures);
          setAttemptsRemaining(remaining);

          if (remaining === 0) {
            const lockoutTime = Date.now() + LOCKOUT_DURATION_MS;
            setLockoutUntil(lockoutTime);
            setLockoutRemainingSeconds(60);
            setPinState('locked_out');
          } else {
            setPinState('error');
          }
          return false;
        }
      } catch (err) {
        console.warn('[DeveloperMode] Verification error caught:', err);
        const nextFailures = getFailedAttempts() + 1;
        setFailedAttempts(nextFailures);
        const remaining = Math.max(0, MAX_ATTEMPTS - nextFailures);
        setAttemptsRemaining(remaining);

        if (remaining === 0) {
          const lockoutTime = Date.now() + LOCKOUT_DURATION_MS;
          setLockoutUntil(lockoutTime);
          setLockoutRemainingSeconds(60);
          setPinState('locked_out');
        } else {
          setPinState('error');
        }
        return false;
      }
    },
    [sessionId]
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

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastState({ message, type });
  }, []);

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
    isLockBlocked,
    activeLockInfo,
    closeLockBlockedModal,
    refreshLockStatus,
    hasUnpublishedChanges,
    setHasUnpublishedChanges: (dirty: boolean) => {
      setDraftDirty(dirty);
      setHasUnpublishedChanges(dirty);
    },
    isCloudHydrating,
    cloudSyncStatus,
    showToast,
  };

  return (
    <DeveloperModeContext.Provider value={value}>
      {children}
      {toastState && (
        <Toast
          message={toastState.message}
          type={toastState.type}
          onDismiss={() => setToastState(null)}
        />
      )}
    </DeveloperModeContext.Provider>
  );
};

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
      openPinModal: () => {},
      closePinModal: () => {},
      submitPin: async () => false,
      exitDevMode: () => {},
      isExitConfirmOpen: false,
      requestExitDevMode: () => {},
      confirmExitDevMode: () => {},
      closeExitConfirmModal: () => {},
      toggleDevMode: () => {},
      sessionId: '',
      isLockBlocked: false,
      activeLockInfo: null,
      closeLockBlockedModal: () => {},
      refreshLockStatus: async () => {},
      hasUnpublishedChanges: false,
      setHasUnpublishedChanges: () => {},
      isCloudHydrating: false,
      cloudSyncStatus: 'saved',
      showToast: () => {},
    };
  }
  return context;
};

export default DeveloperModeContext;
