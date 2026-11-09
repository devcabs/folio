# Tutorial 02: Building a Stepped Canvas Experience

In this tutorial, you will build a complete stepped sequence experience composed of an interactive roadmap track and a recursive document canvas AST.

---

## 🎯 Learning Objectives

By the end of this tutorial, you will:
1. Construct a multi-step sequence track using `RoadmapTrack` and `serpentine-generator`.
2. Model a document canvas AST using `NodeCanvasDocument`, `SectionElement`, and leaf content elements.
3. Bind scroll tracking with `useScrollspy` and URL hash routes with `useHashRoute`.
4. Render a responsive document page containing text blocks, photos, and live charts.

---

## 🏗️ Architecture of a Stepped Canvas

The stepped canvas pattern connects continuous vertical scrolling with discrete waypoint wayfinding:

```
[ Viewport Scroll ] ──> [ Serpentine Bézier Track ] ──> [ Active Waypoint (Node) ]
                                                                   │
                                                                   ▼
                                                       [ Document Canvas AST ]
                                                       ├── Section 01
                                                       │   ├── Subsection A
                                                       │   │   ├── Text Paragraph
                                                       │   │   └── Responsive Photo
                                                       │   └── Interactive Chart
                                                       └── Section 02
```

---

## Step 1: Define Sequence Nodes

Create your sequence milestones in a typed dataset `src/data/nodes.ts`:

```typescript
// src/data/nodes.ts
import type { NodeItem } from '@devcabs/folio-engine';

export const projectNodes: NodeItem[] = [
  {
    id: 'architecture',
    index: 1,
    title: 'Architecture & System Design',
    subtitle: 'High-throughput modular infrastructure',
    summary: 'Foundational decoupled architecture for high-concurrency client engines.',
    accentColor: 'var(--color-node-1, #0284c7)',
    accentTint: 'var(--color-node-1-tint, #f0f9ff)',
    heroImage: {
      src: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200',
      alt: 'Data center servers',
      caption: 'Distributed system nodes',
    },
  },
  {
    id: 'performance',
    index: 2,
    title: 'Optimization & Benchmarking',
    subtitle: 'Zero runtime waste and sub-millisecond latencies',
    summary: 'Eliminating blocking operations and optimizing memory footprints.',
    accentColor: 'var(--color-node-2, #16a34a)',
    accentTint: 'var(--color-node-2-tint, #f0fdf4)',
    heroImage: {
      src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200',
      alt: 'Performance graphs and metrics',
      caption: 'Load testing results under 10k RPS',
    },
  },
];
```

---

## Step 2: Define a Document Canvas AST

Folio Engine organizes document content as an Abstract Syntax Tree (AST). Define the canvas structure for the `'architecture'` node in `src/data/architecture-canvas.ts`:

```typescript
// src/data/architecture-canvas.ts
import type { NodeCanvasDocument } from '@devcabs/folio-engine';

export const architectureDocument: NodeCanvasDocument = {
  nodeId: 'architecture',
  version: 1,
  updatedAt: new Date().toISOString(),
  sections: [
    {
      id: 'sec-foundations',
      type: 'section',
      number: '01',
      isNumbered: true,
      title: 'Core Architectural Pillars',
      subtitle: 'Separation of concerns between state, layout, and distribution',
      elements: [
        {
          id: 'sub-decoupling',
          type: 'subsection',
          title: 'Decoupled State Engine',
          subtitle: 'Dual-channel state management isolating authoring from live distribution',
          elements: [
            {
              id: 'text-intro',
              type: 'text',
              pointId: 'node.architecture.intro',
              content: 'The core engine decouples the reactive client state from cloud persistence, ensuring seamless offline operations and instant preview rendering.',
              as: 'p',
            },
            {
              id: 'photo-diagram',
              type: 'photo',
              pointId: 'node.architecture.photo_1',
              src: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200',
              alt: 'Network topology schematic',
              caption: 'Figure 1.1: Distributed client and edge caching network.',
            },
          ],
        },
        {
          id: 'chart-throughput',
          type: 'chart',
          chartId: 'chart-arch-throughput',
          title: 'Latency vs. Concurrent Connections',
          subtitle: 'Edge KV distribution maintains <15ms TTFB globally',
        },
      ],
    },
  ],
};
```

---

## Step 3: Render the Sequence Track

In your page layout component, compose `RoadmapSection` to render the Bézier curve navigation:

```tsx
// src/components/SequenceJourney.tsx
import React, { useState } from 'react';
import { RoadmapSection } from '@devcabs/folio-engine';
import { projectNodes } from '../data/nodes';

export function SequenceJourney() {
  const [activeNodeId, setActiveNodeId] = useState<string>('architecture');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
      <RoadmapSection
        nodes={projectNodes}
        activeNodeId={activeNodeId}
        onSelectNode={(nodeId) => setActiveNodeId(nodeId)}
      />
    </div>
  );
}
```

---

## Step 4: Render the Recursive Document Canvas

Render the detailed block canvas using `DocumentCanvas`:

```tsx
// src/components/NodeDetailView.tsx
import React from 'react';
import { DocumentCanvas } from '@devcabs/folio-engine';
import { architectureDocument } from '../data/architecture-canvas';

interface NodeDetailViewProps {
  nodeId: string;
}

export function NodeDetailView({ nodeId }: NodeDetailViewProps) {
  // In a real application, fetch the canvas document dynamically via useDocumentCanvas(nodeId)
  return (
    <main style={{ maxWidth: '960px', margin: '48px auto', padding: '0 24px' }}>
      <DocumentCanvas
        document={architectureDocument}
        isDevMode={false}
      />
    </main>
  );
}
```

---

## Step 5: Test Navigation & Responsive Collapsing

1. Start the dev server: `npm run dev`.
2. Scroll through the page: notice that as you cross each node's viewport threshold, the Bézier curve node pill highlights and activates.
3. Resize the window to mobile width (`< 1024px`): observe that `PHOTO_STACKED_BREAKPOINT` triggers, collapsing side-by-side photo flanks into a vertical stacked presentation while maintaining typography cadence.

---

## 🚀 Next Steps

Explore the **How-To Guides** to extend this experience:
- Learn how to persist changes with [How-To: Dual-Channel Content DB](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/01-dual-channel-content-db.md).
- Learn how to bind Google Sheets to charts with [How-To: Google Sheets Chart Sync](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/02-google-sheets-chart-sync.md).
