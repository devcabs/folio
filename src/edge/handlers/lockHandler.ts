/**
 * Folio Engine — Edge Coordinator Lock & PIN Auth Handler
 * Location: src/edge/handlers/lockHandler.ts
 * Specification: docs/task/7.1-storage-adapter-and-security-ssot.md,
 *                docs/task/7.9-media-proxy-and-session-lock-ssot.md
 *
 * Authoritative Cloudflare Edge handler for:
 * - PIN verification against env.DEV_SECURITY_SALT & env.DEV_PIN_HASH
 * - Brute-force rate-limiting in KV (lock:pin_ratelimit)
 * - Opaque lockToken issuance, renewal, and release in KV (lock:coordinator)
 */

import type { KVNamespace } from '../../types/edge';
import {
  hashPin,
  MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from '../../utils/devSecurity';

export const KV_LOCK_COORDINATOR_KEY = 'lock:coordinator';
export const KV_PIN_RATELIMIT_KEY = 'lock:pin_ratelimit';
export const LOCK_TTL_SECONDS = 60;
export const LOCK_EXPIRATION_MS = LOCK_TTL_SECONDS * 1000;

interface LockCoordinatorRecord {
  sessionId: string;
  lockToken: string;
  coordinatorLabel: string;
  lockedAt: number;
  heartbeatAt: number;
  acquiredAt: number;
  expiresAt: number;
}

interface PinRateLimitRecord {
  failedAttempts: number;
  lockedUntil: number | null;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match ? match[1].trim() : null;
}

function generateOpaqueToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  }
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies Authorization: Bearer <lockToken> against KV lock:coordinator.
 */
export async function verifyLockToken(
  request: Request,
  kv: KVNamespace | null
): Promise<{ valid: boolean; status: number; error?: string }> {
  if (!kv) {
    return { valid: false, status: 503, error: 'KV storage is not configured on the edge.' };
  }
  const token = extractBearerToken(request);
  if (!token) {
    return { valid: false, status: 401, error: 'Missing Authorization Bearer lock token.' };
  }
  const record = await kv.get<LockCoordinatorRecord>(KV_LOCK_COORDINATOR_KEY, 'json');
  if (!record || Date.now() >= record.expiresAt) {
    return { valid: false, status: 401, error: 'Coordinator lock is missing or expired.' };
  }
  if (record.lockToken !== token) {
    return { valid: false, status: 401, error: 'Invalid coordinator lock token.' };
  }
  return { valid: true, status: 200 };
}

/**
 * Handles GET, POST, PATCH, and DELETE /api/lock requests.
 */
