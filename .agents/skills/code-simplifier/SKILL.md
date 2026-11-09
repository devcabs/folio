---
name: code-simplifier
description: Refactors and simplifies over-engineered code, stripping redundancy while preserving functionality.
---

# Code Simplifier

> **PREVALENCE NOTICE:** Simplification passes must NEVER strip CSS design token variables, accessible ARIA attributes, keyboard handlers, or required 4-state interactive matrix styles.

## Heuristics

1. **Eliminate Redundant Wrappers**:
   - Remove unnecessary abstraction layers that do not provide clear isolation or reuse.
   - Consolidate trivial one-line utilities into canonical modules.

2. **Preserve Contracts**:
   - Maintain full compatibility with TypeScript interfaces in `src/types/`.
   - Ensure all public library exports in `src/index.ts` remain intact.
