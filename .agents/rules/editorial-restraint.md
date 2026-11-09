# Mandatory Rule: Editorial Restraint & Anti-AI-Slop Standard

> **CRITICAL DIRECTIVE**: You MUST enforce editorial restraint, subtraction, and quiet confidence. Under NO circumstances may you create cluttered, hyper-verbose, ornamental "AI-slop" interfaces with redundant badges, nested docks, rainbow borders, or meta-expository text.

---

## 1. The Single-Primary-Subject Rule (Anti-Kitchen-Sink Budget)
- **1 Anchor & 1 Action**: Every viewport fold or screen section must have exactly **ONE** primary visual anchor and **ONE** primary interactive action.
- **No Pattern Stacking**: Architectural layout patterns (Bento Grids, Continuous Tracks, Floating Bars, Lightbox Overlays) are **mutually exclusive per viewport**. They must be distributed sequentially along the page journey, NEVER nested inside one another (e.g., no floating dock inside a bento box; no auxiliary pill strips above an editorial hero).
- **The Anti-Duplication Boundary**: If an entity (Brand Logo, Brand Name, Primary Status Badge, or Main Navigation Links) is rendered in the global header (`AppHeader`), it is **strictly forbidden** from appearing in the main viewport or hero section.

---

## 2. The Zero-Exposition & Copy Word-Budget Rule (Show, Don't Narrate)
- **Ban Meta-Narrative**: Copy must NEVER explain the website itself, what it replaces, or how to use it.
  - BANNED phrases: *"Welcome to..."*, *"Official gateway for..."*, *"Replacing static compliance folders..."*, *"Click below to explore..."*, *"Come walk with me..."*.
- **Hard Word Budgets**:
  - **Hero Headline**: Maximum **8 words** (punchy, editorial, active).
  - **Hero Subtitle**: Maximum **22 words** (1 single sentence, zero bureaucratic jargon).
  - **Guide Interventions / Notes**: Maximum **10 words** per callout.
  - **Section Descriptions**: Maximum **15 words**.

---

## 3. Source-Bound Heuristics (Zero Synthetic Widgets)
- **Zero Badge Theater**: UX heuristics (Goal Gradient, Social Proof, Competence Feedback) must **NEVER** be satisfied by manufacturing hardcoded fake summary cards (e.g., "Access: 100% Mapped", "Quality: Active Projects").
- **Data Grounding**: Every metric, chip, or progress state must bind directly to authentic data fields in `src/data/node-nodes.json` or active Content DB stores. If live data does not exist, the element MUST NOT be rendered.
- **Spatial Separation**: Progression belongs inside the **Roadmap** or sequence track where the milestones actually live, NEVER as a detached summary dashboard preceding the content.

---

## 4. The Law of Subtraction & Ornament Ceiling
- **Negative Space is the Feature**: Modern technical editorial is defined by large typography contrast, generous whitespace (minimum `var(--space-12)` between modules), and razor-sharp content hierarchy—not decorative density.
- **Max 1 Visual Ornament per Screen**:
  - If a subtle ambient mesh glow exists, **no rainbow borders, no pulsing dots, and no glass blur stacks** are permitted in the same view.
  - BANNED: Conic rotating rainbow borders (`.btnRainbow`), emoji labels in navigation, multiple nested borders.
- **The Subtraction Test**: Before declaring any UI task done, the agent must ask: *"What 2 elements can be deleted from this view without losing any user utility?"* If elements were added purely to decorate or check off a buzzword, strip them immediately.

---

## 5. Universal Zero Outline Policy for Active/Selected/Focused Components (Calm Focus Standard)
- **Zero Outline Halo on Active, Selected, or Focused Elements**: Interactive components (buttons, links, search pills, inputs, tabs, status pills, roadmap nodes, cards) must **NEVER** render an intrusive outline border, outline halo ring, or jarring border-color jump on active, selected, or focused state (`:active`, `:focus`, `:focus-within`, `:focus-visible`, `[aria-selected="true"]`).
- **The "Just Let It Be" Rule**: Maintain calm, natural resting surfaces with `outline: none;` (or `outline: 0;`). Interactive focus or selection feedback belongs to subtle background tone shifts, typography color shifts, or tactile micro-depressions (`transform`), never intrusive container outlines or browser ring halos.

---

## 6. Absolute Ban on Horizontal Dividing Lines for Section Separations
- **Zero Horizontal Lines**: Never use horizontal divider lines (`border-bottom`, `border-top`, `<hr>`, hair-line dividers) to separate sections, headers, subchapters, or content blocks.
- **Whitespace Over Dividers**: Content sections must breathe naturally through deliberate spatial intent and whitespace (`var(--space-flow-block)`, `var(--space-flow-section)`, `var(--space-flow-layout)`). Dividing lines are a relic of bureaucratic web design; modern layouts rely on typographic hierarchy and generous vertical cadence.

---

## 7. Uniform Administrative Edit Button Standard (Zero Custom Labels)
- **Strictly '✎ Edit'**: In Developer Mode and across all administrative affordances, inline edit buttons must strictly display only the text **"Edit"** with the edit icon (`✎ Edit`).
- **Zero Custom Button Labels**: Custom descriptive strings (e.g., *"Edit Hero Narrative"*, *"Edit Hook"*, *"Edit Station Source"*, *"Edit Text"*) are **strictly forbidden** on edit buttons.
- **Dynamic Content DB Authority**: All editable text elements must be dynamically identified and referenced from the client Content DB (`src/utils/contentDb.ts` / `useContent`), with hardcoded strings serving solely as initial default fallbacks.

---

## 8. Canonical Solution & Component-First Mandate
- **Solve Canonically First**: Always solve requirements canonically by default unless stated otherwise.
- **Find a Canonical Component First**: Before crafting UI markup, check `src/components/ui/` and established shared components. Prevent one-off, duplicate, or ad-hoc component bloat.
- **Build Canonical When Repeatable**: If a repeatable component is needed, construct the canonical component first with design tokens and accessibility, and reuse it everywhere.
