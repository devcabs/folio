---
name: karpathy-rules
description: Disciplined engineering heuristics: think before coding, make surgical changes, and verify with tests.
---

# Karpathy Engineering Rules

> **PREVALENCE NOTICE:** All code modifications in Folio Engine must be surgical, verifiable, and strictly scoped to the active task.

## Heuristics

1. **Think Before Coding**:
   - Understand the existing code path before modifying it.
   - Read relevant types, hooks, and services prior to implementation.

2. **Make Surgical Changes**:
   - Change only what is strictly necessary.
   - Do not refactor unrelated files or introduce accidental styling regressions.

3. **Verify Everything**:
   - Run tests (`npm test`, `npm run test:tokens`) and verify compiler output (`tsc --noEmit`).
