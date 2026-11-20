/**
 * Folio Engine — Pure Page Tree Domain Service & Smart 404 Fuzzy Matcher
 * Location: src/services/pageTreeService.ts
 * Specification: docs/task/13.2-pure-page-tree-service-and-fuzzy-404-matcher.md
 *
 * 100% pure, immutable, zero-DOM / zero-React / zero-KV domain service.
 * Safe for both browser React components and Cloudflare Edge Workers.
 */

import type { NodeCanvasDocument } from '../types/canvas';
import { isPageLinkElement } from '../types/canvas';
import { normalizeCanvasDocument } from '../utils/canvasDefaults';
import type { NavItem } from '../types/navigation';
import type { NodeItem } from '../types/node';
import type {
  PageAncestorItem,
  PageMatchCandidate,
  PageNode,
  PageRegistry,
} from '../types/page';

export const RESERVED_SLUGS = new Set([
  'node',
  'page',
  'api',
  'index',
  'index.html',
  'assets',
  'static',
  'favicon.ico',
  'robots.txt',
]);

export const MAX_PAGE_SUMMARY_WORDS = 15;

const MAX_SLUG_LENGTH = 64;

export interface SlugValidationResult {
  valid: boolean;
  sanitized: string;
  error?: string;
  suggestedSlug?: string;
}

export interface CreatePageNodeInput {
  parentId: string;
  title: string;
  slug?: string;
  subtitle?: string;
  summary?: string;
  coverImage?: string;
  order?: number;
  id?: string;
  nowIso?: string;
}

export interface AncestorChainResult {
  rootNode: NodeItem | null;
  ancestors: PageAncestorItem[];
  parent: PageAncestorItem | null;
}

export type ResolvePathResult =
  | {
    matched: true;
    pageId: string;
    rootNode: NodeItem;
    pageNode: PageNode | null;
    ancestors: PageAncestorItem[];
  }
  | {
    matched: false;
    rootNode: NodeItem | null;
    nearestValidAncestor: PageAncestorItem | null;
  };

export interface FindSimilarPagesOptions {
  limit?: number;
  basePath?: string;
  minScore?: number;
  titleResolver?: (node: NodeItem) => string;
}

// ============================================================================
// 1. ID Generation & Slug Sanitization / Validation
// ============================================================================

/** Generates a unique page ID matching PAGE_ID_REGEX (/^[a-z0-9_-]{1,64}$/). */
export function generatePageId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 7).padEnd(5, '0');
  return `page-${ts}-${rand}`;
}

/** Normalizes arbitrary text into a lowercase kebab-case URL slug (max 64 chars). */
export function sanitizeSlug(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) return '';
  return normalized.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '');
}

function findSiblingBySlug(
  slug: string,
  parentId: string | null,
  pages: PageRegistry,
  excludePageId?: string
): PageNode | undefined {
  const target = slug.toLowerCase();
  return Object.values(pages).find(
    (p) =>
      p.parentId === parentId &&
      p.id !== excludePageId &&
      p.slug.toLowerCase() === target
  );
}

/** Produces a sibling-unique slug under `parentId`, appending `-2`, `-3`, ... on collision. */
export function ensureUniqueSiblingSlug(
  baseSlug: string,
  parentId: string | null,
  pages: PageRegistry,
  excludePageId?: string
): string {
  const sanitized = sanitizeSlug(baseSlug);
  const rawLower = baseSlug.trim().toLowerCase();
  const base =
    !sanitized || RESERVED_SLUGS.has(sanitized) || RESERVED_SLUGS.has(rawLower)
      ? 'page'
      : sanitized;

  if (!findSiblingBySlug(base, parentId, pages, excludePageId)) {
    return base;
  }

  let counter = 2;
  while (counter < 10000) {
    const suffix = `-${counter}`;
    const trimmedBase = base
      .slice(0, MAX_SLUG_LENGTH - suffix.length)
      .replace(/-+$/g, '');
    const candidate = `${trimmedBase || 'page'}${suffix}`;
    if (!findSiblingBySlug(candidate, parentId, pages, excludePageId)) {
      return candidate;
    }
    counter += 1;
  }

  return `${base.slice(0, 48)}-${Date.now().toString(36)}`;
}

