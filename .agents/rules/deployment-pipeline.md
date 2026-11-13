---
name: deployment-pipeline
description: >-
  Enforces the unified deployment pipeline rule for Folio Engine (@devcabs/folio-engine): always use `npm run deploy` to validate token purity, typecheck, build library and app distribution, commit, push to GitHub, and deploy to Cloudflare Edge via Wrangler. Apply when deploying or releasing updates, pushing production changes, or publishing content, design, or schema updates.
trigger: model_decision
---

# Unified Deployment Pipeline Standard

> **ABSOLUTE RULE**: Whenever deploying, pushing, or delivering updates for Folio Engine, **NEVER** run standalone `git push` without executing the official unified deploy pipeline.

Always execute:
```bash
npm run deploy
# or with an explicit version bump target (patch | minor | major):
npm run deploy minor
```

---

## 1. Why Direct Push is Prohibited
Running raw `git push` in isolation creates critical failure modes:
1. **GitHub App Webhook Failures**: Third-party OAuth token expirations or GitHub organization permission errors can silently block Cloudflare from building.
2. **Missing Token & Contract Checks**: Direct pushes bypass automated token purity (`npm run test:tokens`), test suites (`npm test`), and typechecking (`tsc --noEmit`).
3. **Stale Cloudflare Caches**: Direct pushes bypass instant edge deployment verification.

---

## 2. The Atomic Deployment Protocol
The automated pipeline script (`scripts/deploy.ts`) executes these critical steps atomically:

1. **Gate 1: Working Tree & Remote Verification**:
   - Ensures no unstaged changes remain and verifies local branch is synchronized with remote.
2. **Gate 2: Quality & Token Audits**:
   - `npm run test:tokens` (100% token purity and alias verification).
   - `npm test` (unit and purity test suites).
3. **Gate 3: Static Typecheck & Bundling**:
   - `npm run build` & `npm run build:lib` ensuring zero TypeScript errors and optimized dual-mode bundles (app and library) in `dist/`.
4. **Gate 4: Automated Version Bump & Git Commit**:
   - Increments `package.json` semver cleanly and creates a signed Git release commit with matching Git tag (`vX.Y.Z`).
5. **Gate 5: Git Push & Direct Cloudflare Edge Deployment**:
   - Pushes commit and tags to `origin main`, then runs `wrangler pages deploy` to push `dist/` directly to Cloudflare's global edge network in seconds.

---

## 3. Command Usage Reference
```bash
# Standard automated release with patch bump:
npm run deploy

# Release with minor version bump:
npm run deploy minor

# Release with explicit semver version:
npm run deploy 0.2.0
```

---

## 4. Canonical Solution Mandate
- **Solve Canonically First**: Deployment and builds must strictly follow the canonical deployment pipeline script (`scripts/deploy.ts` via `npm run deploy`) rather than manual, ad-hoc, or disparate terminal sequences. Unless stated otherwise, always rely on the project's canonical release pathway.
