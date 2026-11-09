---
name: frontend-design
description: Frontend UI/UX design standards enforcing distinctive visual aesthetics, token-first styling, and calm focus interactions.
---

# Frontend Design Standards

> **PREVALENCE NOTICE:** Never generate ad-hoc styles or premature UI markup before tokens are committed to `src/styles/tokens.css`.

## Core Design Principles

1. **Distinctive Aesthetic & Editorial Restraint**:
   - Avoid generic AI styles (arbitrary purple gradients, default system fonts, unnecessary decorative blur).
   - Use high typographic contrast, generous spacing, and deliberate content hierarchy.

2. **Design Tokens First**:
   - All colors must consume `var(--folio-...)` or `var(--color-node-...)` tokens.
   - All typography must consume `var(--font-display)`, `var(--font-sans)`, or `var(--font-mono)`.
   - Never hardcode arbitrary hex colors or pixel dimensions.

3. **4-State Interactive Matrix & Calm Focus**:
   - Implement Default, Hover, Active, Focus-Visible, and Disabled states.
   - Enforce the Universal Zero Outline Policy: `outline: none;` on active or focused states.
