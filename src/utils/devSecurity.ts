import { getStorageNamespace } from '../config/engine.config';
/**
 * Security and Cryptographic Primitives for Developer Mode
 * Task 4.5.0: docs/tasks/task4_5_0_developer_mode.md
 *
 * Implements salted SHA-256 hashing via native Web Crypto API.
 * The raw 4-digit PIN is NEVER stored in cleartext.
 */

export const getDevSalt = (ns?: string) => (ns || getStorageNamespace()) + '_dev_salt_v1';
export const DEV_SALT = getDevSalt();
export const EXPECTED_PIN_HASH =
  'ebfaebc96b9ecb430622e1557189a900d6efa8c532687af1ea7f8ecabd9886d6';

export const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
export const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds (1 minute)
export const MAX_ATTEMPTS = 5;

export const getDevUnlockedAtKey = (ns?: string) => (ns || getStorageNamespace()) + '_dev_unlocked_at';
export const STORAGE_KEY_UNLOCKED_AT = getDevUnlockedAtKey();
export const getDevLockoutUntilKey = (ns?: string) => (ns || getStorageNamespace()) + '_dev_lockout_until';
export const STORAGE_KEY_LOCKOUT_UNTIL = getDevLockoutUntilKey();
export const getDevFailedAttemptsKey = (ns?: string) => (ns || getStorageNamespace()) + '_dev_failed_attempts';
export const STORAGE_KEY_FAILED_ATTEMPTS = getDevFailedAttemptsKey();

/**
 * Zero-dependency pure-TypeScript SHA-256 implementation.
 * Used as a seamless fallback when window.crypto.subtle is unavailable
 * (e.g. non-HTTPS environments, IP-based staging deploys, or restricted WebViews).
 */
export function sha256Fallback(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime: { [n: number]: boolean } = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isPrime[candidate]) {
      for (let i = candidate * candidate; i < 312; i += candidate) {
        isPrime[i] = true;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength | 0;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = [...hash];

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 =
        i < 16
          ? w[i]
          : ((w[i] =
              ((w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0) |
              0) |
            0);

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const temp1 = (hash[7] + s1 + ch + k[i] + s0) | 0;
      const s0Maj = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0Maj + maj) | 0;

      hash = [
        (temp1 + temp2) | 0,
        hash[0],
        hash[1],
        hash[2],
        (hash[3] + temp1) | 0,
        hash[4],
        hash[5],
        hash[6],
      ];
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Computes salted SHA-256 hex digest for a given input PIN string.
 * Native Web Crypto API execution: SHA-256(`${salt}:${pin}`) with
 * automatic graceful fallback to pure-TypeScript SHA-256.
 */
export async function hashPin(pin: string, salt: string = DEV_SALT): Promise<string> {
  const message = `${salt}:${pin}`;
  const cryptoObj =
    typeof window !== 'undefined' && window.crypto
      ? window.crypto
      : typeof globalThis !== 'undefined' && globalThis.crypto
        ? globalThis.crypto
        : null;

  if (cryptoObj && cryptoObj.subtle && typeof cryptoObj.subtle.digest === 'function') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch {
      // If Web Crypto fails unexpectedly in restricted runtime, fall back to pure-TS SHA-256
      return sha256Fallback(message);
    }
  }

  // Seamless fallback for non-secure contexts (http://, IP preview, restricted iframe, older WebViews)
  return sha256Fallback(message);
}

/**
 * Verifies a 4-digit numeric PIN against the salted SHA-256 hash digest.
 */
export async function verifyPin(inputPin: string): Promise<boolean> {
  if (!inputPin || inputPin.length !== 4) {
    return false;
  }
  const computedHash = await hashPin(inputPin);
  return computedHash === EXPECTED_PIN_HASH;
}

/**
 * Verifies whether the runtime environment is a PC / Desktop viewport.
 * Developer Mode is strictly locked to viewports >= 1024px with fine pointer precision.
 */
export function isDesktopDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // Primary check: viewport width >= 1024px (standard desktop threshold),
  // but permit split-screen laptop viewports (>= 720px) when fine pointer or keyboard is present
  const hasFinePointer =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: fine)').matches ||
        window.matchMedia('(any-pointer: fine)').matches
      : true;

  // Touch-only lockout: only lockout devices with coarse pointer (pointer: coarse) when no fine pointer exists
  const isCoarseOnly =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches && !hasFinePointer
      : false;

  const widthSufficient =
    window.innerWidth >= 1024 || (window.innerWidth >= 720 && hasFinePointer);

  return widthSufficient && !isCoarseOnly;
}

