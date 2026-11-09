# Tutorial 01: Getting Started with Folio Engine

In this tutorial, you will install `@devcabs/folio-engine`, configure its application metadata, import the styling design tokens, and render your first interactive application.

---

## 🎯 Learning Objectives

By the end of this tutorial, you will:
1. Install `@devcabs/folio-engine` into a React 19 project.
2. Import the required CSS tokens and stylesheets.
3. Define an `EngineConfig` with basic waypoints and branding.
4. Render the standalone `App` component or compose custom views.

---

## ⏱️ Prerequisites

- **Node.js**: v20.0.0 or higher.
- **React**: React 19 (`react` and `react-dom` ^19.0.0).
- **Bundler**: Vite, Next.js, Remix, or any modern bundler supporting CSS imports and ESM.

---

## Step 1: Install the Package

Add `@devcabs/folio-engine` and its required peer dependencies to your project:

```bash
npm install @devcabs/folio-engine react react-dom zod d3-scale d3-array
```

---

## Step 2: Import Engine Stylesheets

Folio Engine relies on token-driven CSS custom properties and reset rules. In your application root (e.g., `main.tsx` or `App.tsx`), import the stylesheet:

```tsx
// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@devcabs/folio-engine/style.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

> [!IMPORTANT]
> The engine stylesheet must be loaded before any custom component styles to ensure CSS design variables (such as `--folio-primary` and `--font-sans`) are available on `:root`.

---

## Step 3: Configure Engine Metadata

Folio Engine uses a singleton configuration store initialized with `setEngineConfig()`. Create a configuration file `src/engine-setup.ts`:

```typescript
// src/engine-setup.ts
import { setEngineConfig } from '@devcabs/folio-engine';
import type { NodeItem } from '@devcabs/folio-engine';

export const sampleNodes: NodeItem[] = [
  {
    id: 'discovery',
    index: 1,
    title: 'Discovery & Vision',
    subtitle: 'Clarifying the technical moat and customer journey',
    summary: 'The initial stage focuses on architecture, research, and validation.',
    accentColor: 'var(--color-node-1, #2563eb)',
    accentTint: 'var(--color-node-1-tint, #eff6ff)',
    heroImage: {
      src: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200',
      alt: 'Team planning discovery phase',
      caption: 'Initial architectural kickoff',
    },
    stages: [
      { step: 1, stageName: 'Research', narrative: 'Benchmarking state of the art.' },
      { step: 2, stageName: 'Synthesis', narrative: 'Synthesizing requirements and constraints.' },
    ],
  },
  {
    id: 'execution',
    index: 2,
    title: 'Core Implementation',
    subtitle: 'Scaffolding reactive components and data pipelines',
    summary: 'Building the fundamental AST engine and canvas blocks.',
    accentColor: 'var(--color-node-2, #059669)',
    accentTint: 'var(--color-node-2-tint, #ecfdf5)',
    heroImage: {
      src: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200',
      alt: 'Engineers building software',
      caption: 'Production build pipeline',
    },
    stages: [
      { step: 1, stageName: 'Scaffolding', narrative: 'Setting up contracts and types.' },
      { step: 2, stageName: 'Verification', narrative: 'Validating with strict test suites.' },
    ],
  },
];

export function initializeFolio() {
  setEngineConfig({
    appId: 'my-showcase-app',
    appNamespace: 'my_app',
    branding: {
      appName: 'Interactive Project Report',
      tagline: 'Parametric Stepped Scrollytelling',
      logoText: 'FOLIO',
      markSides: 8,
      markWaviness: 0.15,
      heroTitle: 'Interactive Project Showcase',
      heroSubtitle: 'Explore milestone progressions, recursive canvases, and live data charts.',
    },
    nodes: sampleNodes,
    features: {
      enableChartDrawer: true,
      enableEditorMode: true,
      enableHistoryLedger: true,
    },
  });
}
```

---

## Step 4: Render the Showcase Application

Initialize the configuration and render the primary `App` container:

```tsx
// src/App.tsx
import React, { useEffect } from 'react';
import { App as FolioApp } from '@devcabs/folio-engine';
import { initializeFolio } from './engine-setup';

export default function App() {
  useEffect(() => {
    initializeFolio();
  }, []);

  return <FolioApp />;
}
```

---

## Step 5: Verify Your Setup

Run your local development server:

```bash
npm run dev
```

Open your browser at `http://localhost:5173`. You should observe:
1. **Application Header (`AppHeader`)**: Featuring the parametric geometric mark, application title, and responsive waypoint navigation pills.
2. **Hero Welcome (`HeroWelcome`)**: Displaying your configured title, subtitle, and primary call-to-action button.
3. **Serpentine Sequence Track (`RoadmapTrack`)**: Rendering a smooth Bézier curve track connecting your two configured nodes.
4. **Waypoints (`RoadmapNode`)**: Rendering interactive node cards with active scroll states.

---

## 🚀 Next Steps

Now that you have initialized the engine, continue to [Tutorial 02: Building a Stepped Canvas Experience](file:///Users/francisdave/Documents/folio/docs/folio-engine/tutorials/02-building-a-stepped-canvas.md) to learn how to create and customize recursive document canvases.
