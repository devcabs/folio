# Reference: Data Contracts & TypeScript Models

This document specifies the TypeScript interfaces and Zod validation schemas for all core data models in Folio Engine.

---

## 1. Sequence & Waypoint Contracts (`src/types/node.ts`)

### `NodeItem`
Represents an individual milestone or waypoint along the stepped sequence track:

```typescript
export interface NodeItem {
  id: string;                               // Unique identifier (e.g. 'architecture')
  index: number;                            // Sequential ordering rank (1..N)
  title: string;                            // Primary headline
  subtitle?: string;                        // Secondary explanatory subtitle
  summary?: string;                         // Brief introduction blurb
  tagline?: string;                         // Track card tagline
  accentColor: string;                      // CSS variable token or hex color
  accentTint?: string;                      // Subtle background tint color
  heroImage?: NodeHeroImage;                // Primary hero photography
  annotation?: string;                      // Contextual annotation or callout
  nodeNumber?: number;                      // Optional display number override
  stages?: StageStory[];                    // Sub-stage milestone steps
  sourceItems?: SourceItem[];               // Attached evidence or reference records
  metadata?: Record<string, unknown>;       // Arbitrary extensible key-value pairs
}
```

### `NodeHeroImage`
```typescript
export interface NodeHeroImage {
  src: string;                              // Image URL or edge proxy path
  alt: string;                              // Accessibility alternative description
  caption?: string;                         // Editorial caption displayed in lightbox
  showCaption?: boolean;                    // Whether to render caption in card
}
```

### `StageStory`
```typescript
export interface StageStory {
  step: number;                             // Numerical stage order
  stageName: string;                        // Short stage name (e.g. 'Planning')
  narrative: string;                        // Descriptive narrative text
}
```

### `SourceItem`
```typescript
export interface SourceItem {
  id: string;                               // Unique attachment identifier
  title: string;                            // Attachment title or document name
  dateStamp?: string;                       // ISO date string or human date
  photo?: NodeHeroImage;                    // Thumbnail or image preview
  imageSrc?: string;                        // Direct image source
  reference?: string;                       // Citation or reference identifier
}
```

---

## 2. Dynamic Canvas AST Contracts (`src/types/canvas.ts`)

Folio Engine models documents as a recursive block tree:

```
NodeCanvasDocument
└── SectionElement[]
    └── SubsectionElement[] | CanvasLeafElement[]
        └── CanvasLeafElement[] (Text | Photo | Gallery | Chart | Pdf | Documents)
```

### `NodeCanvasDocument`
```typescript
export interface NodeCanvasDocument {
  nodeId: string;                           // Associated sequence node ID
  version: number;                          // Document schema version integer
  sections: SectionElement[];               // Top-level numbered sections
  updatedAt: string;                        // ISO timestamp of last modification
}
```

### `SectionElement`
```typescript
export interface SectionElement extends CanvasElementBase {
  type: 'section';
  number?: string;                          // Two-digit sequential badge (e.g. "01")
  isNumbered?: boolean;                     // Toggle sequential badge visibility
  title: string;                            // Section headline
  titlePointId?: string;                    // Dynamic Content DB key for title
  subtitle?: string;                        // Section subhead
  subtitlePointId?: string;                 // Dynamic Content DB key for subtitle
  elements: CanvasChildElement[];           // Contained subsections or direct leaves
}
```

### `SubsectionElement`
```typescript
export interface SubsectionElement extends CanvasElementBase {
  type: 'subsection';
  title: string;
  titlePointId?: string;
  subtitle?: string;
  subtitlePointId?: string;
  elements: CanvasLeafElement[];            // Leaf content elements only
}
```

