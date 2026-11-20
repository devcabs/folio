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
- **Page Tree Contracts**: `PageNode`, `PageRegistry`, `PageAncestorItem`, `ResolvePathResult`, `PageMatchCandidate`, `PageNodeSchema`, `PageRegistrySchema`, `PAGE_ID_REGEX`, `PAGE_SLUG_REGEX`.
- **Canvas AST Contracts**: `CanvasElement`, `CanvasElementType`, `CanvasElementBase`, `SectionElement`, `SubsectionElement`, `CanvasLeafElement`, `CanvasChildElement`, `TextElement`, `PhotoElement`, `GalleryElement`, `ChartElement`, `PdfElement`, `DocumentsElement`, `PageLinkElement`, `NodeCanvasDocument`, `isPdfElement`, `isDocumentsElement`.
- **Source & Document Sync Contracts**: `SyncedSourceItem`, `SyncedDocumentItem`, `DriveDocumentFile`, `DriveDocumentReconciliationResult`, `SyncFolderDocumentsResult`, `UseDriveDocumentSyncOptions`, `UseDriveDocumentSyncResult`.
- **Chart Contracts**: `ChartType`, `ChartConfig`, `ChartSeries`, `ScatterPoint`, `HistogramBin`, `ChartVisualConfig`.
- **Developer & History Contracts**: `CoordinatorLock`, `HistoryEntry`, `HistoryLedger`, `DraftDiff`.
- **Migration Contracts & Schemas**: `ContentMigration`, `CodeMigration`, `MigrationEntry`, `MigrationEntryInput`, `PendingMigrationReport`, `ContentMigrationSchema`, `CodeMigrationSchema`, `MigrationEntrySchema`, `PendingMigrationReportSchema`, `SEMVER_REGEX`.
- **Navigation Contracts**: `NavItem`, `SubchapterNav`, `BreadcrumbItem`.

### Engine Configuration & Store
- **`createDefaultEngineConfig(overrides?: Partial<EngineConfig>): EngineConfig`**: Default factory.
- **`getEngineConfig(): EngineConfig`**: Retrieves active engine configuration singleton.
- **`setEngineConfig(config: Partial<EngineConfig>): EngineConfig`**: Merges overrides into active configuration.
- **`resetEngineConfig(): void`**: Restores factory defaults.
- **`getStorageNamespace(): string`**: Returns active storage namespace (default `'folio'`).
- **`getStorageKey(key: string, namespace?: string): string`**: Computes namespaced storage key (e.g. `folio_app_pin`).

### Components (Catalog)
- **UI Primitives**: `Button`, `IconButton`, `Modal`, `ModalActions`, `Drawer`, `StatusPill`, `Breadcrumb`, `ParametricShape`, `EditableText`, `PageTitle`, `PageIcon`, `RevolvingButton`, `DrawerTier`, `TieredSlider`, `FAB`, `AccordionSection`, `Toast`, `InlineAlert`, `FormField`, `Input`, `Textarea`, `Select`, `Checkbox`, `SegmentedControl`, `DocumentIcon`, `EditIcon`, `TrashIcon`, `CloseIcon`, `SearchIcon`, `ArrowRightIcon`, `AlertCircleIcon`.
- **Layout Shell**: `AppHeader`, `AppFooter`, `EditorialSection`, `EditorialSidebar`, `HeroWelcome`, `SearchField`.
- **Stepped Sequence**: `RoadmapTrack`, `RoadmapSection`, `RoadmapNode`, `PhotoFlightEngine`.
- **Document Canvas**: `DocumentCanvas`, `NodeCanvas`, `CanvasSection`, `CanvasSubsection`, `CanvasText`, `CanvasPhoto`, `CanvasGallery`, `CanvasChart`, `CanvasPdf`, `CanvasDocuments`, `CanvasPageLink`, `HeroPhoto`.
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
- **`useDriveDocumentSync(nodeId: string, options?: UseDriveDocumentSyncOptions)`**: Synchronizes Google Drive PDF folders into `DocumentsElement` AST nodes.

