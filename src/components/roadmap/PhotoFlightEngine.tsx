import React, { useRef, useEffect, useCallback } from 'react';
import type { NodeItem } from '../../types/node';
import defaultNodes from '../../data/sample-nodes.json';
import {
  NODE_PHOTO_CONFIGS,
  DEFAULT_DEST_MAX_WIDTH_VW,
  DESTINATION_GLOBAL_MARGINS,
  PHOTO_DESTINATION_TIMING_OFFSET,
  PHOTO_STACKED_BREAKPOINT,
  type NodePhotoConfig,
} from '../../data/node-photo-configs';
import { HeroPhoto } from '../canvas/HeroPhoto';
import styles from './PhotoFlightEngine.module.css';

export interface PhotoFlightEngineProps {
  nodes?: NodeItem[];
  onSelectStage?: (stageNumber: number) => void;
  onExploreNode?: (nodeId: string) => void;
  className?: string;
}

/** Build a fast node-number -> config lookup map at module load time */
const PHOTO_CONFIG_MAP = new Map<number, NodePhotoConfig>(
  NODE_PHOTO_CONFIGS.map((c) => [c.nodeNumber, c])
);

/**
 * Smooth Hermite cubic interpolation curve
 */
function smoothStep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * PhotoFlightEngine Component
 *
 * Implements real-time scroll-driven flight from Hero edge peeking positions
 * directly to the Roadmap milestone stations:
 * - Source: Referenced strictly by Center of Gravity (COG) relative to left/right edges and vh
 * - Destination: Parity anchoring (Odd = Upper-Left, Even = Upper-Right)
 * - Viewport safety math enforces healthy margins at all screen sizes
 * - Dynamic on-the-fly area sizing with priority crop focal point
 * - Unified configuration across desktop and mobile
 * - Zero React re-renders during active scrolling (direct DOM mutations)
 * - 60fps/120fps GPU-accelerated translate3d, scale, and rotate
 * - Reversible upward scroll trajectory
 * - Universal Zero Outline Policy & WCAG 2.1 AA accessibility
 */
