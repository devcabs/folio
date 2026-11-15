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
   npx folio-engine doctor --from 0.1.10
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


