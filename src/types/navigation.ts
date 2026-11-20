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
  /** Target root node ID or PageNode.id for client-side navigateToPage */
  pageId?: string;
  /** Optional sequence or stage number prefix (e.g. '01', '02') rendered in JetBrains Mono */
  number?: string;
  /** Explicit active state flag when controlled externally */
  isActive?: boolean;
  /** Optional hierarchy level for nested Table of Contents or 2-level chapter/subpage rendering */
  level?: 'section' | 'subsection' | 'chapter' | 'subpage';
  /** Optional tooltip/description metadata */
  summary?: string;
  /** Optional nested child navigation items (e.g. subsections under a section, or subpages under a chapter) */
  children?: NavItem[];
}
