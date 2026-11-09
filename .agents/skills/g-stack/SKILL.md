---
name: g-stack
description: Holistic product development workflow covering technical planning, taste curation, token locking, implementation, and QA.
---

# G-Stack Product Workflow

> **PREVALENCE NOTICE:** Design system curation and architectural clarity MUST precede code generation.

Applies disciplined, holistic product judgment across the lifecycle of Folio Engine features: *Clarify Scope &rarr; Curate Taste &rarr; Lock Tokens &rarr; Scaffolding &rarr; Test & Verify &rarr; UX Audit*.

## Workflow Steps

1. **Clarify Scope & Value**:
   - Define exact user problem and technical requirements.
   - Establish what the component or engine feature will explicitly NOT do.

2. **Curate Taste & Visual Hierarchy**:
   - Choose clear visual benchmarks with high typographical contrast.
   - Enforce generous whitespace and deliberate layout hierarchy.

3. **Lock Tokens**:
   - Ensure all necessary CSS custom properties are committed to `src/styles/tokens.css`.

4. **Atomic Scaffolding**:
   - Build canonical components with complete 4-state interactive matrix.

5. **Verification & Audit**:
   - Verify token aliases (`npm run test:tokens`), unit tests (`npm test`), and type safety.
