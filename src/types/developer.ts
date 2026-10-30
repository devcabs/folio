import React from 'react';
import type { CloudDraftSyncStatus } from './draft';

/**
 * TypeScript Contracts for Developer Mode & Live Administrative Affordances
 * Task 4.5.0: docs/tasks/task4_5_0_developer_mode.md
 */

export type PinVerificationState = 'idle' | 'verifying' | 'success' | 'error' | 'locked_out';

export interface DeveloperSessionInfo {
  unlockedAt: number | null;
  expiresAt: number | null;
  remainingMinutes: number;
}

export interface DevSessionLock {
  id: 'active_session';
  isLocked: boolean;
  lockedBySessionId: string;
  coordinatorLabel?: string;
  lockedAt: string; // ISO 8601
  lastHeartbeatAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
}

export interface DevLockStatusResponse {
  canAcquire: boolean;
  currentLock?: DevSessionLock;
  isSelfSession: boolean;
}

export interface DeveloperModeContextType {
  /** Whether developer mode is currently active and authenticated */
  isDevMode: boolean;
  /** Whether the current client device meets PC/Desktop requirements (>=1024px, fine pointer) */
  isDesktop: boolean;
  /** Whether the PIN entry modal is currently displayed */
  isPinModalOpen: boolean;
  /** Verification lifecycle state */
  pinState: PinVerificationState;
  /** Number of remaining incorrect attempts before 1-minute lockout */
  attemptsRemaining: number;
  /** Lockout countdown remaining in seconds (0 when not locked out) */
  lockoutRemainingSeconds: number;
  /** Remaining session time in minutes */
  sessionRemainingMinutes: number;
  /** Whether the current PIN modal was triggered for session renewal */
  isRenewal: boolean;
  /** Open PIN modal (or renewal prompt) */
  openPinModal: (isRenewal?: boolean, skipLockCheck?: boolean) => void;
  /** Close PIN modal */
  closePinModal: () => void;
  /** Submit 4-digit PIN for cryptographic verification */
  submitPin: (pin: string) => Promise<boolean>;
  /** Exit developer mode immediately, clearing session unlock timestamp */
  exitDevMode: (options?: { discard?: boolean }) => void;
  /** Whether the exit confirmation dialog is open */
  isExitConfirmOpen: boolean;
  /** Request exit from developer mode (prompts confirmation modal) */
  requestExitDevMode: () => void;
  /** Confirm exit from developer mode, closing dialog and exiting */
  confirmExitDevMode: (options?: { discard?: boolean }) => void;
  /** Dismiss exit confirmation dialog without exiting */
  closeExitConfirmModal: () => void;
  /** Toggle developer mode: opens PIN modal if inactive, prompts exit if active */
  toggleDevMode: () => void;

  // Phase 9.1 Developer Lock Extensions
  /** Unique session ID generated for this browser instance */
  sessionId: string;
  /** Whether Dev Mode entry is blocked because another coordinator holds the lock */
  isLockBlocked: boolean;
  /** Active lock metadata if blocked */
  activeLockInfo: DevSessionLock | null;
  /** Dismiss the blocked coordinator dialog */
  closeLockBlockedModal: () => void;
  /** Force release or refresh lock status */
  refreshLockStatus: () => Promise<void>;

  // Phase 9.7 Draft & Publish Extensions
  /** Whether there are unsaved draft changes in the active session */
  hasUnpublishedChanges: boolean;
  /** Update the dirty state of unpublished draft changes */
  setHasUnpublishedChanges: (hasChanges: boolean) => void;

  // Task 10.7 Zero-Flicker Hydration Extensions
  /** Whether the active version is currently hydrating from cloud storage */
  isCloudHydrating?: boolean;

  // Task 11.2.G2 Cloud DB-Draft Sync Status
  /** Current cloud DB-draft synchronization status */
  cloudSyncStatus?: CloudDraftSyncStatus;

  /** Display a floating Toast feedback capsule */
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export type DevEditType = 'text' | 'link' | 'image' | 'file';

export type DevAffordanceType = 'text' | 'link' | 'image' | 'file' | 'source' | 'indicator';

export interface DevLinkData {
  url: string;
  label?: string;
  openInNewTab?: boolean;
}

export interface DevImageData {
  src: string;
  alt: string;
  caption?: string;
  showCaption?: boolean;
}

export interface DevFileData {
  name: string;
  url: string;
  reference?: string;
  format?: 'pdf' | 'doc' | 'sheet' | 'other';
  size?: string;
}

export interface DevActionAffordanceProps {
  /** Identifier of the milestone or content node (e.g. 'stage-1', 'node-access') */
  pointId?: string;
  /** Type of affordance to render when developer mode is active */
  type?: DevAffordanceType;
  /** Optional custom action label (deprecated under Uniform Edit Standard) */
  label?: string;
  /** Callback when edit action is clicked */
  onEditText?: () => void;
  /** Callback when "Edit Source" action is clicked */
  onEditSource?: () => void;
  /** Optional link to associated Google Drive folder */
  driveUrl?: string;
  /** Current content for dynamic modal editing */
  currentValue?: string | DevLinkData | DevImageData | DevFileData;
  /** Default fallback content for dynamic modal editing */
  defaultValue?: string | DevLinkData | DevImageData | DevFileData;
  /** Direct update handler if bypassing useContent internal dispatch */
  onSave?: (newValue: string) => void;
  /** Direct reset handler if bypassing useContent internal dispatch */
  onReset?: () => void;
  /** Wrapped child component */
  children: React.ReactNode;
  /** Optional container class name */
  className?: string;
  /** Whether to render as an inline container instead of block */
  inline?: boolean;
  /** Whether the target content belongs to a section heading */
  isSection?: boolean;
  /** Whether the section is currently numbered */
  isNumbered?: boolean;
  /** Default numbering fallback */
  defaultNumbered?: boolean;
  /** Callback when section numbering is toggled */
  onNumberedChange?: (isNumbered: boolean) => void;
  /** Optional deterministic trigger identifier for canvas controls targeting */
  editTriggerId?: string;
}

