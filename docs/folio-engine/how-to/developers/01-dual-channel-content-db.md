# How-To: Configure Dual-Channel Content DB & Coordinator Mode

This guide explains how to set up the dual-channel persistence layer in Folio Engine, enabling isolated draft editing, distributed mutex locking, and atomic publishing to Supabase and Cloudflare KV.

> [!NOTE]
> Looking for an end-user walkthrough on editing inside the browser? See the [End-User Dev Mode Guides](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/end-users/01-entering-dev-mode.md). For full app-level Dev Mode wiring (`EngineConfig`, PIN hashing, and chrome components), see [How-To: Configure Dev Mode in Your App](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/developers/06-configuring-dev-mode.md).

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

Create `.env` (for local development) and configure the Supabase client and 4-digit Dev Mode PIN parameters:

```env
# Supabase Persistence
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key

# Coordinator Security PIN (Salted SHA-256 Hash of 4-digit PIN)
VITE_DEV_SALT=folio_engine_salt_2026
VITE_DEV_PIN_HASH=a9f2d8...
```

> [!TIP]
> `devSecurity.ts` computes `SHA-256("${salt}:${pin}")`. Generate the hash using Node.js or OpenSSL with a colon separator:
> ```bash
> echo -n "folio_engine_salt_2026:1234" | shasum -a 256
> ```

---

## Step 2: Initialize Supabase Schema

Execute the provided database migrations in `supabase/migrations/`:
- `01_engine_storage.sql`: Stores key-value copy overrides and canvas AST JSON documents.
- `02_engine_lock.sql`: Stores active distributed coordinator session locks.
- `03_engine_history.sql`: Audit ledger recording edit actions, actor timestamps, and diff snapshots.
- `20261021160000_create_engine_media_storage_and_drafts.sql`: Media storage bucket and staging draft synchronization.

---

## Step 3: Enter Developer / Coordinator Mode

In your application header or via keyboard shortcut (`Cmd/Ctrl + Shift + D`, `?dev=true`, or 5 rapid clicks on the `AppHeader` seal), trigger the PIN verification modal:

```tsx
import { useDeveloperMode } from '@devcabs/folio-engine';

export function DevToggle() {
  const {
    isDevMode,
    openPinModal,
    requestExitDevMode,
    isLockBlocked,
  } = useDeveloperMode();

  return (
    <div>
      {isDevMode ? (
        <button onClick={requestExitDevMode}>
          Exit Dev Mode
        </button>
      ) : (
        <button onClick={() => openPinModal(false)} disabled={isLockBlocked}>
          Enter Dev Mode
        </button>
      )}
    </div>
  );
}
```

When entered:
1. `devSecurity.ts` validates the 4-digit PIN against `EngineConfig.expectedPinHash` or `VITE_DEV_PIN_HASH` (using `EngineConfig.securitySalt` / `VITE_DEV_SALT`).
2. `devLockService.ts` attempts to claim an exclusive lease in the `engine_lock` table.
3. If another coordinator holds an active lease, `DevLockBlockedModal` is displayed, preventing concurrent edits.

---

## Step 4: Authoring Content & Editing Canvas Blocks

When `isDevMode` is active (on desktop viewports):
1. Inline text elements wrap with `DevActionAffordance` and display subtle `✎` edit triggers.
2. Clicking edit opens `UniversalEditModal`, allowing instant copy, link, or image modifications.
3. Canvas sections expose `CanvasAddBar`, allowing coordinators to insert sections, subsections, text, photos, galleries, and charts.
4. Changes write immediately to the **Draft Channel** in `localStorage` under keys prefixed by `getStorageNamespace()` and sync to cloud drafts when Supabase is configured.

---

## Step 5: Publishing Drafts to Production

When ready to release changes:
1. Click the **Publish** button in the `DevModeBadge` floating toolbar.
2. `DevPublishModal` checks for newer remote snapshots (`checkDraftStaleness()`) and requires a concise changelog summary (`> 3` characters).
3. Calls `publishNewSnapshot()` from `historyService.ts`:
   - Commits drafts to the live database channel.
   - Clears dirty local draft caches.
   - Appends an audit snapshot to the `engine_history` ledger.

---

## 🔍 Verification & Troubleshooting

- **Check Unsaved Changes**: Call `hasUnsavedChanges()` from `unsavedChangesService.ts` or inspect `hasUnpublishedChanges` from `useDeveloperMode()`.
- **Inspect Draft Overrides**: Inspect `localStorage` keys prefixed with your `appNamespace` (default `folio_`).
- **Release Stale Mutex**: Locks include an automatic liveness heartbeat and expire after inactivity (or on `beforeunload` / `pagehide` beacon release). You can also call `releaseLock(sessionId)` or `forceReleaseLock()` from `devLockService.ts`.
