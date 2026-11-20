import { useState, useEffect, useCallback, useRef } from "react";
import type { NodeCode, NodeItem } from "../types/node";
import type { PageAncestorItem, PageNode, PageRegistry } from "../types/page";
import { cancelCinematicScroll } from "../utils/smooth-scroll";
import { getEngineConfig, getActiveNodes } from "../config/engine.config";
import { buildPagePath, resolvePathToPage } from "../services/pageTreeService";
import {
  EVENT_WORKSPACE_UNDO_RECONCILE,
  type WorkspaceUndoReconcileDetail,
} from "../services/undoRedoService";

export type RouteType = "home" | "node" | "page" | "hydrating" | "not-found";

export interface RouteState {
  type: "home" | "node" | "hydrating" | "not-found";
  /** Resolved root chapter ID (e.g. 'access'), even when viewing a deep subpage */
  nodeId: NodeCode | null;
  /** Resolved active page ID (equals root nodeId on chapters; equals PageNode.id on subpages) */
  pageId: string | null;
  /** Canonical alias for pageId */
  activePageId: string | null;
  /** Resolved root chapter ID alias */
  rootNodeId: NodeCode | null;
  /** Resolved PageNode when viewing a dynamic subpage; null on root chapters / home / 404 */
  pageNode: PageNode | null;
  /** Ordered ancestor chain [rootChapter, ..., currentPage] */
  ancestors: PageAncestorItem[];
  /** Decoded path segments after /node/ (used by Smart 404 fuzzy matcher & nearest-parent recovery) */
  attemptedSegments: string[];
  /** Deepest valid ancestor matched before failure (used by Smart 404) */
  nearestValidAncestor: PageAncestorItem | null;
  targetStage: number | null;
  rawHash: string;
  pathname?: string;
}

export interface ParseRouteOptions {
  pages?: PageRegistry;
  rootNodes?: NodeItem[];
  isHydrating?: boolean;
}

export interface NavigateToPageOptions {
  replace?: boolean;
  pagesOverride?: PageRegistry;
}

export interface UseHashRouteOptions {
  pages?: PageRegistry;
  isHydrating?: boolean;
  isDevMode?: boolean;
  publishedPages?: PageRegistry;
  onDraftExitRedirect?: (targetTitle: string) => void;
  onUndoRedirect?: (parentTitle: string) => void;
}

function resolveStageForNode(code: string): number | null {
  const configNodes = getActiveNodes();
  if (configNodes.length === 0) return null;
  const idx = configNodes.findIndex((n) => n.id.toLowerCase() === code.toLowerCase());
  if (idx === -1) return null;
  return configNodes[idx].nodeNumber ?? idx + 1;
}

function createEmptyRouteState(
  type: RouteState["type"],
  rawHash: string,
  pathname: string,
  overrides: Partial<RouteState> = {}
): RouteState {
  return {
    type,
    nodeId: null,
    pageId: null,
    activePageId: null,
    rootNodeId: null,
    pageNode: null,
    ancestors: [],
    attemptedSegments: [],
    nearestValidAncestor: null,
    targetStage: null,
    rawHash,
    pathname,
    ...overrides,
  };
}

function decodePathSegments(rawTail: string): string[] | null {
  const parts = rawTail.split("/");
  const segments: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    try {
      const decoded = decodeURIComponent(part).trim().toLowerCase();
      if (decoded) {
        segments.push(decoded);
      }
    } catch {
      return null;
    }
  }
  return segments;
}

function normalizeBasePrefix(basePath?: string): string {
  return basePath ? "/" + basePath.trim().replace(/^\/+|\/+$/g, "") : "";
}

