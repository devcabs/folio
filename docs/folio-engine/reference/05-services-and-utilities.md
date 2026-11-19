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

### `draftService.ts`
Coordinates Cloudflare KV draft workspace persistence (`draft:workspace` via `/api/draft` and `/api/draft/init`) with optimistic concurrency (`expectedRevision` / `expectedUpdatedAt`) and `Authorization: Bearer <lockToken>`.
- `initDraftSession(options?)`: Initializes or resumes `draft:workspace` from Cloudflare KV (with cold-boot bootstrap when `portal:manifest === null && history:index === null`).
- `saveDraftWorkspace(...)`: Persists draft `canvases` and `contentOverrides` directly to `PUT /api/draft`.
- `discardDraftSession()`: Discards active draft changes via `DELETE /api/draft`.

---

### `devLockService.ts`
Edge-authenticated coordinator mutex lock manager backed by Cloudflare KV (`lock:coordinator` via `/api/lock`).
- `acquireDevLock(options)`: Authenticates 4-digit PIN on the edge (`POST /api/lock`) and returns an opaque `lockToken`.
- `renewDevLock(lockToken)`: Sends heartbeat (`PATCH /api/lock`) extending the 60-second KV TTL.
- `releaseDevLock(lockToken)`: Releases the active lock (`DELETE /api/lock`).
- `checkDevLockStatus(lockToken?)`: Queries lock availability (`GET /api/lock`).

---

### `historyService.ts`
Cloudflare KV revision history and two-phase atomic publish client (`/api/history`, `/api/history/restore`, `/api/publish`).
- `fetchHistoryIndex()` / `fetchSnapshotById(id)`: Queries `history:index` and `history:snapshot:${id}` from Cloudflare KV.
- `publishNewSnapshot(...)`: Executes two-phase atomic publish via `POST /api/publish` with `Authorization: Bearer <lockToken>`.
- `restoreSnapshotToDraft(snapshotId, lockToken)`: Restores `canvases` and `contentOverrides` into `draft:workspace` via `POST /api/history/restore`.

---

### `sheetsDataService.ts` & `sheetsVerificationService.ts`
Fetches and sanitizes tabular datasets from published Google Sheets CSV endpoints.
- `parseCsvToMatrix(csvText: string): string[][]`
- `extractSeriesAndCategories(matrix: string[][], options?: ParseOptions): ExtractedChartData`
- `verifySheetAccess(url: string): Promise<{ isValid: boolean; tabs?: string[]; error?: string }>`

---

### `driveDocumentSyncService.ts`
Synchronizes `application/pdf` files from public Google Drive folders (including 1st-level subfolders) and reconciles items while preserving coordinator customizations.
- `cleanDriveDocumentName(fileName: string): string`
- `reconcileDriveDocuments(driveFiles: DriveDocumentFile[], existingDocuments?: SyncedDocumentItem[]): DriveDocumentReconciliationResult`
- `fetchDriveFolderPdfs(folderUrl: string): Promise<DriveDocumentFile[]>`
- `syncFolderDocuments(folderUrl: string, existingDocuments?: SyncedDocumentItem[]): Promise<SyncFolderDocumentsResult>`

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
Key-value text override store hydrated from Cloudflare KV (`portal:manifest.contentOverrides` in Public Mode, `draft:workspace.contentOverrides` in Dev Mode) with zero browser storage.
- `getContent(key: string, fallback?: string): string`
- `setContent(key: string, value: string): void`
- `getAllOverrides(): Record<string, string>`
- `clearContent(): void`

---

### `devSecurity.ts`
Pure salted SHA-256 hashing (`hashPin`) and session/lockout constants (`SESSION_DURATION_MS`, `LOCKOUT_DURATION_MS`, `MAX_ATTEMPTS`). Authoritative PIN verification and rate-limiting (`lock:pin_ratelimit`) execute on the Cloudflare Edge in `lockHandler.ts`.
- `hashPin(pin: string, salt: string): Promise<string>`

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

---

### `mediaUrl.ts`
Resolves Google Drive file/folder URLs into canonical preview, view, and edge media paths.
- `buildDrivePreviewUrl(fileIdOrUrl: string): string` &mdash; Returns `https://drive.google.com/file/d/{fileId}/preview` for embedded PDF iframes.
- `buildDriveViewUrl(fileIdOrUrl: string): string` &mdash; Returns `https://drive.google.com/file/d/{fileId}/view` for new-tab escape hatches.
- `resolveSingleDrivePdfUrl(input: string): ResolvedSinglePdf | null` &mdash; Extracts the Drive file ID from `/file/d/{id}/view`, `/preview`, `/open?id={id}`, `/uc?id={id}`, or a raw ID (rejecting `/folders/` links) and returns `{ fileId, previewUrl, viewUrl, rawUrl }`.
