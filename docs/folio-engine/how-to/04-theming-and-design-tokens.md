# How-To: Customizing Theming & CSS Design Tokens

This guide explains how to customize brand colors, typography roles, spacing, and component surfaces in Folio Engine using pure CSS custom properties.

---

## 🎯 Design Token Philosophy

Folio Engine enforces a **Design System First** architecture:
1. **Zero Raw Hex Colors**: Components consume CSS variables exclusively (e.g., `var(--folio-primary)`).
2. **Zero Hardwired Font Families**: Typography styles consume abstract font role tokens (e.g., `var(--font-display)`, `var(--font-sans)`, `var(--font-mono)`).
3. **Automated Purity Gates**: `scripts/verify-token-aliases.ts` runs on every build, immediately failing compilation if any CSS property uses an un-tokenized color or dangling variable.

---

## 🎨 Token Architecture in `src/styles/tokens.css`

The token system is divided into functional layers:

```
tokens.css
├── Semantic Roles (--folio-primary, --folio-secondary, --folio-accent)
├── Surface Tones (--folio-bg-canvas, --folio-bg-surface, --folio-bg-card)
├── Typography Roles (--font-display, --font-sans, --font-mono, --tracking-tight)
├── Sequence Node Accents (--color-node-1 through --color-node-12)
├── Fluid Typography Roles (--text-display, --text-title, --text-subhead, --text-body)
└── Backward-Compatible Aliases (--color-pillar-1: var(--color-node-1))
```

---

## Step 1: Overriding Brand Colors

To customize your application's brand identity, define overriding CSS variables in your root stylesheet after importing `@devcabs/folio-engine/style.css`:

```css
/* my-theme.css */
:root {
  /* Primary brand hues */
  --folio-primary: #1e3a8a;          /* Deep Sapphire Blue */
  --folio-secondary: #f59e0b;        /* Warm Amber */
  --folio-accent: #0284c7;           /* Sky Blue Accent */

  /* Text & Ink Tokens */
  --folio-text-primary: #0f172a;     /* Slate 900 */
  --folio-text-secondary: #475569;   /* Slate 600 */
  --folio-text-muted: #94a3b8;       /* Slate 400 */

  /* Surface & Canvas Tokens */
  --folio-bg-canvas: #f8fafc;        /* Slate 50 */
  --folio-bg-surface: #ffffff;       /* Pure White */
  --folio-bg-card: #ffffff;
}
```

---

## Step 2: Customizing Node Waypoint Palettes

The serpentine track and vector charts dynamically consume node accent colors based on waypoint index (`--color-node-1` through `--color-node-12`):

```css
:root {
  /* Node 1: Architecture (Indigo) */
  --color-node-1: #4f46e5;
  --color-node-1-tint: #eef2ff;
  --color-node-1-border: rgba(79, 70, 229, 0.25);

  /* Node 2: Performance (Emerald) */
  --color-node-2: #059669;
  --color-node-2-tint: #ecfdf5;
  --color-node-2-border: rgba(5, 150, 105, 0.25);

  /* Node 3: Security (Crimson) */
  --color-node-3: #dc2626;
  --color-node-3-tint: #fef2f2;
  --color-node-3-border: rgba(220, 38, 38, 0.25);

  /* Node 4: Developer Experience (Violet) */
  --color-node-4: #7c3aed;
  --color-node-4-tint: #f5f3ff;
  --color-node-4-border: rgba(124, 58, 237, 0.25);
}
```

---

## Step 3: Configuring Typography Roles

Provide your custom font faces to the semantic typography tokens:

```css
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  /* Display & Section Headings */
  --font-display: 'Cinzel', serif;
  --font-serif: 'Cinzel', serif;

  /* Interface, Body, and Buttons */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Code, Metadata, and Timestamps */
  --font-mono: 'JetBrains Mono', monospace;

  /* Editorial Letter Spacing */
  --tracking-tight: -0.02em;
}
```

---

## Step 4: Universal Zero Outline Policy

Folio Engine strictly enforces calm focus across all interactive controls:

```css
/* Universal Zero Outline Standard */
:focus,
:focus-visible,
:active {
  outline: none !important;
}
```

Interactive states must communicate through subtle background surface shifts, typography contrast, or tactile elevation (`transform: translateY(1px)`), avoiding jarring browser outline rings.

---

## Step 5: Verify Token Purity & Aliases

Run the token alias verification script to guarantee no broken references exist:

```bash
npm run test:tokens
```

Expected output:
```text
🔍 [Token Gate] Found 254 defined CSS tokens in tokens.css.
✅ [Token Gate] 100% token purity and alias verification passed! (257 files scanned)
```
