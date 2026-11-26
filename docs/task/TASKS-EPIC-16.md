# Epic 16: Mobile Chart Typography, Bar/Mark Sizing, Touch Interaction & Layout Hardening

> **Governed by:** [karpathy-rules](file:///Users/francisdave/Documents/folio/.agents/skills/karpathy-rules/SKILL.md) · [code-simplifier](file:///Users/francisdave/Documents/folio/.agents/skills/code-simplifier/SKILL.md) · [feature-dev](file:///Users/francisdave/Documents/folio/.agents/skills/feature-dev/SKILL.md) · [superpowers](file:///Users/francisdave/Documents/folio/.agents/skills/superpowers/SKILL.md) · [design-system-first](file:///Users/francisdave/Documents/folio/.agents/rules/design-system-first.md) · [canonical-ui-enforcement](file:///Users/francisdave/Documents/folio/.agents/rules/canonical-ui-enforcement.md)
>
> **Originating Audit:** Verified 20-view Mobile Chart Audit (`320px`, `375px`, `414px`, `480px` headless Chromium CDP `mobile: true`, `hasTouch: true`, `deviceScaleFactor: 2`).

---

## Problem Statement

An empirical mobile audit across all 20 chart visualizers, shared shells, overlays, and authoring views (`320px–480px` viewports) uncovered four systemic root causes degrading readability, touch ergonomics, and layout integrity on mobile:

1. **Fixed `800×360` SVG `viewBox` Scaling Collapse (`src/utils/chartDimensions.ts`):** None of the 5 visualizers (`BarChart`, `LineChart`, `DonutChart`, `ScatterPlot`, `HistogramChart`) pass responsive `width`/`height`/`isCompact` into `useChartPlotArea()`. On `320px–480px` screens, SVGs shrink to `0.3075×–0.5075×`, collapsing rendered X-axis text to `2.46px–4.06px`, Y-axis/titles/data labels to `2.77px–5.58px`, dense `BarChart` bars to `3.85px–6.36px` (`1.49px–2.46px` stacked segments), `DonutChart` ring to `73.8px` outer diameter, and `LineChart`/`ScatterPlot` points to `1.86px–5.07px` without touch hit-targets.
2. **Unclamped Tooltips & Broken Touch Lifecycle (`ChartTooltip`, `useChartTooltip`):** None of the 5 charts pass `clampX`/`clampY`, causing left (`-39.5px`), top (`-21.8px`), and right (`341px > 320px`) viewport clipping. `ChartTooltip` ignores `unit` (`_unit`). Touch taps flash/vanish on `touchend` (`BarChart`, `DonutChart`, `HistogramChart`), stay stuck visible in `LineChart` (missing `onPointerLeave`), and in `ScatterPlot.tsx:500–511` `onFocus` re-opens tooltips at raw SVG `cx`/`cy` (`left: 672px`, clipped right at `320px`).
3. **Margins, Tick Collisions & `reset.css` Leakage:** Large 6–7 digit Y-ticks collide with `yLabel`; `BarChart` left-margin cap mismatches (`160` vs `180`); `ScatterPlot` hides `.axisTitle` (`display: none`) while still reserving margin; `reset.css` `button { min-height: 44px; min-width: 44px; }` inflates `ChartLegend` pills into `244px`-tall stacks at `320px` (without click/tap toggle), forces `44×44px` close buttons, and inflates `TieredSlider` `.tierBtn`.
4. **Shell, Modal & Authoring Drawer Mobile Rough Edges:** `ChartCard` and `Step4Review` retain `20px` horizontal padding at `320px`; `ChartRouter` hides `.emptySubtitle`; `ChartGhostWireframe` distorts bars (`preserveAspectRatio="none"`); `ChartTableModal` forces horizontal scroll on simple datasets; `ChartConfigDrawer` hides `.companionViewport` below `1024px` and overflows `.footer` at `320px` (`332 > 320`); `Step3ChartSetup` clips `"Histogram"` (`55 > 49` at `320px`); `Step4Review` omits `rawValues`-only histogram check; `RangePreviewMatrix` and `DraggableRows` lack touch interaction and `DraggableRows` overflows horizontally at `320px–375px`.

---

## Locked Architectural Direction

- **Container-Driven Responsive SVG Geometry:** Measure the chart container width via `ResizeObserver` (`useChartContainerWidth`) and feed responsive `width`, `height`, and `isCompact` directly into `useChartPlotArea()` so SVG coordinate units track screen CSS pixels `1:1` (or near `1:1`) on mobile. Rendered SVG font sizes stay `>= 10–11px` across `320px–480px`.
- **Token-First Mobile Ergonomics:** Define all mobile chart spacing, typography floor, compact legend, and touch target tokens in `src/styles/tokens.css` before modifying component CSS modules. Zero hardcoded `#hex`/`rgba()` values.
- **Unified Tap-to-Inspect Tooltip Contract:** Standardize container-relative tooltip clamping (`clampX`/`clampY` + vertical flip) and tap-to-inspect / tap-outside-to-dismiss across all 5 visualizers without breaking desktop hover.
- **No Breaking Schema Changes:** All fixes are layout, rendering, interaction, and CSS improvements preserving existing `ChartConfig` and `CanvasElement` schemas.

---

## Non-Goals

- **No chart library rewrite** — keep the existing custom SVG visualizers in `src/components/chart/`.
- **No breaking `ChartConfig` or `CanvasElement` schema changes.**
- **No redesign of desktop (`>= 1024px`) chart aesthetics** — desktop proportions and styling remain preserved.

---

## Subtask Index

| Subtask | Phase | Title | Scope | Status |
| :--- | :--- | :--- | :--- | :--- |
| **16.1** | Phase 1 (Foundations & Tokens) | [Responsive Chart Dimensions, Container Measurement & Mobile Tokens](file:///Users/francisdave/Documents/folio/docs/task/16.1-responsive-chart-dimensions-tokens-and-container-measurement.md) | Lock mobile chart tokens in `tokens.css`; add `useChartContainerWidth` (`ResizeObserver`); extend `chartDimensions.ts` with responsive `width`/`height`/`isCompact`, aligned `160`/`180` left-margin cap, dynamic Y-tick margin helper, and X-tick decimation helper | Completed |
| **16.2** | Phase 2 (Cartesian Charts) | [Cartesian Charts Mobile Typography, Marks, Hit-Targets & Margins](file:///Users/francisdave/Documents/folio/docs/task/16.2-cartesian-charts-mobile-typography-marks-and-margins.md) | Wire responsive dimensions into `BarChart`, `LineChart`, `ScatterPlot`, and `HistogramChart`; remove `8px` mobile axis shrink; add `r >= 18–22` touch hit-targets, dense bar min-width/scroll & horizontal height scaling, X-tick/value collision avoidance, `ScatterPlot` axis title parity, and `HistogramChart` `.meanLabel` edge flip | Completed |
| **16.3** | Phase 3 (Donut & Legend) | [Donut Chart Mobile Proportions, `ChartLegend` Ergonomics & `reset.css` Containment](file:///Users/francisdave/Documents/folio/docs/task/16.3-donut-chart-mobile-proportions-legend-and-reset-containment.md) | Compact square-ish mobile `viewBox` and readable center/slice typography for `DonutChart`; improve `"Others"` slice contrast; contain `reset.css` `44×44px` leakage on `ChartLegend`, `ChartTableModal` / `Drawer` close buttons, and `TieredSlider` `.tierBtn`; add `onClick` tap-toggle to `ChartLegend` | Completed |
| **16.4** | Phase 4 (Tooltips & Touch) | [`ChartTooltip` Viewport Clamping, `unit` Rendering & Unified Touch Lifecycle](file:///Users/francisdave/Documents/folio/docs/task/16.4-chart-tooltip-clamping-unit-and-touch-lifecycle.md) | Wire `clampX`/`clampY` + top-edge flip in `useChartTooltip` across all 5 visualizers; render ignored `unit` prop in `ChartTooltip`; unify touch tap-to-inspect + tap-outside-to-dismiss; fix `LineChart` stuck tooltip and `ScatterPlot.tsx:500–511` `onFocus` raw-SVG-coordinate tooltip bug | Completed |
| **16.5** | Phase 5 (Shells & Authoring) | [Chart Shells, Modals, Config Drawer & Authoring Controls Mobile Polish](file:///Users/francisdave/Documents/folio/docs/task/16.5-chart-shells-modals-drawer-and-authoring-mobile-polish.md) | Reduce `ChartCard`/`Step4Review` mobile padding; restore `ChartRouter` `.emptySubtitle`; fix `ChartGhostWireframe` aspect distortion; tighten `ChartTableModal` `minTableWidth`; fix `Drawer` `.footer` wrap & mobile preview fallback; fix `Step3ChartSetup` `320px` `"Histogram"` clip; fix `Step4Review` `rawValues` check; fix `StandardDataControls`/`DraggableRows` overflow, missing CSS classes, and touch reorder; add touch range selection to `RangePreviewMatrix` | Completed |
| **16.6** | Phase 6 (Verification & Docs) | [Mobile Viewport Regression Verification, Visual Rubric & Docs Sync](file:///Users/francisdave/Documents/folio/docs/task/16.6-mobile-chart-verification-visual-rubric-and-docs-sync.md) | Automated `320px–480px` mobile chart rubric verification suite; full `tsc`, token, canonical-UI, Vitest, and library build gates; sync `CHANGELOG.md` and affected Diátaxis docs | Completed |
| **16.7** | Phase 7 (Mobile Card Chrome) | [Mobile `ChartCard` Top-Right Kebab Menu, Consolidated Actions & Legend Highlight-View Toggle](file:///Users/francisdave/Documents/folio/docs/task/16.7-mobile-chart-card-kebab-menu-and-legend-toggle.md) | Consolidate `View Table` & `Download Data (CSV)` into a top-right `⋮` kebab menu (`IconButton` + `MoreVerticalIcon`) on `<= 640px` and add an optional `Show Legend` (`menuitemcheckbox`) highlight-view toggle | Planned |

---

## Verification Gates (Epic-Level)

```bash
npx tsc --noEmit
npm run test:tokens
npx vitest run tests/canonical-ui-enforcement.test.ts
npm test
npm run build:lib
```

All must pass with **zero** TypeScript errors, **zero** token violations, **zero** canonical-UI violations, and **zero** test failures, plus verified `320px–480px` rendered geometry (`minFont >= 10px`, zero tooltip clipping, zero horizontal overflow).
