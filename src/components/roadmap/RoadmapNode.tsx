import React, { useCallback } from "react";
import type { NodeItem } from "../../types/node";
import styles from "./RoadmapNode.module.css";

export const PHOTO_STACKED_BREAKPOINT = 1024;

export interface RoadmapNodeProps {
  page: NodeItem;
  x: number;
  y: number;
  trackWidth?: number;
  flank: "left" | "right" | "center";
  isActive: boolean;
  isSelected?: boolean;
  isConnected?: boolean;
  onExplore: (pageId: string) => void;
  onSelectStage?: (stage: number) => void;
}

/**
 * RoadmapNode Component (Phase 4 Subtask 4.2.3)
 *
 * Implements Direct Canvas Milestone Stations (Tactile Gateway Nodes):
 * - Anti-AI-Slop Direct Canvas Editorial Typesetting: Zero rectangular card boxes
 * - 72px Tactile Portal Ring: Physical milestone anchor with seal color
 * - Benchmark Monospace Badge: JetBrains Mono tracking
 * - Layperson Display Title: Plus Jakarta Sans 800 weight with tight tracking
 * - Source-Bound Community Story Hook: Single-Sentence authentic narrative
 * - Refined Editorial Action Link: Hairline underline accent with smooth navigation
 * - Real-time Line Connection Highlighting: Seamless synchronization with serpentine ink
 * - Universal Zero Outline Policy: outline: none across all states
 * - ACTIVE, SELECTED Mode: Solid jewel fill highlighting with crisp white numeral text
 */
export const RoadmapNode = React.memo<RoadmapNodeProps>(
  ({ page, x, y, trackWidth, flank, isActive, isSelected = false, isConnected = false, onExplore, onSelectStage }) => {
    const stageNumber = page.nodeNumber ?? page.index ?? 1;
    const formattedNumeral = stageNumber.toString().padStart(2, "0");
    const categoryBadgeText = (page.tagline ?? page.title).toUpperCase();
    const titleText = page.subtitle ?? page.title;
    const summaryText = page.summary ?? page.annotation ?? "";

    const handleSelectStage = useCallback(() => {
      onSelectStage?.(stageNumber);
    }, [onSelectStage, stageNumber]);

    const handleRingKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectStage?.(stageNumber);
        }
      },
      [onSelectStage, stageNumber]
    );

    const handleExploreClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onExplore(page.id);
      },
      [onExplore, page.id]
    );

    const isHighlighted = isActive || isSelected;
    const flankClass = flank === "right" ? styles.right : styles.left;
    const stateClass = isHighlighted ? styles.stationActive : styles.stationDormant;

    // Viewport-safe boundary calculation:
    // Ensures text descriptions and titles never extend beyond viewport or track edges
    const effectiveWidth = trackWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1200);
    const isStacked = effectiveWidth < PHOTO_STACKED_BREAKPOINT;
    const ringOffset = isStacked ? 52 : 60;
    const safetyMargin = isStacked ? 16 : 32;
    const maxDesignWidth = isStacked ? (effectiveWidth <= 768 ? 340 : 440) : 440;

    // In side-by-side mode (>= 1024px), reserve space for the photo dock slot (approx 320px-520px) and layout gap (48px)
    const photoReservation = isStacked
      ? 0
      : Math.min(520, Math.max(320, effectiveWidth * 0.30)) + 48;

    const availableSpace = trackWidth
      ? flank === "left"
        ? trackWidth - (x + ringOffset) - safetyMargin - photoReservation
        : (x - ringOffset) - safetyMargin - photoReservation
      : maxDesignWidth;

    const safeMaxWidth = Math.max(200, Math.min(maxDesignWidth, Math.floor(availableSpace)));

    return (
      <div
        className={styles.stationWrapper + " " + stateClass + " " + flankClass}
        data-node={stageNumber}
        data-active={isHighlighted ? "true" : "false"}
        data-selected={isSelected ? "true" : "false"}
        data-connected={isConnected ? "true" : "false"}
        style={{
          left: x + "px",
          top: y + "px",
          "--max-content-width": safeMaxWidth + "px",
        } as React.CSSProperties}
      >
        {/* 1. The 72px Tactile Portal Ring (Physical Waypoint Anchor) */}
        <button
          type="button"
          className={styles.portalRing}
          onClick={handleSelectStage}
          onKeyDown={handleRingKeyDown}
          aria-label={"Milestone Stage " + formattedNumeral + ": " + titleText + " (" + page.title + ") — " + (isHighlighted ? "Active Selected Focal Zone" : isConnected ? "Connected Milestone" : "Upcoming Milestone")}
          aria-current={isHighlighted ? "step" : undefined}
          aria-selected={isHighlighted}
          title={"Node " + formattedNumeral + ": " + titleText}
        >
          <span className={styles.ringCore}>
            <span className={styles.stationNumber}>
              {formattedNumeral}
            </span>
          </span>
        </button>

        {/* Station Body: Clean flex container for Editorial Content Block & Photo Dock Slot */}
        <div className={styles.stationBody}>
          {/* 2. Direct Canvas Editorial Typography Block */}
          <div className={styles.contentBlock}>
            {/* 2.1 Benchmark Category Badge */}
            <span className={styles.depedBadge}>
              <span className={styles.statusDot} aria-hidden="true" />
              <span>{categoryBadgeText}</span>
            </span>

            {/* 2.2 Layperson Display Title */}
            <h3 className={styles.displayTitle}>
              {titleText}
            </h3>

            {/* 2.3 Community Story Hook (Single-Sentence Source-Bound) */}
            {summaryText && (
              <p className={styles.summary}>
                {summaryText}
              </p>
            )}

            {/* 2.4 Refined Editorial Action Link */}
            <div className={styles.actionWrapper}>
              <div
                role="button"
                tabIndex={0}
                className={styles.exploreLink}
                onClick={handleExploreClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleExploreClick(e as unknown as React.MouseEvent);
                  }
                }}
                aria-label={"Explore Node Details for Node " + formattedNumeral + ": " + titleText}
              >
                <span>Explore Node Details</span>
                <span className={styles.exploreArrow} aria-hidden="true">↓</span>
              </div>
            </div>
          </div>

          {/* 3. Milestone Photo Docking Target Slot (Reserved Station Canvas) */}
          <div
            className={styles.photoDockSlot}
            data-photo-dock={stageNumber}
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }
);

RoadmapNode.displayName = "RoadmapNode";