/** Validates a slug against emptiness, reserved names, and sibling-only collisions. */
export function validateSlug(
  slug: string,
  parentId: string | null,
  pages: PageRegistry,
  excludePageId?: string
): SlugValidationResult {
  const sanitized = sanitizeSlug(slug);
  if (!sanitized) {
    return {
      valid: false,
      sanitized: '',
      error: 'URL name is required.',
    };
  }

  const rawLower = slug.trim().toLowerCase();
  if (RESERVED_SLUGS.has(sanitized) || RESERVED_SLUGS.has(rawLower)) {
    return {
      valid: false,
      sanitized,
      error: 'This URL name is reserved.',
    };
  }

  const collision = findSiblingBySlug(sanitized, parentId, pages, excludePageId);
  if (collision) {
    return {
      valid: false,
      sanitized,
      error: `A sibling page already uses "${sanitized}".`,
      suggestedSlug: ensureUniqueSiblingSlug(sanitized, parentId, pages, excludePageId),
    };
  }

  return {
    valid: true,
    sanitized,
  };
}

/** Counts words in an optional page summary for editorial restraint validation. */
export function countSummaryWords(text?: string): number {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// ============================================================================
// 2. Immutable Tree CRUD & Cycle-Safe Reparenting
// ============================================================================

/** Returns direct children of `parentId` sorted stably by order, createdAt, and id. */
export function getDirectChildren(pages: PageRegistry, parentId: string): PageNode[] {
  return Object.values(pages)
    .filter((p) => p.parentId === parentId)
    .sort(
      (a, b) =>
        a.order - b.order ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id)
    );
}

/** Immutably creates a new PageNode with a sibling-unique slug and returns updated registry. */
export function createPageNode(
  pages: PageRegistry,
  input: CreatePageNodeInput
): { pages: PageRegistry; page: PageNode } {
  const id = input.id ?? generatePageId();
  const slug = ensureUniqueSiblingSlug(
    input.slug ?? input.title,
    input.parentId,
    pages,
    id
  );
  const order =
    input.order !== undefined
      ? input.order
      : getDirectChildren(pages, input.parentId).length;
  const now = input.nowIso ?? new Date().toISOString();

  const page: PageNode = {
    id,
    parentId: input.parentId,
    slug,
    title: input.title,
    ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
    order,
    createdAt: now,
    updatedAt: now,
  };

  return {
    pages: { ...pages, [page.id]: page },
    page,
  };
}

/** Immutably updates metadata on an existing PageNode, validating any slug change. */
export function updatePageNodeMetadata(
  pages: PageRegistry,
  pageId: string,
  updates: Partial<Pick<PageNode, 'title' | 'slug' | 'subtitle' | 'summary' | 'coverImage' | 'order'>>,
  nowIso?: string
): { pages: PageRegistry; page: PageNode } {
  const current = pages[pageId];
  if (!current) {
    throw new Error(`Page "${pageId}" does not exist.`);
  }

  let nextSlug = current.slug;
  if (updates.slug !== undefined) {
    const validation = validateSlug(updates.slug, current.parentId, pages, pageId);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Invalid URL name.');
    }
    nextSlug = validation.sanitized;
  }

  const nextPage: PageNode = {
    ...current,
    ...(updates.title !== undefined ? { title: updates.title } : {}),
    ...(updates.subtitle !== undefined ? { subtitle: updates.subtitle } : {}),
    ...(updates.summary !== undefined ? { summary: updates.summary } : {}),
    ...(updates.coverImage !== undefined ? { coverImage: updates.coverImage } : {}),
    ...(updates.order !== undefined ? { order: updates.order } : {}),
    slug: nextSlug,
    updatedAt: nowIso ?? new Date().toISOString(),
  };

  return {
    pages: { ...pages, [pageId]: nextPage },
    page: nextPage,
  };
}

