---
description: Prohibits modifying masid or deploying any consumer apps from this workspace. Folio Engine (@devcabs/folio-engine) is strictly an npm package.
---

# Mandatory Rule: Package Boundary & Consumer App Isolation

> **CRITICAL DIRECTIVE**: `@devcabs/folio-engine` is strictly an npm package. You MUST NEVER modify `masid` or deploy any consumer applications from this workspace.

## Prohibited Actions
1. **No Consumer App Modifications**: Do NOT edit, create, or delete files in `masid` or any other consumer application repository/directory.
2. **No Consumer App Deployments**: Do NOT run deployment commands (e.g., `wrangler deploy`, Cloudflare Pages/Workers deploys, or consumer app build/deploy scripts) for `masid` or any consumer app.

## Allowed Scope
- Changes in this workspace are strictly scoped to the `@devcabs/folio-engine` npm package (library source, types, styles, tests, docs, and package publishing).
