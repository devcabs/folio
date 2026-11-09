---
name: design-system-first
description: >-
  Mandatory rule to enforce before starting any UI/UX scaffolding, component generation, or page layouts, ensuring complete design system tokens are established upfront.
trigger: always_on
---

# Mandatory Rule: Design System First & Token Discipline

> **CRITICAL DIRECTIVE**: You MUST follow design system first principles. NEVER start designing, scaffolding, or generating UI/UX components or page layouts without an established visual scope and complete design system tokens established down to the tiniest of details.

---

## 1. Absolute Prohibition on Premature UI Generation
- **No Unstyled/Ad-Hoc UI**: You MUST NEVER generate components, views, templates, or page layouts using ad-hoc styling, browser defaults, or placeholder generic designs (no "AI slop" purple gradients, default fonts, or arbitrary un-tokenized colors).
- **Hard Gate**: If a UI/UX task is requested and a formal design system token does not yet exist in the codebase (in `src/styles/tokens.css`), you MUST STOP and establish the design token first.

---

## 2. Mandatory 5-Phase Workflow Enforcement
Every UI/UX feature or application build MUST progress through these 5 phases in order:

### Phase 1: Clarify Scope & Contracts
- Define component props, TypeScript contracts, and data models in `src/types/`.
- Define what the component explicitly will **NOT** do.
- Define concrete verification criteria (unit tests, token verifications) before generating code.

### Phase 2: Taste Curation & Visual Benchmarks
- Commit to an explicit visual theme upfront (e.g., Clean Technical Editorial).
- Zero tolerance for default, generic AI styling.

### Phase 3: Design System FIRST (The Token Gate)
Before writing any component markup, ensure all tokens are defined in `src/styles/tokens.css`:
1. **Surfaces & Colors (HSL/OKLCH)**: `--folio-bg-canvas`, `--folio-bg-surface`, `--folio-text-primary`, `--folio-text-secondary`, `--folio-primary`, `--folio-secondary`, `--color-node-1` through `--color-node-12`.
2. **Typography System**: Must strictly consume CSS custom properties from `src/styles/tokens.css` (never push or hardwire specific font families):
   - Display / Titles: `var(--font-display)` / `var(--font-serif)`
   - Interface / Body: `var(--font-sans)` / `var(--font-body)`
   - Codes / Data: `var(--font-mono)`
   - Tightened tracking: `var(--tracking-tight)` (`-0.025em`)
   - Semantic roles: `var(--text-display)`, `var(--text-title)`, `var(--text-subhead)`, `var(--text-body)`, `var(--text-caption)`.
3. **Spacing & Geometry**: 4px/8px scale (`--space-1` to `--space-16`). Button width roughly double button height.
4. **Motion Curves**: `--duration-fast: 150ms`, `--duration-normal: 250ms`, `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`.

### Phase 4: Atomic Scaffolding & 4-State Matrix (Canonical Component First)
- **Canonical Component Discovery First**: Before building new UI, search `src/components/ui/` for existing canonical components.
- **Build Canonical When Repeatable**: If a repeatable component or pattern is missing or scattered, build the canonical component first in `src/components/ui/` with token-only styles and full 4-state matrix, then consume it.
- **4-State Interactive Matrix**: Every interactive element (buttons, cards, inputs, links) must implement all states: **Default**, **Hover**, **Active/Pressed**, **Focus-Visible** (`outline: none;` Universal Zero Outline Policy), and **Disabled/Loading**.
- Provide immediate micro-interaction feedback.

### Phase 5: UX Psychology & Audit
Before marking any UI task complete, audit against:
1. **Goal Gradient**: Never start at 0% (credit initial momentum: Step 1 initialized = 20%).
2. **Smart Defaults**: Pre-fill common choices in forms.
3. **Endowment / Value Before Gate**: Let users explore before presenting barriers.
4. **Evaluative Ease**: Never show ambiguous ranges; show exact values.
5. **Competence Feedback**: Measure real output/mastery over arbitrary badge theater.
6. **Slop Audit**: Run UX/UI review to eliminate residual decorative clutter.

---

## 3. Enforcement Routine for All Prompts
1. **Solve Canonically First**: Solve problems canonically by default unless stated otherwise.
2. Check `src/styles/tokens.css` for existing design tokens before touching any view or component. If tokens are missing or incomplete, define tokens first.
3. Check `src/components/ui/` for an existing canonical component first; build canonical components when repeatable.
4. Build components strictly consuming CSS variables—never hardcode raw hex colors or arbitrary pixel values.
5. Verify in the browser immediately.
