/**
 * Folio Engine — Canonical Page Tree Contract & Zod Schemas
 * Location: src/types/page.ts
 * Specification: docs/task/13.1-page-tree-canvas-ast-and-edge-kv-contracts.md
 *
 * Pure TypeScript + Zod module (zero React/DOM imports) so Edge Workers
 * and client services share identical validation and type contracts.
 */

import { z } from 'zod';

/** Strictly matches NODE_ID_REGEX in src/edge/handlers/publicHandler.ts */
export const PAGE_ID_REGEX = /^[a-z0-9_-]{1,64}$/;

/** Lowercase alphanumeric kebab-case URL segment; max 64 chars enforced in schema */
export const PAGE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface PageNode {
  /** Unique stable page identifier matching PAGE_ID_REGEX (e.g. "page-<base36ts>-<rand>") */
  id: string;
  /** Parent chapter ID (from EngineConfig.nodes) or parent PageNode.id; null reserved for future root compatibility */
  parentId: string | null;
  /** URL folder segment under its parent (strictly sanitized, unique among siblings) */
  slug: string;
  /** Single-authority display title shared across Page Link card, PageTitle, Breadcrumb, and AppHeader */
  title: string;
  /** Optional extended subtitle */
  subtitle?: string;
  /** Optional 1-line summary (recommended <= 15 words per editorial-restraint.md) */
  summary?: string;
  /** Optional cover image URL (external or Google Drive link) for editorial page-link cards */
  coverImage?: string;
  /** Zero-based display order among siblings (synced from parent canvas PageLinkElement order) */
  order: number;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 last-update timestamp */
  updatedAt: string;
}

export type PageRegistry = Record<string, PageNode>;

export const PageNodeSchema = z.object({
  id: z.string().regex(PAGE_ID_REGEX, 'Page id must match /^[a-z0-9_-]{1,64}$/'),
  parentId: z.string().min(1).nullable(),
  slug: z
    .string()
    .min(1, 'Page slug is required')
    .max(64, 'Page slug must be at most 64 characters')
    .regex(PAGE_SLUG_REGEX, 'Page slug must be lowercase kebab-case'),
  title: z.string().min(1, 'Page title is required'),
  subtitle: z.string().optional(),
  summary: z.string().optional(),
  coverImage: z.string().optional(),
  order: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const PageRegistrySchema = z.record(z.string(), PageNodeSchema);

export interface PageAncestorItem {
  id: string;
  title: string;
  slug: string;
  path: string;
  isRootChapter: boolean;
}

export interface PageMatchCandidate {
  id: string;
  title: string;
  path: string;
  breadcrumbLabel: string;
  score: number;
}

export interface PageMutationPayload {
  pages?: PageRegistry;
  deletedPageIds?: string[];
}
