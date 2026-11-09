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
        └── CanvasLeafElement[] (Text | Photo | Gallery | Chart)
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
}

export interface ChartElement extends CanvasElementBase {
  type: 'chart';
  chartId: string;                          // Identifier referencing ChartConfig
  title: string;
  subtitle?: string;
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
  canvas: NodeCanvasDocument;
  charts: CachedIndicatorDataset[];
  sources: Record<string, SyncedSourceMetadata>;
  compiledAt: string;
}
```

### `PublicPortalManifestPayload`
```typescript
export interface PublicPortalManifestPayload {
  appId: string;
  appName: string;
  version: string;
  nodes: {
    id: string;
    index: number;
    title: string;
    hash: string;
  }[];
  generatedAt: string;
}
```
