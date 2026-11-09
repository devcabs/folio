# Reference: Component Catalog & Props

This document provides technical specifications, prop interfaces, and styling slots for all primary React components exported by `@devcabs/folio-engine`.

---

## 1. Layout Shell Components (`src/components/layout/`)

### `<AppHeader />`
The primary global navigation chrome featuring brand logo, title, and waypoint pills.

#### Props (`AppHeaderProps`)
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `activeStage?` | `number` | `1` | Currently active sequence index. |
| `onStageSelect?` | `(stage: number) => void` | `undefined` | Callback fired when user clicks a sequence pill. |
| `title?` | `string` | Configured `appName` | Application display title. |
| `logoText?` | `string` | `'FOLIO'` | Text rendered adjacent to parametric mark. |

---

### `<AppFooter />`
The canonical bottom structural footer.

#### Props (`AppFooterProps`)
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `orgName?` | `string` | `undefined` | Organization or project publisher name. |
| `links?` | `{ label: string; href: string }[]` | `[]` | Secondary navigation links. |

---

### `<HeroWelcome />`
High-contrast editorial hero banner with dynamic typography clamp scaling.

#### Props (`HeroWelcomeProps`)
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `title?` | `string` | Config `heroTitle` | Main headline (8-word budget recommended). |
| `subtitle?` | `string` | Config `heroSubtitle` | Subtitle (22-word budget recommended). |
| `kicker?` | `string` | `'OVERVIEW'` | Eyebrow category tag. |
| `onExploreClick?`| `() => void` | Smooth scroll | Primary CTA button callback. |

---

## 2. Stepped Sequence Components (`src/components/roadmap/`)

### `<RoadmapTrack />`
Renders the parametric continuous Bézier SVG curve track connecting sequence waypoints.

#### Props (`RoadmapTrackProps`)
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `nodes` | `NodeItem[]` | `[]` | Array of milestone sequence nodes. |
| `activeNodeId` | `string` | `''` | Currently active node in viewport. |
| `onSelectNode` | `(id: string) => void` | Required | Waypoint selection callback. |
| `trackWidth?` | `number` | Dynamic | Optional container width override. |

---

### `<RoadmapNode />`
Individual waypoint card along the sequence track with 4-state interactive styling.

#### Props (`RoadmapNodeProps`)
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `NodeItem` | Required | Node data object. |
| `x` | `number` | Required | X coordinate computed by serpentine generator. |
| `y` | `number` | Required | Y coordinate computed by serpentine generator. |
| `flank` | `'left' \| 'right' \| 'center'` | Required | Visual orientation relative to Bézier center line. |
| `isActive` | `boolean` | Required | Whether node is currently in the active viewport focus. |
| `onSelect` | `() => void` | Required | Click handler triggering navigation. |

---

## 3. Document Canvas Components (`src/components/canvas/`)

### `<DocumentCanvas />`
The primary recursive AST block canvas renderer.

#### Props (`DocumentCanvasProps`)
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `document` | `NodeCanvasDocument` | Required | Full document AST object. |
| `isDevMode?` | `boolean` | `false` | Enables inline editing affordances and add bars. |
| `onDocumentChange?` | `(doc: NodeCanvasDocument) => void` | `undefined` | Callback fired on block edits, moves, or deletions. |

---

### `<CanvasSection />`
Renders an individual numbered section (`01`, `02`) containing subsections and leaf blocks.

#### Props
| Prop | Type | Description |
| :--- | :--- | :--- |
| `section` | `SectionElement` | Section AST data element. |
| `isDevMode` | `boolean` | Coordinator mode toggle. |
| `onUpdate` | `(section: SectionElement) => void` | Update dispatcher. |
| `onDelete` | `() => void` | Delete dispatcher. |

---

## 4. Vector Chart Components (`src/components/chart/`)

### `<ChartRouter />`
Smart container selecting the appropriate D3 SVG renderer based on `config.type`.

#### Props (`ChartRouterProps`)
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `config` | `ChartConfig` | Required | Complete chart configuration object. |
| `onOpenDrawer?` | `() => void` | `undefined` | Callback opening the configuration drawer. |
| `interactive?` | `boolean` | `true` | Enables tooltips and legend clicks. |

---

### `<BarChart />`, `<LineChart />`, `<DonutChart />`, `<ScatterPlot />`, `<HistogramChart />`
Individual pure D3 SVG chart renderers.

#### Shared Props (`BaseChartProps`)
| Prop | Type | Description |
| :--- | :--- | :--- |
| `config` | `ChartConfig` | Normalized chart configuration. |
| `width?` | `number` | Optional fixed width (defaults to responsive SVG 100%). |
| `height?` | `number` | Aspect-ratio derived height (default: 380px). |

---

## 5. UI Primitives (`src/components/ui/`)

### `<ParametricShape />`
Mathematical cubic-Bézier polygon generator creating smooth, pulsating, or wavy geometric brand marks.

#### Props (`ParametricShapeProps`)
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `sides` | `number` | `8` | Number of polygon vertices (3 to 32). |
| `waviness` | `number` | `0.15` | Amplitude of Bézier undulating lobes (0.0 to 1.0). |
| `size` | `number` | `40` | SVG square bounding dimension in pixels. |
| `color` | `string` | `'var(--folio-primary)'` | SVG fill or stroke color. |

---

### `<Button />`
Canonical button primitive adhering to the 4-state interactive matrix and zero outline policy.

#### Props (`ButtonProps`)
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `variant?` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'primary'` | Visual surface variant. |
| `size?` | `'sm' \| 'md' \| 'lg'` | `'md'` | Padding and font dimension. |
| `isLoading?` | `boolean` | `false` | Displays loading spinner and disables pointer. |
| `disabled?` | `boolean` | `false` | Disabled state with accessible opacity and cursor. |

---

### `<Modal />` & `<Drawer />`
Accessible overlays with scroll locks, focus traps, and backdrop dismissal.

#### Shared Overlay Props
| Prop | Type | Description |
| :--- | :--- | :--- |
| `isOpen` | `boolean` | Controls visibility. |
| `onClose` | `() => void` | Callback triggered on Escape key or backdrop click. |
| `title?` | `string` | Accessible dialog title (`aria-labelledby`). |
| `children` | `React.ReactNode` | Modal or drawer body contents. |