/** Collects all descendant PageNode IDs of `pageId` with cycle protection. */
export function getDescendantPageIds(pages: PageRegistry, pageId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const node of Object.values(pages)) {
    if (node.parentId === null) continue;
    const list = childrenByParent.get(node.parentId);
    if (list) {
      list.push(node.id);
    } else {
      childrenByParent.set(node.parentId, [node.id]);
    }
  }

  const visited = new Set<string>([pageId]);
  const descendants: string[] = [];
  const queue: string[] = [pageId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const childIds = childrenByParent.get(currentId);
    if (!childIds) continue;

    for (const childId of childIds) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      descendants.push(childId);
      queue.push(childId);
    }
  }

  return descendants;
}

/** Returns exact count of descendant pages under `pageId`. */
export function countDescendantPages(pages: PageRegistry, pageId: string): number {
  return getDescendantPageIds(pages, pageId).length;
}

/** Immutably deletes `pageId` and all its descendants from `pages`. */
export function cascadeDeleteSubtree(
  pages: PageRegistry,
  pageId: string
): { pages: PageRegistry; deletedIds: string[] } {
  if (!pages[pageId]) {
    return { pages, deletedIds: [] };
  }

  const descendants = getDescendantPageIds(pages, pageId);
  const deletedIds = [pageId, ...descendants];
  const deleteSet = new Set(deletedIds);

  const nextPages: PageRegistry = {};
  for (const [id, node] of Object.entries(pages)) {
    if (!deleteSet.has(id)) {
      nextPages[id] = node;
    }
  }

  return { pages: nextPages, deletedIds };
}

/** Immutably reparents `pageId` under `newParentId`, rejecting cycles and disambiguating slug. */
export function reparentPageNode(
  pages: PageRegistry,
  pageId: string,
  newParentId: string,
  nowIso?: string
): { pages: PageRegistry; page: PageNode } {
  const current = pages[pageId];
  if (!current) {
    throw new Error(`Page "${pageId}" does not exist.`);
  }

  if (newParentId === pageId || getDescendantPageIds(pages, pageId).includes(newParentId)) {
    throw new Error('Cannot move a page into itself or one of its subpages.');
  }

  const slug = ensureUniqueSiblingSlug(current.slug, newParentId, pages, pageId);
  const nextOrder = getDirectChildren(pages, newParentId).filter(
    (child) => child.id !== pageId
  ).length;

  const updatedPage: PageNode = {
    ...current,
    parentId: newParentId,
    slug,
    order: nextOrder,
    updatedAt: nowIso ?? new Date().toISOString(),
  };

  return {
    pages: { ...pages, [pageId]: updatedPage },
    page: updatedPage,
  };
}

// ============================================================================
// 3. Canvas-Driven Order Synchronization
// ============================================================================

/** Extracts deduplicated PageLinkElement targetPageIds in exact document reading order. */
export function extractPageLinkOrderFromCanvas(canvas: NodeCanvasDocument): string[] {
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  const normalized = normalizeCanvasDocument(canvas, canvas.nodeId);

  for (const element of normalized.elements) {
    if (isPageLinkElement(element)) {
      if (!seen.has(element.targetPageId)) {
        seen.add(element.targetPageId);
        orderedIds.push(element.targetPageId);
      }
    }
  }

  return orderedIds;
}

