/**
 * devLockService.ts
 * Folio Engine: Edge-Authenticated Cloudflare KV Coordinator Session Lock Service
 * Specification: docs/task/7.9-media-proxy-and-session-lock-ssot.md
 *
 * Enforces strict single-coordinator exclusivity via /api/lock (Cloudflare KV):
 * - Zero browser storage or cross-tab broadcast channels.
 * - Zero module-level session IDs or offline local fallback locks.
 * - Strict fail-stop semantics on all network or HTTP errors.
 */

import type { DevSessionLock, DevLockStatusResponse } from '../types/developer';

export const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
export const LOCK_EXPIRATION_MS = 60_000; // 60 seconds (KV TTL)

export interface AcquireDevLockOptions {
  pin: string;
  sessionId?: string;
  coordinatorLabel?: string;
  forceReacquireWithPin?: boolean;
}

export interface AcquireDevLockResult {
  success: boolean;
  sessionId?: string;
  lockToken?: string;
  expiresAt?: number;
  lock?: DevSessionLock;
  status?: number;
  error?: string;
  attemptsRemaining?: number;
  lockoutUntil?: number | null;
}

/**
 * Generates an ephemeral session identifier without module-level or browser storage.
 */
export function getSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
 * Query active lock status from Cloudflare KV via GET /api/lock.
 * Fails stop (canAcquire: false) on any non-2xx or network error.
 */
export async function checkDevLockStatus(
  lockToken?: string | null
): Promise<DevLockStatusResponse> {
  if (typeof fetch !== 'function') {
    return {
      canAcquire: false,
      isSelfSession: false,
      error: 'Fetch API unavailable.',
    };
  }

  try {
    const headers: Record<string, string> = {};
    if (lockToken) {
      headers['Authorization'] = `Bearer ${lockToken}`;
    }

    const res = await fetch('/api/lock', {
      method: 'GET',
      cache: 'no-store',
      headers,
    });

    if (!res.ok) {
      return {
        canAcquire: false,
        isSelfSession: false,
        error: `Lock status check failed (HTTP ${res.status}).`,
      };
    }

    const data = (await res.json()) as {
      isLocked?: boolean;
      locked?: boolean;
      canAcquire?: boolean;
      isSelfSession?: boolean;
      coordinatorLabel?: string;
      lockedAt?: number;
      heartbeatAt?: number;
      acquiredAt?: number;
      expiresAt?: number;
      lockoutUntil?: number | null;
      attemptsRemaining?: number;
    };

    const isLocked = Boolean(data.isLocked ?? data.locked);
    if (!isLocked) {
      return {
        canAcquire: data.canAcquire !== false,
        isSelfSession: false,
        lockoutUntil: data.lockoutUntil ?? null,
        attemptsRemaining: data.attemptsRemaining,
      };
    }

    const currentLock: DevSessionLock = {
      id: 'active_session',
      isLocked: true,
      lockedBySessionId: '',
      coordinatorLabel: data.coordinatorLabel || 'Coordinator',
      lockedAt: data.lockedAt
        ? new Date(data.lockedAt).toISOString()
        : new Date().toISOString(),
      lastHeartbeatAt: data.heartbeatAt
        ? new Date(data.heartbeatAt).toISOString()
        : new Date().toISOString(),
      expiresAt: data.expiresAt
        ? new Date(data.expiresAt).toISOString()
        : new Date(Date.now() + LOCK_EXPIRATION_MS).toISOString(),
    };

    return {
      canAcquire: Boolean(data.canAcquire),
      currentLock,
      isSelfSession: Boolean(data.isSelfSession),
      lockoutUntil: data.lockoutUntil ?? null,
      attemptsRemaining: data.attemptsRemaining,
    };
  } catch (err) {
    return {
      canAcquire: false,
      isSelfSession: false,
      error: err instanceof Error ? err.message : 'Network error checking lock status.',
    };
  }
}

/**
 * Authenticates the coordinator PIN on the edge and acquires the Cloudflare KV lock
 * via POST /api/lock. Fails stop on any non-2xx or network error.
 */
export async function acquireDevLock(
  options: AcquireDevLockOptions
): Promise<AcquireDevLockResult> {
  if (typeof fetch !== 'function') {
    return { success: false, error: 'Fetch API unavailable.' };
  }

  try {
    const res = await fetch('/api/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: options.pin,
        sessionId: options.sessionId,
        coordinatorLabel: options.coordinatorLabel || 'Coordinator',
        forceReacquireWithPin: options.forceReacquireWithPin === true,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      success?: boolean;
      sessionId?: string;
      lockToken?: string;
      coordinatorLabel?: string;
      acquiredAt?: number;
      lockedAt?: number;
      expiresAt?: number;
      error?: string;
      attemptsRemaining?: number;
      lockoutUntil?: number | null;
    };

    if (!res.ok) {
      const conflictLock: DevSessionLock | undefined =
        res.status === 409
          ? {
            id: 'active_session',
            isLocked: true,
            lockedBySessionId: '',
            coordinatorLabel: data.coordinatorLabel || 'Coordinator',
            lockedAt: new Date().toISOString(),
            lastHeartbeatAt: new Date().toISOString(),
            expiresAt: data.expiresAt
              ? new Date(data.expiresAt).toISOString()
              : new Date(Date.now() + LOCK_EXPIRATION_MS).toISOString(),
          }
          : undefined;

      return {
        success: false,
        status: res.status,
        error: data.error || `Lock acquisition failed (HTTP ${res.status}).`,
        attemptsRemaining: data.attemptsRemaining,
        lockoutUntil: data.lockoutUntil,
        lock: conflictLock,
      };
    }

    const nowIso = new Date().toISOString();
    const lock: DevSessionLock = {
      id: 'active_session',
      isLocked: true,
      lockedBySessionId: data.sessionId || options.sessionId || '',
      coordinatorLabel: data.coordinatorLabel || options.coordinatorLabel || 'Coordinator',
      lockedAt: data.lockedAt ? new Date(data.lockedAt).toISOString() : nowIso,
      lastHeartbeatAt: nowIso,
      expiresAt: data.expiresAt
        ? new Date(data.expiresAt).toISOString()
        : new Date(Date.now() + LOCK_EXPIRATION_MS).toISOString(),
    };

    return {
      success: Boolean(data.success ?? data.ok),
      sessionId: data.sessionId,
      lockToken: data.lockToken,
      expiresAt: data.expiresAt,
      lock,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error acquiring lock.',
    };
  }
}

/**
 * Renews the 60-second KV TTL for the active coordinator session via PATCH /api/lock.
 * Fails stop (returns false) on any non-2xx or network error.
 */
export async function renewDevLockHeartbeat(lockToken?: string | null): Promise<boolean> {
  if (!lockToken || typeof fetch !== 'function') {
    return false;
  }

  try {
    const res = await fetch('/api/lock', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${lockToken}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Releases the coordinator lock in Cloudflare KV via DELETE /api/lock.
 * Fails stop (returns false) on any non-2xx or network error.
 */
export async function releaseDevLock(lockToken?: string | null): Promise<boolean> {
  if (!lockToken || typeof fetch !== 'function') {
    return false;
  }

  try {
    const res = await fetch('/api/lock', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${lockToken}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Dispatches a keepalive DELETE /api/lock request on tab/window unload.
 */
export function releaseDevLockBeacon(lockToken?: string | null): void {
  if (!lockToken || typeof fetch !== 'function') return;

  try {
    fetch('/api/lock', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${lockToken}`,
      },
      keepalive: true,
    }).catch(() => { });
  } catch {
    // Ignore unload exceptions
  }
}
