# Rule: Docs Sync — Update Relevant Docs on Every Change

Whenever code, config, tokens, or agent files are modified, **update the corresponding documentation before closing the task**. Use the table below to identify which doc(s) to update.

---

## Update Map

### Design System & Tokens (`src/styles/`)

| Changed | Update |
|---|---|
| `src/styles/tokens.css` — new/modified token | `docs/folio-engine/how-to/developers/04-theming-and-design-tokens.md` |
| `src/styles/reset.css` | `docs/folio-engine/how-to/developers/04-theming-and-design-tokens.md` |

---

### Components (`src/components/`)

| Changed | Update |
|---|---|
| Any component in `src/components/ui/` (canonical UI) | `docs/folio-engine/reference/03-components.md` |
| Canvas components (`src/components/canvas/`) | `docs/folio-engine/reference/03-components.md` + `docs/folio-engine/tutorials/02-building-a-stepped-canvas.md` + `docs/folio-engine/how-to/end-users/02-editing-content-and-canvas.md` |
| Chart components (`src/components/chart/`) | `docs/folio-engine/how-to/developers/02-google-sheets-chart-sync.md` + `docs/folio-engine/how-to/end-users/04-configuring-charts-in-browser.md` |
| Source & Drive gallery components (`src/components/source/`) | `docs/folio-engine/reference/03-components.md` + `docs/folio-engine/how-to/end-users/03-photos-and-drive-galleries.md` |
| Dev Mode chrome & modals (`src/components/dev/`) | `docs/folio-engine/reference/03-components.md` + relevant `docs/folio-engine/how-to/end-users/` guide + `docs/folio-engine/how-to/developers/06-configuring-dev-mode.md` |
| History drawer (`src/components/history/`) | `docs/folio-engine/reference/03-components.md` + `docs/folio-engine/how-to/end-users/05-history-undo-and-publishing.md` |
| Roadmap components (`src/components/roadmap/`) | `docs/folio-engine/reference/03-components.md` |
| Hooks or contexts (`src/components/**/use*.ts`, `src/hooks/`) | `docs/folio-engine/reference/04-hooks-and-contexts.md` |

---

### Data Contracts & Types (`src/types/`)

| Changed | Update |
|---|---|
| Any `.ts` file in `src/types/` | `docs/folio-engine/reference/02-data-contracts.md` |
| Data schema (`src/data/`) | `docs/folio-engine/reference/02-data-contracts.md` |

---

### Public API & Exports (`src/index.ts`, `package.json` exports)

| Changed | Update |
|---|---|
| New or removed public export | `docs/folio-engine/reference/01-public-api-exports.md` |
| `package.json` name, version, or `exports` map | `docs/folio-engine/reference/01-public-api-exports.md` + `README.md` |

---

### Services, Utilities & Edge Functions (`src/`)

| Changed | Update |
|---|---|
| Service files (`src/services/`, `src/lib/`) | `docs/folio-engine/reference/05-services-and-utilities.md` |
| Edge functions or KV cache logic | `docs/folio-engine/how-to/developers/03-edge-pre-baking-and-kv-cache.md` |
| Storage / SSR safety guards | `docs/folio-engine/reference/05-services-and-utilities.md` |

---

### Configuration (`next.config.*`, `tsconfig.json`, `.env*`, `src/config/`)

| Changed | Update |
|---|---|
| Any config file | `docs/folio-engine/reference/06-configuration.md` |
| New environment variable | `docs/folio-engine/reference/06-configuration.md` + `README.md` |
| Dev Mode config, PIN/salt security, or `DeveloperModeContext` | `docs/folio-engine/how-to/developers/06-configuring-dev-mode.md` |

---

### Architecture & Core Engine

| Changed | Update |
|---|---|
| Core engine logic (render loop, coordinator, sequencer) | `docs/folio-engine/explanation/01-system-architecture.md` |
| Stepped sequence / Bezier math | `docs/folio-engine/explanation/03-stepped-sequence-bezier-math.md` |
| Recursive document AST | `docs/folio-engine/explanation/04-recursive-document-ast.md` |
| Dual-mode distribution (npm / embed) | `docs/folio-engine/explanation/02-dual-mode-distribution.md` |
| Coordinator concurrency model | `docs/folio-engine/explanation/05-coordinator-mode-concurrency.md` |

---

### Content DB & Google Sheets (`src/`, integrations)

| Changed | Update |
|---|---|
| Dual-channel content DB logic | `docs/folio-engine/how-to/developers/01-dual-channel-content-db.md` |
| Google Sheets sync | `docs/folio-engine/how-to/developers/02-google-sheets-chart-sync.md` + `docs/folio-engine/how-to/end-users/04-configuring-charts-in-browser.md` |

---

### End-User Dev Mode Workflows (Browser UI & Shortcuts)

| Changed | Update |
|---|---|
| Dev Mode triggers (logo tap, shortcut, URL params), PIN rules, session timer, lock/exit flows | `docs/folio-engine/how-to/end-users/01-entering-dev-mode.md` |
| `UniversalEditModal`, `DevActionAffordance`, `CanvasAddBar`, `CanvasItemControls` UI | `docs/folio-engine/how-to/end-users/02-editing-content-and-canvas.md` |
| Single photo upload, `LinkFolderModal`, `EditPhotoModal`, Drive photo sync UI | `docs/folio-engine/how-to/end-users/03-photos-and-drive-galleries.md` |
| `ChartConfigDrawer` steps, Google Sheets URL verification, data/appearance tabs | `docs/folio-engine/how-to/end-users/04-configuring-charts-in-browser.md` |
| `DevModeBadge` toolbar, Undo/Redo, `HistoryHubModal`, `DevPublishModal` UI | `docs/folio-engine/how-to/end-users/05-history-undo-and-publishing.md` |

---

### Diagnostics & Testing

| Changed | Update |
|---|---|
| Test files (`*.test.*`, `*.spec.*`) | `docs/folio-engine/how-to/developers/05-diagnostics-and-testing.md` |
| Doctor / preflight logic | `docs/folio-engine/how-to/developers/05-diagnostics-and-testing.md` |

---

### Agent Config & Skills (`.agents/`)

| Changed | Update |
|---|---|
| `.agents/manifest.json` | `README.md` (agent tooling section) |
| `.agents/skills/*.md` | Update the skill's own `SKILL.md` inline — no separate doc needed |
| `.agents/rules/*.md` | Update the rule file itself inline — no separate doc needed |

---

### Getting Started & Tutorials

| Changed | Update |
|---|---|
| Install / bootstrap flow | `docs/folio-engine/tutorials/01-getting-started.md` |
| Canvas setup walkthrough | `docs/folio-engine/tutorials/02-building-a-stepped-canvas.md` |

---

## Enforcement

1. **Before closing any task**: scan your changes against the table above and identify at least one doc to update (or explicitly note "no doc update needed" with a reason).
2. **Doc updates must be meaningful** — not just a timestamp change. Add or revise the specific section that reflects what changed: a new prop, a new token name, a changed API signature, a new config key, or an updated UI button/workflow.
3. **Never delete existing doc content** without replacing it with up-to-date content.
4. **If the relevant doc doesn't exist yet**, create it under the correct Diataxis category:
   - `how-to/developers/` — task-oriented engineering and app-configuration guides (how to wire, deploy, theme, test X)
   - `how-to/end-users/` — zero-code, browser UI guides for editors/coordinators using Dev Mode
   - `reference/` — factual, dry API and contract specs
   - `explanation/` — conceptual background, architecture reasoning
   - `tutorials/` — step-by-step walkthroughs for newcomers