/** Synchronizes direct child PageNode.order values to match parent canvas PageLinkElement order. */
export function deriveSubpageOrderFromCanvas(
  pages: PageRegistry,
  parentId: string,
  canvas: NodeCanvasDocument,
  nowIso?: string
): { pages: PageRegistry; changed: boolean } {
  const directChildren = getDirectChildren(pages, parentId);
  if (directChildren.length === 0) {
    return { pages, changed: false };
  }

  const linkedOrder = extractPageLinkOrderFromCanvas(canvas);
  const childById = new Map(directChildren.map((c) => [c.id, c]));

  const sortedChildren: PageNode[] = [];
  const placedIds = new Set<string>();

  for (const targetId of linkedOrder) {
    const child = childById.get(targetId);
    if (child && !placedIds.has(child.id)) {
      placedIds.add(child.id);
      sortedChildren.push(child);
    }
  }

  for (const child of directChildren) {
    if (!placedIds.has(child.id)) {
      placedIds.add(child.id);
      sortedChildren.push(child);
    }
  }

  let changed = false;
  for (let i = 0; i < sortedChildren.length; i++) {
    if (sortedChildren[i].order !== i) {
      changed = true;
      break;
    }
  }

  if (!changed) {
    return { pages, changed: false };
  }

  const timestamp = nowIso ?? new Date().toISOString();
  const nextPages: PageRegistry = { ...pages };
  for (let i = 0; i < sortedChildren.length; i++) {
    const child = sortedChildren[i];
    if (child.order !== i) {
      nextPages[child.id] = {
        ...child,
        order: i,
        updatedAt: timestamp,
      };
    }
  }

  return { pages: nextPages, changed: true };
}

// ============================================================================
// 4. Folder Path Resolution, Ancestor Chains & 2-Level Nav Builder
// ============================================================================

function normalizeBasePath(basePath?: string): string {
  if (!basePath || basePath === '/') return '';
  return basePath.replace(/\/+$/, '');
}

function resolveRootTitle(
  rootNode: NodeItem,
  titleResolver?: (rootNode: NodeItem) => string
): string {
  return titleResolver ? titleResolver(rootNode) : rootNode.title;
}

/** Builds the canonical trailing-slash folder URL path for a root chapter or nested PageNode. */
export function buildPagePath(
  pageId: string,
  rootNodes: NodeItem[],
  pages: PageRegistry,
  basePath?: string
): string {
  const normBase = normalizeBasePath(basePath);
  const rootMatch = rootNodes.find((r) => r.id === pageId);
  if (rootMatch) {
    return `${normBase}/node/${rootMatch.id}/`;
  }

  const rootMap = new Map(rootNodes.map((r) => [r.id, r]));
  const slugs: string[] = [];
  const visited = new Set<string>();
  let currentId: string | null = pageId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const root = rootMap.get(currentId);
    if (root) {
      return `${normBase}/node/${root.id}/${slugs.join('/')}/`;
    }
    const page: PageNode | undefined = pages[currentId];
    if (!page) break;
    slugs.unshift(page.slug);
    currentId = page.parentId;
  }

  return `${normBase}/node/`;
}

/** Resolves decoded path segments after `/node/` to a matching chapter or nested PageNode. */
export function resolvePathToPage(
  segments: string[],
  rootNodes: NodeItem[],
  pages: PageRegistry
): ResolvePathResult {
  if (segments.length === 0) {
    return { matched: false, rootNode: null, nearestValidAncestor: null };
  }

  const rootSeg = segments[0].toLowerCase();
  const rootNode = rootNodes.find((r) => r.id.toLowerCase() === rootSeg);
  if (!rootNode) {
    return { matched: false, rootNode: null, nearestValidAncestor: null };
  }

  const rootAncestor: PageAncestorItem = {
    id: rootNode.id,
    title: rootNode.title,
    slug: rootNode.id,
    path: buildPagePath(rootNode.id, rootNodes, pages),
    isRootChapter: true,
  };

  const ancestors: PageAncestorItem[] = [rootAncestor];
  let nearestValidAncestor: PageAncestorItem = rootAncestor;
  let currentParentId = rootNode.id;
  let currentPageNode: PageNode | null = null;

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i].toLowerCase();
    const directChildren = getDirectChildren(pages, currentParentId);
    const matchedChild = directChildren.find((c) => c.slug.toLowerCase() === seg);
    if (!matchedChild) {
      return {
        matched: false,
        rootNode,
        nearestValidAncestor,
      };
    }

    const ancestorItem: PageAncestorItem = {
      id: matchedChild.id,
      title: matchedChild.title,
      slug: matchedChild.slug,
      path: buildPagePath(matchedChild.id, rootNodes, pages),
      isRootChapter: false,
    };
    ancestors.push(ancestorItem);
    nearestValidAncestor = ancestorItem;
    currentParentId = matchedChild.id;
    currentPageNode = matchedChild;
  }

  return {
    matched: true,
    pageId: currentParentId,
    rootNode,
    pageNode: currentPageNode,
    ancestors,
  };
}