/**
 * Retrieves the stored session unlock timestamp from sessionStorage.
 */
export function getSessionUnlockTime(): number | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  const raw = sessionStorage.getItem(STORAGE_KEY_UNLOCKED_AT);
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Stores the session unlock timestamp in sessionStorage.
 */
export function setSessionUnlockTime(timestamp: number): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  sessionStorage.setItem(STORAGE_KEY_UNLOCKED_AT, timestamp.toString());
}

/**
 * Clears the session unlock timestamp from sessionStorage.
 */
export function clearSessionUnlockTime(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  sessionStorage.removeItem(STORAGE_KEY_UNLOCKED_AT);
}

/**
 * Evaluates whether a session timestamp is still active (< 30 minutes).
 */
export function isSessionValid(unlockedAt: number | null, now: number = Date.now()): boolean {
  if (!unlockedAt) return false;
  return now - unlockedAt < SESSION_DURATION_MS;
}

/**
 * Calculates remaining session duration in minutes (rounded up).
 */
export function getRemainingSessionMinutes(
  unlockedAt: number | null,
  now: number = Date.now()
): number {
  if (!unlockedAt) return 0;
  const elapsed = now - unlockedAt;
  const remainingMs = Math.max(0, SESSION_DURATION_MS - elapsed);
  return Math.ceil(remainingMs / (60 * 1000));
}

/**
 * Helper to safely access persistent storage (localStorage with sessionStorage fallback).
 * Prevents lockout bypass via page refreshes or opening new browser tabs.
 */
function getPersistentStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.localStorage) return window.localStorage;
  } catch {
    // Fall back if localStorage is disabled in restricted environments
  }
  try {
    if (window.sessionStorage) return window.sessionStorage;
  } catch {
    // Fallback if sessionStorage is also disabled
  }
  return null;
}

/**
 * Retrieves the lockout expiration timestamp if active.
 */
export function getLockoutUntil(): number | null {
  const storage = getPersistentStorage();
  if (!storage) return null;
  const raw = storage.getItem(getDevLockoutUntilKey());
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Stores the lockout expiration timestamp.
 */
export function setLockoutUntil(timestamp: number): void {
  const storage = getPersistentStorage();
  if (!storage) return;
  storage.setItem(getDevLockoutUntilKey(), timestamp.toString());
}

/**
 * Clears the lockout expiration timestamp.
 */
export function clearLockoutUntil(): void {
  const storage = getPersistentStorage();
  if (!storage) return;
  storage.removeItem(getDevLockoutUntilKey());
}

/**
 * Retrieves current failed attempts count.
 */
export function getFailedAttempts(): number {
  const storage = getPersistentStorage();
  if (!storage) return 0;
  const raw = storage.getItem(getDevFailedAttemptsKey());
  if (!raw) return 0;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Updates failed attempts count.
 */
export function setFailedAttempts(count: number): void {
  const storage = getPersistentStorage();
  if (!storage) return;
  storage.setItem(getDevFailedAttemptsKey(), count.toString());
}

/**
 * Resets failed attempts count.
 */
export function resetFailedAttempts(): void {
  const storage = getPersistentStorage();
  if (!storage) return;
  storage.removeItem(getDevFailedAttemptsKey());
}
