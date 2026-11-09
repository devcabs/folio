---
name: accessibility
description: WCAG 2.1 AA accessibility standards, keyboard navigation, focus management, and screen-reader support.
---

# Accessibility (a11y) Standards

> **PREVALENCE NOTICE:** All interactive components in Folio Engine must satisfy WCAG 2.1 AA criteria.

## Standards & Practices

1. **Keyboard Navigation & Focus Management**:
   - All interactive controls (buttons, tabs, modal dialogs, drawers, lightboxes) must be fully operable via keyboard (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`).
   - Modal dialogs and drawers must implement focus traps and return focus upon closing.
   - Enforce the Universal Zero Outline Policy: replace browser outline rings with clear contrast shifts and calm focus styling.

2. **ARIA Semantics & Roles**:
   - Assign appropriate ARIA attributes (`aria-expanded`, `aria-selected`, `aria-controls`, `role="dialog"`, `role="region"`).
   - Ensure screen-reader announcements for asynchronous status changes.

3. **Color Contrast & Readability**:
   - Ensure contrast ratios >= 4.5:1 for normal text and >= 3:1 for graphical objects and UI components.
