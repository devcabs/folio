---
name: coding-standards
description: >-
  Enforces coding conventions, naming standards, CSS modules with design tokens, and the single-tasked modularity & anti-bloat principle for Folio Engine (@devcabs/folio-engine).
trigger:
  - "When creating or modifying React components, hooks, utilities, or types"
  - "When naming files, functions, variables, or interfaces"
  - "When writing component styling"
---

# Folio Engine Coding & Naming Standards

## 0. Canonical Solution & Component-First Mandate
- **Solve Canonically First**: Always solve problems canonically by default unless explicitly instructed otherwise. Default to established architectural patterns, shared utilities, data contracts, and first-class components.
- **Find a Canonical Component First**: Before creating or modifying UI elements (especially repeatable components like buttons, inputs, drawers, modals, badges, cards, tabs, breadcrumbs, toasts), search `src/components/ui/` and established shared engine components first. Reuse and compose existing canonical components rather than building ad-hoc, divergent, or inline duplicates.
- **Build Canonical When Repeatable**: If a repeatable component or UI pattern does not yet exist or is fragmented across views, elevate and build the canonical component first in `src/components/ui/` with strict token styling, full 4-state matrix, and WCAG 2.1 AA accessibility, then consume it.

---

## 1. Supreme Principle: Cohesion & Changeability (Finding the Balance)
- **Don't Pile, Don't Fragment**: Don't generalize speculatively. Don't extract merely because you can. Avoid scattering tightly coupled logic across dozens of trivial wrappers.
- **The Litmus Test**: Ask: *"Does extracting this make the system meaningfully easier to understand, reuse, test, or change?"* If no, keep it colocated.
- **Earned Abstraction**: Abstractions must be earned by actual reuse, meaningful isolation, independent testing, or distinct change boundaries.
- **Lean Small & Single-Purpose**: When a visual or logical chunk has a distinct identity (e.g. `StatusPill`, `RoadmapTrack`, `MediaLightbox`), extract it into a small, single-purpose component rather than letting parent files drift into monoliths.

---

## 2. File & Naming Conventions
- **React Components**: `PascalCase.tsx` (`AppHeader.tsx`, `RoadmapTrack.tsx`, `DocumentCanvas.tsx`)
- **Styles**: Scoped CSS modules colocated with component: `[Component].module.css` (`AppHeader.module.css`)
- **Hooks, Utilities, Types, Data**: `kebab-case.ts` / `kebab-case.json` (`node.ts`, `validate-schema.ts`, `node-nodes.json`)
- **Identifiers**:
  - Components & Interfaces/Types: `PascalCase` without `I` prefix (`NodeItem`, `AppHeaderProps`, `CanvasDocument`)
  - Functions & Variables: `camelCase` with descriptive verbs (`handleSelect`, `formatDate`)
  - Event Handlers: `handle[Event]` inside components, `on[Event]` for callback props
  - Booleans: `is`, `has`, `should`, `can` prefix (`isExpanded`, `hasNodeData`)
  - Constants: `UPPER_SNAKE_CASE` for static module constants

---

## 3. Styling & CSS Rules
- Pure CSS Modules: `import styles from './[Component].module.css'`
- Strict Design Tokens: Always use CSS custom properties from `src/styles/tokens.css` (`var(--font-display)` / `var(--font-serif)`, `var(--font-sans)` / `var(--font-body)`, `var(--font-mono)`, `var(--folio-primary)`, `var(--space-4)`).
- Zero Specific Font Pushing: Never push, declare, or hardwire specific font families in code or rules; all components and styles must strictly consume the established typography tokens from `src/styles/tokens.css`.
- Zero Tailwind & zero arbitrary un-tokenized hex colors in CSS modules.
- 4-State Interactive Matrix: Always implement default, hover, active, focus-visible, and disabled states.
- Universal Zero Outline Policy: Strictly enforce `outline: none;` on all active, selected, or focused interactive components. Never show outline rings or halos.

---

## 4. Import Ordering Standard
1. React & external packages (`react`, `react-dom`, `zod`, `d3-scale`, `d3-array`)
2. Internal types (`../../types/node`, `../../types/canvas`)
3. Internal components & hooks (`../layout/AppHeader`, `../../hooks/...`)
4. Data & static assets (`../../data/node-nodes.json`)
5. Scoped CSS Module (`styles from './Component.module.css'`)

---

## 5. Commits
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`.

---

## 6. Plan-First Discipline & Anti-Eager Implementation Gate
- **Distinguish Planning from Execution**: When planning features or architectural changes, maintain clear documentation in `docs/tasks/`.
- **Zero Premature Code**: Avoid speculative modifications before requirements, contracts, and test cases are specified.
- **Approval Required**: Present design proposals clearly and await user confirmation before executing disruptive architectural refactorings.
