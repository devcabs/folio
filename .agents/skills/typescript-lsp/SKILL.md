---
name: typescript-lsp
description: Leverages TypeScript language server, strict typing, and symbol references to eliminate runtime and type errors.
---

# TypeScript LSP & Static Analysis

> **PREVALENCE NOTICE:** This skill operates strictly under [docs/folio-engine/reference/02-data-contracts.md](file:///Users/francisdave/Documents/folio/docs/folio-engine/reference/02-data-contracts.md). Type contracts for sequence nodes, canvas blocks, charts, and data sources in `src/types/` must strictly adhere to engine specifications.

## Core Capabilities

1. **Type Contract Enforcement**:
   - Validate and maintain strict type contracts across `src/types/` (`canvas.ts`, `chart.ts`, `node.ts`, `source.ts`, `edge.ts`).
   - Eliminate `any` types and ambiguous type casts.

2. **Symbol Renaming & Refactoring**:
   - Perform safe, cross-module refactors utilizing symbol definitions and references.
   - Ensure exported library types in `src/index.ts`, `src/edge.ts`, and `src/diagnostics.ts` remain backward compatible and strongly typed.

3. **Compiler Diagnostics**:
   - Resolve TypeScript compiler diagnostics (`tsc --noEmit`) before completing any task.
