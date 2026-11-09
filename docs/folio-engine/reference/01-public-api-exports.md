# Reference: Public API & Package Exports

This document details the public interface and module entrypoints exported by `@devcabs/folio-engine`.

---

## 📦 Package Entrypoints

The library exposes three subpath exports in `package.json`:

```
@devcabs/folio-engine                # Root client library (Components, hooks, DOM)
├── @devcabs/folio-engine/edge        # Edge & Cloudflare Worker entrypoint (Zero-DOM)
├── @devcabs/folio-engine/diagnostics # Contract validation & CI setup verification
└── @devcabs/folio-engine/style.css   # Consolidated CSS design tokens and component styles
```

---

## 1. Root Entrypoint (`@devcabs/folio-engine`)

Import via:
```typescript
import { ... } from '@devcabs/folio-engine';
```

### Application Shell
- **`App`**: Complete standalone application shell rendering header, hero section, serpentine sequence track, document canvas, and footer.

### Data Contracts & Types
- **Node Contracts**: `NodeItem`, `NodeCode`, `NodeHeroImage`, `CanonicalPhoto`, `SourceItem`, `StageStory`.
- **Canvas AST Contracts**: `CanvasElement`, `CanvasElementType`, `CanvasElementBase`, `SectionElement`, `SubsectionElement`, `CanvasLeafElement`, `CanvasChildElement`, `TextElement`, `PhotoElement`, `GalleryElement`, `ChartElement`, `NodeCanvasDocument`.
- **Chart Contracts**: `ChartType`, `ChartConfig`, `ChartSeries`, `ScatterPoint`, `HistogramBin`, `ChartVisualConfig`.
- **Developer & History Contracts**: `CoordinatorLock`, `HistoryEntry`, `HistoryLedger`, `DraftDiff`.
- **Navigation Contracts**: `NavItem`, `SubchapterNav`, `BreadcrumbItem`.

### Engine Configuration & Store
- **`createDefaultEngineConfig(overrides?: Partial<EngineConfig>): EngineConfig`**: Default factory.
- **`getEngineConfig(): EngineConfig`**: Retrieves active engine configuration singleton.
- **`setEngineConfig(config: Partial<EngineConfig>): EngineConfig`**: Merges overrides into active configuration.
- **`resetEngineConfig(): void`**: Restores factory defaults.
- **`getStorageNamespace(): string`**: Returns active storage namespace (default `'folio'`).
- **`getStorageKey(key: string, namespace?: string): string`**: Computes namespaced storage key (e.g. `folio_app_pin`).

### Components (Catalog)
- **UI Primitives**: `Button`, `Modal`, `Drawer`, `StatusPill`, `Breadcrumb`, `ParametricShape`, `EditableText`, `RevolvingButton`, `DrawerTier`, `TieredSlider`, `FAB`, `AccordionSection`, `Toast`.
- **Layout Shell**: `AppHeader`, `AppFooter`, `EditorialSection`, `EditorialSidebar`, `HeroWelcome`, `SearchField`.
- **Stepped Sequence**: `RoadmapTrack`, `RoadmapSection`, `RoadmapNode`, `PhotoFlightEngine`.
- **Document Canvas**: `DocumentCanvas`, `NodeCanvas`, `CanvasSection`, `CanvasSubsection`, `CanvasText`, `CanvasPhoto`, `CanvasGallery`, `CanvasChart`, `HeroPhoto`.
- **Vector Chart Studio**: `ChartRouter`, `BarChart`, `LineChart`, `DonutChart`, `ScatterPlot`, `HistogramChart`, `ChartConfigDrawer`, `ChartLegend`, `ChartTooltip`, `RangePreviewMatrix`, `ChartTableModal`.
- **Developer Chrome**: `DevModeBadge`, `DevPinModal`, `DevPublishModal`, `DevLockBlockedModal`, `DevExitConfirmModal`, `UniversalEditModal`, `HistoryHubModal`.

