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
Synchronizes browser window `#hash` with active sequence waypoints without triggering disruptive full page reloads.

```typescript
function useHashRoute(): {
  currentHash: string;
  navigateToNode: (nodeId: string) => void;
};
```

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

### `useChartTooltip()`
Manages interactive hover coordinates, SVG viewport boundary containment, and formatted data strings for D3 chart tooltips.

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

## 5. React Context Providers

### `<DeveloperModeContext />`
Wraps application roots to provide reactive coordinator authentication and mutex lock leasing.

### `<UndoRedoContext />`
Wraps the canvas editor to maintain immutable history snapshots and transaction stacks.
