---
name: folio-engine-migration
description: >-
  Mandatory pre-upgrade and post-upgrade migration check for consumer applications
  using @devcabs/folio-engine. Copy or import into consumer `.agents/rules/`.
trigger:
  - "When upgrading @devcabs/folio-engine or modifying EngineConfig/content schemas"
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

