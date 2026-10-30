/**
 * devLockService.ts
 * Folio Engine: Developer Mode Database Session Lock & Race Prevention Service
 * Task 9.1: docs/tasks/task9_1_dev_mode_database_session_lock.md
 *
 * Enforces strict single-coordinator exclusivity across the portal:
 * 1. PostgREST / Supabase cloud persistence for live cross-device coordinator lock.
 * 2. High-resilience localStorage multi-tab fallback with cross-tab storage events.
 * 3. 30-second heartbeat renewal with 60-second crash recovery timeout.
 * 4. Beacon-based immediate release on tab/window unload (navigator.sendBeacon / fetch keepalive).
 */

import type { DevSessionLock, DevLockStatusResponse } from '../types/developer';

export const DEV_LOCK_STORAGE_KEY = 'masid_dev_lock';
export const DEV_SESSION_ID_KEY = 'masid_dev_session_id';
export const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
export const LOCK_EXPIRATION_MS = 60_000; // 60 seconds (crash timeout)

interface RawSupabaseSessionRow {
  id: string;
  is_locked: boolean;
  locked_by_session_id: string;
  coordinator_label: string;
  locked_at: string;
  last_heartbeat_at: string;
  expires_at: string;
}

import { getSupabaseConfig, isTableAvailable, markTableMissing } from '../utils/supabase-config';
export { getSupabaseConfig, isTableAvailable, markTableMissing };

let inMemorySessionId: string | null = null;

export const TAB_INSTANCE_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

let sessionBroadcastChannel: BroadcastChannel | null = null;
export function getSessionBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!sessionBroadcastChannel) {
    try {
      sessionBroadcastChannel = new BroadcastChannel('masid_tab_session_dedup');
    } catch {
      // Ignore in restricted environments
    }
  }
  return sessionBroadcastChannel;
}

/**
 * Regenerates a unique browser tab session ID (used when a cloned tab is detected).
 */
export function regenerateSessionId(): string {
  const newId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  inMemorySessionId = newId;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(DEV_SESSION_ID_KEY, newId);
    } catch {
      // Storage restricted fallback
    }
  }
  return newId;
}

/**
 * Generates or retrieves a persistent browser tab session ID.
 */
export function getSessionId(): string {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem(DEV_SESSION_ID_KEY);
      if (stored && stored.trim().length > 0) {
        return stored;
      }
      const newId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      window.sessionStorage.setItem(DEV_SESSION_ID_KEY, newId);
      return newId;
    } catch {
      // Storage restricted fallback
    }
  }

  if (!inMemorySessionId) {
    inMemorySessionId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
  return inMemorySessionId;
}

/**
 * Reset memory session ID (primarily for test harness isolation).
 */
export function resetSessionIdForTesting(newId?: string): void {
  inMemorySessionId = newId || null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (newId) {
        window.sessionStorage.setItem(DEV_SESSION_ID_KEY, newId);
      } else {
        window.sessionStorage.removeItem(DEV_SESSION_ID_KEY);
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Evaluates whether an active lock has expired past the 60-second crash recovery window.
 */
export function isLockExpired(lock: DevSessionLock, now: number = Date.now()): boolean {
  if (!lock.isLocked) return true;
  const heartbeatTime = new Date(lock.lastHeartbeatAt).getTime();
  if (Number.isNaN(heartbeatTime)) return true;
  return now - heartbeatTime > LOCK_EXPIRATION_MS;
}

/**
 * Read the local session lock state from persistent storage.
 */
export function getLocalLock(): DevSessionLock | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage?.getItem(DEV_LOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DevSessionLock;
    if (parsed && typeof parsed.isLocked === 'boolean' && parsed.lockedBySessionId) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write the local session lock state to persistent storage.
 */
export function setLocalLock(lock: DevSessionLock | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!lock) {
      window.localStorage?.removeItem(DEV_LOCK_STORAGE_KEY);
    } else {
      window.localStorage?.setItem(DEV_LOCK_STORAGE_KEY, JSON.stringify(lock));
    }
  } catch {
    // Ignore storage quota or disabled errors
  }
}

/**
 * Query active lock status from Supabase cloud or local multi-tab cache.
 */
export async function checkDevLockStatus(sessionId: string): Promise<DevLockStatusResponse> {
  const config = getSupabaseConfig();
  let activeLock: DevSessionLock | null = null;
  let cloudQueried = false;

  if (config && isTableAvailable('dev_mode_session')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(
        `${config.url}/rest/v1/dev_mode_session?id=eq.active_session&select=*`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.status === 404) {
        markTableMissing('dev_mode_session');
      } else if (res.ok) {
        cloudQueried = true;
        const rows = (await res.json()) as RawSupabaseSessionRow[];
        if (rows && rows.length > 0 && rows[0].is_locked) {
          const row = rows[0];
          activeLock = {
            id: 'active_session',
            isLocked: row.is_locked,
            lockedBySessionId: row.locked_by_session_id,
            coordinatorLabel: row.coordinator_label || 'Coordinator',
            lockedAt: row.locked_at,
            lastHeartbeatAt: row.last_heartbeat_at,
            expiresAt: row.expires_at,
          };
          // Sync cloud truth to local cache
          setLocalLock(activeLock);
        } else if (rows && rows.length > 0 && !rows[0].is_locked) {
          activeLock = null;
          setLocalLock(null);
        }
      }
    } catch {
      // Network failure or timeout: fall back gracefully to local multi-tab lock
    }
  }

  // If cloud could not be queried or table missing, check local lock
  if (!cloudQueried && !activeLock) {
    activeLock = getLocalLock();
  }

  // Evaluate validity and expiration
  if (!activeLock || isLockExpired(activeLock)) {
    return {
      canAcquire: true,
      currentLock: undefined,
      isSelfSession: false,
    };
  }

  const isSelf = activeLock.lockedBySessionId === sessionId;
  return {
    canAcquire: isSelf,
    currentLock: activeLock,
    isSelfSession: isSelf,
  };
}

