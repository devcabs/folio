# Folio Engine Documentation

Welcome to the documentation for **Folio Engine** (`@devcabs/folio-engine`), a modular, installable React 19 application engine and component library for technical scrollytelling, parametric stepped sequences, recursive document canvases, and in-browser vector chart studios.

---

## 🧭 Documentation System: Diátaxis Framework

This documentation is organized strictly according to the **Diátaxis Framework**, an industry-standard technical documentation architecture that separates documentation based on reader intent and cognitive mode:

```
                  [ Practical / Action ]
                       How-To Guides
                 (Problem-solving recipes)
                            │
  [ Learning ]              │              [ Information ]
   Tutorials  ──────────────┼──────────────   Reference
(Guided hands-on)           │             (Exhaustive facts)
                            │
                       Explanation
                  (System architecture)
                [ Theoretical / Cognition ]
```

| Quadrant | Purpose | When to Use | Target Destination |
| :--- | :--- | :--- | :--- |
| **Tutorials** | Learning-oriented | "I am new here and want to build a working experience step-by-step." | [tutorials/](file:///Users/francisdave/Documents/folio/docs/folio-engine/tutorials/) |
| **How-To Guides** | Goal-oriented | "I have a specific task or problem to solve in production." | [how-to/](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/) |
| **Reference** | Information-oriented | "I need exact API signatures, props, types, and configuration contracts." | [reference/](file:///Users/francisdave/Documents/folio/docs/folio-engine/reference/) |
| **Explanation** | Understanding-oriented | "I want to understand the underlying architecture, math, and design decisions." | [explanation/](file:///Users/francisdave/Documents/folio/docs/folio-engine/explanation/) |

---

## 📂 Repository Documentation Map

All engine-specific documentation is consolidated inside the [`docs/folio-engine/`](file:///Users/francisdave/Documents/folio/docs/folio-engine/) subfolder:

```
docs/
├── README.md                                    # This navigation root
└── folio-engine/                                # Folio Engine technical documentation
    ├── README.md                                # Engine overview and Diátaxis index
    ├── tutorials/                               # Learning guides
    │   ├── 01-getting-started.md                # Quickstart: install, configure, render
    │   └── 02-building-a-stepped-canvas.md      # Building sequence track + document canvas
    ├── how-to/                                  # Goal-oriented solution recipes
    │   ├── 01-dual-channel-content-db.md        # Live vs. draft Supabase persistence
    │   ├── 02-google-sheets-chart-sync.md       # In-browser chart studio + live sheet sync
    │   ├── 03-edge-pre-baking-and-kv-cache.md   # Cloudflare Pages Functions + KV cache
    │   ├── 04-theming-and-design-tokens.md      # CSS design tokens, fonts, and themes
    │   └── 05-diagnostics-and-testing.md        # Verifying integrity, purity, and schemas
    ├── reference/                               # Exhaustive technical specifications
    │   ├── 01-public-api-exports.md             # Package entrypoints and exported APIs
    │   ├── 02-data-contracts.md                 # TypeScript models and Zod schemas
    │   ├── 03-components.md                     # Component catalog and props interfaces
    │   ├── 04-hooks-and-contexts.md             # Custom React hooks and state contexts
    │   ├── 05-services-and-utilities.md         # Services, storage adapters, and math utilities
    │   └── 06-configuration.md                 # EngineConfig, env vars, and build options
    └── explanation/                             # Deep architectural explanations
        ├── 01-system-architecture.md            # High-level architecture and data flows
        ├── 02-dual-mode-distribution.md         # Standalone app vs. npm library distribution
        ├── 03-stepped-sequence-bezier-math.md   # Serpentine track geometry and scroll sync
        ├── 04-recursive-document-ast.md         # Recursive block AST model and operations
        └── 05-coordinator-mode-concurrency.md   # Distributed mutex locks and undo/redo ledger
```

---

## ⚡ Quick Links by Role

- **For Application Developers Consuming Folio**: Start with [Tutorial 01: Getting Started](file:///Users/francisdave/Documents/folio/docs/folio-engine/tutorials/01-getting-started.md) and review [Public API Exports](file:///Users/francisdave/Documents/folio/docs/folio-engine/reference/01-public-api-exports.md).
- **For Content & Editorial Coordinators**: Read [How-To: Dual-Channel Content DB](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/01-dual-channel-content-db.md) and [Explanation: Coordinator Mode](file:///Users/francisdave/Documents/folio/docs/folio-engine/explanation/05-coordinator-mode-concurrency.md).
- **For Designers & Frontend Engineers**: Read [How-To: Theming and Design Tokens](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/04-theming-and-design-tokens.md) and [Component Catalog](file:///Users/francisdave/Documents/folio/docs/folio-engine/reference/03-components.md).
- **For DevOps & Cloud Architects**: Read [How-To: Edge Pre-Baking & KV Cache](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/03-edge-pre-baking-and-kv-cache.md) and [Explanation: System Architecture](file:///Users/francisdave/Documents/folio/docs/folio-engine/explanation/01-system-architecture.md).
