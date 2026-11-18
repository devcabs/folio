# Folio Engine — Active Epics & Atomic Task Index

> **Prevalence Notice:** Governed by [.agents/skills/karpathy-rules/SKILL.md](file:///Users/francisdave/Documents/folio/.agents/skills/karpathy-rules/SKILL.md), [.agents/skills/feature-dev/SKILL.md](file:///Users/francisdave/Documents/folio/.agents/skills/feature-dev/SKILL.md), [.agents/skills/superpowers/SKILL.md](file:///Users/francisdave/Documents/folio/.agents/skills/superpowers/SKILL.md), and [.agents/rules/design-system-first.md](file:///Users/francisdave/Documents/folio/.agents/rules/design-system-first.md).

---

## 📚 Active Epics Overview

| Epic ID | Title | Canonical Epic Spec | Status |
| :--- | :--- | :--- | :--- |
| **Epic 9** | [Developer Mode Canvas Authoring Controls, Insertion Bars & Modal Unification](file:///Users/francisdave/Documents/folio/docs/task/TASKS-EPIC-9.md) | `docs/task/TASKS-EPIC-9.md` | Planned |
| **Epic 10** | [Chart Configuration UX Realignment — "Shape the Data → Encode the Visual → Polish & Label"](file:///Users/francisdave/Documents/folio/docs/task/TASKS-EPIC-10.md) | `docs/task/TASKS-EPIC-10.md` | Planned |
| **Epic 11** | [Lightweight Canvas PDF Support — Inline `pdf` Viewer & Drive `documents` Folder Sync](file:///Users/francisdave/Documents/folio/docs/task/TASKS-EPIC-11.md) | `docs/task/TASKS-EPIC-11.md` | Planned |

---

## 📄 Epic 11: Lightweight Canvas PDF Support (`TASKS-EPIC-11.md`)

**Canonical Document:** [TASKS-EPIC-11.md](file:///Users/francisdave/Documents/folio/docs/task/TASKS-EPIC-11.md)

| Subtask ID | Phase | Title | Scope | File Reference | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **11.1** | Phase 1 (MVP) | [PDF & Documents Data Contracts, Edge Schemas, URL Resolvers & Design Tokens](file:///Users/francisdave/Documents/folio/docs/task/11.1-pdf-data-contracts-url-resolvers-and-tokens.md) | Define `PdfElement`, `DocumentsElement`, `SyncedDocumentItem`, Zod edge schemas, Drive `/preview` & `/view` URL resolvers in `mediaUrl.ts`, default factories in `canvasDefaults.ts`, and PDF/document tokens in `src/styles/tokens.css` | `docs/task/11.1-pdf-data-contracts-url-resolvers-and-tokens.md` | Pending |
| **11.2** | Phase 1 (MVP) | [Inline `<CanvasPdf>` Viewer Component & Fallback States](file:///Users/francisdave/Documents/folio/docs/task/11.2-canvas-pdf-inline-viewer-component.md) | Build `<CanvasPdf>` with responsive Google Drive `/preview` `<iframe>`, editorial title/caption, `"Open in New Tab ↗"` link, calm fallback state, and side `✎ Edit` button | `docs/task/11.2-canvas-pdf-inline-viewer-component.md` | Pending |
| **11.3** | Phase 1 (MVP) | [Single PDF Authoring Wiring (`CanvasAddBar`, `UniversalEditModal`, `DocumentCanvas`)](file:///Users/francisdave/Documents/folio/docs/task/11.3-single-pdf-authoring-and-modal-wiring.md) | Wire `pdf` creation, editing, deletion confirmation, and AST persistence across `CanvasAddBar`, `UniversalEditModal`, `CanvasDeleteConfirmModal`, and `DocumentCanvas` | `docs/task/11.3-single-pdf-authoring-and-modal-wiring.md` | Pending |
| **11.4** | Phase 2 (`documents`) | [Google Drive PDF Folder Sync Service & `useDriveDocumentSync` Hook](file:///Users/francisdave/Documents/folio/docs/task/11.4-drive-pdf-folder-sync-service-and-hook.md) | Implement `driveDocumentSyncService.ts` (`fetchDriveFolderPdfs`, `reconcileDriveDocuments`, `syncFolderDocuments`) and `useDriveDocumentSync.ts` with 5-state lifecycle and AST persistence | `docs/task/11.4-drive-pdf-folder-sync-service-and-hook.md` | Pending |
| **11.5** | Phase 2 (`documents`) | [`<CanvasDocuments>`, `<SourceDocuments>` List & `<PdfPreviewModal>` Suite](file:///Users/francisdave/Documents/folio/docs/task/11.5-canvas-documents-list-and-preview-modal.md) | Build `<SourceDocuments>`, `<PdfPreviewModal>`, `<EditDocumentModal>`, and `<CanvasDocuments>`, wire `Document` submenu (`Single PDF` / `PDF Folder`) in `CanvasAddBar`, and unify `LinkFolderModal` editing in `DocumentCanvas` | `docs/task/11.5-canvas-documents-list-and-preview-modal.md` | Pending |
| **11.6** | Phase 2 (Release) | [End-to-End Verification, Version Doctor Migration Ledger & Diátaxis Docs Sync](file:///Users/francisdave/Documents/folio/docs/task/11.6-pdf-support-e2e-verification-ledger-and-docs-sync.md) | Record release entry in `src/migrations/ledger.ts`, sync `CHANGELOG.md`, update Diátaxis docs per `docs-sync.md`, and run full quality/token/migration verification gates | `docs/task/11.6-pdf-support-e2e-verification-ledger-and-docs-sync.md` | Pending |

---

## 📊 Epic 10: Chart Configuration UX Realignment (`TASKS-EPIC-10.md`)

**Canonical Document:** [TASKS-EPIC-10.md](file:///Users/francisdave/Documents/folio/docs/task/TASKS-EPIC-10.md)

| Subtask ID | Title | Scope | File Reference | Status |
| :--- | :--- | :--- | :--- | :--- |
| **10.1** | [Chart Type Switcher & Non-Exclusive Accordions](file:///Users/francisdave/Documents/folio/docs/task/10.1-chart-type-switcher-and-non-exclusive-accordions.md) | Replace `<select>` Chart Type dropdown with a token-compliant segmented selector and remove forced exclusive accordion collapsing in `Step3ChartSetup` | `docs/task/10.1-chart-type-switcher-and-non-exclusive-accordions.md` | Pending |
| **10.2** | [Resequence `Data` Tab ("Shape the Data")](file:///Users/francisdave/Documents/folio/docs/task/10.2-shape-the-data-tab-resequencing.md) | Place primary column mapping first, move `Order & Direction` from `Appearance` into `Data`, open Histogram `Binning & Distribution` by default, and move `Table Orientation` (Transpose) to the bottom of `Data` | `docs/task/10.2-shape-the-data-tab-resequencing.md` | Pending |
| **10.3** | [Resequence `Appearance` Visual Encoding ("Encode the Visual")](file:///Users/francisdave/Documents/folio/docs/task/10.3-encode-the-visual-appearance-resequencing.md) | Promote `Visual Style` to top of `Appearance` (`defaultOpen={true}`) across all 5 charts and split Scatter's 8-control panel into `Trendline & Analytics` and `Axes & Scale` | `docs/task/10.3-encode-the-visual-appearance-resequencing.md` | Pending |
| **10.4** | [Consolidate "Polish & Label" Section](file:///Users/francisdave/Documents/folio/docs/task/10.4-polish-and-label-consolidation.md) | Place `Data Labels` (Bar/Line/Donut) and `Titles & Axis Labels` at the bottom of `Appearance` as the final polish step with clear conditional labels | `docs/task/10.4-polish-and-label-consolidation.md` | Pending |
| **10.5** | [Chart Configuration UX Tests & Token Verification](file:///Users/francisdave/Documents/folio/docs/task/10.5-chart-config-ux-regression-tests-and-token-audit.md) | Add unit/component tests verifying per-chart section order, keyboard navigation, and state preservation, plus `test:tokens`, `tsc --noEmit`, and `npm run build` | `docs/task/10.5-chart-config-ux-regression-tests-and-token-audit.md` | Pending |

---

## 🛠️ Epic 9: Developer Mode Canvas Authoring Controls, Insertion Bars & Modal Unification (`TASKS-EPIC-9.md`)

**Canonical Document:** [TASKS-EPIC-9.md](file:///Users/francisdave/Documents/folio/docs/task/TASKS-EPIC-9.md)

| Subtask ID | Title | Scope | File Reference | Status |
| :--- | :--- | :--- | :--- | :--- |
| **9.1** | [Unconditional Post-Header Insertion Bar for Canvas Sections](file:///Users/francisdave/Documents/folio/docs/task/9.1-canvas-section-post-header-add-bar.md) | Always render `sec-top-${section.id}` `CanvasAddBar` immediately after every `<CanvasSection>` heading in Dev Mode | `docs/task/9.1-canvas-section-post-header-add-bar.md` | Pending |
| **9.2** | [Eliminate Subsection Ghost Hover Zone & Duplicate Insertion Bars](file:///Users/francisdave/Documents/folio/docs/task/9.2-canvas-subsection-ghost-gap-and-duplicate-add-bar-fix.md) | Render `sub-top-${child.id}` unconditionally, remove duplicate `sub-${child.id}` bar, fix subsection insertion index, and anchor subsection toolbar at top | `docs/task/9.2-canvas-subsection-ghost-gap-and-duplicate-add-bar-fix.md` | Pending |
| **9.3** | [Deduplicate Gallery Sync Photos Affordance in `SourceGallery`](file:///Users/francisdave/Documents/folio/docs/task/9.3-gallery-duplicate-sync-photos-button-removal.md) | Remove legacy `footerRight` `↻ Sync Photos` button in `SourceGallery.tsx`, keeping the single canonical `sideSyncBtn` in `sideEditWrapper` | `docs/task/9.3-gallery-duplicate-sync-photos-button-removal.md` | Pending |
| **9.4** | [Unify Floating Toolbar Edit Action with Side `✎ Edit` Button Modals](file:///Users/francisdave/Documents/folio/docs/task/9.4-floating-toolbar-and-side-edit-modal-unification.md) | Unify Gallery floating toolbar Edit + side `✎ Edit` onto `LinkFolderModal`, and unify Chart floating toolbar Edit + side `✎ Edit` onto `ChartConfigDrawer` with `initialConfig` & AST persistence | `docs/task/9.4-floating-toolbar-and-side-edit-modal-unification.md` | Pending |
