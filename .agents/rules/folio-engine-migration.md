---
name: folio-engine-migration
description: >-
  Mandatory pre-upgrade and post-upgrade migration check for consumer applications using @devcabs/folio-engine. Apply when upgrading @devcabs/folio-engine or modifying EngineConfig/content schemas. Copy or import into consumer `.agents/rules/`.
trigger: model_decision
---

# Rule: `@devcabs/folio-engine` Migration Verification

Whenever `@devcabs/folio-engine` is upgraded, run `npx folio-engine doctor` first. Review all breaking changes and required pending content changes before making code modifications.

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
   npx folio-engine doctor --from 0.1.2
   ```

2. **Review All Reported Changes Before Editing Code**:
   - Inspect **Breaking Changes & Code Actions** (and apply any before/after code updates).
   - Inspect **Pending Content Changes** (`[REQUIRED]` and `[OPTIONAL]` entity updates).
   - Follow the **Agent Prompt Block** output by `npx folio-engine doctor` for step-by-step migration guidance.

3. **Update Your Watermark & Verify**:
   - Update `contentVersion` in your `EngineConfig` (e.g., `setEngineConfig({ contentVersion: '<target-version>' })`) once content migrations are complete.
   - Re-run `npx folio-engine doctor` and your application's test/build suite to confirm zero pending drift.

---

## Consumer App Migration Checklist (v0.1.8 → v0.1.10)

When upgrading a consumer application from `0.1.8` to `0.1.10`, execute the following required migration to-dos:

1. **Element-Level Photo Gallery Ownership (0.1.8)**:
   - [ ] Audit all canvas gallery elements in `sample-nodes.json` and AST documents.
   - [ ] Ensure every gallery element specifies its own `driveUrl` attribute (e.g., `https://drive.google.com/drive/folders/YOUR_FOLDER_ID`) and unique `id`.
   - [ ] Verify that consumer gallery components (`CanvasGallery`, `SourceGallery`) no longer rely on parent node photo sync fallback.

2. **Cloudflare Edge KV Single-Source Pipeline (0.1.9)**:
   - [ ] Ensure Cloudflare Pages Function `/api/public/node/:nodeId` is deployed with active Edge KV namespace bindings.
   - [ ] Purge any direct consumer code reading `folio_live_canvas_[nodeId]` or `_draft_content_overrides` from `localStorage` during public page visits.
   - [ ] Verify public pages render the ghost skeleton wireframe during cold hydration without layout shifts (CLS).

3. **Pure AST Revision Rollback & Fallback Cards (0.1.9)**:
   - [ ] Verify that revision rollback restores pure Canvas ASTs into draft sandboxes without legacy flat content override re-hydration.
   - [ ] Check that unconfigured Google Sheets charts display `DataPendingCard` rather than arbitrary demo metrics.
   - [ ] Confirm broken image URLs trigger resilient fallback cards rather than blank layout collapses.

4. **EngineConfig Watermark Synchronization (0.1.10)**:
   - [ ] Update `contentVersion: '0.1.10'` in your `EngineConfig` setup (`src/engine-setup.ts` or `src/App.tsx`).
   - [ ] Run `npx folio-engine doctor` to confirm zero pending drift and verified compatibility.