/** Returns the ordered ancestor chain from root chapter down to `pageId`, plus rootNode and immediate parent. */
export function getAncestorChain(
  pageId: string,
  rootNodes: NodeItem[],
  pages: PageRegistry,
  basePath?: string,
  titleResolver?: (rootNode: NodeItem) => string
): AncestorChainResult {
  const rootMap = new Map(rootNodes.map((r) => [r.id, r]));
  const directRoot = rootMap.get(pageId);
  if (directRoot) {
    const item: PageAncestorItem = {
      id: directRoot.id,
      title: resolveRootTitle(directRoot, titleResolver),
      slug: directRoot.id,
      path: buildPagePath(directRoot.id, rootNodes, pages, basePath),
      isRootChapter: true,
    };
    return {
      rootNode: directRoot,
      ancestors: [item],
      parent: null,
    };
  }

  const pageChain: PageNode[] = [];
  const visited = new Set<string>();
  let currentId: string | null = pageId;
  let foundRoot: NodeItem | null = null;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const root = rootMap.get(currentId);
    if (root) {
      foundRoot = root;
      break;
    }
    const page: PageNode | undefined = pages[currentId];
    if (!page) break;
    pageChain.unshift(page);
    currentId = page.parentId;
  }

  const ancestors: PageAncestorItem[] = [];
  if (foundRoot) {
    ancestors.push({
      id: foundRoot.id,
      title: resolveRootTitle(foundRoot, titleResolver),
      slug: foundRoot.id,
      path: buildPagePath(foundRoot.id, rootNodes, pages, basePath),
      isRootChapter: true,
    });
  }

  for (const page of pageChain) {
    ancestors.push({
      id: page.id,
      title: page.title,
      slug: page.slug,
      path: buildPagePath(page.id, rootNodes, pages, basePath),
      isRootChapter: false,
    });
  }

  const parent = ancestors.length >= 2 ? ancestors[ancestors.length - 2] : null;
  return {
    rootNode: foundRoot,
    ancestors,
    parent,
  };
}

/** Builds a strictly 2-level navigation tree (chapters + direct Level 2 subpages). */
export function buildTwoLevelNavTree(
  rootNodes: NodeItem[],
  pages: PageRegistry,
  activePageId?: string | null,
  basePath?: string,
  titleResolver?: (rootNode: NodeItem) => string
): NavItem[] {
  const activeRootId = activePageId
    ? getAncestorChain(activePageId, rootNodes, pages, basePath, titleResolver).rootNode?.id ?? null
    : null;

  return rootNodes.map((root) => {
    const directChildren = getDirectChildren(pages, root.id);
    const children: NavItem[] = directChildren.map((child) => ({
      label: child.title,
      href: buildPagePath(child.id, rootNodes, pages, basePath),
      pageId: child.id,
      level: 'subpage',
      isActive: activePageId === child.id,
      ...(child.summary ? { summary: child.summary } : {}),
    }));

    return {
      label: resolveRootTitle(root, titleResolver),
      href: buildPagePath(root.id, rootNodes, pages, basePath),
      pageId: root.id,
      level: 'chapter',
      isActive: activeRootId === root.id,
      ...(children.length > 0 ? { children } : {}),
    };
  });
}

// ============================================================================
// 5. Smart 404 Fuzzy Similarity Matcher
// ============================================================================

