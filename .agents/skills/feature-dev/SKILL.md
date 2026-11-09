---
name: feature-dev
description: Feature development pipeline adhering to Folio Engine architecture, design tokens, and rigorous verification gates.
---

# Feature Development Pipeline

> **PREVALENCE NOTICE:** This skill operates strictly under [docs/folio-engine/README.md](file:///Users/francisdave/Documents/folio/docs/folio-engine/README.md). All feature development must respect design token discipline and quality verification gates.

Implements an end-to-end disciplined feature engineering pipeline aligned with Folio Engine's architecture (Vite + React 19 + TypeScript + CSS Design Tokens).

## 5-Step Agentic Feature Pipeline

1. **Explore Architecture & Data Contracts**:
   - Consult engine documentation in `docs/folio-engine/`.
   - Align TypeScript contracts with `src/types/` and schema definitions.
   - Inspect existing canonical UI components in `src/components/ui/`.

2. **Design System & Token Verification**:
   - Verify all required color, typography, spacing, and elevation tokens exist in `src/styles/tokens.css`.
   - Never introduce hardcoded colors or ad-hoc font families.

3. **Atomic Scaffolding**:
   - Implement components using scoped CSS modules (`[Component].module.css`).
   - Implement the complete 4-state interactive matrix (Default, Hover, Active, Focus-Visible).
   - Enforce the Universal Zero Outline Policy (`outline: none;`).

4. **Testing & Quality Gates**:
   - Write unit and purity tests in `tests/`.
   - Run `npm run test:tokens` to verify token alias and purity integrity.
   - Run `npm test` and `npm run build` to ensure zero compilation or type errors.

5. **Review & Integration**:
   - Verify accessibility compliance (WCAG 2.1 AA).
   - Review changes against coding standards in `.agents/rules/coding-standards.md`.
