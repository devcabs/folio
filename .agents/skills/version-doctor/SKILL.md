---
name: version-doctor
description: Enforces strict Version Doctor and migration ledger compliance for Folio Engine (@devcabs/folio-engine), ensuring all breaking changes, code actions, and content migrations are synchronously logged before npm publishing.
---

# Version Doctor & Migration Ledger Compliance

> **PREVALENCE NOTICE:** This skill enforces strict compliance under [docs/folio-engine/README.md](file:///Users/francisdave/Documents/folio/docs/folio-engine/README.md) and [.agents/rules/deployment-pipeline.md](file:///Users/francisdave/Documents/folio/.agents/rules/deployment-pipeline.md). No code modifications, schema updates, or API changes may be released to npm without being synchronously recorded in the Migration Ledger and exposed through Version Doctor.

---

## 1. Single Source of Truth Architecture

All version transitions, breaking changes, code transformations, and content schema changes are defined in a single source of truth:
👉 [src/migrations/ledger.ts](file:///Users/francisdave/Documents/folio/src/migrations/ledger.ts) (`FOLIO_MIGRATION_LEDGER`).

From this ledger:
1. **Version Doctor CLI** (`npx folio-engine doctor` / `npm run doctor`) inspects installed consumer versions, detects drift, and prints actionable agent migration prompts.
2. **Dev Migration Modal** (`DevMigrationModal.tsx`) alerts developers in browser Dev Mode when their app has unacknowledged migrations.
3. **Automated Changelog Engine** (`npm run changelog`) compiles [CHANGELOG.md](file:///Users/francisdave/Documents/folio/CHANGELOG.md) directly from ledger records.
4. **Publishing & Release Gates** (`scripts/verify-migration-sync.ts`, `deploy.ts`, and `package.json` `prepublishOnly`) prevent desynchronized releases from ever being published.

---

## 2. Mandatory Entry Classification Matrix

Every upcoming release entry in `src/migrations/ledger.ts` MUST supply non-empty arrays for `breakingChanges` and `contentChanges`:

```ts
{
  version: '0.1.11',
  releaseDate: '2026-11-15',
  title: 'Descriptive Title of Release',
  summary: 'Concise summary of capabilities and refactors.',
  breakingChanges: [
    // Note: State 'No breaking API changes; additive features only.' if none.
    'Signature change to useDocumentCanvasHydration(options).',
  ],
  codeActions: [
    {
      description: 'Replace legacy import with subpath export.',
      affectedFiles: ['src/App.tsx'],
      exampleBefore: 'import { OldExport } from "@devcabs/folio-engine";',
      exampleAfter: 'import { NewExport } from "@devcabs/folio-engine/diagnostics";',
    },
  ],
  contentChanges: [
    {
      id: 'feature-flag-0.1.11',
      title: 'Enable Feature Flag or Schema Node',
      required: true, // or false if optional
      description: 'Explanation of content or schema requirement.',
      affectedEntities: ['sample-nodes.json', 'EngineConfig'],
      migrationPrompt: 'Concrete instructions for consumer apps or agents.',
    },
    {
      id: 'content-version-watermark-0.1.11',
      title: 'Advance contentVersion Watermark to 0.1.11',
      required: true,
      description: 'Update contentVersion in EngineConfig to clear pending migration warnings.',
      affectedEntities: ['EngineConfig', 'src/engine-setup.ts'],
      migrationPrompt: 'Set `contentVersion: "0.1.11"` in your application EngineConfig.',
    },
  ],
}
```

---

## 3. The 3 Enforcement Gates

### Gate 1: Git Pre-Push Hook (`.git/hooks/pre-push`)
- Prevents pushing unrecorded changes to GitHub.
- Automatically executes `npm run verify:migrations`.
- Aborts if `CHANGELOG.md` is out of sync with `src/migrations/ledger.ts` or if `package.json` semver is unlisted.

### Gate 2: Direct NPM Publishing Lockdown (`prepublishOnly`)
- Embedded in `package.json`:
  ```json
  "prepublishOnly": "npm run verify:migrations && npm run doctor"
  ```
- If `npm publish` is run directly from the CLI or CI, npm triggers `prepublishOnly` before packing. Desynced changelogs or malformed ledger entries cause immediate exit code `1`.

### Gate 3: Canonical Deployment Pipeline (`npm run deploy`)
- `scripts/deploy.ts` runs automated ledger pre-flight audits, compiles and verifies `CHANGELOG.md`, tags the release, publishes to npm, and deploys to Cloudflare Edge.

---

## 4. Edge Delegation & Anti-Duplication Enforcement

> **MANDATORY ARCHITECTURAL DIRECTIVE**: Consumer applications (like `masid`) MUST NOT maintain duplicate copies of `mediaUrl.ts`, `types/edge.ts`, `functions/api/*`, or custom Cloudflare Worker routers.
>
> All serverless routing, KV caching, atomic publish pipelines, and edge media transcoding MUST be born inside `src/edge/` and exported via `@devcabs/folio-engine/edge`. Engine documentation and releases must NEVER instruct consumers to copy-paste backend code.

### The 3 Continuous Prevention Controls
To permanently prevent serverless drift and route duplication in consumer applications:

1. **Automated Diagnostic Gates (`verifyEdgeDelegation`)**:
   - Version Doctor CLI (`npx folio-engine doctor`) scans for shadow files (`functions/api/publish.ts`, `src/utils/mediaUrl.ts`, `src/types/edge.ts`) and non-delegating `worker.ts`.
   - Any duplicate route files immediately fail the doctor audit with actionable remediation instructions.

2. **Consumer CI Gate Lockdown**:
   - Consumer applications must include Version Doctor in their continuous verification:
     ```json
     "scripts": {
       "test": "vitest run && npx folio-engine doctor"
     }
     ```
   - If an engineer or coding agent attempts to scaffold local `/api/` functions or copy engine utilities into the host repo, CI fails immediately with exit code `1`.

3. **Consumer Agent Rule Mirroring**:
   - Whenever `@devcabs/folio-engine` is upgraded, copy or sync [folio-engine-migration.md](file:///Users/francisdave/Documents/folio/.agents/rules/folio-engine-migration.md) into the consumer's `.agents/rules/` directory.
   - This ensures AI coding agents operating on the host repository are explicitly constrained by **Section 0: Zero Duplication Policy** before generating code.

### Consumer 5-Line Delegation Contract
Host applications only require a minimal `worker.ts` delegation entry point:
```ts
import { handleFolioEdgeRequest } from '@devcabs/folio-engine/edge';

export default {
  fetch(request: Request, env: any, ctx: any) {
    return handleFolioEdgeRequest(request, env, ctx);
  },
};
```

---

## 5. Agent & Developer Standard Operating Procedure (SOP)

When implementing any feature, bug fix, or schema change:

1. **Stage Changes in Migration Ledger**:
   - Open [src/migrations/ledger.ts](file:///Users/francisdave/Documents/folio/src/migrations/ledger.ts).
   - Ensure the entry for the target release is populated with accurate `breakingChanges`, `codeActions`, and `contentChanges`.

2. **Sync the Changelog**:
   ```bash
   npm run changelog
   npm run changelog:verify
   ```

3. **Verify Version Doctor Output**:
   ```bash
   npm run doctor
   ```

4. **Run the Pre-Release Verification Gate**:
   ```bash
   npm run verify:migrations
   ```

5. **Release via Canonical Deploy Pipeline**:
   ```bash
   npm run deploy [patch | minor | major]
   ```