export const PhotoFlightEngine: React.FC<PhotoFlightEngineProps> = ({
  nodes,
  onSelectStage,
  onExploreNode,
  className,
}) => {
  const effectiveNodes = nodes && nodes.length > 0 ? nodes : (defaultNodes as NodeItem[]);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  const lastMeasuredWidthRef = useRef<number>(0);

  // Cached layout coordinates in document space
  const layoutCoordinatesRef = useRef<
    Map<
      number,
      {
        heroCenterX: number;
        heroCenterY: number;
        heroWidth: number;
        heroAngle: number;
        dockX: number;
        dockY: number;
        dockWidth: number;
        dockHeight: number;
        dockCenterX: number;
        dockCenterY: number;
        startScroll: number;
        dockScroll: number;
        nodeArrivalScroll: number;
      }
    >
  >(new Map());

  const registerCardRef = useCallback((stageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(stageNum, el);
    } else {
      cardRefs.current.delete(stageNum);
    }
  }, []);

  // Measure Hero dimensions and milestone dock slots
  const measureCoordinates = useCallback(() => {
    const windowWidth = document.documentElement.clientWidth || window.innerWidth;
    const windowHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const isStacked = windowWidth < PHOTO_STACKED_BREAKPOINT;
    const marginSettings = isStacked
      ? DESTINATION_GLOBAL_MARGINS.mobile
      : DESTINATION_GLOBAL_MARGINS.desktop;

    const containerRect = containerRef.current?.getBoundingClientRect();
    const containerLeft = containerRect ? containerRect.left : 0;
    const containerTop = containerRect ? containerRect.top : 0;

    const newCoords = new Map();

    // Query all photo dock slots in the roadmap
    effectiveNodes.forEach((node, idx) => {
      const stage = node.nodeNumber ?? node.index ?? (idx + 1);
      const dockSlot = document.querySelector<HTMLElement>(`[data-photo-dock="${stage}"]`);

      // ── Read unified placement from node-photo-configs.ts (single source of truth) ──
      const photoCfg = PHOTO_CONFIG_MAP.get(stage);
      const src = photoCfg?.source ?? {
        side: stage % 2 === 1 ? ('left' as const) : ('right' as const),
        x: 3,
        y: Math.min(85, 20 + stage * 12),
        width: 14,
        rotation: stage % 2 === 1 ? 8 : -8,
      };
      const dst = photoCfg?.destination;
      const focalPoint = photoCfg?.focalPoint ?? { x: 50, y: 50 };

      // 1. Source (hero peeking) Center of Gravity (COG) coordinates in document space
      const isLeft = src.side === 'left';
      const heroCenterX = isLeft
        ? ((src.x ?? 3) / 100) * windowWidth
        : windowWidth - ((src.x ?? 3) / 100) * windowWidth;
      const heroCenterY = ((src.y ?? 50) / 100) * windowHeight;
      const heroWidth = Math.max(80, ((src.width ?? 14) / 100) * windowWidth);
      const heroHeight = heroWidth * 0.75;
      const heroAngle = src.rotation ?? 0;

      // 2. Destination (docked) coordinates — computed on the fly from measured DOM dock slot
      const stationNode =
        document.querySelector<HTMLElement>(`#sequence-roadmap [data-node="${stage}"]`) ||
        (dockSlot ? (dockSlot.closest<HTMLElement>('[data-node]') || dockSlot.parentElement) : null);

      let dockWidth = heroWidth;
      let dockHeight = heroHeight;
      let dockX = heroCenterX - heroWidth / 2;
      let dockY = heroCenterY - heroHeight / 2;

      // Reading focal line top margin (matches useRoadmapScroll ~26% of vh)
      const readingTopMargin = Math.min(260, Math.max(180, Math.round(windowHeight * 0.26)));

      if (dockSlot) {
        const rect = dockSlot.getBoundingClientRect();
        const slotLeft = rect.left - containerLeft;
        const slotTop  = rect.top  - containerTop;
        const slotRight = rect.right - containerLeft;

        // Natural measured width from slot or fallback to heroWidth
        const targetWidth = rect.width > 0 ? rect.width : heroWidth;

        // Dynamic available vertical height inside this milestone fold:
        const foldHeight = Math.max(windowHeight, 640);
        let maxAllowedHeight = 260;
        if (stationNode) {
          const nodeRect = stationNode.getBoundingClientRect();
          const nodeTopDocY = nodeRect.top + scrollY;
          const nextFoldViewportTop = (nodeTopDocY + foldHeight) - readingTopMargin;
          maxAllowedHeight = Math.max(160, nextFoldViewportTop - (rect.top + scrollY) - marginSettings.bottomPadding);
        } else {
          const nextFoldViewportTop = (rect.top + scrollY + foldHeight) - readingTopMargin;
          maxAllowedHeight = Math.max(160, nextFoldViewportTop - (rect.top + scrollY) - marginSettings.bottomPadding);
        }

        // On mobile and stacked tablets (< 1024px), keep compact ~4:3 proportion
        // On desktop (>= 1024px), let the photo extend down toward the bottom of the fold
        if (isStacked) {
          dockHeight = Math.round(Math.min(targetWidth * 0.72, maxAllowedHeight));
          dockWidth = targetWidth;
        } else {
          const viewportRemainingH = windowHeight * 0.74 - marginSettings.bottomPadding;
          dockHeight = Math.round(Math.min(viewportRemainingH, maxAllowedHeight));
          dockWidth = targetWidth;
        }

        // Maximum allowed width respecting healthy lateral margin and config limit
        const maxAllowedWidth = Math.min(
          windowWidth - 2 * marginSettings.marginX,
          ((dst?.maxWidthVw ?? DEFAULT_DEST_MAX_WIDTH_VW) / 100) * windowWidth
        );
        dockWidth = Math.min(dockWidth, maxAllowedWidth);

        // Parity-based Destination Referencing:
        // ODD nodes (1, 3, 5): referenced by Upper Left -> slotLeft + dst.x
        // EVEN nodes (2, 4):   referenced by Upper Right -> slotRight - dockWidth + dst.x
        const isOddNode = stage % 2 !== 0;
        const rawDockX = isOddNode
          ? slotLeft + (dst?.x ?? 0)
          : slotRight - dockWidth + (dst?.x ?? 0);
        const rawDockY = slotTop + (dst?.y ?? 0);

        // Healthy Viewport Margin Clamp Math (guarantees NO photo bleeds beyond safe margins)
        dockX = Math.max(
          marginSettings.marginX,
          Math.min(rawDockX, windowWidth - marginSettings.marginX - dockWidth)
        );
        dockY = rawDockY;
      }

      const dockCenterX = dockX + dockWidth / 2;
      const dockCenterY = dockY + dockHeight / 2;

      // 3. Calculate scroll flight thresholds
      let milestoneNodeScroll: number;
      if (stationNode) {
        const nodeRect = stationNode.getBoundingClientRect();
        const nodeTopDocY = nodeRect.top + scrollY;
        milestoneNodeScroll = Math.max(0, nodeTopDocY - readingTopMargin);
      } else {
        milestoneNodeScroll = Math.max(0, dockY - readingTopMargin);
      }

      // Timing offset: Photo arrives at final destination 10% before the scroll reaches the node
      const timingOffset = dst?.timingOffset ?? PHOTO_DESTINATION_TIMING_OFFSET;

      let startScroll = 0;
      if (stage === 1) {
        startScroll = 0;
      } else {
        const prevCoord = newCoords.get(stage - 1);
        const prevNodeScroll = prevCoord ? prevCoord.nodeArrivalScroll : milestoneNodeScroll * 0.7;
        const flightSpan = Math.min(windowHeight * 0.75, Math.max(200, milestoneNodeScroll - prevNodeScroll));
        const heroExitScroll = Math.max(160, Math.round(windowHeight * 0.35));
        startScroll = Math.max(heroExitScroll, milestoneNodeScroll - flightSpan);
      }

      // Approach flight distance towards the milestone node
      const approachSpan = Math.max(1, milestoneNodeScroll - startScroll);
      // Settle photo at final destination exactly 10% before the scroll reaches the milestone node
      const dockScroll = Math.max(startScroll + 1, Math.round(milestoneNodeScroll - approachSpan * timingOffset));

      newCoords.set(stage, {
        heroCenterX,
        heroCenterY,
        heroWidth,
        heroAngle,
        dockX,
        dockY,
        dockWidth,
        dockHeight,
        dockCenterX,
        dockCenterY,
        startScroll,
        dockScroll,
        nodeArrivalScroll: milestoneNodeScroll,
      });

      // Position card container at docked coordinates in document space
      const cardEl = cardRefs.current.get(stage);
      if (cardEl) {
        cardEl.style.left     = `${dockX}px`;
        cardEl.style.top      = `${dockY}px`;
        cardEl.style.width    = `${dockWidth}px`;
        cardEl.style.height   = `${dockHeight}px`;
        cardEl.style.setProperty('--card-focal-x', `${focalPoint.x}%`);
        cardEl.style.setProperty('--card-focal-y', `${focalPoint.y}%`);
      }
    });

    layoutCoordinatesRef.current = newCoords;
  }, [effectiveNodes]);

  // Real-time animation loop: updates card transforms on scroll with 0 React re-renders
  const updateTransforms = useCallback(() => {
    const scrollY = window.scrollY;
    const isReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const windowHeight = window.innerHeight;
    const heroExitScroll = Math.max(160, Math.round(windowHeight * 0.35));

    effectiveNodes.forEach((node, idx) => {
      const stage = node.nodeNumber ?? node.index ?? (idx + 1);
      const cardEl = cardRefs.current.get(stage);
      const coords = layoutCoordinatesRef.current.get(stage);

      if (!cardEl || !coords) return;

      if (isReducedMotion) {
        // Direct docked resting state without motion
        cardEl.style.transform = 'none';
        cardEl.style.opacity = '1';
        cardEl.dataset.flightState = 'docked';
        return;
      }

      const {
        heroCenterX,
        heroCenterY,
        heroWidth,
        heroAngle,
        dockCenterX,
        dockCenterY,
        dockWidth,
        startScroll,
        dockScroll,
      } = coords;

      if (stage === 1) {
        // Node 1: Direct flight from Hero Welcome left-edge slot into Milestone 1 dock
        const span = Math.max(1, dockScroll - startScroll);
        const rawT = (scrollY - startScroll) / span;
        const t = Math.min(Math.max(rawT, 0), 1);
        const easedT = smoothStep(t);
        const u = 1 - easedT;

        const deltaX = u * (heroCenterX - dockCenterX);
        const deltaY = u * (heroCenterY - dockCenterY);
        const scale = 1 + u * (heroWidth / dockWidth - 1);
        const rotate = u * heroAngle;

        cardEl.style.transform = `translate3d(${deltaX.toFixed(2)}px, ${deltaY.toFixed(2)}px, 0) scale(${scale.toFixed(4)}) rotate(${rotate.toFixed(2)}deg)`;
        cardEl.style.opacity = '1';

        if (t >= 0.88) {
          cardEl.dataset.flightState = 'docked';
        } else if (t <= 0.12) {
          cardEl.dataset.flightState = 'hero';
        } else {
          cardEl.dataset.flightState = 'flying';
        }
      } else {
        // Nodes 2–N:
        // 1. In Hero Welcome (scrollY <= heroExitScroll): Anchored at Hero peeking slot, fades naturally as hero exits
        // 2. Intermediate (heroExitScroll < scrollY < startScroll): Dormant (hidden) so it NEVER clutters other nodes
        // 3. Milestone Arrival Corridor (scrollY >= startScroll): Smoothly glides in from fold edge and docks
        if (scrollY <= heroExitScroll) {
          const fadeT = Math.min(1, Math.max(0, (scrollY - 40) / Math.max(1, heroExitScroll - 40)));
          const opacity = (1 - fadeT) * 0.94;
          const deltaX = heroCenterX - dockCenterX;
          const deltaY = heroCenterY - dockCenterY;
          const scale = heroWidth / dockWidth;
          const rotate = heroAngle;

          cardEl.style.transform = `translate3d(${deltaX.toFixed(2)}px, ${deltaY.toFixed(2)}px, 0) scale(${scale.toFixed(4)}) rotate(${rotate.toFixed(2)}deg)`;
          cardEl.style.opacity = opacity.toFixed(3);
          cardEl.dataset.flightState = opacity > 0.05 ? 'hero' : 'dormant';
        } else if (scrollY >= startScroll) {
          const span = Math.max(1, dockScroll - startScroll);
          const rawT = (scrollY - startScroll) / span;
          const t = Math.min(Math.max(rawT, 0), 1);
          const easedT = smoothStep(t);
          const u = 1 - easedT;

          // Glides in laterally from the edge of the milestone fold and docks
          const deltaX = u * (heroCenterX - dockCenterX);
          const deltaY = -100 * u;
          const scale = 1 + u * (heroWidth / dockWidth - 1);
          const rotate = u * heroAngle;
          const enterOpacity = Math.min(1, Math.max(0.1, t / 0.25));

          cardEl.style.transform = `translate3d(${deltaX.toFixed(2)}px, ${deltaY.toFixed(2)}px, 0) scale(${scale.toFixed(4)}) rotate(${rotate.toFixed(2)}deg)`;
          cardEl.style.opacity = enterOpacity.toFixed(3);
          cardEl.dataset.flightState = t >= 0.88 ? 'docked' : 'flying';
        } else {
          cardEl.style.opacity = '0';
          cardEl.dataset.flightState = 'dormant';
        }
      }
    });
  }, [effectiveNodes]);

  // Scroll and Resize Event Listeners (passive for performance)
  useEffect(() => {
    const onScroll = () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(updateTransforms);
    };

    const onResize = () => {
      const currentWidth = document.documentElement.clientWidth || window.innerWidth;
      if (Math.abs(currentWidth - lastMeasuredWidthRef.current) > 2) {
        lastMeasuredWidthRef.current = currentWidth;
        measureCoordinates();
      }
      updateTransforms();
    };

    // Initial setup with slight delay for DOM nodes to complete layout
    measureCoordinates();
    updateTransforms();
    lastMeasuredWidthRef.current = document.documentElement.clientWidth || window.innerWidth;

    const timer = setTimeout(() => {
      measureCoordinates();
      updateTransforms();
    }, 100);

    // Observe roadmap section layout updates
    const roadmapEl = document.getElementById('sequence-roadmap');
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && roadmapEl) {
      resizeObserver = new ResizeObserver(() => {
        measureCoordinates();
        updateTransforms();
      });
      resizeObserver.observe(roadmapEl);
    }

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        measureCoordinates();
        updateTransforms();
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });

    return () => {
      clearTimeout(timer);
      resizeObserver?.disconnect();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [measureCoordinates, updateTransforms]);

  // Card click handler: In Hero state -> glide to stage. In Docked state -> open node page.
  const handleCardClick = useCallback(
    (node: NodeItem, e: React.MouseEvent) => {
      e.stopPropagation();
      const stageNum = node.nodeNumber ?? node.index ?? 1;
      const cardEl = cardRefs.current.get(stageNum);
      const flightState = cardEl?.dataset.flightState || 'hero';

      if (flightState === 'docked') {
        onExploreNode?.(node.id);
      } else {
        onSelectStage?.(stageNum);
      }
    },
    [onSelectStage, onExploreNode]
  );

  return (
    <div
      ref={containerRef}
      className={`${styles.flightContainer} ${className || ''}`}
      aria-label="Sequence photographic flight cards"
    >
      {effectiveNodes.map((node, idx) => {
        const stageNum = node.nodeNumber ?? node.index ?? (idx + 1);
        const photoCfg = PHOTO_CONFIG_MAP.get(stageNum);
        const focalPoint = photoCfg?.focalPoint ?? { x: 50, y: 50 };
        return (
          <div
            key={node.id}
            ref={(el) => registerCardRef(stageNum, el)}
            className={styles.flightCardWrapper}
            data-node={stageNum}
            data-flight-state="hero"
            style={
              {
                '--card-focal-x': `${focalPoint.x}%`,
                '--card-focal-y': `${focalPoint.y}%`,
              } as React.CSSProperties
            }
            onClick={(e) => handleCardClick(node, e)}
          >
            <HeroPhoto
              node={node}
              heroImage={node.heroImage}
              onExploreNode={onExploreNode}
              onClick={() => {
                const cardEl = cardRefs.current.get(stageNum);
                const flightState = cardEl?.dataset.flightState || 'hero';
                if (flightState === 'docked') {
                  onExploreNode?.(node.id);
                } else {
                  onSelectStage?.(stageNum);
                }
              }}
              priority={stageNum === 1}
              focalPoint={focalPoint}
              className={styles.innerCard}
            />
          </div>
        );
      })}
    </div>
  );
};

export default PhotoFlightEngine;
