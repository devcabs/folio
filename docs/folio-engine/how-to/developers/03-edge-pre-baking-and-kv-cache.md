# How-To: Edge Pre-Baking & Cloudflare KV Distribution

This guide demonstrates how Folio Engine compiles self-contained `NodeCanvasDocument` ASTs at publish time and serves them directly from Cloudflare Edge KV with strict fail-stop semantics.

---

## 🎯 Problem Statement

Calling external APIs dynamically on every user page load introduces latency, rate limiting, and egress costs. Folio Engine includes an **Edge Pre-Baking Pipeline** (`edgePreBakeService.ts`) that compiles self-contained AST documents—with embedded chart configs/datasets, embedded gallery photos, and rewritten `/api/media/drive/:fileId` URLs—into versioned Cloudflare KV payloads served in $<15\text{ms}$.

---

## 🏗️ The Pre-Baking & Distribution Pipeline

```
[ Coordinator Publish (POST /api/publish) ]
         │
         ▼
[ edgePreBakeService.ts ]
         │
         ├── Compiles self-contained NodeCanvasDocument AST per node
         ├── Strips private ChartElement.config.sheetUrl (zero-leak)
         ├── Rewrites Google Drive URLs to /api/media/drive/:fileId?w=...
         └── Generates responsive srcSet (400w, 800w, 1600w)
         │
         ▼
[ Two-Phase Cloudflare KV Write (KV_ENGINE_PUBLIC) ]
         ├── Phase A: history:snapshot:${id}, node:${id}:${nodeId}, node:${nodeId}
         └── Phase B: portal:manifest (activeSnapshotId) & history:index
         │
         ▼
[ Client Instant Hydration via /api/public/* ]
```

---

## Step 1: Delegate Edge Routes in Your Worker / Pages Function

Mount `handleFolioEdgeRequest` from `@devcabs/folio-engine/edge` in your Cloudflare Worker or Pages Function:

```typescript
// src/worker.ts (or functions/[[path]].ts)
import { handleFolioEdgeRequest } from '@devcabs/folio-engine/edge';

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    return handleFolioEdgeRequest(request, env, ctx);
  },
};
```

`handleFolioEdgeRequest` resolves `env.KV_ENGINE_PUBLIC` (or a custom `kvBinding` option) and routes:
- `GET /api/public/manifest` → reads `portal:manifest` (returns HTTP 404/503 on miss; never fabricates a 200 fallback).
- `GET /api/public/node/:nodeId` → resolves `portal:manifest.activeSnapshotId` and reads `node:${activeSnapshotId}:${nodeId}` (with ETag conditional `304 Not Modified` support).
- `GET /api/media/drive/:fileId` → streams Google Drive images with `w` width sizing.
- `POST /api/publish`, `/api/draft`, `/api/history`, `/api/lock` → coordinator authoring endpoints.

---

## Step 2: Optional Build-Time Verification

You can validate compiled `PublicNodePayload` and `PublicPortalManifestPayload` objects in CI using `@devcabs/folio-engine/diagnostics`:

```typescript
import { validateNodePayload } from '@devcabs/folio-engine/diagnostics';

const result = validateNodePayload(payload);
if (!result.ok) {
  throw new Error(result.errors.join('\n'));
}
```

---

## Step 3: Deploy to Cloudflare

Deploy the application and edge worker atomically using the official deploy pipeline:

```bash
npm run deploy
```

This runs:
1. `npm run test:tokens`, `npm run test:purity`, `tsc --noEmit`, and `npm test`.
2. `npm run build` & `npm run build:lib`.
3. Commits, pushes, and executes `wrangler` deployment.

---

## 🔍 Validating Edge Delivery

Verify the edge deployment using curl:

```bash
curl -I https://your-domain.com/api/public/node/architecture
```

Expected response headers when published:
```http
HTTP/2 200
content-type: application/json; charset=utf-8
etag: "..."
cache-control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400
```


---

## Dynamic Nested Subpages & Zero-Wait Edge HTML Injection

Folio Engine supports unlimited-depth nested subpages without extra client waterfalls on cold load:

1. **Multi-Segment SPA Fallback & HTML Manifest Injection (`htmlManifestInjector.ts`)**:
   - When `handleFolioEdgeRequest` serves any non-API `text/html` route (such as `/node/access/research/interviews/2026-notes/`) via `env.ASSETS.fetch`, `maybeInjectManifestResponse` reads `portal:manifest` from KV and injects `<script>window.__FOLIO_MANIFEST__ = ...;</script>` into `<head>` (with XSS-safe `<` escaping).
   - `PortalChromeContext` and `useHashRoute` read `window.__FOLIO_MANIFEST__` synchronously via `readInjectedPortalManifest()`, resolving deep-link routes at `0ms` with zero 404 flash and zero redundant `/api/public/manifest` fetch.
2. **Subpage Staging (`node:${snapshotId}:${pageId}`)**:
   - During `POST /api/publish`, `publishHandler.ts` compiles and stages every active `PageNode` canvas under `node:${snapshotId}:${pageId}` alongside root chapters, strips any private `sheetUrl` values, and persists `pages` inside `portal:manifest`.
3. **Atomic Subtree Purge (`deletedPageIds`)**:
   - `PUT /api/draft` accepts `deletedPageIds?: string[]` to atomically delete `draft.pages[id]` and `draft.canvases[id]` in a single KV transaction when a subpage branch is deleted.
