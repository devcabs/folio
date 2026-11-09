# Reference: Core Services & Utilities

This document specifies the internal services, storage adapters, and calculation utilities in Folio Engine.

---

## 1. Core Services (`src/services/`)

### `canvasLayoutService.ts`
Manages tree traversal, block insertion, reordering, and deletion for `NodeCanvasDocument` ASTs.
- `getDocumentCanvas(documentId: string, isDevMode?: boolean): NodeCanvasDocument`
- `saveDocumentCanvas(documentId: string, doc: NodeCanvasDocument, isDevMode?: boolean): NodeCanvasDocument`
- `resetDocumentCanvas(documentId: string): NodeCanvasDocument`
- `insertSection(doc: NodeCanvasDocument, index: number, section: SectionElement): NodeCanvasDocument`
- `deleteSection(doc: NodeCanvasDocument, sectionId: string): NodeCanvasDocument`

---

### `chartSourceService.ts`
Resolves chart data from pre-baked local JSON caches or live Google Sheets endpoints.
- `fetchChartConfig(chartId: string): Promise<ChartConfig | null>`
- `fetchChartConfigsByNode(nodeId: string): Promise<ChartConfig[]>`
- `saveChartConfig(chart: ChartConfig, isDevMode?: boolean): Promise<boolean>`

---

### `draftService.ts`
Coordinates the dual-channel persistence model between local storage and Supabase.
- `getDraftOverrides(): Record<string, string>`
- `saveDraftOverride(key: string, value: string): void`
- `clearDraftOverrides(): void`
- `publishAllDrafts(): Promise<{ success: boolean; count: number }>`
- `discardAllDrafts(): void`

---

### `devLockService.ts`
Distributed coordinator mutex lock manager backed by Supabase.
- `acquireLock(pin: string): Promise<{ success: boolean; lockId?: string; error?: string }>`
- `renewLock(lockId: string): Promise<boolean>`
- `releaseLock(lockId: string): Promise<void>`
- `checkLockStatus(): Promise<{ isLocked: boolean; holderName?: string; expiresAt?: string }>`
- `forceReleaseLock(): Promise<void>`

---

### `historyService.ts` & `historyStorage.ts`
Audit ledger tracking all coordinator edits, actor timestamps, and diff snapshots.
- `recordEdit(action: string, entityId: string, diff: DraftDiff): Promise<void>`
- `getRecentHistory(limit?: number): Promise<HistoryEntry[]>`
- `clearHistoryLedger(): Promise<void>`

---

### `sheetsDataService.ts` & `sheetsVerificationService.ts`
Fetches and sanitizes tabular datasets from published Google Sheets CSV endpoints.
- `parseCsvToMatrix(csvText: string): string[][]`
- `extractSeriesAndCategories(matrix: string[][], options?: ParseOptions): ExtractedChartData`
- `verifySheetAccess(url: string): Promise<{ isValid: boolean; tabs?: string[]; error?: string }>`

---

### `undoRedoService.ts`
Maintains an in-memory transactional snapshot stack for undo/redo state management.
- `pushSnapshot(state: unknown): void`
- `undo(): unknown | null`
- `redo(): unknown | null`
- `clearStack(): void`

---

### `unsavedChangesService.ts`
Tracks whether local uncommitted drafts exist and handles browser beforeunload alerts.
- `setDirty(isDirty: boolean): void`
- `isDirty(): boolean`
- `registerBeforeUnloadHandler(): void`

---

## 2. Utilities (`src/utils/`)

### `chartMath.ts`
D3-scale domain calculations, tick generation, and histogram binning.
- `computeLinearScale(domain: [number, number], range: [number, number]): (val: number) => number`
- `computeNiceDomain(min: number, max: number): [number, number]`
- `generateTicks(domain: [number, number], count?: number): number[]`
- `computeHistogramBins(values: number[], binCount?: number): HistogramBin[]`

---

### `chartSanitizer.ts`
Strips HTML injection and converts malformed cell strings into safe numbers or `null`.
- `sanitizeChartConfig(config: ChartConfig): ChartConfig`
- `sanitizeNumericValue(val: unknown): number | null`
- `sanitizeLabel(text: string): string`

---

### `contentDb.ts`
Key-value text database driving dynamic copy authoring.
- `getContent(key: string, fallback?: string): string`
- `setContent(key: string, value: string): void`
- `getAllOverrides(): Record<string, string>`
- `clearContent(): void`

---

### `devSecurity.ts`
SHA-256 PIN hashing and session token verification.
- `hashPin(pin: string, salt: string): Promise<string>`
- `verifyPin(pin: string, expectedHash: string, salt: string): Promise<boolean>`

---

### `smooth-scroll.ts`
Programmatic, easing-based smooth scroll with cubic ease-out.
- `smoothScrollTo(target: HTMLElement | number, duration?: number): void`

---

### `scrollLock.ts`
Disables background page scroll when modal overlays or drawers are active.
- `lockScroll(): void`
- `unlockScroll(): void`

---

### `accentTextParser.tsx`
Parses custom asterisks syntax into styled typography spans.
- `parseAccentText(input: string): React.ReactNode`
- Example: `"The *future* of data"` &rarr; `"The "` + `<span className="accent">future</span>` + `" of data"`
