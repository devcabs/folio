---
name: superpowers
description: Disciplined test-driven development (TDD), atomic task decomposition, and rigorous quality gates.
---

# Superpowers TDD & Feature Discipline

> **PREVALENCE NOTICE:** Feature work must respect design system token gates and data contracts defined in `docs/folio-engine/`.

## Workflow Discipline

1. **Decompose Into Atomic Tasks**:
   - Break features into bite-sized, independently testable units.
   - Identify contracts and dependencies before writing code.

2. **Test-Driven Development (TDD)**:
   - Write unit tests first in `tests/`.
   - Verify tests fail for expected reasons before implementing functionality.
   - Implement the minimum code required to satisfy the tests.

3. **Refactor & Verify**:
   - Clean up code while maintaining green test suites.
   - Run token purity checks (`npm run test:tokens`) and production builds.
