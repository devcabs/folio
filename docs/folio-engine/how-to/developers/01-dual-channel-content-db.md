# How-To: Configure Cloudflare KV Draft Workspace & Coordinator Mode

This guide explains how to set up the **Single Source of Truth (SSOT)** persistence layer in Folio Engine, enabling isolated draft editing in Cloudflare KV (`draft:workspace`), edge-authenticated mutex locking (`lock:coordinator`), and two-phase atomic publishing.

> [!NOTE]
> Looking for an end-user walkthrough on editing inside the browser? See the [End-User Dev Mode Guides](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/end-users/01-entering-dev-mode.md). For full app-level Dev Mode wiring (`EngineConfig`, edge PIN hashing, and chrome components), see [How-To: Configure Dev Mode in Your App](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/developers/06-configuring-dev-mode.md).

---

## 🎯 Problem Statement

When editorial coordinators edit content, photo attachments, or chart configurations:
1. Live end-users must **never** observe partially drafted or broken content.
2. Multiple coordinators must **never** clobber each other's work through concurrent overwrites.
3. Coordinators must have full rollback (undo/redo) and preview capabilities before publishing changes, with zero browser-side shadow stores (`localStorage`, `sessionStorage`, `IndexedDB`).

---

## 🏗️ Cloudflare KV Dual-Channel Architecture

Folio Engine isolates authoring from public traffic inside a single Cloudflare KV namespace (`KV_ENGINE_PUBLIC`):

```
[ Coordinator Edits ]
         │  (Authorization: Bearer <lockToken>)
         ▼
[ Draft Workspace (KV: draft:workspace via /api/draft) ]  <── Guarded by lock:coordinator (60s TTL)
         │
         ├── In-Memory Undo/Redo Stacks (UndoRedoContext)
         ├── Dirty Changes Tracker (UnsavedChangesService)
         │
  [ Action: POST /api/publish (Two-Phase Atomic) ]
         │
         ▼
[ Live Snapshot (KV: portal:manifest + node:${snapshotId}:${nodeId}) ] ──> [ Public Viewers ]
```

---

## Step 1: Configure Edge Secrets & Cloudflare KV

Configure your Cloudflare Workers / Pages environment (`wrangler.toml` and Cloudflare Secrets) with the KV namespace binding and 4-digit Dev Mode PIN credentials:

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "KV_ENGINE_PUBLIC"
id = "<your-kv-namespace-id>"
```

Set the coordinator PIN secrets on the edge runtime (never bundle PIN hashes into client JavaScript):

```bash
# Generate SHA-256("${salt}:${pin}")
echo -n "folio_engine_salt_2026:1234" | shasum -a 256

# Store secrets in Cloudflare
npx wrangler secret put DEV_SECURITY_SALT
npx wrangler secret put DEV_PIN_HASH
```

> [!TIP]
> `devSecurity.ts` computes `SHA-256("${salt}:${pin}")`. `lockHandler.ts` verifies the PIN server-side on `POST /api/lock` and enforces brute-force rate limiting in KV (`lock:pin_ratelimit`).

---

## Step 2: Delegate `/api/*` Routes to `@devcabs/folio-engine/edge`

Ensure your Cloudflare Worker or Pages Function delegates all `/api/*` requests to `handleFolioEdgeRequest`:

```typescript
import { handleFolioEdgeRequest } from '@devcabs/folio-engine/edge';

export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    return handleFolioEdgeRequest(request, env, ctx);
  },
};
```

This single router wires `/api/lock`, `/api/draft`, `/api/draft/init`, `/api/publish`, `/api/history`, `/api/history/restore`, `/api/public/manifest`, `/api/public/node/:nodeId`, and `/api/media/drive/:fileId`.

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
1. `POST /api/lock` verifies the 4-digit PIN on the edge against `env.DEV_PIN_HASH` and `env.DEV_SECURITY_SALT`.
2. If available, `lockHandler.ts` writes `lock:coordinator` (60s TTL) and returns an opaque `lockToken`.
3. `POST /api/draft/init` loads `draft:workspace` from Cloudflare KV (or bootstraps an uninitialized portal when `portal:manifest === null && history:index === null`).
4. If another coordinator holds an active lease, `DevLockBlockedModal` is displayed, preventing concurrent edits.

---

## Step 4: Authoring Content & Editing Canvas Blocks

When `isDevMode` is active (on desktop viewports):
1. Inline text elements wrap with `DevActionAffordance` and display subtle `✎` edit triggers.
2. Clicking edit opens `UniversalEditModal`, allowing instant copy, link, or image modifications.
3. Canvas sections expose `CanvasAddBar`, allowing coordinators to insert sections, subsections, text, media (`Single Photo`, `Single Video`, `Media Gallery`), documents, charts, and page links.
4. Changes write directly to `PUT /api/draft` (`draft:workspace` in Cloudflare KV) with optimistic concurrency (`expectedRevision` / `expectedUpdatedAt` → HTTP 409 on conflict) and `Authorization: Bearer <lockToken>`.

---

## Step 5: Two-Phase Atomic Publishing to Production

When ready to release changes:
1. Click the **Publish** button in the `DevModeBadge` floating toolbar.
2. `DevPublishModal` checks for newer remote snapshots (`checkDraftStaleness()`) and requires a concise changelog summary (`> 3` characters).
3. Calls `publishNewSnapshot()` (`POST /api/publish` with `Authorization: Bearer <lockToken>`):
   - **Phase A**: Compiles self-contained `NodeCanvasDocument` ASTs (with embedded charts and galleries) and writes immutable `history:snapshot:${id}`, `node:${id}:${nodeId}`, and `node:${nodeId}` keys to KV.
   - **Phase B**: Flips `portal:manifest.activeSnapshotId`, updates `history:index`, and resets `draft:workspace` (`dirty: false`).

---

## 🔍 Verification & Troubleshooting

- **Check Unsaved Changes**: Call `hasUnsavedChanges()` from `unsavedChangesService.ts` or inspect `hasUnpublishedChanges` from `useDeveloperMode()`.
- **Fail-Stop Error Surfaces**: If Cloudflare KV is unreachable or returns HTTP 4xx/5xx, services fail stop immediately and surface `<TopErrorBanner />` rather than falling back to local caches.
- **Release Stale Mutex**: Locks include a 30-second heartbeat (`PATCH /api/lock`) and expire automatically after 60 seconds (`LOCK_EXPIRATION_MS`). You can also call `releaseDevLock()` (`DELETE /api/lock`) or re-authenticate with the PIN to supersede a stale reload lock.
