---
name: code-review
description: Automated, structured code review verifying architectural compliance, design tokens, accessibility, and engine integrity.
---

# Code Review Standard

> **PREVALENCE NOTICE:** All reviews must verify compliance with the Design System First token gate, zero outline policy, and Folio Engine data integrity constraints.

## Review Checklist

1. **Design System & CSS Token Compliance**:
   - Are styles scoped in pure CSS modules (`[Component].module.css`)?
   - Do all colors, typography, spacing, and transitions consume `var(--...)` custom properties from `src/styles/tokens.css`?
   - Is the Universal Zero Outline Policy enforced (`outline: none;` on active/focused elements)?

2. **TypeScript & Data Contracts**:
   - Are types aligned with `src/types/`?
   - Are exports properly registered in `src/index.ts`, `src/edge.ts`, or `src/diagnostics.ts` if intended for public library consumption?

3. **Architecture & Performance**:
   - Are components small, single-purpose, and composed canonically?
   - Are expensive calculations or transforms properly memoized?
   - Does `npm run test:tokens` pass with 100% token purity?