### Leaf Content Elements
```typescript
export interface TextElement extends CanvasElementBase {
  type: 'text';
  pointId: string;                          // Content DB reference key
  content: string;                          // Markdown or plain text
  as?: 'p' | 'blockquote';                  // Semantic typographic wrapper
}

export interface PhotoElement extends CanvasElementBase {
  type: 'photo';
  pointId: string;
  src?: string;
  srcSet?: string;                          // Responsive image candidates
  sizes?: string;                           // Media queries for responsive layout
  aspectRatio?: string;                     // e.g. "16/9", "4/3", "1/1"
  rawDriveUrl?: string;                     // Original asset URL fallback
  alt?: string;
  caption?: string;
  driveUrl?: string;                        // External Drive link
}

export interface GalleryElement extends CanvasElementBase {
  type: 'gallery';
  pointId: string;
  title?: string;
  titlePointId?: string;
  subtitle?: string;
  subtitlePointId?: string;
  driveUrl?: string;                        // Synchronized Google Drive folder URL
  description?: string;                     // Embedded gallery description
  lastVerified?: string;                    // ISO timestamp of last Drive verification
  syncedPhotos?: SyncedSourceItem[];        // Embedded synced Drive photo items
}

export interface ChartElement extends CanvasElementBase {
  type: 'chart';
  chartId: string;                          // Unique chart identifier
  title: string;
  subtitle?: string;
  config?: SheetChartConfig | PublicChartConfig; // Embedded chart config (sheetUrl stripped in public KV)
  dataset?: ChartDataset;                   // Embedded chart dataset
}

export interface PdfElement extends CanvasElementBase {
  type: 'pdf';
  pointId: string;
  src?: string;                             // Resolved Drive embed URL: https://drive.google.com/file/d/{fileId}/preview
  driveFileId?: string;                     // Extracted Google Drive file ID
  driveUrl?: string;                        // Original Google Drive view/share link
  title?: string;                           // Optional editorial document title
  caption?: string;                         // Optional caption below the viewer
  showCaption?: boolean;
  aspectRatio?: string;                     // Optional aspect ratio override (default: --pdf-viewer-aspect-ratio)
}

export interface DocumentsElement extends CanvasElementBase {
  type: 'documents';
  pointId: string;
  title?: string;
  titlePointId?: string;
  subtitle?: string;
  subtitlePointId?: string;
  driveUrl?: string;                        // Synchronized Google Drive folder URL
  description?: string;
  lastVerified?: string;
  syncedDocuments?: SyncedDocumentItem[];   // Embedded synced Drive PDF items
}
```

### Document Sync Contracts (`src/types/source.ts`)
```typescript
export interface SyncedDocumentItem {
  id: string;
  pointId?: string;
  driveFileId: string;
  originalFileName: string;
  title: string;
  previewUrl: string;                       // https://drive.google.com/file/d/{driveFileId}/preview
  viewUrl: string;                          // https://drive.google.com/file/d/{driveFileId}/view
  isCustomTitle?: boolean;                  // Preserves coordinator title overrides across Drive syncs
  orderIndex: number;
  date?: string;
  dateStamp?: string;
  size?: string;
  caption?: string;
}
```

---

## 3. Vector Chart Contracts (`src/types/chart.ts`)

### `ChartConfig`
```typescript
export interface ChartConfig {
  id: string;                               // Unique chart identifier
  nodeId?: string;                          // Associated sequence node ID
  type: ChartType;                          // 'bar' | 'line' | 'donut' | 'scatter' | 'histogram' | 'auto'
  title: string;
  subtitle?: string;
  categories: string[];                     // X-axis category labels
  series: ChartSeries[];                    // Data series
  visualConfig?: ChartVisualConfig;         // Viewport, unit, and scale settings
  sourceUrl?: string;                       // Published Google Sheet CSV URL
}
```

### `ChartSeries`
```typescript
export interface ChartSeries {
  name: string;                             // Series label for legend
  data: (number | null)[];                  // Numeric array; null represents empty cells
  color?: string;                           // CSS color or token override
}
```

### `ChartVisualConfig`
```typescript
export interface ChartVisualConfig {
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  xLabel?: string;
  yLabel?: string;
  unit?: string;                            // Prefix or suffix (e.g. "$", "%")
  tabName?: string;                         // Sheet tab name
  sheetGid?: string;                        // Sheet GID parameter
  range?: string;                           // e.g. "A1:F20"
  excludeSummaryRows?: boolean;             // Filters "Total", "Grand Total", "Average"
  transpose?: boolean;                      // Swaps matrix rows and columns
  binStrategy?: 'auto' | 'custom';          // For histograms
  binCount?: number;
  barVariant?: 'standard' | 'progress';     // Bar chart style
  targetValue?: number;                     // Reference benchmark line
  targetLabel?: string;
  showSummaryStats?: boolean;               // Renders mean, median, max pills
}
```

---

## 4. Edge Distribution Contracts (`src/types/edge.ts`)

### `PublicNodePayload`
```typescript
export interface PublicNodePayload {
  nodeId: string;
  snapshotId: string;
  version: number;
  updatedAt: string;
  canvas: NodeCanvasDocument;               // Self-contained AST with embedded charts & galleries
}
```

