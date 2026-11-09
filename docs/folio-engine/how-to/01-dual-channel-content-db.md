# How-To: Configure Dual-Channel Content DB & Coordinator Mode

This guide explains how to set up the dual-channel persistence layer in Folio Engine, enabling isolated draft editing, distributed mutex locking, and atomic publishing to Supabase and Cloudflare KV.

---

## 🎯 Problem Statement

When editorial coordinators edit content, photo attachments, or chart configurations:
1. Live end-users must **never** observe partially drafted or broken content.
2. Multiple coordinators must **never** clobber each other's work through concurrent overwrites.
3. Coordinators must have full rollback (undo/redo) and preview capabilities before publishing changes.

---

## 🏗️ Dual-Channel Architecture

Folio Engine solves this with a two-tier channel architecture:

```
[ Coordinator Edits ]
         │
         ▼
[ Draft Channel (Local + Staging DB) ]  <── Guarded by DevLockService (Distributed Mutex)
         │
         ├── Undo/Redo Stacks
         ├── Dirty Changes Tracker (UnsavedChangesService)
         │
  [ Action: Publish ]
         │
         ▼
[ Live Channel (Production DB + Edge KV) ] ──> [ Public Viewers (Zero Latency) ]
```

---

## Step 1: Configure Environment Variables

Create `.env` (for local development) and configure the Supabase client parameters:

```env
# Supabase Persistence
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key

# Coordinator Security PIN (SHA-256 Hash of 6-digit PIN)
VITE_EXPECTED_PIN_HASH=8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918
VITE_SECURITY_SALT=folio_engine_salt_2026
```

> [!TIP]
> Generate the SHA-256 PIN hash using Node.js or OpenSSL:
> ```bash
> echo -n "123456folio_engine_salt_2026" | shasum -a 256
> ```

---

## Step 2: Initialize Supabase Schema

Execute the provided database migrations in `supabase/migrations/`:
- `01_engine_content.sql`: Stores key-value copy overrides and canvas AST JSON documents.
- `02_engine_locks.sql`: Stores active distributed coordinator session locks.
- `03_engine_history.sql`: Audit ledger recording edit actions, actor timestamps, and diff snapshots.

---

## Step 3: Enter Developer / Coordinator Mode

In your application header or via keyboard shortcut (`Ctrl + Shift + D` or clicking the Dev Badge), trigger the PIN verification modal:

```tsx
import { useDeveloperMode } from '@devcabs/folio-engine';

export function DevToggle() {
  const { isDevMode, enterDevMode, exitDevMode, lockStatus } = useDeveloperMode();

  return (
    <div>
      {isDevMode ? (
        <button onClick={exitDevMode}>
          Exit Coordinator Mode (Lock: {lockStatus})
        </button>
      ) : (
        <button onClick={() => enterDevMode('123456')}>
          Enter Coordinator Mode
        </button>
      )}
    </div>
  );
}
```

When entered:
1. `devSecurity.ts` validates the PIN against `VITE_EXPECTED_PIN_HASH`.
2. `devLockService.ts` attempts to claim an exclusive lease in the `engine_locks` table.
3. If another coordinator holds an active lease, `DevLockBlockedModal` is displayed, preventing concurrent edits.

---

## Step 4: Authoring Content & Editing Canvas Blocks

When `isDevMode` is active:
1. Inline text elements wrap with `EditableText` and display subtle `✎ Edit` indicators.
2. Clicking edit opens `UniversalEditModal`, allowing instant markdown and plain text modifications.
3. Canvas sections expose `CanvasAddBar`, allowing coordinators to insert subsections, photo blocks, and charts.
4. Changes write immediately to the **Draft Channel** in `localStorage` under keys prefixed by `getStorageNamespace()`.

---

## Step 5: Publishing Drafts to Production

When ready to release changes:
1. Click the **Publish** button in the coordinator bottom toolbar.
2. The `DevPublishModal` performs pre-flight verification:
   - Validates canvas AST schemas with Zod (`NodeCanvasDocumentSchema`).
   - Verifies external Google Sheets and Drive assets.
3. Calls `draftService.publishAllDrafts()`:
   - Commits drafts to the live database channel.
   - Clears dirty local draft caches.
   - Appends an audit record to the `engine_history` ledger.
   - Releases the coordinator mutex lock.

---

## 🔍 Verification & Troubleshooting

- **Check Unsaved Changes**: Run `hasUnsavedChanges()` from `unsavedChangesService.ts` in the browser console.
- **Inspect Draft Overrides**: Inspect `localStorage.getItem('folio_live_content_overrides')`.
- **Force Release Stale Mutex**: If a browser crashes, the lock automatically expires after 15 minutes, or can be released via `devLockService.forceReleaseLock()`.
