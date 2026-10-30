import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import styles from "./RoadmapTrack.module.css";
import {
  generateSerpentineRoadmap,
  progressToDrawnLength,
  type GeneratedNodePoint,
  type SerpentineGeneratorOptions,
} from "./serpentine-generator";
import { RoadmapNode } from "./RoadmapNode";
import type { NodeItem } from "../../types/node";

export interface RoadmapTrackProps {
  nodes?: NodeItem[];
  activeStage: number;    // Discrete stage: 1 to N
  subscribeProgress: (callback: (progress: number) => void) => () => void;
  className?: string;
  onNodeClick?: (stage: number) => void;
  onExplore?: (pageId: string) => void;
  options?: SerpentineGeneratorOptions;
}

/**
 * RoadmapTrack Component (Phase 4 Subtask 4.2.1a: Natural Flow Engine)
 *
 * Implements a natural document flow serpentine track:
 * - 1:1 Scale-locked vector canvas in natural page flow (zero sticky lock, zero cameraWrapper)
 * - Layer 1: Foundation Ribbon (wide structural roadbed)
 * - Layer 2: Institutional Spine (tactile dashed center line)
 * - Layer 2.5: Golden Glow Aura (Sunburst Gold radiance)
 * - Layer 3: Dynamic Active Ink (Primary)
 * - Zero React re-renders during active scrolling (direct DOM mutation on stroke offsets and node data-connected)
 * - Parameterized to render dynamic node counts N >= 1 without layout shifts or NaN
 */
