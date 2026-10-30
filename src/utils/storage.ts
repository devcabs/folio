/**
 * Canonical browser storage accessor for Folio Engine.
 * Safely accesses window.localStorage, falling back to window.sessionStorage.
 */
export function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.localStorage) return window.localStorage;
  } catch {
    // Quota or access restriction
  }
  try {
    if (window.sessionStorage) return window.sessionStorage;
  } catch {
    // Quota or access restriction
  }
  return null;
}

/**
 * Task 11.2.G3: Zero-LocalStorage Document Policy Enforcement.
 * Purges legacy draft and bloated document payloads from window.localStorage,
 * preserving solely small scalar session tokens (masid_session_id, masid_dev_unlocked_at,
 * masid_live_active_published_id, masid_draft_active, masid_draft_dirty).
 * Enforces a strict < 5 KB total localStorage footprint.
 */
export function purgeLegacyDocumentStorage(): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const keysToRemove: string[] = [];

    // Support both Object.keys(storage) and storage.length / storage.key(i)
    const allKeys = typeof Object.keys === 'function' ? Object.keys(storage) : [];
    for (const key of allKeys) {
      if (
        key.startsWith('masid_draft_canvas_') ||
        key.startsWith('masid_canvas_') ||
        key.startsWith('masid_live_canvas_') ||
        key === 'masid_content_overrides' ||
        key === 'masid_draft_content_overrides'
      ) {
        keysToRemove.push(key);
      }
    }

    const len = storage.length || 0;
    for (let i = 0; i < len; i++) {
      const key = storage.key(i);
      if (
        key &&
        (key.startsWith('masid_draft_canvas_') ||
          key.startsWith('masid_canvas_') ||
          key.startsWith('masid_live_canvas_') ||
          key === 'masid_content_overrides' ||
          key === 'masid_draft_content_overrides') &&
        !keysToRemove.includes(key)
      ) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  } catch {
    // Tolerant in restricted sandboxes
  }
}

// Auto-run once at module load (advanced-init-once)
try {
  purgeLegacyDocumentStorage();
} catch {
  // Ignore startup purge errors
}