/** Computes iterative O(m*n) Levenshtein edit distance between two strings. */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;

  let prev = new Array<number>(shorter.length + 1);
  let curr = new Array<number>(shorter.length + 1);

  for (let j = 0; j <= shorter.length; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= longer.length; i++) {
    curr[0] = i;
    const chLong = longer[i - 1];
    for (let j = 1; j <= shorter.length; j++) {
      const cost = chLong === shorter[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[shorter.length];
}

function tokenizeText(input: string): string[] {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function diceSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  return (2 * intersection) / (setA.size + setB.size);
}

function normalizedLevenshtein(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

interface SearchCorpusItem {
  id: string;
  title: string;
  slug: string;
  rootId: string;
  relPath: string;
  path: string;
  breadcrumbLabel: string;
}

/** Ranks valid pages by fuzzy similarity to attempted 404 URL segments. */
export function findSimilarPages(
  attemptedSegments: string[],
  rootNodes: NodeItem[],
  pages: PageRegistry,
  options?: FindSimilarPagesOptions
): PageMatchCandidate[] {
  const limit = options?.limit ?? 5;
  const minScore = options?.minScore ?? 0.2;
  const basePath = options?.basePath;
  const titleResolver = options?.titleResolver;

  const cleanSegments = attemptedSegments
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (cleanSegments.length === 0) return [];

  const corpus: SearchCorpusItem[] = [];

  for (const root of rootNodes) {
    const title = resolveRootTitle(root, titleResolver);
    corpus.push({
      id: root.id,
      title,
      slug: root.id,
      rootId: root.id,
      relPath: root.id.toLowerCase(),
      path: buildPagePath(root.id, rootNodes, pages, basePath),
      breadcrumbLabel: title,
    });
  }

  for (const page of Object.values(pages)) {
    const chain = getAncestorChain(page.id, rootNodes, pages, basePath, titleResolver);
    if (!chain.rootNode) continue;
    corpus.push({
      id: page.id,
      title: page.title,
      slug: page.slug,
      rootId: chain.rootNode.id,
      relPath: chain.ancestors.map((a) => a.slug.toLowerCase()).join('/'),
      path: buildPagePath(page.id, rootNodes, pages, basePath),
      breadcrumbLabel: chain.ancestors.map((a) => a.title).join(' / '),
    });
  }

  const attemptedLeaf = cleanSegments[cleanSegments.length - 1];
  const attemptedFullPath = cleanSegments.join('/');
  const attemptedTokens = cleanSegments.flatMap(tokenizeText);
  const attemptedRoot = cleanSegments[0];

  const scored: PageMatchCandidate[] = [];

  for (const item of corpus) {
    const candidateSlug = item.slug.toLowerCase();
    const candidateTitleLower = item.title.toLowerCase();
    const candidateTitleSlug = sanitizeSlug(item.title);
    const candidateTokens = [
      ...tokenizeText(item.slug),
      ...tokenizeText(item.title),
    ];

    const tokenOverlap = diceSimilarity(attemptedTokens, candidateTokens);
    const levSim = Math.max(
      normalizedLevenshtein(attemptedLeaf, candidateSlug),
      normalizedLevenshtein(attemptedLeaf, candidateTitleSlug || candidateTitleLower),
      normalizedLevenshtein(attemptedFullPath, item.relPath)
    );

    let substringBonus = 0;
    if (
      attemptedLeaf.length >= 2 &&
      (candidateSlug.includes(attemptedLeaf) ||
        attemptedLeaf.includes(candidateSlug) ||
        candidateTitleLower.includes(attemptedLeaf))
    ) {
      substringBonus = 0.15;
    } else if (
      attemptedTokens.some(
        (t) =>
          t.length >= 3 &&
          (candidateSlug.includes(t) || candidateTitleLower.includes(t))
      )
    ) {
      substringBonus = 0.08;
    }

    const ancestorBonus = attemptedRoot === item.rootId.toLowerCase() ? 0.1 : 0;

    const score = Math.min(
      1,
      Math.max(0, 0.35 * tokenOverlap + 0.5 * levSim + substringBonus + ancestorBonus)
    );

    if (score >= minScore) {
      scored.push({
        id: item.id,
        title: item.title,
        path: item.path,
        breadcrumbLabel: item.breadcrumbLabel,
        score,
      });
    }
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.path.length - b.path.length ||
      a.title.localeCompare(b.title)
  );

  return scored.slice(0, limit);
}