function resolveSegmentsToRouteState(
  segments: string[],
  rawHash: string,
  cleanPath: string,
  validNodes: NodeCode[] | undefined,
  rootNodes: NodeItem[],
  pages: PageRegistry,
  isHydrating: boolean
): RouteState {
  if (segments.length === 0) {
    return createEmptyRouteState("not-found", rawHash, cleanPath);
  }

  const rootCandidate = segments[0];
  const isRootAllowed = validNodes
    ? validNodes.some((n) => n.toLowerCase() === rootCandidate)
    : true;

  if (!isRootAllowed) {
    return createEmptyRouteState("not-found", rawHash, cleanPath, {
      attemptedSegments: segments,
    });
  }

  // Case A: Single segment (/node/:id/)
  if (segments.length === 1) {
    const matchedRoot = rootNodes.find((r) => r.id.toLowerCase() === rootCandidate);
    const code = matchedRoot ? matchedRoot.id : rootCandidate;
    const effectiveNodes = matchedRoot
      ? rootNodes
      : [{ id: code, title: code } as NodeItem];
    const canonicalPath = buildPagePath(code, effectiveNodes, pages);
    const rootAncestor: PageAncestorItem = {
      id: code,
      title: matchedRoot?.title ?? code,
      slug: code,
      path: canonicalPath,
      isRootChapter: true,
    };

    return createEmptyRouteState("node", rawHash, canonicalPath, {
      nodeId: code,
      pageId: code,
      activePageId: code,
      rootNodeId: code,
      pageNode: null,
      ancestors: [rootAncestor],
      attemptedSegments: [code],
      targetStage: resolveStageForNode(code),
    });
  }

  // Case B: Multi-segment (/node/<chapter>/<subpage>/.../)
  const resolved = resolvePathToPage(segments, rootNodes, pages);
  if (resolved.matched) {
    const canonicalPath = buildPagePath(resolved.pageId, rootNodes, pages);
    return createEmptyRouteState("node", rawHash, canonicalPath, {
      nodeId: resolved.rootNode.id,
      pageId: resolved.pageId,
      activePageId: resolved.pageId,
      rootNodeId: resolved.rootNode.id,
      pageNode: resolved.pageNode,
      ancestors: resolved.ancestors,
      attemptedSegments: segments,
      targetStage: resolveStageForNode(resolved.rootNode.id),
    });
  }

  // Optimistic Chapter-Prefix Hydration Guard
  if (isHydrating && resolved.rootNode !== null) {
    return createEmptyRouteState("hydrating", rawHash, cleanPath, {
      nodeId: resolved.rootNode.id,
      rootNodeId: resolved.rootNode.id,
      ancestors: resolved.nearestValidAncestor ? [resolved.nearestValidAncestor] : [],
      attemptedSegments: segments,
      nearestValidAncestor: resolved.nearestValidAncestor,
      targetStage: resolveStageForNode(resolved.rootNode.id),
    });
  }

  return createEmptyRouteState("not-found", rawHash, cleanPath, {
    attemptedSegments: segments,
    nearestValidAncestor: resolved.nearestValidAncestor,
  });
}

/**
 * Universal route parser supporting arbitrary-depth folder routes (/node/<chapter>/<subpage>/.../),
 * legacy hash routes (#node/:id), stage anchors (#stage-N), and basePath prefixes.
 */
