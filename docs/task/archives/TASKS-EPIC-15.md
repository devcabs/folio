# Epic 15: Unified Media Support — Inline `video` Embed & Mixed Photo/Video Drive Galleries

> **Governed by:** [karpathy-rules](file:///Users/francisdave/Documents/folio/.agents/skills/karpathy-rules/SKILL.md) · [code-simplifier](file:///Users/francisdave/Documents/folio/.agents/skills/code-simplifier/SKILL.md) · [feature-dev](file:///Users/francisdave/Documents/folio/.agents/skills/feature-dev/SKILL.md) · [superpowers](file:///Users/francisdave/Documents/folio/.agents/skills/superpowers/SKILL.md) · [design-system-first](file:///Users/francisdave/Documents/folio/.agents/rules/design-system-first.md) · [canonical-ui-enforcement](file:///Users/francisdave/Documents/folio/.agents/rules/canonical-ui-enforcement.md)
>
> **Prerequisite Epics:** [Epic 11 — Lightweight Canvas PDF Support](file:///Users/francisdave/Documents/folio/docs/task/TASKS-EPIC-11.md) · [Epic 12 — Canonical UI Primitives](file:///Users/francisdave/Documents/folio/docs/task/TASKS-EPIC-12.md) · [Epic 14 — `PageLinkElement` Card Size Variants](file:///Users/francisdave/Documents/folio/docs/task/TASKS-EPIC-14.md)

---

## Problem Statement

Folio Engine currently treats visual media as photos-only:

1. **No standalone video block:** Authors cannot embed a single Google Drive video or YouTube video inline on a canvas page.
2. **Drive folders ignore videos:** `drivePhotoSyncService` filters strictly for `image/*`. Mixed Google Drive folders silently drop video clips.

---

## Locked UX Direction (Option 1 — Unified "Media", Zero Over-Engineering)

- **Add Bar (`CanvasAddBar`):** Rename `Photo` → **`Media`** with a 3-item submenu:
  1. **Single Photo** (`photo`)
  2. **Single Video** (`video`)
  3. **Media Gallery** (`gallery` — Google Drive folder syncing both `image/*` and `video/*`)
- **Single Video (`CanvasVideo`):** Mirrors `<CanvasPdf>` — a single responsive 16:9 `<iframe>` supporting **Google Drive** (`/file/d/{id}/preview`) and **YouTube** (`youtube-nocookie.com/embed/{id}`) via standard link pasting (no YouTube API key required). Includes optional title/caption, `"Open in New Tab ↗"` link, calm empty fallback, and Dev Mode `✎ Edit`.
- **Mixed Media Gallery (`SourceGallery` + `SourceLightbox`):** Linked Drive folders automatically sync `video/*` alongside `image/*`. Video tiles show their Drive poster thumbnail + a tokenized play-icon badge and `MM:SS` duration pill. Clicking opens the same `SourceLightbox`, rendering the Drive `/preview` `<iframe>` on video slides and keeping photo zoom on image slides.

---

## Non-Goals

- **No YouTube API** — standard URL parsing + `youtube-nocookie.com/embed/{id}` only.
- **No Vimeo / direct `.mp4` `<video>` player** — keep playback to one simple `<iframe>` path (Google Drive + YouTube).
- **No separate `VideoGallery` element** — `GalleryElement` is the single canonical mixed-media collection.
- **No breaking schema migration** — keep `GalleryElement.syncedPhotos`; legacy items without `mediaType` default to `'image'`.

---

## Subtask Index

| Subtask | Phase | Title | Scope | Status |
| :--- | :--- | :--- | :--- | :--- |
| **15.1** | Phase 1 (Contracts & Tokens) | [Video & Mixed-Media Contracts, URL Resolver & Design Tokens](file:///Users/francisdave/Documents/folio/docs/task/15.1-video-contracts-url-resolver-and-tokens.md) | `VideoElement` + `VideoElementSchema` + `createDefaultVideoElement`; optional video fields on `SourceItem`/`SyncedSourceItem`/`DrivePhotoFile`; `resolveSingleVideoUrl` (Drive + YouTube) & `formatVideoDuration` in `mediaUrl.ts`; video/badge tokens in `tokens.css` | Completed |
| **15.2** | Phase 2 (Inline Video & Add Bar) | [Inline `<CanvasVideo>` Component & Unified `Media` Authoring](file:///Users/francisdave/Documents/folio/docs/task/15.2-canvas-video-and-unified-media-authoring.md) | `<CanvasVideo>` iframe player mirroring `<CanvasPdf>`; shared `VideoIcon`/`PlayIcon` in `ui/Icons.tsx`; `CanvasAddBar` `Photo` → `Media` submenu (`Single Photo`, `Single Video`, `Media Gallery`); `'video'` wiring in `CanvasElementFields`, modals, and `DocumentCanvas` | Completed |
| **15.3** | Phase 3 (Mixed Drive Galleries) | [Mixed Photo/Video Drive Sync, Card Badges & Playable `SourceLightbox`](file:///Users/francisdave/Documents/folio/docs/task/15.3-mixed-media-drive-sync-and-lightbox.md) | Extend `drivePhotoSyncService` for `video/*` & `videoMediaMetadata(durationMillis)`; add play badge + `MM:SS` duration pill in `SourceCard` & `LightboxPhotoStrip`; play Drive `/preview` iframe in `SourceLightbox`; adapt `EditPhotoModal` & `SourceGallery` copy | Completed |
| **15.4** | Phase 4 (Exports & Verification) | [Public Exports, Version Doctor Ledger, Docs Sync & Full Verification](file:///Users/francisdave/Documents/folio/docs/task/15.4-verification-exports-ledger-and-docs.md) | Export `VideoElement`, `CanvasVideo`, `resolveSingleVideoUrl`, `formatVideoDuration`; update `src/migrations/ledger.ts`, `CHANGELOG.md`, and Diátaxis docs; run all quality/token/canonical-UI/build gates | Completed |

---

## Verification Gates (Epic-Level)

```bash
npx tsc --noEmit
npm run test:tokens
npx vitest run tests/canonical-ui-enforcement.test.ts
npm test
npm run build:lib
```

All must pass with **zero** TypeScript errors, **zero** token violations, **zero** canonical-UI violations, and **zero** test failures.