/**
 * Attempt to acquire the Developer Mode lock institutional-wide.
 * Enforces atomic Compare-And-Swap (CAS) against Supabase cloud storage.
 */
export async function acquireDevLock(
  sessionId: string,
  coordinatorLabel: string = 'Coordinator'
): Promise<{ success: boolean; lock?: DevSessionLock; error?: string }> {
  // Pre-flight status check
  const status = await checkDevLockStatus(sessionId);

  if (!status.canAcquire && status.currentLock && !status.isSelfSession) {
    return {
      success: false,
      lock: status.currentLock,
      error: 'Lock is currently held by another active coordinator.',
    };
  }

  const now = new Date();
  const expires = new Date(now.getTime() + LOCK_EXPIRATION_MS);

  const lock: DevSessionLock = {
    id: 'active_session',
    isLocked: true,
    lockedBySessionId: sessionId,
    coordinatorLabel,
    lockedAt: now.toISOString(),
    lastHeartbeatAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  const config = getSupabaseConfig();
  if (config && isTableAvailable('dev_mode_session')) {
    try {
      const nowIso = now.toISOString();
      // Atomic CAS via PostgREST row filtering:
      // Row is updated ONLY IF:
      // 1. is_locked is false, OR
      // 2. expires_at < now (previous lock expired), OR
      // 3. locked_by_session_id is already this session (re-entry/renewal)
      const patchUrl = `${config.url}/rest/v1/dev_mode_session?id=eq.active_session&or=(is_locked.eq.false,expires_at.lt.${nowIso},locked_by_session_id.eq.${sessionId})`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          is_locked: true,
          locked_by_session_id: sessionId,
          coordinator_label: coordinatorLabel,
          locked_at: lock.lockedAt,
          last_heartbeat_at: lock.lastHeartbeatAt,
          expires_at: lock.expiresAt,
        }),
      });

      if (patchRes.status === 404) {
        markTableMissing('dev_mode_session');
        setLocalLock(lock);
        return { success: true, lock };
      }

      if (patchRes.ok) {
        const rows = (await patchRes.json()) as RawSupabaseSessionRow[];
        if (rows && rows.length > 0) {
          const acquiredRow = rows[0];
          const cloudLock: DevSessionLock = {
            id: 'active_session',
            isLocked: true,
            lockedBySessionId: acquiredRow.locked_by_session_id,
            coordinatorLabel: acquiredRow.coordinator_label || coordinatorLabel,
            lockedAt: acquiredRow.locked_at,
            lastHeartbeatAt: acquiredRow.last_heartbeat_at,
            expiresAt: acquiredRow.expires_at,
          };
          setLocalLock(cloudLock);
          return { success: true, lock: cloudLock };
        } else {
          // 0 rows updated: check if the row exists or if it's locked by another coordinator
          const checkRes = await fetch(
            `${config.url}/rest/v1/dev_mode_session?id=eq.active_session&select=*`,
            {
              headers: {
                apikey: config.anonKey,
                Authorization: `Bearer ${config.anonKey}`,
              },
            }
          );

          if (checkRes.ok) {
            const existingRows = (await checkRes.json()) as RawSupabaseSessionRow[];
            if (existingRows.length === 0) {
              // Table is completely empty: insert initial row
              const insertRes = await fetch(`${config.url}/rest/v1/dev_mode_session`, {
                method: 'POST',
                headers: {
                  apikey: config.anonKey,
                  Authorization: `Bearer ${config.anonKey}`,
                  'Content-Type': 'application/json',
                  Prefer: 'return=representation',
                },
                body: JSON.stringify({
                  id: 'active_session',
                  is_locked: true,
                  locked_by_session_id: sessionId,
                  coordinator_label: coordinatorLabel,
                  locked_at: lock.lockedAt,
                  last_heartbeat_at: lock.lastHeartbeatAt,
                  expires_at: lock.expiresAt,
                }),
              });
              if (insertRes.ok) {
                setLocalLock(lock);
                return { success: true, lock };
              }
            } else if (
              existingRows[0].is_locked &&
              existingRows[0].locked_by_session_id !== sessionId
            ) {
              // Another coordinator acquired the lock first in the race
              const currentHolder: DevSessionLock = {
                id: 'active_session',
                isLocked: true,
                lockedBySessionId: existingRows[0].locked_by_session_id,
                coordinatorLabel: existingRows[0].coordinator_label || 'Coordinator',
                lockedAt: existingRows[0].locked_at,
                lastHeartbeatAt: existingRows[0].last_heartbeat_at,
                expiresAt: existingRows[0].expires_at,
              };
              setLocalLock(currentHolder);
              return {
                success: false,
                lock: currentHolder,
                error: 'Lock is currently held by another active coordinator.',
              };
            }
          }
        }
      } else {
        console.warn(`[devLockService] Supabase patch responded with HTTP ${patchRes.status}`);
      }
    } catch (err) {
      console.warn('[devLockService] Supabase write error; holding local lock:', err);
    }
  }

  // 1. Immediately store in local multi-tab storage fallback
  setLocalLock(lock);
  return {
    success: true,
    lock,
  };
}

