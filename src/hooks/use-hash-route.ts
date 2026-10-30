import { useState, useEffect, useCallback } from "react";
import type { NodeCode } from "../types/node";
import { cancelCinematicScroll } from "../utils/smooth-scroll";

export type RouteType = "home" | "node" | "page" | "not-found";

export interface RouteState {
  type: "home" | "node" | "not-found";
  nodeId: NodeCode | null;
  /** Backwards compatibility alias */
  pageId: NodeCode | null;
  targetStage: number | null;
  rawHash: string;
  pathname?: string;
}

export const VALID_NODES: NodeCode[] = [
  "access",
  "equity",
  "quality",
  "resiliency",
  "governance",
];

export const NODE_TO_STAGE: Record<NodeCode, number> = {
  access: 1,
  equity: 2,
  quality: 3,
  resiliency: 4,
  governance: 5,
};

export const STAGE_TO_NODE: Record<number, NodeCode> = {
  1: "access",
  2: "equity",
  3: "quality",
  4: "resiliency",
  5: "governance",
};

/**
 * Universal route parser supporting both modern HTML5 path routes (/node/:id/)
 * and legacy hash routes (#node/:id).
 * Parameterized to support arbitrary custom node identifiers and stages.
 */
export function parseRoute(pathname = "/", hash = "", validNodes?: NodeCode[]): RouteState {
  const cleanPath = pathname.trim().replace(/\/+$/, "") + "/";
  const cleanHash = hash.replace(/^#\/?/, "").trim();

  // 1. Path route: /node/:id/ or /page/:id/
  const pathMatch = cleanPath.match(/^\/(node|page)\/([a-zA-Z0-9_-]+)\/?$/);
  if (pathMatch) {
    const candidateId = pathMatch[2].toLowerCase();
    const isAllowed = validNodes ? validNodes.includes(candidateId) : true;
    if (isAllowed) {
      const code = candidateId;
      return {
        type: "node",
        nodeId: code,
        pageId: code,
        targetStage: NODE_TO_STAGE[code] ?? null,
        rawHash: hash,
        pathname: "/node/" + code + "/",
      };
    }
    return {
      type: "not-found",
      nodeId: null,
      pageId: null,
      targetStage: null,
      rawHash: hash,
      pathname: cleanPath,
    };
  }

  // 2. Legacy Hash route: #node/:id or #page/:id
  if (cleanHash.startsWith("node/") || cleanHash.startsWith("page/")) {
    const prefix = cleanHash.startsWith("node/") ? "node/" : "page/";
    const candidateId = cleanHash.slice(prefix.length).replace(/\/$/, "").toLowerCase();
    const isAllowed = validNodes ? validNodes.includes(candidateId) : true;
    if (isAllowed) {
      const code = candidateId;
      return {
        type: "node",
        nodeId: code,
        pageId: code,
        targetStage: NODE_TO_STAGE[code] ?? null,
        rawHash: hash,
        pathname: "/node/" + code + "/",
      };
    }
    return {
      type: "not-found",
      nodeId: null,
      pageId: null,
      targetStage: null,
      rawHash: hash,
      pathname: cleanPath,
    };
  }

  // 3. Stage return targets on home (#stage-1 to #stage-N)
  const stageMatch = cleanHash.match(/^stage-(\d+)$/);
  if (stageMatch) {
    const stageNum = parseInt(stageMatch[1], 10);
    return {
      type: "home",
      nodeId: null,
      pageId: null,
      targetStage: stageNum,
      rawHash: hash,
      pathname: "/",
    };
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
    return {
      type: "home",
      nodeId: null,
      pageId: null,
      targetStage: null,
      rawHash: hash,
      pathname: "/",
    };
  }

  // 5. Any unrecognized hash or non-root path
  return {
    type: "not-found",
    nodeId: null,
    pageId: null,
    targetStage: null,
    rawHash: hash,
    pathname: cleanPath,
  };
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

export function useHashRoute(validNodes?: NodeCode[]) {
  const [routeState, setRouteState] = useState<RouteState>(() =>
    parseRoute(
      typeof window !== "undefined" ? window.location.pathname : "/",
      typeof window !== "undefined" ? window.location.hash : "",
      validNodes
    )
  );

  useEffect(() => {
    // If user arrived with legacy #node/id, upgrade URL in address bar to clean /node/id/
    if (typeof window !== "undefined") {
      const cleanHash = window.location.hash.replace(/^#\/?/, "").trim();
      if (cleanHash.startsWith("node/") || cleanHash.startsWith("page/")) {
        const prefix = cleanHash.startsWith("node/") ? "node/" : "page/";
        const candidateId = cleanHash.slice(prefix.length).replace(/\/$/, "").toLowerCase();
        const isAllowed = validNodes ? validNodes.includes(candidateId) : true;
        if (isAllowed) {
          window.history.replaceState(null, "", "/node/" + candidateId + "/");
        }
      }
    }

    const handleLocationChange = () => {
      setRouteState(parseRoute(window.location.pathname, window.location.hash, validNodes));
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, [validNodes]);

  const navigateToNode = useCallback((nodeId: NodeCode) => {
    cancelCinematicScroll();
    const targetUrl = "/node/" + nodeId + "/";
    if (typeof window !== "undefined") {
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, "", targetUrl);
      }
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      setRouteState(parseRoute(window.location.pathname, window.location.hash, validNodes));
    }
  }, [validNodes]);

  const navigateToHome = useCallback((stage?: number) => {
    cancelCinematicScroll();
    const targetUrl = stage && stage >= 1 ? "/#stage-" + stage : "/";
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", targetUrl);
      if (!stage) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
      setRouteState(parseRoute(window.location.pathname, window.location.hash, validNodes));
    }
  }, [validNodes]);

  return {
    route: routeState.type,
    nodeId: routeState.nodeId,
    pageId: routeState.pageId,
    targetStage: routeState.targetStage,
    rawHash: routeState.rawHash,
    pathname: routeState.pathname,
    navigateToNode,
    navigateToPage: navigateToNode,
    navigateToHome,
  };
}

// Canonical alias
export const useAppRoute = useHashRoute;
