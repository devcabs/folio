# Epic 17 PRD: App-Wide Mobile & Tablet Responsiveness Hardening

> **Status:** Whiteboard Draft *(Not yet tasked — no subtasks created)*  
> **Epic Number:** 17 *(sequenced after [Epic 16](file:///Users/francisdave/Documents/folio/docs/task/TASKS-EPIC-16.md))*  
> **Owner:** Folio Engine (`@devcabs/folio-engine`)  
> **Audit Basis:** Static code/CSS audit across all ~210 UI, feedback, layout, roadmap, canvas, chart, source, dev, and history files against 6 target viewports (`320×568`, `375×667`, `390×844`, `430×932`, `667×375`, `768×1024`). Live browser verification deferred until Chrome DevTools remote debugging is available.  
> **Design & UX Alignment:** [UI Standards](file:///Users/francisdave/Documents/folio/.agents/rules/ui-standards.md) · [UX Psychology](file:///Users/francisdave/Documents/folio/.agents/rules/ux-psychology.md) · [Canonical UI Enforcement](file:///Users/francisdave/Documents/folio/.agents/rules/canonical-ui-enforcement.md) · [Design System First](file:///Users/francisdave/Documents/folio/.agents/rules/design-system-first.md) · [Accessibility](file:///Users/francisdave/Documents/folio/.agents/skills/accessibility/SKILL.md)

---

## 1. Problem Statement

While [Epic 16](file:///Users/francisdave/Documents/folio/docs/task/TASKS-EPIC-16.md) (`16.1–16.7`) hardened the chart visualizers and chart configuration studio (`BarChart`, `LineChart`, `DonutChart`, `HistogramChart`, `ScatterPlot`, `ChartTooltip`, `ChartLegend`, `ChartCard`, `ChartTableModal`, `Drawer` companion fallback), an objective full-application mobile responsiveness audit across all canonical UI primitives and non-canonical feature views uncovered systemic usability, overflow, touch-ergonomics, and viewport-containment defects across the rest of the application:

- **Core Navigation & Scrollytelling Breakage:** The landing page's discrete scroll-lock blocks scrolling inside an open mobile nav menu, disables native pinch-to-zoom, and traps off-fold stage media and footer links on short/landscape phones. Meanwhile, reading routes hide `EditorialSidebar` below `1024px` without providing any mobile Table of Contents or sticky Back control.
- **Media, Lightbox & PDF Friction:** `SourceLightbox` blocks pinch-zoom, misinterprets 2-finger pinch attempts as slide swipes, lacks panning when double-tap zoomed, and clips video players in landscape (`667×375`). `PdfPreviewModal` and `CanvasPdf` exceed short/narrow viewports.
- **Systemic Canonical Primitive & Safe-Area Gaps:** `index.html` omits `viewport-fit=cover`, overlays use `100vh` without `dvh`/`svh` or `env(safe-area-inset-*)`, `StatusPill` breaks multi-line mobile hero kickers, `Input`/`Textarea` `.monospace` triggers iOS auto-zoom (`14px`), `Modal`/`Drawer` clip or crowd on `320px`/`667×375`, and numerous canonical buttons/links/checkboxes fall below the `44×44px` touch target floor.
- **Hybrid Tablet (`768×1024`) Authoring Gaps:** Because [devSecurity.ts](file:///Users/francisdave/Documents/folio/src/utils/devSecurity.ts#L178-L199) permits Developer Mode at `>= 720px` when a fine pointer is present, `DevModeBadge` overflows `768px` screens and covers the `FAB`, `CanvasAddBar`'s palette overflows horizontally, and `CanvasItemControls` remains hover-only for touch interactions.

---

## 2. Goals & Explicit Non-Goals

### Goals

1. **Resolve All Remaining App-Wide Mobile & Tablet Findings:** Address every verified Critical, High, Medium, and Low defect across canonical primitives, shell/navigation, roadmap, media lightbox, PDFs, galleries/documents, and hybrid `768×1024` Developer Mode surfaces.
2. **Fix Root-Cause Canonical Primitives First:** Harden `Modal`, `Drawer`, `StatusPill`, `Button`, `IconButton`, `Breadcrumb`, `Checkbox`, `AccordionSection`, `Input`/`Textarea`, `DraggableRows`, `DevHelpTooltip`, and [scrollLock.ts](file:///Users/francisdave/Documents/folio/src/utils/scrollLock.ts) so all downstream feature views inherit mobile compliance automatically.
3. **Restore Mobile Reading & Scrollytelling Ergonomics:** Ensure open mobile menus scroll freely, pinch-zoom works (WCAG 1.4.4), short/landscape stages and footer links remain reachable, and node/subpage readers retain access to an in-page Table of Contents and stage-aware Back navigation below `1024px`.
4. **Harden Media & Safe-Area Containment:** Enable pinch-zoom and zoomed panning in `SourceLightbox`, prevent landscape video/PDF clipping, add `viewport-fit=cover` + `dvh` + `env(safe-area-inset-*)` across fixed/overlay chrome, and verify live rendering across all 6 target viewports (`320×568` through `768×1024`).

### Explicit Non-Goals

- **No duplication of Epic 16 (`16.1–16.7`) work:** Items already implemented in the working tree under Epic 16 (listed in Section 3.5) are excluded from Epic 17 scope.
- **No breaking AST, `EngineConfig`, or content schema changes:** All fixes are CSS, layout, interaction, and UI primitive improvements.
- **No unlocking of Developer Mode on touch-only phones:** The coarse-pointer lockout below `720px` in `isDesktopDevice()` remains intentional.
- **No desktop (`>= 1024px`) visual redesign:** Desktop editorial proportions and aesthetics stay intact.
- **No subtasks in this PRD:** Formal task specs (`docs/task/TASKS-EPIC-17.md` and `17.x-*.md`) will only be authored after whiteboard discussion and sign-off.

---

## 3. Audited Findings Register (Plain English + Verified Code Evidence)

> All items below are **Verified in Code/DOM** via static inspection across the 6 target viewports (`320×568`, `375×667`, `390×844`, `430×932`, `667×375`, `768×1024`). Items requiring live browser runtime confirmation are listed separately in Section 7.

### 3.1 Critical Findings

1. **Home Page Scroll Lock Blocks Mobile Menus, Pinch-Zoom & Short Screens** *(Canonical Shell + Non-Canonical Hook — All 6 viewports, worst at `667×375` & `320×568`)*  
   - **Plain English:** On the home page, custom swipe-stepping locks normal scrolling. Because of this, users cannot scroll an open mobile navigation menu (swiping advances the background roadmap instead), cannot pinch-to-zoom, and on short/landscape screens cannot reach milestone photos or the top half of the footer.  
   - **Evidence:** [use-discrete-step-navigation.ts](file:///Users/francisdave/Documents/folio/src/hooks/use-discrete-step-navigation.ts#L145-L243), [reset.css](file:///Users/francisdave/Documents/folio/src/styles/reset.css#L93-L99), [AppHeader.tsx](file:///Users/francisdave/Documents/folio/src/components/layout/AppHeader.tsx#L528-L535), [serpentine-generator.ts](file:///Users/francisdave/Documents/folio/src/components/roadmap/serpentine-generator.ts#L117), [use-roadmap-scroll.ts](file:///Users/francisdave/Documents/folio/src/components/roadmap/use-roadmap-scroll.ts#L137). `landing-scroll-locked` applies `touch-action: none` on `html`/`body`, and `handleTouchMove` calls `e.preventDefault()` unconditionally unless `isScrollLocked()` or target matches `[aria-modal="true"], [role="dialog"], [role="alertdialog"]`. `AppHeader`'s mobile dropdown uses `role="menu"` without `acquireScrollLock()`. `e.touches.length > 1` is not bypassed for pinch-zoom. At `667×375`, `segmentH >= 640px` + `topMargin >= 180px` pushes docked photos (`~245px`) below the `375px` fold, and `AppFooter` (`~560–620px`) scrolls to `scrollHeight` (bottom), trapping upper links.

2. **No Table of Contents or Persistent Back Button Below `1024px`** *(Canonical Layout — All 6 viewports)*  
   - **Plain English:** Below `1024px`, the reading sidebar disappears completely, and its section Table of Contents and stage-aware Back button are not moved into the mobile header or anywhere else on the page.  
   - **Evidence:** [App.module.css](file:///Users/francisdave/Documents/folio/src/App.module.css#L86-L88), [EditorialSidebar.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/EditorialSidebar.module.css#L204-L208), [App.tsx](file:///Users/francisdave/Documents/folio/src/App.tsx#L373-L419). `@media (max-width: 1023px)` hides `.sidebarColumn` and `.sidebarContainer` (`display: none`). `App.tsx` passes `siteNavItems` (2-level site tree) to `AppHeader`, while `effectiveNodeSections` (`useAutoTableOfContents`) and `sidebarOnBack` (`< Roadmap`) are rendered solely inside `EditorialSidebar`.

3. **Photo/Video Lightbox Blocks Pinch-Zoom, Cannot Pan Zoomed Photos & Clips Videos in Landscape** *(Non-Canonical — All 6 viewports; video clipping worst at `667×375`)*  
   - **Plain English:** Pinch-to-zoom is blocked (and trying to pinch can accidentally change or close the photo), double-tap zoom cannot be panned around, and on landscape phones the top/bottom bars take up over half the screen and cut off lightbox videos.  
   - **Evidence:** [SourceLightbox.module.css](file:///Users/francisdave/Documents/folio/src/components/source/SourceLightbox.module.css#L135-L208), [SourceLightbox.tsx](file:///Users/francisdave/Documents/folio/src/components/source/SourceLightbox.tsx#L90-L226), [useSwipeGesture.ts](file:///Users/francisdave/Documents/folio/src/hooks/useSwipeGesture.ts#L109-L142). `.stage` and `.lightboxImage` declare `touch-action: none` with zero JS pinch-zoom; `useSwipeGesture` tracks `e.touches.length > 0` and omits `e.isPrimary` in `onPointerDown`; `.imageFrameZoomed` (`scale(1.5)`) sits inside `.stage { overflow: hidden }` with no pan handler; at `667×375` (`> 640px`), `.headerBar` (`72px`) + `.footerBar` (`132–164px`) consume `54–63%` of height, leaving `~139px` for `.stage` and clipping `.videoFrame` (`max-height: min(75vh, 640px)` = `281px`).

4. **Developer Mode Floating Dock Overflows `768px` Tablets & Covers the `FAB`** *(Non-Canonical — `768×1024` active with fine pointer; `320–667px` if un-gated)*  
   - **Plain English:** On `768px` tablets/split-screen laptops where Dev Mode is allowed, the single-row floating Dev dock is wider than the screen, cutting off the Status and Exit buttons on both edges and overlapping the bottom-right `FAB`.  
   - **Evidence:** [DevModeBadge.module.css](file:///Users/francisdave/Documents/folio/src/components/dev/DevModeBadge.module.css#L8-L95), [DevModeBadge.tsx](file:///Users/francisdave/Documents/folio/src/components/dev/DevModeBadge.tsx#L169-L319). `.floatingCapsule` is `position: fixed; left: 50%; transform: translateX(-50%); display: inline-flex;` with no `max-width`, `overflow-x`, `flex-wrap`, `@media` rules, or `env(safe-area-inset-bottom)`. Children use `white-space: nowrap` (`~651px` base, `~736px` saving, `~855–940px` with migration warning pill), overflowing `768px` symmetrically and overlapping `FAB`.

### 3.2 High Findings

5. **Roadmap Portal Rings Clip at `320px` & Left-Flank Docked Photos Misalign** *(Non-Canonical — `320×568` clipping; `320–430px` alignment)*  
   - **Plain English:** On `320px` screens, right-side milestone circles get clipped at the right edge, and left-side docked photos sit slightly misaligned from their text column on `320–390px` screens.  
   - **Evidence:** [serpentine-generator.ts](file:///Users/francisdave/Documents/folio/src/components/roadmap/serpentine-generator.ts#L107-L113), [RoadmapNode.module.css](file:///Users/francisdave/Documents/folio/src/components/roadmap/RoadmapNode.module.css#L85-L89,L373-L407), [RoadmapNode.tsx](file:///Users/francisdave/Documents/folio/src/components/roadmap/RoadmapNode.tsx#L93-L99), [PhotoFlightEngine.tsx](file:///Users/francisdave/Documents/folio/src/components/roadmap/PhotoFlightEngine.tsx#L198-L201). `safeWidth = Math.max(width, 320)` places `rightX = 272px` inside a `288px` padded track, clipping the `72px` `.portalRing`. Left `.stationBody` starts at `116px` viewport X with `min(340px, calc(100vw - 120px))` (reaching `100vw - 4px`), causing `PhotoFlightEngine`'s edge clamp to shift docked photos `12px` left of the text block.

6. **`StatusPill` Forces Single-Line Text, Breaking Hero Kicker & Compact Drive Pills** *(Canonical `StatusPill` + `HeroWelcome` — `320×568`, `375×667`)*  
   - **Plain English:** The pill component forces its inner text onto one line, overriding the hero's mobile wrap rule so long kicker text (and long compact Drive folder pills) spill out of the pill on narrow phones.  
   - **Evidence:** [StatusPill.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/StatusPill.module.css#L17,L43-L46), [HeroWelcome.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/HeroWelcome.module.css#L227-L233), [SourceFolderAttachment.module.css](file:///Users/francisdave/Documents/folio/src/components/source/SourceFolderAttachment.module.css#L13-L19). Inner `<span className={styles.label}>` explicitly declares `white-space: nowrap`, ignoring `.kickerPill { white-space: normal !important }`.

7. **Missing `viewport-fit=cover`, Outdated `100vh` Heights & Missing Safe-Area Insets** *(Canonical — `320×568` through `667×375`)*  
   - **Plain English:** The page omits `viewport-fit=cover`, and modals, drawers, headers, and menus rely on `100vh` without safe-area padding—causing overlays to tuck under notches, home indicators, and mobile browser toolbars, while the fixed header eats `~22%` of a landscape phone's height.  
   - **Evidence:** [index.html](file:///Users/francisdave/Documents/folio/index.html#L5), [Modal.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/Modal.module.css#L11-L25), [Drawer.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/Drawer.module.css#L15-L16,L127-L136,L311-L334), [AppHeader.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/AppHeader.module.css#L7-L18,L456), [AppFooter.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/AppFooter.module.css#L14), [TopErrorBanner.module.css](file:///Users/francisdave/Documents/folio/src/components/feedback/TopErrorBanner.module.css#L17,L28-L32), [PageNotFound.module.css](file:///Users/francisdave/Documents/folio/src/components/feedback/PageNotFound.module.css#L13-L14), [ChartTableModal.module.css](file:///Users/francisdave/Documents/folio/src/components/chart/ChartTableModal.module.css#L11-L12). `AppHeader` stays `top: 32px` (`82px` total = `21.9%` of `375px` height).

8. **Systemic Sub-`44×44px` Touch Targets Across Canonical Primitives & Reader Controls** *(Canonical + Non-Canonical — All 6 viewports)*  
   - **Plain English:** Many shared buttons, close icons, menu toggles, links, checkboxes, and accordion headers are smaller than comfortable `44×44px` finger targets.  
   - **Evidence:** Canonical overrides of `reset.css`: [Button.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/Button.module.css#L25-L69) (`xs: 26px`, `sm: 36px`), [IconButton.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/IconButton.module.css#L52-L74) (`xs: 26px`, `sm: 32px`, `md: 40px`), [StatusPill.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/StatusPill.module.css#L56-L62,L146-L159) (`26px` / `~31.4px`), [Breadcrumb.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/Breadcrumb.module.css#L89-L109) (`28px`), [Checkbox.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/Checkbox.module.css#L12-L38) (`~16–18px`), [AccordionSection.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/AccordionSection.module.css#L12-L28) (`~27.5px`), [TieredSlider.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/TieredSlider.module.css#L62-L90,L120-L134) (`24px` thumb, unpadded `.tierBtn` height). Layout/Feature controls: [AppHeader.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/AppHeader.module.css#L365-L368,L493-L565) (`.menuToggle` `36×36px`, `.brandGroup` `32px`, `.mobileNavLink` `~36px`, `.mobileSubNavLink` `~27.5px`), [AppFooter.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/AppFooter.module.css#L88-L98,L222-L230) (`~20px` / `~27.5px`), [SearchField.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/SearchField.module.css#L84-L90) (`32×32px`), [CanvasPdf.tsx](file:///Users/francisdave/Documents/folio/src/components/canvas/CanvasPdf.tsx#L121-L131) / [CanvasVideo.tsx](file:///Users/francisdave/Documents/folio/src/components/canvas/CanvasVideo.tsx#L105-L115) / [SourceDocuments.tsx](file:///Users/francisdave/Documents/folio/src/components/source/SourceDocuments.tsx#L240-L251) / [PdfPreviewModal.tsx](file:///Users/francisdave/Documents/folio/src/components/source/PdfPreviewModal.tsx#L123-L168) (`26px` `size="xs"`), [LightboxPhotoStrip.module.css](file:///Users/francisdave/Documents/folio/src/components/source/LightboxPhotoStrip.module.css#L41-L42,L134-L138) (`44×33px` / `56×42px`), [SourceLightbox.module.css](file:///Users/francisdave/Documents/folio/src/components/source/SourceLightbox.module.css#L91-L92,L271-L273) (`40×40px` close, `42×42px` nav), [ChartTableModal.module.css](file:///Users/francisdave/Documents/folio/src/components/chart/ChartTableModal.module.css#L78-L82) (`28×28px`), [SourceImage.module.css](file:///Users/francisdave/Documents/folio/src/components/source/SourceImage.module.css#L92-L106) (`~24–26px` Retry).

9. **Floating Hero Photos Overlap Hero Copy & Navbar** *(Non-Canonical — `320×568`–`667×375`)*  
   - **Plain English:** Decorative hero photos sit above the hero text layer on phones (covering text and intercepting taps) and collide with the top navbar in landscape.  
   - **Evidence:** [PhotoFlightEngine.module.css](file:///Users/francisdave/Documents/folio/src/components/roadmap/PhotoFlightEngine.module.css#L15,L42-L46), [HeroWelcome.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/HeroWelcome.module.css#L74), [PhotoFlightEngine.tsx](file:///Users/francisdave/Documents/folio/src/components/roadmap/PhotoFlightEngine.tsx#L127-L132). `.flightContainer` (`z-index: 6`, `pointer-events: auto`) stacks over `.heroContainer` (`z-index: 3`). At `320×568`, Node 2 (`80×60px` at `x: 8%, y: 23%`) intrudes `65.6px` over hero copy; at `667×375`, Nodes 1 & 2 (`y: 51–125px`) slice behind `AppHeader` (`y: 32–82px`).

10. **Canvas Editor Palette Overflows & Hover-Only Controls Hide on `768×1024` Hybrid Devices** *(Non-Canonical — `768×1024` fine/hybrid pointer)*  
    - **Plain English:** On `768px` touch+trackpad devices, the single-row "+ Add Element" bar overflows horizontally, and edit/move/delete bars stay invisible until hovered with a mouse.  
    - **Evidence:** [CanvasControls.module.css](file:///Users/francisdave/Documents/folio/src/components/canvas/CanvasControls.module.css#L31,L65,L126-L194,L441-L473), [CanvasItemControls.tsx](file:///Users/francisdave/Documents/folio/src/components/canvas/CanvasItemControls.tsx#L74,L154-L214), [DocumentCanvas.tsx](file:///Users/francisdave/Documents/folio/src/components/canvas/DocumentCanvas.tsx#L1195-L1205). `.paletteMenu` (`~660–740px` non-wrapping 7-item flex row) clips inside `768px` / `~352px` `.gridItem` cells; `.itemControlsFloatingBar` and `.addPillButton` are `opacity: 0; pointer-events: none` until `:hover`/`:focus-within`; drag reorder uses HTML5 `draggable` only.

11. **PDF Viewers & Video/PDF Previews Exceed Short & Narrow Viewports** *(Non-Canonical — `320×568`, `375×667`, `667×375`)*  
    - **Plain English:** The PDF preview modal forces double scrolling around an embedded PDF, and the inline PDF error/fallback card stays locked at `480px` tall (taller than a landscape phone screen).  
    - **Evidence:** [PdfPreviewModal.module.css](file:///Users/francisdave/Documents/folio/src/components/source/PdfPreviewModal.module.css#L39-L54), [CanvasPdf.module.css](file:///Users/francisdave/Documents/folio/src/components/canvas/CanvasPdf.module.css#L77-L85,L106-L116,L151-L160), [CanvasVideo.module.css](file:///Users/francisdave/Documents/folio/src/components/canvas/CanvasVideo.module.css#L76-L82), [tokens.css](file:///Users/francisdave/Documents/folio/src/styles/tokens.css#L263-L265). `PdfPreviewModal` `75vh` + `~200–256px` modal chrome = `656–682px` (`320×568`) and `~481px` (`667×375`); `CanvasPdf` `.pdfFallbackCard` omits a mobile override (`min-height: 480px`), and landscape `.iframeFrame` (`4/3` aspect, `~528px`) + `CanvasVideo` (`16/9`, `~409px`) exceed `375px` viewport height.

12. **Modals & Drawers Clip on Narrow/Landscape Screens, Ignore Keyboards & Leak iOS Scroll** *(Canonical `Modal`, `Drawer`, `scrollLock` + `DevPinModal` — `320×568`, `375×667`, `667×375`)*  
    - **Plain English:** Narrow screens leave very little room inside modals (causing the 4-digit PIN boxes to spill out), Drawer headers/tabs/footers leave minimal scroll room in landscape and clip 6+ tabs, virtual keyboards are ignored, and background scroll-locking isn't hardened for iOS Safari.  
    - **Evidence:** [Modal.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/Modal.module.css#L20-L102), [DevPinModal.module.css](file:///Users/francisdave/Documents/folio/src/components/dev/DevPinModal.module.css#L53-L96), [Drawer.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/Drawer.module.css#L45,L209-L247), [scrollLock.ts](file:///Users/francisdave/Documents/folio/src/utils/scrollLock.ts#L33-L43). `Modal` `16px×2 + 24px×2` padding leaves `240px` at `320px` while `DevPinModal` `.slotsRow` is `276px` (`4×60 + 3×12`); `Modal` lacks `max-height`/scrollable body and `--keyboard-offset`; `Drawer` chrome eats `~184–204px` on `667×375` and `.tabList` overflows with 6+ tabs (`6×44px + gaps > 280px`); `scrollLock.ts` only sets `overflow: hidden` and hardcodes `#root`.

### 3.3 Medium Findings

13. **Monospace Inputs/Textareas (`14px`) Trigger iOS Safari Auto-Zoom** *(Canonical — iOS Safari `320×568`–`667×375`)*  
    - **Evidence:** [Input.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/Input.module.css#L53-L57), [Textarea.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/Textarea.module.css#L55-L59) (`.monospace { font-size: var(--text-body-sm); }` = `14px`, used in `CanvasElementFields` URL Name & `CanvasDeleteConfirmModal`).

14. **Gallery 3-Column Mobile Row Crowds Tiles (`320–390px`)** *(Non-Canonical)*  
    - **Evidence:** [SourceGallery.module.css](file:///Users/francisdave/Documents/folio/src/components/source/SourceGallery.module.css#L85-L131), [SourceCard.module.css](file:///Users/francisdave/Documents/folio/src/components/source/SourceCard.module.css#L158-L203), [SourceImage.module.css](file:///Users/francisdave/Documents/folio/src/components/source/SourceImage.module.css#L63-L90). `repeat(3, 1fr)` yields `81–94px` tiles at `320px`; `.videoPlayBadge` (`56×56px`) overlaps `.videoDurationPill` by `~9px`, and `.errorFallback` (`~108px`) clips `Retry`.

15. **Document Lists & Editorial Folder Cards Crush Titles on Narrow Phones** *(Non-Canonical — `320×568`, `375×667`)*  
    - **Evidence:** [SourceFolderAttachment.module.css](file:///Users/francisdave/Documents/folio/src/components/source/SourceFolderAttachment.module.css#L25-L103), [SourceDocuments.module.css](file:///Users/francisdave/Documents/folio/src/components/source/SourceDocuments.module.css#L60-L148). Editorial card leaves `~60px` for title next to `nowrap` action; `.documentRow` leaves `~130px` (`~18` chars) for `.rowTitle` with unwrapped `.rowSubMeta`.

16. **Custom Modal Headers Collide with `Modal`'s `.absoluteCloseButton` & Long `Modal.title`** *(Canonical + Non-Canonical — `320×568`–`390×844`)*  
    - **Evidence:** [Modal.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/Modal.module.css#L44-L70), [DevPinModal.tsx](file:///Users/francisdave/Documents/folio/src/components/dev/DevPinModal.tsx#L101-L123), [DevLockBlockedModal.tsx](file:///Users/francisdave/Documents/folio/src/components/dev/DevLockBlockedModal.tsx#L71-L82), [DevExitConfirmModal.tsx](file:///Users/francisdave/Documents/folio/src/components/dev/DevExitConfirmModal.tsx#L62-L131), [DevMigrationModal.tsx](file:///Users/francisdave/Documents/folio/src/components/dev/DevMigrationModal.tsx#L163-L181), [HistoryHubModal.tsx](file:///Users/francisdave/Documents/folio/src/components/history/HistoryHubModal.tsx#L337-L414). Five modals omit `Modal` `title` and collide with `.absoluteCloseButton`; `Modal.header` lacks `gap` and `.title` lacks `min-width: 0; overflow-wrap: anywhere` (affects `PdfPreviewModal` long filenames).

17. **Touch-Inaccessible Canonical Controls (`DraggableRows` & `DevHelpTooltip`)** *(Canonical — All touch viewports)*  
    - **Evidence:** [DraggableRows.tsx](file:///Users/francisdave/Documents/folio/src/components/ui/DraggableRows.tsx#L36-L73), [DraggableRows.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/DraggableRows.module.css#L98-L115), [DevHelpTooltip.tsx](file:///Users/francisdave/Documents/folio/src/components/ui/DevHelpTooltip.tsx#L101-L148), [DevHelpTooltip.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/DevHelpTooltip.module.css#L1-L18). `DraggableRows` is HTML5 DnD only; `DevHelpTooltip` is `14×14px`, suppresses `onClick`/`onMouseDown`, opens only on hover/focus, and lacks bottom viewport clamping.

18. **Non-Wrapping Toolbars & Rows Overflow/Crush at `320–390px`** *(Canonical + Non-Canonical)*  
    - **Evidence:** [SegmentedControl.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/SegmentedControl.module.css#L6-L48) (5+ options > `240px` modal), [SeriesSelectToolbar.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/SeriesSelectToolbar.module.css#L1-L34) (`~354px` row), [HistoryHubModal.module.css](file:///Users/francisdave/Documents/folio/src/components/history/HistoryHubModal.module.css#L78-L141) (`.historyItem`/`.itemMeta` overflow `280px`), [SectionTitle.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/SectionTitle.module.css#L77-L82), [FormField.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/FormField.module.css#L13-L35), [Step1SourceRange.module.css](file:///Users/francisdave/Documents/folio/src/components/chart/drawer/panels/Step1SourceRange.module.css#L415-L419), [Modal.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/Modal.module.css#L92-L102).

19. **Missing `min-width: 0` / `overflow-wrap: break-word` Causing Brand/Text Clipping** *(Canonical + Non-Canonical — `320–390px`)*  
    - **Evidence:** [AppHeader.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/AppHeader.module.css#L108-L120) (`.brandMeta` breaks `.brandTitle` ellipsis, pushing `.menuToggle` out), [SourceLightbox.module.css](file:///Users/francisdave/Documents/folio/src/components/source/SourceLightbox.module.css#L321-L356) (`.metadataBlock`/`.photoTitle`), [PageTitle.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/PageTitle.module.css#L19-L46), [InlineAlert.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/InlineAlert.module.css#L6-L28), [CanvasPageLink.module.css](file:///Users/francisdave/Documents/folio/src/components/canvas/CanvasPageLink.module.css#L116-L130,L288-L309,L387-L410), [CanvasLeaf.module.css](file:///Users/francisdave/Documents/folio/src/components/canvas/CanvasLeaf.module.css#L49-L78,L156-L163), [CanvasEmptyNotice.module.css](file:///Users/francisdave/Documents/folio/src/components/canvas/CanvasEmptyNotice.module.css#L9-L62), [TopErrorBanner.module.css](file:///Users/francisdave/Documents/folio/src/components/feedback/TopErrorBanner.module.css#L83-L99), [HeroWelcome.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/HeroWelcome.module.css#L132-L146).

20. **`HeroWelcomeGhostWireframe` Overflows `320px` & Jumps on Hydration** *(Canonical Layout — `320×568`; CLS across all 6)*  
    - **Evidence:** [HeroWelcomeGhostWireframe.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/HeroWelcomeGhostWireframe.module.css#L23-L98) lacks `@media (max-width: 1023px)` parity (`240px`/`272px` skeleton bars inside `224px` box at `320px`; inset rounded card jumps to full-bleed).

21. **`ChartTableModal` `<colgroup>` Width > 100%, Landscape Rows & Sticky Category Context** *(Non-Canonical — `320×568`, `667×375`)*  
    - **Evidence:** [ChartTableModal.tsx](file:///Users/francisdave/Documents/folio/src/components/chart/ChartTableModal.tsx#L52-L68,L106-L155), [ChartTableModal.module.css](file:///Users/francisdave/Documents/folio/src/components/chart/ChartTableModal.module.css#L11-L12,L118-L126). Fixed `<col>` widths sum to `100% + 48px`; `667×375` leaves ~4–5 rows; horizontal scroll keeps only `#` sticky while `.categoryCell` scrolls off.

22. **`CanvasPageLink` `lg`/`sm` Fixed Thumbnails Oversize on `667×375` & `320×568`** *(Non-Canonical)*  
    - **Evidence:** [CanvasPageLink.module.css](file:///Users/francisdave/Documents/folio/src/components/canvas/CanvasPageLink.module.css#L262-L278,L362-L385). `.cardLgThumb` min `256px` (total card `~380–460px > 375px`); `.cardSmThumb` fixed `224px` (`~324px` card = `86%` of `667×375`).

23. **Localized Component Bugs (`Step1SourceRange`, `chartDimensions.ts`, `ColumnSelect`)** *(Canonical + Non-Canonical)*  
    - **Evidence:** [Step1SourceRange.module.css](file:///Users/francisdave/Documents/folio/src/components/chart/drawer/panels/Step1SourceRange.module.css#L177-L199) (dead `.input`/`.select` descendant selectors fail to size hashed CSS-module inputs/selects); [chartDimensions.ts](file:///Users/francisdave/Documents/folio/src/utils/chartDimensions.ts#L138-L145) (even-count `step === 2` renders adjacent final two X-ticks); [ColumnSelect.tsx](file:///Users/francisdave/Documents/folio/src/components/ui/ColumnSelect.tsx#L93,L120-L127) & [ColumnSelect.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/ColumnSelect.module.css#L101-L131) (`<label>` `onClick` double-toggles `<button>`, downward-only `240px` popover, `~35.5px` `<li>` options).

### 3.4 Low Findings

24. **Sub-`12px` Micro-Typography (`9px–11.5px`)** across badges, timestamps, and `xs`/`sm` pills (`ColumnTypeBadge` `9px`, `DraggableRows` `10px`, `DrawerTier`/`SeriesSelectToolbar`/`SourceFolderAttachment`/`HistoryHubModal`/`DevModeBadge`/`DevMigrationModal`/`Button sizeXs`/`StatusPill sizeSm` `11px`, `TieredSlider` `11.52px`).
25. **`FAB` Stacking, Width Guard & Mount Offset:** [FAB.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/FAB.module.css#L11,L97-L115) (`z-index: 50 < --z-sticky: 100`, no `max-width` for custom labels at `320px`) and [FAB.tsx](file:///Users/francisdave/Documents/folio/src/components/ui/FAB.tsx#L45-L63) (skips initial mount `visualViewport` check).
26. **Minor Layout, Token & Canonical Hygiene Polish:**
    - [AppFooter.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/AppFooter.module.css#L71): `.columnHeading` uses color token `--text-secondary` as `font-size`.
    - [SearchField.module.css](file:///Users/francisdave/Documents/folio/src/components/layout/SearchField.module.css#L107-L124,L170-L193): `⌘K` desktop shortcut hint still shown on `667×375` & `768×1024` touch devices.
    - [DevMigrationModal.module.css](file:///Users/francisdave/Documents/folio/src/components/dev/DevMigrationModal.module.css#L47-L54,L154-L174): `max-height: 360px` nested scroll at `667×375`; `.primaryActions` lacks `flex-wrap`.
    - [CanvasAddModal.module.css](file:///Users/francisdave/Documents/folio/src/components/canvas/CanvasAddModal.module.css#L212-L229): vertical button stack up to `1023px` wastes height on `667×375`.
    - [Breadcrumb.module.css](file:///Users/francisdave/Documents/folio/src/components/ui/Breadcrumb.module.css#L25-L45): hidden horizontal scrollbar lacks edge-fade cue.
    - [Toast.module.css](file:///Users/francisdave/Documents/folio/src/components/feedback/Toast.module.css#L7-L25): `max-width` omits left/right safe areas; stacked toasts lack `max-height`.
    - [RangePreviewMatrix.module.css](file:///Users/francisdave/Documents/folio/src/components/chart/RangePreviewMatrix.module.css#L172-L181): `.emptySheet { height: 100vh }`.
    - [DevActionAffordance.module.css](file:///Users/francisdave/Documents/folio/src/components/dev/DevActionAffordance.module.css#L146-L157): absolute `.textBadge` overlaps trailing text at `768px`.
    - [UniversalEditModal.tsx](file:///Users/francisdave/Documents/folio/src/components/dev/UniversalEditModal.tsx#L776): mobile stacked footer CSS (`.actions`) is unattached dead code; `CanvasAddBar`, `CanvasPhoto`, `SourceImage`, `SourceLightbox`, and local `<Toast>` instances bypass canonical `ui/` primitives.

### 3.5 Epic 16 Overlap Summary *(Already Addressed — Excluded from Epic 17)*

| Audit Item | Resolution Status in Epic 16 |
|---|---|
| `DonutChart` fixed `800×360` viewBox & tiny mobile text | **Resolved in Epic `16.3`** (`useChartContainerWidth` + square-ish mobile viewBox) |
| `ChartTooltip` clamping, `unit` rendering & touch tap lifecycle (`Bar`, `Line`, `Donut`, `Histogram`, `Scatter`) | **Resolved in Epic `16.4`** (needs live browser verification alongside Epic 17) |
| `ChartLegend` tap-to-pin `onClick` toggle | **Resolved in Epic `16.3`** |
| `Drawer` companion preview hidden `<= 1024px` & `.footer` wrap | **Resolved in Epic `16.5`** (`mobileCompanionSection` toggle + `flex-wrap: wrap`) |
| `Step3ChartSetup` 5-col `"Histogram"` clip at `320px` | **Resolved in Epic `16.5`** (`repeat(3, minmax(0, 1fr))` `<= 400px`) |
| `RangePreviewMatrix` mouse-only range selection | **Resolved in Epic `16.5`** (touch selection added) |
| `ChartCard` `20px` mobile padding & footer button crowding | **Resolved in Epic `16.5` & `16.7`** (`--chart-pad-surface-mobile` + kebab menu) |
| `ChartTableModal` `minTableWidth` sizing | **Resolved in Epic `16.5`** |
| `TieredSlider` `20px` thumb & `reset.css` `.tierBtn` inflation | **Resolved in Epic `16.3`** (`24×24px` thumb + `min-width/height: unset`) |

---

## 4. Locked-In vs. Proposed Product Decisions

| # | Area | Status | Decision / Proposal | Rationale |
|---|---|---|---|---|
| **1** | **Desktop & Dev Gate Preservation** | **Locked** | Preserve desktop (`>= 1024px`) layout and keep touch-only phone (`< 720px`) Dev Mode lockout in `isDesktopDevice()`. | Keeps authoring focused on tablet/desktop while ensuring `768×1024` hybrid/split-screen authoring works cleanly. |
| **2** | **Canonical-First Remediation** | **Locked** | Fix shared primitives in `src/components/ui/` and `src/styles/tokens.css` before touching downstream feature modules. | Eliminates root multipliers (e.g., `StatusPill`, `Modal`, `Drawer`, `Button`, `IconButton`) across dozens of views. |
| **3** | **Home Scroll-Lock on Short / Touch Screens** | **Proposed** | Yield to `[role="menu"]` and multi-touch pinch unconditionally; evaluate whether discrete scroll-lock should relax or auto-yield when `innerHeight < 640px` or when inside footer/tall stages. | Restores menu scrolling, pinch-zoom (WCAG 1.4.4), and reachability of off-fold photos/footer on `667×375` & `320×568`. |
| **4** | **Mobile In-Page TOC Placement** | **Proposed** | Render a compact collapsible `"On this page"` pill/bar (and sticky/accessible Back link) in the reading column below `1024px`, keeping `AppHeader`'s 2-level Option A menu uncluttered. | Preserves [Epic 13 PRD](file:///Users/francisdave/Documents/folio/docs/whiteboard/EPIC-13-dynamic-nested-pages/13-PRD.md) Option A restraint while restoring mobile section navigation. |
| **5** | **Compact Button Touch Hit-Area (`44×44px`)** | **Proposed** | Keep visual compactness of `size="xs"` / `IconButton` on desktop while expanding touch hit-areas to `44×44px` via `@media (pointer: coarse)` (`::after` pseudo-hit-slop or min-height). | Satisfies WCAG/Apple/Material touch targets without bloating editorial card chrome. |

---

## 5. User Flows & Experience

### Reader Flows (`320×568` through `768×1024`)
1. **Landing & Scrollytelling (`home`):** Reader lands on a zero-flash hero (`HeroWelcomeGhostWireframe` matching `HeroWelcome` mobile layout), reads an unbroken wrapped kicker pill unobstructed by floating photos, opens/scrolls the mobile nav menu freely, steps through centered/unclipped roadmap milestones, and reaches every footer link and `FAB` cleanly—even on `667×375` landscape or with pinch-zoom active.
2. **Chapter & Subpage Reading (`node`/`page`):** Reader sees a clean breadcrumb, can open an inline mobile `"On this page"` TOC or step back to the parent/roadmap stage below `1024px`, opens PDFs or videos sized safely within short landscape viewports, and taps full-size `44×44px`-friendly action links without iOS auto-zoom or horizontal clipping.
3. **Evidence Lightbox (`SourceLightbox`):** Reader pinch-zooms or double-taps photos and pans smoothly when zoomed, switches slides cleanly without pinch misfires, and watches lightbox videos in `667×375` landscape with compact/collapsible chrome and safe-area clearance.

### Hybrid Tablet & Split-Screen Editor Flows (`768×1024` fine pointer)
1. **Dev Dock & Canvas Authoring:** `DevModeBadge` wraps or scrolls cleanly inside `768px` without hiding `Exit` or covering `FAB`. `CanvasAddBar`'s element palette wraps within the viewport, and `CanvasItemControls` remains discoverable and usable via touch taps as well as hover.
2. **Modals & Drawers:** PIN entry, edit modals, `HistoryHubModal`, and `ChartConfigDrawer` fit inside `320px` and `667×375` viewports with non-colliding headers, wrapping footers, keyboard-aware positioning, and reliable iOS scroll lock.

---

## 6. High-Level Architectural Direction

1. **Viewport, Safe-Area & Token Foundations:** Add `viewport-fit=cover` in [index.html](file:///Users/francisdave/Documents/folio/index.html); standardize `dvh` fallbacks and `env(safe-area-inset-*)` tokens in [tokens.css](file:///Users/francisdave/Documents/folio/src/styles/tokens.css); enforce `12px` readable label floor and `16px` touch input floor.
2. **Canonical UI & Scroll-Lock Upgrades:** Upgrade `Modal`, `Drawer`, `StatusPill`, `Button`, `IconButton`, `Breadcrumb`, `Checkbox`, `AccordionSection`, `Input`/`Textarea` `.monospace`, `ColumnSelect`, `SegmentedControl`, `SeriesSelectToolbar`, `DraggableRows`, `DevHelpTooltip`, `FAB`, `Toast`, `TopErrorBanner`, and [scrollLock.ts](file:///Users/francisdave/Documents/folio/src/utils/scrollLock.ts).
3. **Shell, Scrollytelling & Mobile TOC:** Fix `use-discrete-step-navigation.ts`, `AppHeader` (`.brandMeta` `min-width: 0`, landscape height, `pointerdown`/`touchstart` dismissal), `HeroWelcomeGhostWireframe` mobile parity, mobile `"On this page"` TOC + Back affordance, `RoadmapTrack`/`RoadmapNode`/`PhotoFlightEngine` math.
4. **Media, Lightbox, PDFs & Hybrid Authoring:** Fix `SourceLightbox` + `useSwipeGesture` multi-touch/pan/landscape chrome, `PdfPreviewModal`/`CanvasPdf`/`CanvasVideo` viewport caps, `SourceGallery`/`SourceDocuments`/`SourceFolderAttachment`/`CanvasPageLink` narrow layouts, and `DevModeBadge`/`CanvasAddBar`/`CanvasItemControls` hybrid-tablet support.
5. **Live 6-Viewport Browser Verification:** Connect Chrome DevTools and measure all 6 viewports (`320×568`, `375×667`, `390×844`, `430×932`, `667×375`, `768×1024`) to close out all Section 7 items.

---

## 7. Edge Cases, Guardrails & Items Needing Live Browser Verification

### Guardrails
- Preserve `box-sizing: border-box` and Universal Zero Outline Policy across all focus/active states.
- Respect `prefers-reduced-motion: reduce` on all media/skeleton transitions (`SourceGallerySkeleton`, `SourceImage`, `SourceDocuments`, `HistoryHubModal`).
- Never break `#root`-less consumer app mounting in [scrollLock.ts](file:///Users/francisdave/Documents/folio/src/utils/scrollLock.ts).

### Items Requiring Live Browser Verification *(Once Chrome Remote Debugging Is Enabled)*
1. **Above-the-Fold Hero CTA & Accented Word Wrapping (`320×568`, `667×375`):** Confirm whether `HeroWelcome` CTA clips below `375px` fold and whether `.bukasGradient` (`38.64px`) overflows `272px` width with loaded `Fraunces` metrics.
2. **`PhotoFlightEngine` Hero Overlap & Mobile Chrome Resize (`320×568`–`667×375`):** Verify hero text legibility under peeking photos, iOS Safari horizontal rubber-banding (`overflow-x: clip` on `body` only), and height-only resize staleness.
3. **Home Footer vs. `FAB` Overlap (`320×568`, `375×667`, `667×375`):** Measure whether fixed left/right `FAB`s obscure footer links at bottom scroll, `320px` inter-FAB gap, and computed `42px` vs `44px` button height.
4. **`AppHeader` Outside-Tap Dismissal & `Modal` Auto-Focus on iOS Safari:** Verify `mousedown`-only listener dismissal on body taps and whether `Modal` `setTimeout(..., 25)` auto-focus triggers premature virtual keyboard occlusion.
5. **Virtual Keyboard & iOS `scrollLock` Bleed (`320×568`, `390×844`, `667×375`):** Confirm backdrop touch-scroll bleed, keyboard overlap on `DevPinModal`/`CanvasAddModal`/`ChartConfigDrawer`, and `<Input monospace />` focus auto-zoom.
6. **`SourceLightbox` Chrome Toggle Race & Thumbnail Glow Clipping:** Verify `handleStageClick` vs `.backdrop` `onTouchStart` `resetIdleTimer()` race and `LightboxPhotoStrip` active thumbnail shadow clipping at `<= 640px`.
7. **Cross-Origin PDF `<iframe>` Touch Scroll (`PdfPreviewModal`, `CanvasPdf`):** Verify touch scrolling/pinch inside Google Drive preview iframes on iOS Safari.
8. **`ChartTableModal` Fixed Colgroup & Post-Epic-16 Touch Timing:** Verify browser resolution of `48px + 100%` `<colgroup>` and confirm Epic 16 touch tooltip behavior across real touch devices.
9. **Touch Sticky `:hover` & `content-visibility` Scrollbar Jump:** Check unguarded `:hover` transforms (`CanvasPageLink`, `CanvasPhoto`, `SourceCard`, `SourceDocuments`, `ParametricShape`) and `contain-intrinsic-size` height mismatches (`280px`/`350px`/`520px`) during mobile scroll.
10. **Borderline Control Heights (`~42.8px` vs `44px`):** Measure computed heights of `Input`, `Select`, `ChartSortingControls` `<Select>`, `CanvasPhoto` `.photoFallbackCard` at `320px`, and `CanvasElementFields` `SegmentedControl` wrapping at `320px`.

---

## 8. Open Questions for Refinement

1. **Discrete Scroll-Lock Policy on Short / Touch Viewports:** On `home` when `window.innerHeight < 640px` (e.g., `667×375` landscape) or when a stage/footer overflows the viewport, should `use-discrete-step-navigation.ts` automatically fall back to native scrolling (keeping `FAB` step buttons active), or allow free scroll within tall stages/footer before snapping?
2. **Mobile In-Page TOC UX (`< 1024px`):** Should the mobile Table of Contents on `node`/`page` routes render as a collapsible `"On this page"` disclosure card right under `PageTitle`, or as a compact sticky floating pill/drawer trigger?
3. **Compact Touch Target Strategy (`Button xs/sm`, `IconButton`, Links):** For dense editorial surfaces (`SourceDocuments`, `CanvasPdf`, `Toast` dismiss, `AppFooter` links), do we prefer invisible `44×44px` `::after` tap-area expansion on `@media (pointer: coarse)` (preserving compact visual density) or larger visible button boxes?
4. **Live Browser Verification Timing:** Should we connect Chrome DevTools and run the live 6-viewport baseline measurement pass *before* promoting Epic 17 to `docs/task/`, or include it as the opening gate of Phase 1?

---

## 9. Draft Phase Outline *(Not Yet Tasked — Zero Subtasks Created)*

> **Note:** Per [Whiteboard-First](file:///Users/francisdave/Documents/folio/.agents/rules/whiteboard-first.md), this outline is exploratory only. Formal subtasks in `docs/task/` will not be created until this PRD is discussed and approved.

- **Draft Phase 1 — Live Baseline, Viewport Foundations & Safe-Area Tokens:** Run live 6-viewport Chrome DevTools baseline, add `viewport-fit=cover`, establish `dvh`, safe-area, and coarse-pointer touch-target tokens.
- **Draft Phase 2 — Canonical UI & Scroll-Lock Hardening:** Upgrade `Modal`, `Drawer`, `StatusPill`, `Button`/`IconButton`, `Breadcrumb`, `Checkbox`, `AccordionSection`, `Input`/`Textarea` `.monospace`, `ColumnSelect`, `SegmentedControl`, `SeriesSelectToolbar`, `DraggableRows`, `DevHelpTooltip`, `FAB`, `Toast`, `TopErrorBanner`, and `scrollLock.ts`.
- **Draft Phase 3 — Home Shell, Scrollytelling & Mobile TOC Navigation:** Fix `use-discrete-step-navigation.ts`, `AppHeader`, `AppFooter`, `HeroWelcomeGhostWireframe`, mobile TOC + stage-aware Back affordance, `RoadmapTrack`/`RoadmapNode`, and `PhotoFlightEngine`.
- **Draft Phase 4 — Media Lightbox, PDFs & Gallery/Document Views:** Fix `SourceLightbox` + `useSwipeGesture`, `PdfPreviewModal`/`CanvasPdf`/`CanvasVideo`, `SourceGallery`/`SourceCard`/`SourceImage`, `SourceDocuments`/`SourceFolderAttachment`, and `CanvasPageLink`.
- **Draft Phase 5 — Hybrid `768×1024` Studio & 6-Viewport Verification Gate:** Fix `DevModeBadge`, `CanvasAddBar`/`CanvasItemControls`, modal header/footer edge cases (`DevPinModal`, `HistoryHubModal`, `DevMigrationModal`, etc.), and pass full unit + 6-viewport live verification gates.
