/**
 * Canonical Navigation Type Contracts
 * Document Reference: docs/07_CODING_STANDARDS.md
 * 
 * Reusable navigation contracts across AppHeader, EditorialSidebar,
 * Table of Contents, and Mobile Navigation Menus.
 */

export interface NavItem {
  /** Display label for the navigation item */
  label: string;
  /** Navigation destination (URL, route hash e.g. '#stage-1', or path) */
  href: string;
  /** Unique element ID targeted by in-page anchors without the '#' prefix */
  id?: string;
  /** Optional sequence or stage number prefix (e.g. '01', '02') rendered in JetBrains Mono */
  number?: string;
  /** Explicit active state flag when controlled externally */
  isActive?: boolean;
}
