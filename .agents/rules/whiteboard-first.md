---
name: whiteboard-first
description: >-
  Requires all significantly large new epics built from scratch to be brainstormed, broken down, and documented as a PRD inside docs/whiteboard/<epic-number>-<slug>/ before authoring formal task files in docs/task/.
trigger: always_on
---

# Mandatory Rule: Whiteboard-First Epic Discovery & PRD Gate

> **CRITICAL DIRECTIVE**: Never jump straight into `docs/task/` or code when starting a **significantly large epic from scratch**. All major new epics MUST be brainstormed, broken down, and documented as a Product Requirements Document (PRD) inside `docs/whiteboard/` and explicitly discussed with the user **before** writing formal task specs in `docs/task/`.

---

## 1. When This Rule Applies

### Required (Whiteboard-First Mandatory)
Apply this workflow whenever the user initiates a **large, net-new epic** from scratch, including:
- New architectural subsystems or core capabilities (e.g., dynamic nested pages, new persistence channels, new editor studios).
- Multi-phase features spanning 3+ subtasks across data contracts, routing/services, and UI.
- Significant UX paradigm shifts or schema evolutions affecting `@devcabs/folio-engine` consumers.

### Exempt (Go Directly to Execution or `docs/task/`)
Skip the whiteboard gate for:
- Bug fixes, regressions, and targeted patches.
- Small single-component enhancements or token/copy tweaks.
- Routine maintenance, dependency bumps, or executing an **already-approved** task from `docs/task/`.

---

## 2. Mandatory 4-Step Whiteboard Workflow

### Step 1: Plain-English Brainstorm
- Explore the problem space, key design forks, and pros/cons with the user in clear, accessible language before locking architecture.
- Surface edge cases (data loss, mobile UX, backward compatibility, orphan states) early while decisions are cheap to change.

### Step 2: Create the Whiteboard Folder & PRD
- Check the latest epic number in `docs/task/` (e.g., `TASKS-EPIC-12.md`) and assign the next sequential number (`N`).
- Create a dedicated folder:
  `docs/whiteboard/EPIC-<N>-<kebab-slug>/`
- Author `docs/whiteboard/EPIC-<N>-<kebab-slug>/<N>-PRD.md` containing:
  1. **Problem Statement**
  2. **Goals & Explicit Non-Goals**
  3. **Locked-In Product Decisions** (table of agreed choices & rationale)
  4. **User Flows & Experience** (reader & editor perspectives)
  5. **High-Level Architectural Direction**
  6. **Edge Cases & Guardrails**
  7. **Open Questions for Refinement**
  8. **Draft Phase Outline** *(explicitly marked as not yet tasked)*
- Additional exploratory notes, diagrams, or trade-off comparisons for the epic may also live inside the same `docs/whiteboard/EPIC-<N>-<kebab-slug>/` folder.

### Step 3: Discussion & Sign-Off Gate
- Iterate on the whiteboard PRD with the user until open questions are resolved and the user explicitly signs off on moving to formal task breakdown.
- **Hard Gate:** Do **NOT** create `docs/task/TASKS-EPIC-<N>.md`, `docs/task/<N>.x-*.md`, or start feature implementation until the whiteboard PRD is approved.

### Step 4: Promote to `docs/task/`
- Once approved, update the PRD status from `Whiteboard Draft` to `Approved — Promoted to docs/task/`.
- Decompose the approved PRD into atomic, phased task specs in `docs/task/` (`TASKS-EPIC-<N>.md` + `<N>.1-*.md`, `<N>.2-*.md`, etc.), linking back to the originating `docs/whiteboard/EPIC-<N>-<kebab-slug>/<N>-PRD.md` as the product source of truth.
