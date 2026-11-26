# Epic 14: `PageLinkElement` Card Size Variants (Small 2-Col & Large Hero)

> **Governed by:** [karpathy-rules](file:///Users/francisdave/Documents/folio/.agents/skills/karpathy-rules/SKILL.md) · [design-system-first](file:///Users/francisdave/Documents/folio/.agents/rules/design-system-first.md) · [canonical-ui-enforcement](file:///Users/francisdave/Documents/folio/.agents/rules/canonical-ui-enforcement.md) · [editorial-restraint](file:///Users/francisdave/Documents/folio/.agents/rules/editorial-restraint.md)
>
> **Prerequisite Epic:** [Epic 13 — Dynamic Multi-Page & Nested Subpage Architecture](file:///Users/francisdave/Documents/folio/docs/task/archives/TASKS-EPIC-13.md) ✅ Completed

---

## Problem Statement

`CanvasPageLink` currently renders one fixed layout (the medium editorial card: 40% left media slot, horizontal row). Authors have no way to control visual weight or density of page link cards. This blocks two valid editorial use cases:

1. **Dense index pages** — many sibling pages side-by-side in a compact 2-column grid.
2. **Hero chapter openers** — a single high-priority subpage deserving a cinematic full-width treatment.

## Goals

- Add `sm` (Small, 2-column grid clustering) and `lg` (Large, cinematic hero) card size variants to `CanvasPageLink`.
- Expose a card size selector in the Add/Edit modal (General tab), defaulting to `md`.
- **Never change** the existing `md` (Medium) implementation — it is working, tested, and must remain untouched.

## Non-Goals

- No new page routing or data model changes (beyond the `cardSize` field on `PageLinkElement`).
- No server/edge changes — `cardSize` is a pure client-side render hint.
- No migration needed — omitted `cardSize` gracefully defaults to `'md'`.

---

## Subtask Index

| Subtask | Phase | Title | Status |
| :--- | :--- | :--- | :--- |
| **14.1** | Implementation | [`PageLinkElement` Card Size Variants — AST, Authoring UX, Rendering & Grid Clustering](file:///Users/francisdave/Documents/folio/docs/task/14.1-page-link-card-sizes.md) | Complete |

---

## Verification Gates (Epic-Level)

After 14.1 is complete, run the full suite:

```bash
npx tsc --noEmit
npm run test:tokens
npx vitest run tests/components/canvas-page-link.test.tsx \
                 tests/components/canvas-add-page-workflow.test.tsx \
                 tests/components/document-canvas.test.ts \
                 tests/canonical-ui-enforcement.test.ts
npm test
```

All must pass with **zero** TypeScript errors, **zero** token violations, and **zero** test failures.