### Hooks
- **`useDocumentCanvas(documentId: string)`**: Manages document AST retrieval and block mutations.
- **`useNodeCanvas(nodeId: string)`**: Waypoint-specific canvas hydration hook.
- **`useDeveloperMode()`**: Coordinates coordinator mode, PIN entry, and mutex state.
- **`useUndoRedo()`**: Provides in-memory undo/redo dispatchers and stack counts.
- **`useScrollspy()`**: Intercepts active viewport waypoint along the serpentine track.
- **`useHashRoute()`**: Synchronizes browser URL `#hash` with active sequence waypoints.
- **`useScroll()`**: Tracks window scroll position and scroll velocity.
- **`useChartTooltip()`**: Manages hover coordinates and data formatting for SVG chart tooltips.
- **`useDynamicSectionNumbers()`**: Automatically calculates two-digit section numbers (`01`, `02`).
- **`useContent()`**: Reactive hook for reading and editing Content DB text values.
- **`useLightboxHistory()`**: Manages browser back-button behavior for fullscreen media lightboxes.

### Services & Utilities
- **`canvasLayoutService`**: AST manipulation utilities (add, move, delete, renumber).
- **`chartSourceService`**: Resolves chart datasets from pre-baked JSON or live Google Sheets endpoints.
- **`draftService`**: Dual-channel persistence bridge saving drafts locally and syncing to Supabase.
- **`devLockService`**: Distributed coordinator mutex lock manager.
- **`historyService`**: Append-only ledger recording coordinator actions.
- **`undoRedoService`**: In-memory state history stack.
- **`unsavedChangesService`**: Tracks dirty drafts and intercepts uncommitted browser exits.
- **`contentDb`**: Local key-value text database for dynamic copy authoring.
- **`smoothScrollTo(target: string | number)`**: Eased programmatic scrolling.
- **`lockScroll() / unlockScroll()`**: Body scroll management for modal and drawer overlays.
- **`parseAccentText(text: string): React.ReactNode`**: Parses markdown accent syntax (`*highlight*`).

---

## 2. Edge Entrypoint (`@devcabs/folio-engine/edge`)

Import via:
```typescript
import { ... } from '@devcabs/folio-engine/edge';
```

Designed with **zero DOM references** and **zero React imports**, safe for Cloudflare Workers, Cloudflare Pages Functions, Vercel Edge Middleware, and Node.js pre-bake scripts.

### Exported Functions & Services
- **`compilePublicNodePayload(nodeId: string, snapshot: unknown, options?: unknown): PublicNodePayload`**: Compiles node metadata, AST canvas, chart datasets, and source attachments into an edge payload.
- **`compilePublicPortalManifest(nodes: NodeItem[], options?: unknown): PublicPortalManifestPayload`**: Compiles navigation manifest of available waypoints.
- **`gatherSourceMetadata(nodeId: string, options?: unknown): Record<string, SyncedSourceMetadata>`**: Gathers external source attachments.
- **`getMediaUrl(fileId: string, format?: 'webp' | 'jpeg', size?: number): string`**: Generates edge CDN proxy URLs for Google Drive or Cloudflare Images.

### Exported Edge Types & Schemas
- `PublicNodePayload` & `PublicNodePayloadSchema`
- `PublicPortalManifestPayload` & `PublicPortalManifestPayloadSchema`
- `CachedIndicatorDataset` & `CachedIndicatorDatasetSchema`
- `SyncedSourceMetadata` & `SyncedSourceMetadataSchema`

---

## 3. Diagnostics Entrypoint (`@devcabs/folio-engine/diagnostics`)

Import via:
```typescript
import { ... } from '@devcabs/folio-engine/diagnostics';
```

### Exported Functions
- **`verifyEngineSetup(options?: SetupOptions): Promise<EngineSetupResult>`**: Performs pre-flight integrity audits on persistence credentials, configuration parameters, and schema compliance.

### Exported Zod Schemas
- `EngineConfigSchema`
- `EngineBrandingConfigSchema`
- `NodeCanvasDocumentSchema`
- `PublicNodePayloadSchema`
- `PublicPortalManifestPayloadSchema`
- `CachedIndicatorDatasetSchema`
- `SyncedSourceMetadataSchema`