### `PublicPortalManifestPayload`
```typescript
export interface PublicPortalManifestPayload {
  activeSnapshotId: string;
  publishedAt: string;
  nodeIds: string[];
  schemaVersion: number;
  contentOverrides?: Record<string, string>;
}
```

### `DraftWorkspacePayload`
```typescript
export interface DraftWorkspacePayload {
  baseSnapshotId: string;
  dirty: boolean;
  revision: number;
  updatedAt: string;
  authorSessionId: string;
  canvases: Record<string, NodeCanvasDocument>;
  contentOverrides: Record<string, string>;
}
```

---

## 5. Navigation Contracts (`src/types/navigation.ts`)

```typescript
export interface NavItem {
  label: string;
  href: string;
  id?: string;
  pageId?: string;                          // Target PageNode.id or root chapter ID
  number?: string;
  summary?: string;                         // Optional subpage summary for 2-level dropdowns
  isActive?: boolean;
  level?: 'section' | 'subsection' | 'chapter' | 'subpage';
  children?: NavItem[];                     // Direct Level 2 subpages or subsection items
}
```

---

## 7. Dynamic Subpage Tree & PageLink Contracts (`src/types/page.ts`, `src/types/canvas.ts`, `src/types/edge.ts`)

Unlimited-depth subpage trees are stored as a normalized `PageRegistry` (`Record<string, PageNode>`) rather than nested inside `NodeCanvasDocument`s. Each subpage is linked from its parent canvas via a 1:1 `PageLinkElement`.

### `PageNode` & `PageRegistry` (`src/types/page.ts`)
```typescript
export interface PageNode {
  id: string;                               // Immutable ID matching /^page-[a-z0-9-]+$/
  parentId: string;                         // Root chapter ID or parent PageNode.id
  slug: string;                             // URL segment matching /^[a-z0-9-]+$/
  title: string;                            // Single source of truth for card, header, breadcrumb & PageTitle
  summary?: string;                         // Optional 1-line card summary (<= 15 words)
  order: number;                            // Zero-based sibling order synced to parent canvas card order
  createdAt: string;                        // ISO-8601 timestamp
  updatedAt: string;                        // ISO-8601 timestamp
}

export type PageRegistry = Record<string, PageNode>;
```

### `PageLinkElement` (`src/types/canvas.ts`)
```typescript
export interface PageLinkElement extends CanvasElementBase {
  type: 'page-link';
  targetPageId: string;                     // References PageNode.id in PortalChromeContext.pages
  summary?: string;                         // Optional fallback summary if PageNode.summary is unset
}
```

### Workspace, Manifest & Snapshot Extensions (`src/types/edge.ts`, `src/types/history.ts`)
- `DraftWorkspacePayload.pages?: PageRegistry` & `DraftWorkspaceUpdateRequest.deletedPageIds?: string[]` (atomically purges `draft.pages[id]` and `draft.canvases[id]` in a single `PUT /api/draft` transaction).
- `PublicPortalManifestPayload.pages?: PageRegistry` (injected into `window.__FOLIO_MANIFEST__` on HTML cold loads).
- `PublishedSnapshot.pages?: PageRegistry` (preserved across publish and `POST /api/history/restore`).

---

## 6. Migration Ledger Contracts (`src/types/migration.ts`)

All migration contracts are backed by strict Zod schemas (`ContentMigrationSchema`, `CodeMigrationSchema`, `MigrationEntrySchema`, `PendingMigrationReportSchema`) and validated against bare semver strings (`SEMVER_REGEX`, no leading `v` prefix).

### `ContentMigration` & `CodeMigration`
```typescript
export interface ContentMigration {
  id: string;
  title: string;
  required: boolean;
  description: string;
  affectedEntities?: string[];
  migrationPrompt?: string;
}

export interface CodeMigration {
  description: string;
  affectedFiles?: string[];
  exampleBefore?: string;
  exampleAfter?: string;
}
```

### `MigrationEntry` & `PendingMigrationReport`
```typescript
export interface MigrationEntry {
  version: string;                          // Bare semver (e.g. '0.1.4')
  releaseDate: string;                      // ISO format or YYYY-MM-DD
  title: string;
  summary: string;
  breakingChanges: string[];
  codeActions: CodeMigration[];
  contentChanges: ContentMigration[];
}

export interface PendingMigrationReport {
  currentEngineVersion: string;
  contentVersionWatermark: string;
  hasPendingContentChanges: boolean;
  pendingContentChanges: ContentMigration[];
  unappliedVersions: string[];
}
```
