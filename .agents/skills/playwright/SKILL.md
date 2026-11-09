---
name: playwright
description: Browser automation, visual snapshots, and end-to-end testing for Folio Engine applications.
---

# Playwright E2E & Browser Automation

> **PREVALENCE NOTICE:** Browser tests verify interaction budgets, accessibility, and visual integrity of Folio Engine components and showcase views.

## Core Capabilities & Verification Targets

1. **Sequence Track & Scroll Navigation**:
   - Verify continuous-scroll Bézier track responsiveness and step active states.
   - Assert smooth section transitions and hash-route synchronization.

2. **Document Canvas & AST Rendering**:
   - Verify recursive section rendering, nested subsections, and media lightboxes.
   - Test inline editing affordances in Developer Mode.

3. **Chart Studio & Interactive Drawers**:
   - Verify SVG chart rendering, hover tooltips, and data drawer slide-ins.

4. **Accessibility & Visual Quality**:
   - Perform automated axe accessibility scans.
   - Capture cross-viewport visual snapshots (desktop, tablet, mobile).
