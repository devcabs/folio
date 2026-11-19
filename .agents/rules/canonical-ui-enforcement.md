---
name: canonical-ui-enforcement
description: >-
  Prevents non-canonical, ad-hoc, or duplicated UI components, raw HTML controls, cross-component CSS module borrowing, and duplicated inline SVGs/helpers across Folio Engine (@devcabs/folio-engine).
trigger: always_on
---

# Mandatory Rule: Canonical UI Enforcement & Anti-Duplication Gate

> **CRITICAL DIRECTIVE**: Never write ad-hoc, copy-pasted, or non-canonical UI in feature components. Every repeatable control, surface, form field, icon, or feedback pattern MUST consume a canonical primitive from `src/components/ui/` or `src/components/feedback/`. If the primitive does not exist yet, **STOP and extract it into `src/components/ui/` first**, then consume it.

---

## 1. Mandatory Primitive Mapping (Zero Raw Ad-Hoc Controls)

Before writing any JSX in `src/components/**` (outside `src/components/ui/`), check `src/components/ui/index.ts`. The following raw patterns are **prohibited** in feature components:

| Prohibited Ad-Hoc Pattern | Required Canonical Target |
|---|---|
| Raw `<button>` for actions, close, edit, nav, or icon triggers | `Button` (`src/components/ui/Button.tsx`) — or extend `Button` / extract `IconButton` in `src/components/ui/` first |
| Ad-hoc external action links (`<a className={styles.openTabLink}>Open ↗</a>`) | `Button as="a"` or `StatusPill variant="link"` |
| Ad-hoc status/counter/date/warning pill spans (`.counterBadge`, `.dateBadge`, `.pill`) | `StatusPill` (`src/components/ui/StatusPill.tsx`) |
| Raw `<input>`, `<textarea>`, `<select>`, `<label>` + hint/error stacks | Canonical `FormField`, `Input`, `Textarea`, `Select` in `src/components/ui/` (extract first if missing) |
| Raw `<input type="checkbox">` rows | Canonical `Checkbox` / `CheckboxField` in `src/components/ui/` (extract/generalize from `ValueLabelToggle` first if missing) |
| Ad-hoc `role="radiogroup"` segmented toggles | Canonical `SegmentedControl` in `src/components/ui/` (extract first if missing) |
| Custom dialog backdrops / Escape / focus-trap logic | `Modal` (`src/components/ui/Modal.tsx`) or `Drawer` (`src/components/ui/Drawer.tsx`) — exemptions require a distinct layout paradigm (e.g., fullscreen zoomable media stage) |
| Local `<Toast>` component state in feature views | `showToast` from `useDeveloperMode()` |
| Duplicated modal footer action bars or inline `role="alert"` banners | Shared `Modal` `footer` / `ModalActions` and `InlineAlert` primitives |

---

## 2. The Rule of Two (Mandatory Extraction)

The **second time** any of the following appears across two components, you MUST extract it into a single canonical primitive or shared utility before finishing the task:
- **UI structures & form panels** (e.g., `EditPhotoModal` + `EditDocumentModal`, `CanvasAddModal` + `UniversalEditModal`, `SourceGallery` + `SourceDocuments` side-edit/sync bars).
- **Inline `<svg>` icons** (e.g., `DocumentIcon` / `DocumentBadgeIcon`, edit/trash icons) — never copy-paste `<svg>` markup between components; extract into a shared icon primitive.
- **UI-bound helpers** (e.g., Google Drive error-message mapping, tab-options memoization, Drive URL preview resolution).

> **Abstraction Fit Check**: Only consolidate patterns with shared **semantic and behavioral intent**. Do NOT merge domain-specific layouts with coincidental visual similarity (e.g., bespoke SVG wireframes/skeletons or fullscreen pinch-zoom lightboxes).

---

## 3. Strict CSS Module Ownership & Token Purity

1. **Zero Cross-Component CSS Borrowing**: A feature component MUST NEVER import another sibling/feature component's private `*.module.css` (e.g., `EditDocumentModal.tsx` importing `./EditPhotoModal.module.css`). If two components share styling, extract the shared UI primitive or shared component instead.
2. **Zero Hardcoded Colors or Shadows**: Never write raw `#hex`, `rgb()`, `rgba()`, `hsl()`, or `hsla()` values (including fallback values like `var(--text-inverse, #ffffff)`) in any `*.module.css`. Consume tokens exclusively from `src/styles/tokens.css`.
3. **No Redundant Pass-Through Wrappers**: Never create thin re-export files in feature directories (e.g., `src/components/layout/StatusPill.tsx` re-exporting `../ui/StatusPill`). Import directly from `src/components/ui/`.

---

## 4. Mandatory Pre-Completion Self-Audit

Before marking any UI task complete, run a quick verification against your touched files:
- [ ] **No new raw `<button>`, `<input>`, `<textarea>`, or `<select>`** outside `src/components/ui/`.
- [ ] **No cross-component `.module.css` imports** in modified or added files.
- [ ] **No copy-pasted `<svg>` icons** or duplicated modal/form shells.
- [ ] **No hardcoded `#hex` / `rgba()` / `hsla()`** in CSS modules (`npm run test:tokens` passes).
- [ ] **4-state interactive matrix & Universal Zero Outline Policy** (`outline: none;` on focus/active) preserved via canonical primitives.
