# Explanation: Recursive Document Canvas & Block AST Design

This document explores the design and operational semantics of the block-based Abstract Syntax Tree (AST) powering Folio Engine's `DocumentCanvas`.

---

## 🌳 AST Tree Structure & Hierarchy

Instead of storing rich content as unconstrained HTML blobs or flat markdown strings, Folio Engine organizes documents as a strictly typed, recursive AST:

```
NodeCanvasDocument
└── sections: SectionElement[]
    ├── id: string
    ├── number: "01" (Dynamic sequential number)
    ├── title: string
    └── elements: CanvasChildElement[]
        ├── SubsectionElement
        │   ├── id: string
        │   ├── title: string
        │   └── elements: CanvasLeafElement[]
        │       ├── TextElement (content: string, as: 'p' | 'blockquote')
        │       └── PhotoElement (src: string, alt: string, caption: string)
        ├── GalleryElement (driveUrl: string)
        └── ChartElement (chartId: string)
```

---

## 🔒 Immutability & Tree Operations

All tree manipulations in `canvasLayoutService.ts` are pure functions producing new immutable document instances without mutating existing state:

```typescript
// Example: Pure immutable leaf insertion
export function insertLeafIntoSection(
  doc: NodeCanvasDocument,
  sectionId: string,
  newLeaf: CanvasLeafElement
): NodeCanvasDocument {
  return {
    ...doc,
    updatedAt: new Date().toISOString(),
    sections: doc.sections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        elements: [...sec.elements, newLeaf],
      };
    }),
  };
}
```

---

## 🔢 Dynamic Sequential Numbering

In editorial documents, sections often require two-digit numerical prefixes (e.g., `01 Foundations`, `02 Architecture`). In static systems, inserting a new section between 01 and 02 requires manually renumbering all subsequent sections.

Folio Engine solves this with `useDynamicSectionNumbers.ts`:
1. The AST stores an optional `isNumbered: boolean` toggle per section.
2. The runtime traversal walks the `sections` array in order.
3. Every section with `isNumbered: true` receives an automatically computed two-digit badge string:
   $$\text{number} = \text{String}(\text{index} + 1)\text{.padStart}(2, \text{'0'})$$
4. Sections with `isNumbered: false` are rendered without a badge and do not increment the sequential counter.
5. Reordering or deleting sections automatically updates all section badges at 60fps without touching database keys.

---

## 🧩 Leaf Content Types & Capabilities

| Leaf Type | Schema Contract | Render Behavior |
| :--- | :--- | :--- |
| **`text`** | `TextElement` | Renders typography paragraphs or quotes with accent parser syntax (`*bold emphasis*`). |
| **`photo`** | `PhotoElement` | Responsive image rendering with aspect-ratio preservation and fullscreen lightbox click triggers. |
| **`gallery`** | `GalleryElement` | Horizontal photo strip or grid synchronized with Google Drive media folders. |
| **`chart`** | `ChartElement` | Resolves chart configuration by `chartId` and embeds a responsive SVG chart. |
