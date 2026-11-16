---
name: folio-engine-migration
description: >-
  Mandatory pre-upgrade and post-upgrade migration check for consumer applications using @devcabs/folio-engine. Apply when upgrading @devcabs/folio-engine or modifying EngineConfig/content schemas. Copy or import into consumer `.agents/rules/`.
trigger: model_decision
---

# Rule: `@devcabs/folio-engine` Migration Verification & Edge Delegation

Whenever `@devcabs/folio-engine` is upgraded, run `npx folio-engine doctor` first. Review all breaking changes, anti-duplication audits, and required pending content changes before making code modifications.

---

## 0. Mandatory Edge Route Delegation (Zero Duplication Policy)

> **CRITICAL DIRECTIVE**: Consumer applications MUST NOT create or duplicate serverless route logic, `functions/api/*`, `src/utils/mediaUrl.ts`, `src/types/edge.ts`, or custom Cloudflare Worker routers.
>
> All Cloudflare Edge routing logic is fully managed and exported by `@devcabs/folio-engine/edge`.

### Canonical 5-Line `worker.ts` Template
In host applications (like `masid`), `worker.ts` MUST delegate directly:

```ts
import { handleFolioEdgeRequest } from '@devcabs/folio-engine/edge';

export default {
  fetch(request: Request, env: any, ctx: any) {
    return handleFolioEdgeRequest(request, env, ctx);
  },
};
```

If the host application requires its own custom endpoints, handle them before delegating:
```ts
import { handleFolioEdgeRequest } from '@devcabs/folio-engine/edge';

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);
    if (url.pathname === '/api/host-specific-route') {
      return handleCustomHostRoute(request, env);
    }
    return handleFolioEdgeRequest(request, env, ctx);
  },
};
```

---

## Mandatory Upgrade Workflow

1. **Run the Migration Doctor**:
   ```bash
   npx folio-engine doctor
   ```
   For CI pipelines or structured agent parsing, use JSON output:
   ```bash
   npx folio-engine doctor --format json
   ```
   If upgrading from a known prior release after `node_modules` has already been updated, pass `--from <previous-version>`:
   ```bash
   npx folio-engine doctor --from 0.1.11
   ```

2. **Review All Reported Changes & Audits Before Editing Code**:
   - Inspect **Edge Delegation & Anti-Duplication Audits** (and purge any duplicate `functions/api/` files).
   - Inspect **Breaking Changes & Code Actions** (and apply any before/after code updates).
   - Inspect **Pending Content Changes** (`[REQUIRED]` and `[OPTIONAL]` entity updates).
   - Follow the **Agent Prompt Block** output by `npx folio-engine doctor` for step-by-step migration guidance.

3. **Update Your Watermark & Verify**:
   - Update `contentVersion` in your `EngineConfig` (e.g., `setEngineConfig({ contentVersion: '<target-version>' })`) once content migrations are complete.
   - Re-run `npx folio-engine doctor` and your application's test/build suite to confirm zero pending drift.

---

## Consumer App Migration Checklist (v0.1.11 → v0.1.12)

When upgrading a consumer application from `0.1.11` to `0.1.12`, execute the following required migration to-dos:

1. **Apply Supabase Database Migration (0.1.12)**:
   - [ ] Run `supabase/migrations/20261116000000_ensure_chart_sources_node_id.sql` in your Supabase SQL editor:
     ```sql
     ALTER TABLE chart_sources ADD COLUMN IF NOT EXISTS node_id TEXT NOT NULL DEFAULT 'node-financial-model';
     CREATE INDEX IF NOT EXISTS idx_chart_sources_node_id ON chart_sources(node_id);
     ```
   - [ ] Verify `chart_sources` queries and inserts correctly isolate charts per roadmap `node_id`.

2. **Canvas Fetch Error Handling & Dignified Public Notice (0.1.12)**:
   - [ ] Confirm `DocumentCanvas` mounts canonical `TopErrorBanner` on edge fetch failure in public mode with retry capability, rather than showing a false empty notice.
   - [ ] Verify `CanvasEmptyNotice` displays minimal dignified draft notice ("This section is currently in draft") when no sections exist and no fetch errors occur.
   - [ ] Optional: If implementing custom canvas chrome, consume `fetchError` and `retryFetch` from `useDocumentCanvas(nodeId)` or import `TopErrorBanner` from `@devcabs/folio-engine`.

3. **Draft Baseline Hydration & Storage Cleanup (0.1.12)**:
   - [ ] When starting a draft from an active published version, verify drafts pre-hydrate from Edge KV (`/api/public/node/:nodeId`) so local editing does not begin with empty or stale state.
   - [ ] Verify publishing automatically purges local draft keys (`folio_draft_canvas_${nodeId}`) and deletes remote active draft in Supabase `engine_drafts`.

4. **EngineConfig Watermark Synchronization (0.1.12)**:
   - [ ] Update `contentVersion: '0.1.12'` in your `EngineConfig` setup (`src/engine-setup.ts` or `src/App.tsx`).
   - [ ] Run `npx folio-engine doctor` to confirm zero pending migrations.

---

## Consumer App Migration Checklist (v0.1.10 → v0.1.11)

When upgrading a consumer application from `0.1.10` to `0.1.11`, execute the following required migration to-dos:

1. **Universal Edge Router Extraction & Purge Duplicates (0.1.11)**:
   - [ ] Delete any duplicate local edge routes or utilities:
     ```bash
     rm -rf functions/api src/utils/mediaUrl.ts src/types/edge.ts
     ```
   - [ ] Replace custom worker router with canonical delegation to `handleFolioEdgeRequest` from `@devcabs/folio-engine/edge`.
   - [ ] Confirm KV bindings (`KV_ENGINE_PUBLIC` or `KV_MASID_PUBLIC`) are bound in `wrangler.toml`.

2. **EngineConfig Watermark Synchronization (0.1.11)**:
   - [ ] Update `contentVersion: '0.1.11'` in your `EngineConfig` setup (`src/engine-setup.ts` or `src/App.tsx`).
   - [ ] Run `npx folio-engine doctor` to confirm zero duplicate files and verified compatibility.


