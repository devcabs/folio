---
name: ui-standards
description: >-
  Consolidated UI standards enforcing the 4-state interactive matrix, typography hierarchy, fluid clamp scaling, 4px/8px geometry scale, and elevation depth. Apply when building or styling interactive components (buttons, links, form inputs, cards, roadmap nodes) or configuring typography, spacing, or elevation.
trigger: model_decision
---

# UI Standards & Component Guidelines

## 0. Canonical Component-First Mandate
- **Solve Canonically First**: Always solve UI requirements canonically by default unless stated otherwise.
- **Find a Canonical Component First**: Before creating or modifying UI elements, first check `src/components/ui/` (e.g. `Button`, `Drawer`, `Modal`, `PageTitle`, `Breadcrumb`, `Toast`, `StatusPill`). Reuse and compose existing canonical components rather than generating ad-hoc or inline variants.
- **Build Canonical When Repeatable**: When a repeatable component or interactive pattern is needed and does not yet exist or is fragmented, create the canonical component first in `src/components/ui/` with complete token adherence, 4-state matrix, and accessibility, then consume it.

---

## 1. The 4-State Interactive Matrix
Every clickable or interactive element must support and visibly differentiate:
1. **Default State**: Accessible contrast ($\ge 4.5:1$ text, $\ge 3:1$ graphics).
2. **Hover State**: Subtle surface shift or elevation lift (`transform: translateY(-2px)`).
3. **Active / Pressed State**: Tactile depression feedback (`transform: translateY(1px)` or scale down).
4. **Focus-Visible / Active / Selected State**: Universal Zero Outline Policy (`outline: none`). Visual differentiation is communicated through subtle surface color shift, typography contrast, or tactile depression, strictly avoiding outline rings or halos.
5. **Disabled / Loading State**: Reduced opacity (`0.5`), disabled cursor, inline spinner or skeleton placeholder without layout shifts.

---

## 2. Typography & Hierarchy System (Strict Token Compliance)
- **Typography System Tokens (from `src/styles/tokens.css`)**:
  - Display / Headings / Section Titles / Flourishes: `var(--font-display)` or `var(--font-serif)`
  - Interface / Body / Narrative / Badges / Buttons: `var(--font-sans)` or `var(--font-body)`
  - Codes / Data / Timestamps / Monospace: `var(--font-mono)`
- **Zero Hardwired Fonts & Token-Only Mandate**:
  - NEVER push, mandate, or declare specific font family names in rules, CSS modules, components, or inline styles.
  - All typography declarations MUST strictly consume the established CSS custom properties from `src/styles/tokens.css`.
- **Editorial Tracking & Line-Height Standards**:
  - Tightened Editorial Tracking: `var(--tracking-tight)` (`-0.025em`) for display and headings.
  - Line Heights: `var(--leading-tight)` (`1.15`) for compact headlines, `var(--leading-snug)` (`1.25`) for subtitles, and `var(--leading-normal)` (`1.55`) for narrative body.
- **Fluid Typography Roles**:
  - Hero / Primary Page Anchor: `var(--text-display)` (`clamp(2.25rem, 5vw + 0.5rem, 3.75rem)`) (override: `var(--text-display-mobile)` for `<640px`)
  - Hero Subtitle: `var(--text-subtitle-hero)` (`clamp(1rem, 1.3vw, 1.15rem)`)
  - Section Headings & Sequence Nodes: `var(--text-title)` (`clamp(1.35rem, 2.5vw + 0.3rem, 1.85rem)`)
  - Card Titles & Lead Narrative: `var(--text-subhead)` (`1.125rem`)
  - Standard Body, Nav Links & Buttons: `var(--text-body)` (`1rem`)
  - Metadata, Badges, Kickers, Citations: `var(--text-caption)` (`0.8125rem`)

---

## 3. Spacing & Geometry Scale
- **Strict 4px/8px Rhythm**: All margins, paddings, and gaps must use tokens:
  - `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-6: 24px`, `--space-8: 32px`, `--space-12: 48px`, `--space-16: 64px`.
- **Button Geometry**:
  - Button width roughly double button height.
  - Generous horizontal padding (`px-5`, `py-2.5`).
- **Elevation Depth**:
  - Light mode shadows must be soft and high-blur (`0 8px 24px -4px rgba(0, 0, 0, 0.08)`).
  - Dark mode surfaces must elevate via lighter background tones, never black shadows.