export function parseRoute(
  pathname = "/",
  hash = "",
  validNodes?: NodeCode[],
  basePath?: string,
  options?: ParseRouteOptions
): RouteState {
  let cleanPath = pathname.trim().replace(/\/+$/, "") + "/";
  const cleanHash = hash.replace(/^#\/?/, "").trim();

  // Strip optional hosting basePath prefix (e.g. '/portal' or '/app')
  const effectiveBasePath = basePath ?? getEngineConfig().basePath;
  if (effectiveBasePath) {
    const normBase = effectiveBasePath.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    if (normBase && cleanPath.startsWith("/" + normBase + "/")) {
      cleanPath = cleanPath.slice(normBase.length + 1);
    }
  }

  const rootNodes = options?.rootNodes ?? getActiveNodes();
  const pages = options?.pages ?? {};
  const isHydrating = options?.isHydrating ?? false;

  // 1. Path route: /node/<chapter>/... or /page/<chapter>/...
  const pathMatch = cleanPath.match(/^\/(node|page)\/(.+?)\/?$/);
  if (pathMatch) {
    const segments = decodePathSegments(pathMatch[2]);
    if (!segments || segments.length === 0) {
      return createEmptyRouteState("not-found", hash, cleanPath);
    }
    return resolveSegmentsToRouteState(
      segments,
      hash,
      cleanPath,
      validNodes,
      rootNodes,
      pages,
      isHydrating
    );
  }

  // 2. Legacy Hash route: #node/... or #page/...
  if (cleanHash.startsWith("node/") || cleanHash.startsWith("page/")) {
    const prefix = cleanHash.startsWith("node/") ? "node/" : "page/";
    const segments = decodePathSegments(cleanHash.slice(prefix.length));
    if (!segments || segments.length === 0) {
      return createEmptyRouteState("not-found", hash, cleanPath);
    }
    return resolveSegmentsToRouteState(
      segments,
      hash,
      cleanPath,
      validNodes,
      rootNodes,
      pages,
      isHydrating
    );
  }

  // 3. Stage return targets on home (#stage-1 to #stage-N)
  const stageMatch = cleanHash.match(/^stage-(\d+)$/);
  if (stageMatch) {
    const stageNum = parseInt(stageMatch[1], 10);
    return createEmptyRouteState("home", hash, "/", {
      targetStage: stageNum,
    });
  }

  // 4. Recognized Home Landmarks or empty hash on root path
  const isHomeAnchor =
    !cleanHash ||
    cleanHash === "home" ||
    cleanHash === "main-content" ||
    cleanHash === "roadmap" ||
    cleanHash === "sequence-roadmap";

  const isRootPath = cleanPath === "/" || cleanPath === "/index.html/";

  if (isRootPath && isHomeAnchor) {
    return createEmptyRouteState("home", hash, "/");
  }

  // 5. Any unrecognized hash or non-root path
  return createEmptyRouteState("not-found", hash, cleanPath);
}

/**
 * Backwards compatibility helper for legacy hash parser
 */
export function parseHash(hash: string, validNodes?: NodeCode[]): RouteState {
  return parseRoute(
    typeof window !== "undefined" ? window.location.pathname : "/",
    hash,
    validNodes
  );
}

export function useHashRoute(
  validNodes?: NodeCode[],
  basePath?: string,
  options?: UseHashRouteOptions
) {
  const effectiveBasePath = basePath ?? getEngineConfig().basePath;
  const pages = options?.pages;
  const isHydrating = options?.isHydrating ?? false;
  const isDevMode = options?.isDevMode;
  const publishedPages = options?.publishedPages;
  const onDraftExitRedirect = options?.onDraftExitRedirect;
  const onUndoRedirect = options?.onUndoRedirect;

  const validNodesKey = validNodes ? validNodes.join("|") : "";
  const validNodesRef = useRef(validNodes);
  validNodesRef.current = validNodes;

  const [routeState, setRouteState] = useState<RouteState>(() =>
    parseRoute(
      typeof window !== "undefined" ? window.location.pathname : "/",
      typeof window !== "undefined" ? window.location.hash : "",
      validNodes,
      effectiveBasePath,
      { pages, isHydrating }
    )
  );

  const prevIsDevModeRef = useRef<boolean | undefined>(isDevMode);
  const lastResolvedRef = useRef<{
    pageId: string | null;
    rootNodeId: NodeCode | null;
    pageNode: PageNode | null;
    ancestors: PageAncestorItem[];
  } | null>(null);

  if (routeState.type === "node") {
    lastResolvedRef.current = {
      pageId: routeState.pageId,
      rootNodeId: routeState.rootNodeId,
      pageNode: routeState.pageNode,
      ancestors: routeState.ancestors,
    };
  }

  // Re-evaluate routeState whenever location, pages, isHydrating, validNodes, or basePath changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const cleanHash = window.location.hash.replace(/^#\/?/, "").trim();
    if (cleanHash.startsWith("node/") || cleanHash.startsWith("page/")) {
      const parsed = parseRoute(
        window.location.pathname,
        window.location.hash,
        validNodesRef.current,
        effectiveBasePath,
        { pages, isHydrating }
      );
      if (parsed.type === "node" && parsed.pathname) {
        const normBase = normalizeBasePrefix(effectiveBasePath);
        window.history.replaceState(null, "", `${normBase}${parsed.pathname}`);
      }
    }

    const syncRoute = () => {
      setRouteState(
        parseRoute(
          window.location.pathname,
          window.location.hash,
          validNodesRef.current,
          effectiveBasePath,
          { pages, isHydrating }
        )
      );
    };

    syncRoute();

    window.addEventListener("popstate", syncRoute);
    window.addEventListener("hashchange", syncRoute);

    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("hashchange", syncRoute);
    };
  }, [validNodesKey, effectiveBasePath, pages, isHydrating]);

  const navigateToPage = useCallback(
    (pageId: string, navOptions?: NavigateToPageOptions) => {
      cancelCinematicScroll();
      const targetPages = navOptions?.pagesOverride ?? pages ?? {};
      const rootNodes = getActiveNodes();
      const normBase = normalizeBasePrefix(effectiveBasePath);
      const isKnownRootOrPage =
        rootNodes.some((r) => r.id === pageId) || Boolean(targetPages[pageId]);
      const targetUrl = isKnownRootOrPage
        ? buildPagePath(pageId, rootNodes, targetPages, effectiveBasePath)
        : `${normBase}/node/${pageId}/`;

      if (typeof window !== "undefined") {
        if (navOptions?.replace) {
          window.history.replaceState(null, "", targetUrl);
        } else if (window.location.pathname !== targetUrl) {
          window.history.pushState(null, "", targetUrl);
        }
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        setRouteState(
          parseRoute(
            window.location.pathname,
            window.location.hash,
            validNodesRef.current,
            effectiveBasePath,
            { pages: targetPages, isHydrating }
          )
        );
      }
    },
    [validNodesKey, effectiveBasePath, pages, isHydrating]
  );

  const navigateToNode = useCallback(
    (nodeId: NodeCode) => {
      navigateToPage(nodeId);
    },
    [navigateToPage]
  );

  const navigateToHome = useCallback(
    (stage?: number) => {
      cancelCinematicScroll();
      const normBase = normalizeBasePrefix(effectiveBasePath);
      const targetUrl =
        stage && stage >= 1 ? normBase + "/#stage-" + stage : normBase || "/";
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", targetUrl);
        if (!stage) {
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        }
        setRouteState(
          parseRoute(
            window.location.pathname,
            window.location.hash,
            validNodesRef.current,
            effectiveBasePath,
            { pages, isHydrating }
          )
        );
      }
    },
    [validNodesKey, effectiveBasePath, pages, isHydrating]
  );

  // Dev Mode Draft Refresh / Exit Guard
  useEffect(() => {
    const wasDevMode = prevIsDevModeRef.current === true;
    prevIsDevModeRef.current = isDevMode;

    if (!wasDevMode || isDevMode !== false || isHydrating) {
      return;
    }

    const lastResolved = lastResolvedRef.current;
    if (!lastResolved || !lastResolved.pageNode) {
      return;
    }

    const draftPageId = lastResolved.pageNode.id;
    const isPublished = Boolean(publishedPages && publishedPages[draftPageId]);
    if (isPublished) {
      return;
    }

    // Walk ancestors from deepest parent to root chapter to find nearest published ancestor
    let nearestPublished: PageAncestorItem | null = null;
    for (let i = lastResolved.ancestors.length - 1; i >= 0; i--) {
      const candidate = lastResolved.ancestors[i];
      if (candidate.id === draftPageId) continue;
      if (candidate.isRootChapter || (publishedPages && publishedPages[candidate.id])) {
        nearestPublished = candidate;
        break;
      }
    }

    if (nearestPublished) {
      navigateToPage(nearestPublished.id, {
        replace: true,
        pagesOverride: publishedPages ?? {},
      });
      onDraftExitRedirect?.(nearestPublished.title);
    } else if (lastResolved.rootNodeId) {
      navigateToPage(lastResolved.rootNodeId, {
        replace: true,
        pagesOverride: publishedPages ?? {},
      });
      onDraftExitRedirect?.(lastResolved.rootNodeId);
    } else {
      navigateToHome();
    }
  }, [
    isDevMode,
    isHydrating,
    publishedPages,
    navigateToPage,
    navigateToHome,
    onDraftExitRedirect,
  ]);

  // Workspace-Aware Cross-Page Undo/Redo Route Reconciliation
  const activePageIdRef = useRef<string | null>(routeState.activePageId);
  activePageIdRef.current = routeState.activePageId;
  const ancestorsRef = useRef<PageAncestorItem[]>(routeState.ancestors);
  ancestorsRef.current = routeState.ancestors;
  const rootNodeIdRef = useRef<NodeCode | null>(routeState.rootNodeId);
  rootNodeIdRef.current = routeState.rootNodeId;
  const routeTypeRef = useRef<RouteState["type"]>(routeState.type);
  routeTypeRef.current = routeState.type;
  const pagesRef = useRef<PageRegistry | undefined>(pages);
  pagesRef.current = pages;
  const onUndoRedirectRef = useRef(onUndoRedirect);
  onUndoRedirectRef.current = onUndoRedirect;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
      return;
    }

    const handleWorkspaceReconcile = (e: Event) => {
      const detail = (e as CustomEvent<WorkspaceUndoReconcileDetail>).detail;
      const activePageId = activePageIdRef.current;
      if (!detail || routeTypeRef.current !== "node" || !activePageId) {
        return;
      }

      const nodes = getActiveNodes();
      const isRoot = nodes.some((n) => n.id === activePageId);
      const effectivePages = detail.nextPages ?? pagesRef.current ?? {};

      // Case 1: Currently viewed subpage was deleted by undo/redo -> redirect to nearest surviving ancestor
      const wasDeleted =
        Boolean(detail.deletedPageIds?.includes(activePageId)) ||
        (!isRoot && Boolean(detail.nextPages) && !detail.nextPages![activePageId]);

      if (wasDeleted) {
        const ancestors = ancestorsRef.current;
        let survivingAncestor: PageAncestorItem | null = null;
        for (let i = ancestors.length - 1; i >= 0; i--) {
          const candidate = ancestors[i];
          if (candidate.id === activePageId) continue;
          if (detail.deletedPageIds?.includes(candidate.id)) continue;
          if (candidate.isRootChapter || effectivePages[candidate.id]) {
            survivingAncestor = candidate;
            break;
          }
        }

        if (survivingAncestor) {
          navigateToPage(survivingAncestor.id, {
            replace: true,
            pagesOverride: effectivePages,
          });
          onUndoRedirectRef.current?.(survivingAncestor.title);
        } else if (rootNodeIdRef.current) {
          navigateToPage(rootNodeIdRef.current, {
            replace: true,
            pagesOverride: effectivePages,
          });
          onUndoRedirectRef.current?.(rootNodeIdRef.current);
        } else {
          navigateToHome();
        }
        return;
      }

      // Case 2: Slug changed on active page or an ancestor -> reconcile URL via replaceState
      if (detail.nextPages) {
        const expectedPath = buildPagePath(
          activePageId,
          nodes,
          detail.nextPages,
          effectiveBasePath
        );
        if (window.location.pathname !== expectedPath) {
          navigateToPage(activePageId, {
            replace: true,
            pagesOverride: detail.nextPages,
          });
        }
      }
    };

    window.addEventListener(EVENT_WORKSPACE_UNDO_RECONCILE, handleWorkspaceReconcile);
    return () => {
      window.removeEventListener(EVENT_WORKSPACE_UNDO_RECONCILE, handleWorkspaceReconcile);
    };
  }, [effectiveBasePath, navigateToPage, navigateToHome]);

  return {
    route: routeState.type,
    nodeId: routeState.nodeId,
    pageId: routeState.pageId,
    activePageId: routeState.activePageId,
    rootNodeId: routeState.rootNodeId,
    pageNode: routeState.pageNode,
    ancestors: routeState.ancestors,
    attemptedSegments: routeState.attemptedSegments,
    nearestValidAncestor: routeState.nearestValidAncestor,
    targetStage: routeState.targetStage,
    rawHash: routeState.rawHash,
    pathname: routeState.pathname,
    navigateToNode,
    navigateToPage,
    navigateToHome,
  };
}

// Canonical alias
export const useAppRoute = useHashRoute;