/**
 * Renews the liveness timestamp for the active session.
 * Rejects renewal if another session has claimed the cloud row.
 */
export async function renewDevLockHeartbeat(sessionId: string): Promise<boolean> {
  const local = getLocalLock();
  // If local exists and belongs to another non-expired session, refuse renewal
  if (local && local.isLocked && local.lockedBySessionId !== sessionId && !isLockExpired(local)) {
    return false;
  }

  const now = new Date();
  const expires = new Date(now.getTime() + LOCK_EXPIRATION_MS);

  const renewedLock: DevSessionLock = {
    id: 'active_session',
    isLocked: true,
    lockedBySessionId: sessionId,
    coordinatorLabel: local?.coordinatorLabel || 'Coordinator',
    lockedAt: local?.lockedAt || now.toISOString(),
    lastHeartbeatAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  const config = getSupabaseConfig();
  if (config && isTableAvailable('dev_mode_session')) {
    try {
      const res = await fetch(
        `${config.url}/rest/v1/dev_mode_session?id=eq.active_session&locked_by_session_id=eq.${sessionId}`,
        {
          method: 'PATCH',
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            is_locked: true,
            last_heartbeat_at: renewedLock.lastHeartbeatAt,
            expires_at: renewedLock.expiresAt,
          }),
        }
      );
      if (res.status === 404) {
        markTableMissing('dev_mode_session');
        setLocalLock(renewedLock);
        return true;
      }
      if (res.ok) {
        const rows = (await res.json()) as RawSupabaseSessionRow[];
        if (rows && rows.length > 0) {
          setLocalLock(renewedLock);
          return true;
        }
        // 0 rows updated: lock was taken by another coordinator or freed
        return false;
      }
      return false;
    } catch {
      return true; // Local lock kept alive on network interruption
    }
  }

  setLocalLock(renewedLock);
  return true;
}

/**
 * Releases the Developer Mode lock cleanly.
 */
export async function releaseDevLock(sessionId: string): Promise<boolean> {
  const local = getLocalLock();
  if (local && local.lockedBySessionId === sessionId) {
    setLocalLock(null);
  }

  const config = getSupabaseConfig();
  if (config && isTableAvailable('dev_mode_session')) {
    try {
      const res = await fetch(
        `${config.url}/rest/v1/dev_mode_session?id=eq.active_session&locked_by_session_id=eq.${sessionId}`,
        {
          method: 'PATCH',
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            is_locked: false,
          }),
        }
      );
      if (res.status === 404) {
        markTableMissing('dev_mode_session');
        return true;
      }
      return res.ok;
    } catch {
      return true;
    }
  }

  return true;
}

/**
 * Dispatches an instant release beacon when tab/window unloads (beforeunload/pagehide).
 */
export function releaseDevLockBeacon(sessionId: string): void {
  // 1. Immediately wipe local lock
  const local = getLocalLock();
  if (local && local.lockedBySessionId === sessionId) {
    setLocalLock(null);
  }

  // 2. Dispatch network beacon if Supabase is configured
  const config = getSupabaseConfig();
  if (!config || !isTableAvailable('dev_mode_session')) return;

  const url = `${config.url}/rest/v1/dev_mode_session?id=eq.active_session&locked_by_session_id=eq.${sessionId}`;
  const payload = JSON.stringify({ is_locked: false });

  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }
  } catch {
    // Fall back to keepalive fetch
  }

  try {
    if (typeof fetch !== 'undefined') {
      fetch(url, {
        method: 'PATCH',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
        },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Ignore unload exceptions
  }
}

/**
 * Subscribes to cross-tab lock changes via storage events.
 */
export function subscribeToLockStorage(callback: (lock: DevSessionLock | null) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (e: StorageEvent) => {
    if (e.key === DEV_LOCK_STORAGE_KEY) {
      try {
        const parsed = e.newValue ? (JSON.parse(e.newValue) as DevSessionLock) : null;
        callback(parsed);
      } catch {
        callback(null);
      }
    }
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
