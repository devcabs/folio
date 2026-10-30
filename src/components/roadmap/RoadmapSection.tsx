import React, { useRef, useEffect } from "react";

import { useRoadmapScroll, type RoadmapScrollZone } from "./use-roadmap-scroll";
import { RoadmapTrack } from "./RoadmapTrack";
import type { NodeItem } from "../../types/node";
import type { SerpentineGeneratorOptions } from "./serpentine-generator";

import styles from "./RoadmapSection.module.css";

export type { RoadmapScrollZone };

export interface RoadmapSectionHandle {
  scrollToStage: (stage: number, onComplete?: () => void) => void;
  nextStage: (onComplete?: () => void) => void;
  prevStage?: (onComplete?: () => void) => void;
}

export interface RoadmapSectionProps {
  nodes?: NodeItem[];
  options?: SerpentineGeneratorOptions;
  onStageChange?: (activeStage: number, scrollZone: RoadmapScrollZone) => void;
  onExploreNode?: (nodeId: string) => void;
  /** Backwards compatibility alias */
  onExplorePage?: (pageId: string) => void;
}

/**
 * RoadmapSection Component (Phase 4 Subtask 4.2.1b: Discrete Step Roadmap Engine)
 *
 * Viewport stage coordination for the winding progression roadmap:
 * - Direct milestone coordinate navigation via scrollToStage, nextStage, prevStage
 * - Dynamic serpentine track and stepping stones rendering for arbitrary N nodes
 * - Centralized keyboard and gesture locking handled via useDiscreteStepNavigation
 */
export const RoadmapSection = React.forwardRef<RoadmapSectionHandle, RoadmapSectionProps>(
  ({ nodes, options, onStageChange, onExploreNode, onExplorePage }, ref) => {
    const handleExplore = onExploreNode ?? onExplorePage;
    const sectionRef = useRef<HTMLElement>(null);
    const totalNodes = nodes?.length ?? 5;
    const { activeStage, scrollZone, scrollToStage, subscribeProgress } = useRoadmapScroll(sectionRef);

    useEffect(() => {
      onStageChange?.(activeStage, scrollZone);
    }, [activeStage, scrollZone, onStageChange]);

    React.useImperativeHandle(
      ref,
      () => ({
        scrollToStage,
        nextStage: (onComplete?: () => void) => {
          if (activeStage < totalNodes) {
            scrollToStage(activeStage + 1, onComplete);
          }
        },
        prevStage: (onComplete?: () => void) => {
          if (activeStage > 1) {
            scrollToStage(activeStage - 1, onComplete);
          }
        },
      }),
      [activeStage, scrollToStage, totalNodes]
    );

    return (
      <section
        ref={sectionRef}
        className={styles.roadmapSection}
        aria-label="Winding Progression Roadmap"
        id="sequence-roadmap"
      >
        {/* Serpentine SVG Track & Dynamic Stepping Stones */}
        <RoadmapTrack
          nodes={nodes}
          options={options}
          activeStage={activeStage}
          subscribeProgress={subscribeProgress}
          onNodeClick={scrollToStage}
          onExplore={handleExplore}
        />
      </section>
    );
  }
);

RoadmapSection.displayName = "RoadmapSection";
