---
name: vercel-react-best-practices
description: React 19 performance patterns, modern component composition, and lifecycle optimization guidelines.
---

# React 19 Best Practices & Performance

> **PREVALENCE NOTICE:** Folio Engine is a modern React 19 dual-mode engine (bundled as both an npm library and a Vite application).

## Optimization Guidelines

1. **Render Optimization**:
   - Avoid unnecessary re-renders with strategic memoization and derived state calculations.
   - Use `useTransition` and `useDeferredValue` for smooth visual interactions during data updates.

2. **Component Composition**:
   - Favor composition over deep prop drilling.
   - Co-locate state near components that consume it.

3. **Bundle & Export Efficiency**:
   - Maintain clean tree-shakeable exports in `src/index.ts`, `src/edge.ts`, and `src/diagnostics.ts`.
