# Reference: Custom Hooks & State Contexts

This document specifies the React hooks and context providers exported by `@devcabs/folio-engine`.

---

## 1. Document Canvas Hooks

### `useDocumentCanvas(documentId: string)`
Primary hook for fetching, updating, and mutating a recursive document AST.

```typescript
function useDocumentCanvas(documentId: string): {
  document: NodeCanvasDocument | null;
  isLoading: boolean;
  error: Error | null;
  updateSection: (sectionId: string, updated: Partial<SectionElement>) => void;
  addSection: (newSection: SectionElement) => void;
  removeSection: (sectionId: string) => void;
  reorderSections: (sourceIndex: number, destinationIndex: number) => void;
  saveCanvas: () => Promise<boolean>;
};
```

---

### `useDynamicSectionNumbers(sections: SectionElement[])`
Calculates sequential two-digit display numbers (`01`, `02`, `03`) across visible sections, respecting optional `isNumbered` flags:

```typescript
function useDynamicSectionNumbers(sections: SectionElement[]): {
  numberedSections: SectionElement[];
  totalNumberedCount: number;
};
```

---

## 2. Navigation & Viewport Hooks

### `useScrollspy(options?: ScrollspyOptions)`
Tracks window scroll progression and intercepts active waypoints along the continuous Bézier curve track.

```typescript
function useScrollspy(options?: {
  nodeIds: string[];
  offsetPercent?: number; // Viewport trigger boundary (default: 40%)
}): {
  activeNodeId: string;
  scrollProgress: number;  // 0.0 to 1.0 along sequence journey
};
```

---

### `useHashRoute()`
Synchronizes browser URL pathname (`/node/{chapter}/{subpage}.../`) and legacy `#hash` routes with active root chapters and nested `PageNode`s.

```typescript
function useHashRoute(options?: {
  pages?: PageRegistry;
  isManifestHydrated?: boolean;
}): {
  route: RouteState;
  activePageId: string | null;
  rootNodeId: string | null;
  pageNode: PageNode | null;
  ancestors: PageAncestorItem[];
  isHydrating: boolean;
  isNotFound: boolean;
  navigateToOverview: () => void;
  navigateToNode: (nodeId: string, pageId?: string) => void;
};
```
- Returns `'hydrating'` (renders `<CanvasGhostWireframe />` instead of 404) while cold-boot manifest hydration is pending.
- Includes the **Draft Refresh Guard**: in Dev Mode, `pages` from `draft:workspace` takes precedence over `portal:manifest` so newly created subpages never flash 404 on reload.

---

### `useScroll()`
Lightweight, throttle-optimized scroll coordinate and velocity tracker.

```typescript
function useScroll(): {
  scrollY: number;
  scrollDirection: 'up' | 'down' | 'idle';
  isScrolledPastHero: boolean;
};
```

---

## 3. Coordinator & Persistence Hooks

### `useDeveloperMode()`
Provides access to Coordinator Mode, PIN authentication, and distributed mutex lock lease status.

```typescript
function useDeveloperMode(): {
  isDevMode: boolean;
  isLockAcquired: boolean;
  lockStatus: 'unlocked' | 'acquired' | 'blocked' | 'expired';
  enterDevMode: (pin: string) => Promise<boolean>;
  exitDevMode: () => Promise<void>;
  forceClaimLock: () => Promise<boolean>;
};
```

---

### `PortalChromeContext` (`src/context/PortalChromeContext.tsx`)
Hydrates `contentOverrides`, `pages: PageRegistry`, and `publishedPages: PageRegistry` synchronously from `window.__FOLIO_MANIFEST__` (Public Mode) or asynchronously from `GET /api/draft` (Dev Mode). Exposes `commitWorkspaceMutation(...)` for atomic cross-page `pages`, `canvases`, and `deletedPageIds` updates.

### `UndoRedoContext` (`src/context/UndoRedoContext.tsx`)
Connects `Cmd+Z` / `Cmd+Shift+Z` to `undoRedoService.popUndoAsync()` / `popRedoAsync()`, executing workspace-addressed `createWorkspaceUndoAction` snapshots across any mounted page and dispatching `EVENT_WORKSPACE_UNDO_RECONCILE` for automatic parent route redirection when an active subpage is undone.

### `useUndoRedo()`
Connects to the in-memory immutable state stack, providing undo/redo actions for canvas and copy edits.

```typescript
function useUndoRedo(): {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  historyLength: number;
  futureLength: number;
};
```

---

### `useContent(key: string, fallbackDefault?: string)`
Reactive hook for reading and editing localized string entries in the client Content DB.

```typescript
function useContent(
  key: string,
  fallbackDefault?: string
): {
  value: string;
  setValue: (newValue: string) => void;
  isOverridden: boolean;
};
```

---

### `useUnsavedChangesPrompt()`
Monitors dirty draft states and registers `beforeunload` browser listeners to prevent accidental data loss.

```typescript
function useUnsavedChangesPrompt(): {
  hasDirtyDrafts: boolean;
  markDirty: () => void;
  markClean: () => void;
};
```

---

## 4. Media & Chart Hooks

### `useChartContainerWidth(options?: UseChartContainerWidthOptions)`
Internal chart hook (`src/hooks/useChartContainerWidth.ts`) that measures a chart container's CSS width via `ResizeObserver` so SVG `viewBox` coordinates track rendered pixels `1:1` on compact mobile viewports (`< 480px`), falling back cleanly in SSR/Node/happy-dom environments.

```typescript
function useChartContainerWidth<T extends HTMLElement = HTMLDivElement>(
  options?: {
    defaultWidth?: number;
    compactBreakpoint?: number;
    ref?: RefObject<T | null>;
  }
): {
  containerRef: RefObject<T | null>;
  width: number;
  isCompact: boolean;
};
```

---

### `useChartTooltip(options?: UseChartTooltipOptions)`
Manages interactive hover/focus/tap coordinates, container-relative viewport boundary clamping (`clampX`/`clampY` with above/below placement flipping), SVG coordinate projection (`projectSvgToContainer`), unified tap-to-inspect + tap-outside-to-dismiss touch lifecycles, and formatted data strings (`unit`) for SVG chart tooltips.

```typescript
function useChartTooltip(): {
  tooltipState: {
    isOpen: boolean;
    x: number;
    y: number;
    title: string;
    value: string;
    color: string;
  };
  showTooltip: (data: TooltipData, event: React.MouseEvent) => void;
  hideTooltip: () => void;
};
```

---

### `useLightboxHistory(isOpen: boolean, onClose: () => void)`
Coordinates browser back-button behavior with media lightboxes. Pressing the browser back button dismisses the lightbox rather than navigating away from the current page.

---

### `useDriveDocumentSync(nodeId: string, options?: UseDriveDocumentSyncOptions)`
Non-blocking React 19 hook for synchronizing `application/pdf` files from a linked Google Drive folder into a `DocumentsElement` AST node with a deterministic 5-state lifecycle (`never_synced` | `syncing` | `synced_success` | `synced_empty` | `sync_error`).

```typescript
function useDriveDocumentSync(
  nodeId: string,
  options?: UseDriveDocumentSyncOptions
): UseDriveDocumentSyncResult;
```

---

## 5. React Context Providers

### `<DeveloperModeContext />`
Wraps application roots to provide reactive coordinator authentication and mutex lock leasing.

### `<UndoRedoContext />`
Wraps the canvas editor to maintain immutable history snapshots and transaction stacks.