export async function handleLockRoute(
  request: Request,
  env: any,
  kv: KVNamespace | null
): Promise<Response> {
  if (!kv) {
    return jsonResponse({ error: 'KV storage is not configured on the edge.' }, 503);
  }

  const method = request.method.toUpperCase();
  const now = Date.now();

  if (method === 'GET') {
    const [record, rateLimit] = await Promise.all([
      kv.get<LockCoordinatorRecord>(KV_LOCK_COORDINATOR_KEY, 'json'),
      kv.get<PinRateLimitRecord>(KV_PIN_RATELIMIT_KEY, 'json'),
    ]);

    const activeLockoutUntil =
      rateLimit?.lockedUntil && now < rateLimit.lockedUntil ? rateLimit.lockedUntil : null;
    const failedAttempts =
      rateLimit && (!rateLimit.lockedUntil || now < rateLimit.lockedUntil)
        ? rateLimit.failedAttempts
        : 0;
    const attemptsRemaining = activeLockoutUntil
      ? 0
      : Math.max(0, MAX_ATTEMPTS - failedAttempts);

    const isLocked = Boolean(record && now < record.expiresAt);
    const bearerToken = extractBearerToken(request);
    const isSelfSession = Boolean(
      isLocked && bearerToken && record && record.lockToken === bearerToken
    );

    if (!isLocked || !record) {
      return jsonResponse(
        {
          locked: false,
          isLocked: false,
          canAcquire: true,
          isSelfSession: false,
          lockoutUntil: activeLockoutUntil,
          attemptsRemaining,
        },
        200
      );
    }

    // Never expose holderSessionId, sessionId, or lockToken
    return jsonResponse(
      {
        locked: true,
        isLocked: true,
        canAcquire: isSelfSession,
        isSelfSession,
        coordinatorLabel: record.coordinatorLabel || 'Coordinator',
        acquiredAt: record.acquiredAt,
        lockedAt: record.lockedAt,
        heartbeatAt: record.heartbeatAt,
        expiresAt: record.expiresAt,
        lockoutUntil: activeLockoutUntil,
        attemptsRemaining,
      },
      200
    );
  }

  if (method === 'POST') {
    const salt = typeof env?.DEV_SECURITY_SALT === 'string' ? env.DEV_SECURITY_SALT.trim() : '';
    const expectedHash = typeof env?.DEV_PIN_HASH === 'string' ? env.DEV_PIN_HASH.trim() : '';

    if (!salt || !expectedHash) {
      return jsonResponse(
        { error: 'Edge security credentials (DEV_SECURITY_SALT / DEV_PIN_HASH) are not configured.' },
        503
      );
    }

    const rateLimit = (await kv.get<PinRateLimitRecord>(KV_PIN_RATELIMIT_KEY, 'json')) ?? {
      failedAttempts: 0,
      lockedUntil: null,
    };

    if (rateLimit.lockedUntil && now < rateLimit.lockedUntil) {
      return jsonResponse(
        {
          error: 'Too many failed PIN attempts. Locked out.',
          lockoutUntil: rateLimit.lockedUntil,
          attemptsRemaining: 0,
        },
        429
      );
    }

    let pin = '';
    let requestedSessionId = '';
    let coordinatorLabel = 'Coordinator';
    let forceReacquireWithPin = false;

    try {
      const body = (await request.json()) as {
        pin?: unknown;
        sessionId?: unknown;
        coordinatorLabel?: unknown;
        forceReacquireWithPin?: unknown;
      };
      pin = typeof body?.pin === 'string' ? body.pin : '';
      requestedSessionId =
        typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
      if (typeof body?.coordinatorLabel === 'string' && body.coordinatorLabel.trim()) {
        coordinatorLabel = body.coordinatorLabel.trim();
      }
      forceReacquireWithPin = body?.forceReacquireWithPin === true;
    } catch {
      return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
    }

    const isFourDigits = pin.length === 4;
    const computedHash = isFourDigits ? await hashPin(pin, salt) : '';
    const isValid = isFourDigits && computedHash === expectedHash;

    if (!isValid) {
      const nextAttempts =
        (rateLimit.lockedUntil && now >= rateLimit.lockedUntil ? 0 : rateLimit.failedAttempts) + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        const lockoutUntil = now + LOCKOUT_DURATION_MS;
        await kv.put(
          KV_PIN_RATELIMIT_KEY,
          JSON.stringify({ failedAttempts: nextAttempts, lockedUntil: lockoutUntil }),
          { expirationTtl: Math.ceil(LOCKOUT_DURATION_MS / 1000) + 60 }
        );
        return jsonResponse(
          {
            error: 'Too many failed PIN attempts. Locked out.',
            lockoutUntil,
            attemptsRemaining: 0,
          },
          429
        );
      }

      await kv.put(
        KV_PIN_RATELIMIT_KEY,
        JSON.stringify({ failedAttempts: nextAttempts, lockedUntil: null }),
        { expirationTtl: Math.ceil(LOCKOUT_DURATION_MS / 1000) + 60 }
      );
      return jsonResponse(
        {
          error: 'Invalid PIN.',
          attemptsRemaining: MAX_ATTEMPTS - nextAttempts,
          lockoutUntil: null,
        },
        401
      );
    }

    // Valid PIN: clear rate limit
    await kv.delete(KV_PIN_RATELIMIT_KEY);

    // Check if an active non-expired lock is held by a competing session
    const existing = await kv.get<LockCoordinatorRecord>(KV_LOCK_COORDINATOR_KEY, 'json');
    if (
      existing &&
      now < existing.expiresAt &&
      requestedSessionId &&
      existing.sessionId &&
      requestedSessionId !== existing.sessionId &&
      !forceReacquireWithPin
    ) {
      return jsonResponse(
        {
          error: 'Coordinator lock is currently held by another active session.',
          isLocked: true,
          coordinatorLabel: existing.coordinatorLabel || 'Coordinator',
          expiresAt: existing.expiresAt,
        },
        409
      );
    }

    const sessionId = requestedSessionId || generateOpaqueToken();
    const lockToken = generateOpaqueToken();
    const expiresAt = now + LOCK_EXPIRATION_MS;
    const record: LockCoordinatorRecord = {
      sessionId,
      lockToken,
      coordinatorLabel,
      lockedAt: now,
      heartbeatAt: now,
      acquiredAt: now,
      expiresAt,
    };

    await kv.put(KV_LOCK_COORDINATOR_KEY, JSON.stringify(record), {
      expirationTtl: LOCK_TTL_SECONDS,
    });

    return jsonResponse(
      {
        ok: true,
        success: true,
        sessionId,
        lockToken,
        coordinatorLabel,
        acquiredAt: now,
        lockedAt: now,
        expiresAt,
      },
      200
    );
  }

  if (method === 'PATCH') {
    const auth = await verifyLockToken(request, kv);
    if (!auth.valid) {
      return jsonResponse({ error: auth.error }, auth.status);
    }
    const existing = await kv.get<LockCoordinatorRecord>(KV_LOCK_COORDINATOR_KEY, 'json');
    if (!existing) {
      return jsonResponse({ error: 'Coordinator lock not found.' }, 404);
    }
    const expiresAt = now + LOCK_EXPIRATION_MS;
    await kv.put(
      KV_LOCK_COORDINATOR_KEY,
      JSON.stringify({ ...existing, heartbeatAt: now, expiresAt }),
      { expirationTtl: LOCK_TTL_SECONDS }
    );
    return jsonResponse({ ok: true, success: true, expiresAt }, 200);
  }

  if (method === 'DELETE') {
    const auth = await verifyLockToken(request, kv);
    if (!auth.valid) {
      return jsonResponse({ error: auth.error }, auth.status);
    }
    await kv.delete(KV_LOCK_COORDINATOR_KEY);
    return jsonResponse({ ok: true, success: true }, 200);
  }

  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
