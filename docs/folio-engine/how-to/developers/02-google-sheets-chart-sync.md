# How-To: Synchronize Google Sheets with In-Browser Vector Charts

This guide walks through configuring the In-Browser Vector Chart Studio in Folio Engine, connecting published Google Sheets or CSV URLs, and customizing visualization parameters via `ChartConfigDrawer`.

---

## 🎯 Problem Statement

Data visualizers frequently change in production. Hardcoding chart values in JSON requires developer deployments for simple tabular edits. Folio Engine enables live, zero-code synchronization from Google Sheets directly to responsive SVG charts while maintaining 100% token styling and XSS sanitization.

---

## 🏗️ Synchronization Pipeline

```
[ Google Sheet ] ──(Publish to Web as CSV)──> [ Google Sheets API / CSV Endpoint ]
                                                          │
                                                          ▼
                                             [ sheetsDataService.ts ]
                                             ├── CSV Parse & Matrix Extract
                                             ├── Strip Summary Rows (Total, Avg)
                                             └── Optional Matrix Transposition
                                                          │
                                                          ▼
                                             [ chartSanitizer.ts ]
                                             └── Number Purity & Anti-XSS Sanitizer
                                                          │
                                                          ▼
                                             [ D3-Scale Renderers ]
                                             (Bar / Line / Donut / Scatter / Histogram)
```

---

## Step 1: Prepare the Google Sheet

1. Open your Google Sheet.
2. Ensure the top row contains column headers (e.g., `Category`, `2024`, `2025`, `Target`).
3. Ensure the first column contains series or category labels.
4. Click **File** &rarr; **Share** &rarr; **Publish to the Web**.
5. Choose the specific tab, set format to **Comma-separated values (.csv)**, and click **Publish**.
6. Copy the published CSV URL.

---

## Step 2: Open Chart Studio in Developer Mode

1. Enter Coordinator Mode (`Ctrl + Shift + D` and enter PIN).
2. Navigate to the chart block on any canvas document.
3. Hover over the chart and click the **Configure Chart** button (`ChartConfigDrawer` opens on the right edge).

---

## Step 3: Complete the 4-Step Configuration Wizard

The `ChartConfigDrawer` guides you through 4 atomic panels:

### Step 1: Source & URL
- Paste the published Google Sheet CSV URL or raw sheet URL.
- The engine automatically verifies the sheet via `sheetsVerificationService.ts` and fetches available tabs.

### Step 2: Data Range & Pre-Processing
- Preview the tabular dataset in `RangePreviewMatrix`.
- **Transpose**: Toggle if your data is arranged horizontally rather than vertically.
- **Exclude Summary Rows**: Automatically strips `Total`, `Grand Total`, and `Average` rows from chart series.
- **Specific Range**: Define cell ranges (e.g., `A2:E20`) to ignore header footnotes.

### Step 3: Visual Setup & Palette
- **Chart Type**: Select from `Bar`, `Line`, `Donut`, `Scatter`, `Histogram`, or `Auto`.
- **Accent Scheme**: Select the node accent color token or assign discrete multi-series colors.
- **Value Formatting**: Configure prefix (e.g. `$`), suffix (e.g. `%`), and decimal precision.
- **Axis Scales**: Set custom `yMin` and `yMax` boundaries or leave empty for dynamic D3 nice scaling.

### Step 4: Review & Live Test
- Inspect the interactive live SVG preview.
- Test hover tooltips (`ChartTooltip`).
- Verify data table modal (`ChartTableModal`) renders correctly for accessible data inspection.
- Click **Save Configuration**.

---

## Step 4: Standalone Code Embedding

To embed a vector chart directly in custom JSX without using the AST canvas:

```tsx
import React from 'react';
import { ChartRouter } from '@devcabs/folio-engine';
import type { ChartConfig } from '@devcabs/folio-engine';

const sampleChartConfig: ChartConfig = {
  id: 'revenue-growth',
  nodeId: 'financials',
  type: 'bar',
  title: 'Quarterly Revenue Growth',
  subtitle: 'Comparison between Q1-Q4 projections and actual performance',
  categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [
    { name: 'Projection', data: [120, 150, 180, 220], color: 'var(--color-node-1)' },
    { name: 'Actual', data: [130, 155, 175, 240], color: 'var(--color-node-2)' },
  ],
  visualConfig: {
    unit: '$k',
    showSummaryStats: true,
  },
};

export function QuarterlyChart() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <ChartRouter config={sampleChartConfig} />
    </div>
  );
}
```

---

## 🛡️ Security & XSS Protection

All incoming Google Sheet cells pass through `src/utils/chartSanitizer.ts`:
- String labels are sanitized to prevent HTML tag injection.
- Numeric series coerce non-numeric strings (`"N/A"`, `"-"`, `""`) safely to `null`, preventing NaN crashes in SVG path generators.
- URLs and sheet formulas (`=IMPORTXML`, `=HYPERLINK`) are stripped.