### Services & Utilities
- **`pageTreeService`**: Normalized `PageNode` tree helpers (`generatePageId`, `sanitizeSlug`, `ensureUniqueSiblingSlug`, `validateSlug`, `createPageNode`, `updatePageNodeMetadata`, `getDescendantPageIds`, `countDescendantPages`, `cascadeDeleteSubtree`, `deriveSubpageOrderFromCanvas`, `buildPagePath`, `resolvePathToPage`, `getAncestorChain`, `buildTwoLevelNavTree`, `findSimilarPages`).
- **`driveDocumentSyncService`**: Google Drive PDF folder synchronization and reconciliation (`cleanDriveDocumentName`, `reconcileDriveDocuments`, `fetchDriveFolderPdfs`, `syncFolderDocuments`).
- **`canvasLayoutService`**: Pure AST manipulation utilities (add, move, delete, renumber) and direct KV draft/public canvas accessors.
- **`draftService`**: Cloudflare KV draft workspace persistence bridge (`GET / PUT /api/draft`, `POST /api/draft/init`).
- **`devLockService`**: Edge-authenticated Cloudflare KV coordinator mutex lock manager (`lock:coordinator`).
- **`historyService`**: Cloudflare KV revision history and two-phase atomic publish client (`/api/history`, `/api/publish`).
- **`undoRedoService`**: In-memory state history stack.
- **`unsavedChangesService`**: Tracks dirty drafts and intercepts uncommitted browser exits.
- **`contentDb`**: In-memory + React-hydrated key-value text accessor backed by Cloudflare KV (`portal:manifest` / `draft:workspace`).
- **`watermarkResolver`**: Single-source content watermark resolver reading strictly from `EngineConfig.contentVersion`.
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

### Exported Router & Handlers
- **`handleFolioEdgeRequest(request, env, ctx?, options?)`**: Universal Cloudflare edge router dispatching `/api/lock`, `/api/draft`, `/api/draft/init`, `/api/publish`, `/api/history`, `/api/history/restore`, `/api/public/manifest`, `/api/public/node/:nodeId`, and `/api/media/drive/:fileId`.
- **`resolveKVNamespace(env, options?)`**: Resolves the active `KVNamespace` (`options.kv`, `env[options.kvBinding]`, or `env.KV_ENGINE_PUBLIC`).
- **`handleCorsPreflight(options?)`**: Handles `OPTIONS /api/*` CORS preflight requests.
- **`handlePublishRoute`**, **`handlePublicNodeRoute`**, **`handlePublicManifestRoute`**, **`handleDriveMediaRoute`**: Direct route handlers.

### Exported Functions & Services
- **`compilePublicNodePayload(nodeId: string, snapshot: PublishedSnapshot): PublicNodePayload`**: Compiles a self-contained node AST payload with rewritten `/api/media/drive/:fileId` URLs and stripped `sheetUrl` values.
- **`compilePortalManifest(snapshot: PublishedSnapshot, options?: PreBakeCompileOptions): PublicPortalManifestPayload`**: Compiles the active portal manifest (`activeSnapshotId`, `nodeIds`, `pages`, `contentOverrides`).
- **`serializeManifestForHtmlScript`**, **`injectManifestIntoHtml`**, **`maybeInjectManifestResponse`**: Edge HTML middleware injecting `window.__FOLIO_MANIFEST__` into `text/html` responses for zero-wait deep-link cold boots.
- **`buildEdgeMediaUrl(fileId: string, options?)`** & **`buildEdgeSrcSet(fileId: string, widths?)`**: Generates edge CDN proxy URLs for Google Drive media.

### Exported Edge Types & Schemas
- `PublicNodePayload` & `PublicNodePayloadSchema`
- `PublicPortalManifestPayload` & `PublicPortalManifestPayloadSchema`
- `PageNode`, `PageRegistry`, `PageNodeSchema`, `PageRegistrySchema`, `PageLinkElementSchema`, `DraftWorkspaceUpdateRequest`
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