export const RoadmapTrack = React.memo<RoadmapTrackProps>(
  ({ nodes = [], activeStage, subscribeProgress, className, onNodeClick, onExplore, options }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const progressGlowRef = useRef<SVGPathElement>(null);
    const progressInkRef = useRef<SVGPathElement>(null);
    const nodeElementsRef = useRef<Map<number, HTMLElement>>(new Map());

    const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => ({
      width: typeof window !== "undefined" ? (document.documentElement.clientWidth || window.innerWidth) : 1200,
      height: typeof window !== "undefined" ? (document.documentElement.clientHeight || window.innerHeight) : 800,
    }));

    const [selectedStage, setSelectedStage] = useState<number | null>(activeStage);

    // Keep selectedStage synchronized when scroll updates activeStage
    useEffect(() => {
      setSelectedStage(activeStage);
    }, [activeStage]);

    const handleNodeClick = useCallback(
      (stage: number) => {
        setSelectedStage(stage);
        onNodeClick?.(stage);
      },
      [onNodeClick]
    );

    const handleExplore = useCallback(
      (pageId: string) => {
        if (onExplore) {
          onExplore(pageId);
          return;
        }
        const targetEl = document.getElementById("page-section-" + pageId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth" });
        } else {
          const roadmapContainer = document.getElementById("sequence-roadmap");
          if (roadmapContainer) {
            const targetTop = roadmapContainer.offsetTop + roadmapContainer.offsetHeight + 10;
            window.scrollTo({
              top: targetTop,
              behavior: "smooth",
            });
          }
        }
      },
      [onExplore]
    );

    // Measure container / viewport width dynamically on resize
    useEffect(() => {
      let rafId: number | null = null;

      const updateDimensions = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          if (!containerRef.current) return;
          const containerWidth = containerRef.current.clientWidth;
          const rectWidth = Math.round(containerRef.current.getBoundingClientRect().width);
          const docWidth = typeof document !== "undefined" ? document.documentElement.clientWidth : 0;
          const winWidth = typeof window !== "undefined" ? window.innerWidth : 0;

          const newWidth = Math.round(
            containerWidth || rectWidth || docWidth || winWidth || 1200
          );
          const newHeight = Math.round(
            (typeof window !== "undefined" ? window.innerHeight : 0) ||
            (typeof document !== "undefined" ? document.documentElement.clientHeight : 0) ||
            800
          );

          if (newWidth <= 0) return;

          setDimensions(prev => {
            if (Math.abs(prev.width - newWidth) < 2 && Math.abs(prev.height - newHeight) < 2) {
              return prev;
            }
            return { width: newWidth, height: newHeight };
          });
        });
      };

      updateDimensions();

      // ResizeObserver to detect real-time layout changes
      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          updateDimensions();
        });
        resizeObserver.observe(containerRef.current);
      }

      window.addEventListener("resize", updateDimensions, { passive: true });
      window.addEventListener("orientationchange", updateDimensions, { passive: true });

      return () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        window.removeEventListener("resize", updateDimensions);
        window.removeEventListener("orientationchange", updateDimensions);
      };
    }, []);

    // Generate responsive serpentine geometry in real time
    const roadmap = useMemo(
      () =>
        generateSerpentineRoadmap(dimensions.width, dimensions.height, {
          ...options,
          nodeCount: nodes.length > 0 ? nodes.length : undefined,
          nodes:
            nodes.length > 0
              ? nodes.map((n, i) => ({
                  stage: n.nodeNumber ?? n.index ?? i + 1,
                  id: n.id,
                  accentColorVar: n.accentColor,
                  label: n.title,
                }))
              : undefined,
        }),
      [dimensions.width, dimensions.height, nodes, options]
    );

    // Direct DOM mutation for ink progress and milestone connection
    useEffect(() => {
      if (containerRef.current) {
        const elements = new Map<number, HTMLElement>();
        containerRef.current.querySelectorAll<HTMLElement>("[data-node]").forEach(el => {
          const stage = Number(el.dataset.node);
          if (!isNaN(stage)) {
            elements.set(stage, el);
          }
        });
        nodeElementsRef.current = elements;
      }

      const handleProgress = (progress: number) => {
        const clampedProgress = Math.min(Math.max(progress, 0), 1);
        const drawnFraction = roadmap.totalLength > 0
          ? progressToDrawnLength(clampedProgress, roadmap.cumLengths) / roadmap.totalLength
          : 0;
        const strokeDashoffset = Math.max(0, 1 - drawnFraction);

        if (progressInkRef.current) {
          progressInkRef.current.style.strokeDashoffset = strokeDashoffset.toFixed(5);
        }
        if (progressGlowRef.current) {
          progressGlowRef.current.style.strokeDashoffset = strokeDashoffset.toFixed(5);
        }

        // Direct DOM attribute update for instant zero-latency milestone illumination
        const touchOffset = 0.008;
        for (let i = 0; i < roadmap.points.length; i++) {
          const node = roadmap.points[i];
          const isConn = clampedProgress >= (node.threshold - touchOffset);
          const nodeEl = nodeElementsRef.current.get(node.stage);
          if (nodeEl) {
            const val = isConn ? "true" : "false";
            if (nodeEl.dataset.connected !== val) {
              nodeEl.dataset.connected = val;
            }
          }
        }
      };

      const unsubscribe = subscribeProgress(handleProgress);
      return unsubscribe;
    }, [subscribeProgress, roadmap]);

    return (
      <div
        ref={containerRef}
        className={styles.trackContainer + " " + (className || "")}
        style={{
          width: "100%",
          height: roadmap.totalHeight + "px",
        }}
      >
        <svg
          className={styles.svgTrack}
          width={dimensions.width}
          height={roadmap.totalHeight}
          viewBox={"0 0 " + dimensions.width + " " + roadmap.totalHeight}
          preserveAspectRatio="none"
          role="presentation"
          aria-hidden="true"
        >
          {/* Unified Responsive Vector Path Triad */}
          <g>
            {/* Layer 1: Foundation Ribbon (wide structural roadbed) */}
            <path
              d={roadmap.pathData}
              className={styles.foundationPath}
            />

            {/* Layer 2: Institutional Spine (tactile dashed center line) */}
            <path
              d={roadmap.pathData}
              className={styles.spinePath}
            />

            {/* Layer 2.5: Golden Glow Aura (Sunburst Gold radiance) */}
            <path
              ref={progressGlowRef}
              d={roadmap.pathData}
              className={styles.progressGlow}
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
              }}
            />

            {/* Layer 3: Active Flowing Ink (Primary) */}
            <path
              ref={progressInkRef}
              d={roadmap.pathData}
              className={styles.progressInk}
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                opacity: 1,
              }}
            />
          </g>
        </svg>

        {/* Milestone Stations (Direct Canvas Gateway Nodes) */}
        {roadmap.points.map((nodePoint: GeneratedNodePoint, idx: number) => {
          const page = nodes[idx] ?? {
            id: nodePoint.id,
            index: nodePoint.stage,
            title: nodePoint.label,
            subtitle: nodePoint.label,
            accentColor: nodePoint.accentColorVar,
          };
          const isSelected = selectedStage === nodePoint.stage;
          const isActive = activeStage === nodePoint.stage;
          return (
            <RoadmapNode
              key={page.id}
              page={page}
              x={nodePoint.x}
              y={nodePoint.y}
              trackWidth={dimensions.width}
              flank={nodePoint.flank}
              isActive={isActive}
              isSelected={isSelected}
              isConnected={nodePoint.stage === 1} // Initial resting state: Node 1 begins touched at scroll 0
              onExplore={handleExplore}
              onSelectStage={handleNodeClick}
            />
          );
        })}
      </div>
    );
  }
);

RoadmapTrack.displayName = "RoadmapTrack";
