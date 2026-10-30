import { useState, useEffect, useCallback, useRef } from 'react';
import { cinematicScrollTo } from '../../utils/smooth-scroll';

export type RoadmapScrollZone = 'above' | 'inside' | 'below';

export interface RoadmapScrollState {
  progressRef: React.RefObject<number>;
  activeStage: number;    // Discrete stage: 1 to 5
  scrollZone: RoadmapScrollZone;
  isEngineActive: boolean; // True when within roadmap track
  scrollToStage: (stage: number, onComplete?: () => void) => void;
  subscribeProgress: (callback: (progress: number) => void) => () => void;
}

/**
 * useRoadmapScroll (Subtask 4.2.1a: Natural Document Flow Engine)
 *
 * Replaces locked 500vh viewport camera with a clean, high-performance
 * natural scroll observer. Progress is calculated relative to the user's
 * eye-level reading focal line intersecting the milestone nodes.
 *
 * Direct DOM subscribers receive 60/120fps progress updates without React re-renders.
 */
export const useRoadmapScroll = (
  containerRef: React.RefObject<HTMLElement | null>
): RoadmapScrollState => {
  const progressRef = useRef<number>(0);
  const progressListenersRef = useRef<Set<(progress: number) => void>>(new Set());
  const [activeStage, setActiveStage] = useState<number>(1);
  const [scrollZone, setScrollZone] = useState<RoadmapScrollZone>('above');
  const [isEngineActive, setIsEngineActive] = useState<boolean>(false);

  const scrollZoneRef = useRef<RoadmapScrollZone>('above');
  const isEngineActiveRef = useRef<boolean>(false);
  const activeStageRef = useRef<number>(1);
  const isTickingRef = useRef<boolean>(false);

  const computeScroll = useCallback(() => {
    if (!containerRef.current) return;

    const vh = window.innerHeight || document.documentElement.clientHeight;
    // Eye-level reading line positioned comfortably lower on screen (~26% vh, 180-260px)
    const focalY = Math.min(260, Math.max(180, Math.round(vh * 0.26)));
    const nodes = containerRef.current.querySelectorAll<HTMLElement>('[data-node]');

    let clampedProgress = 0;
    let zone: RoadmapScrollZone = 'inside';
    let stage = 1;

    if (nodes.length >= 2) {
      const p1 = nodes[0];
      const p5 = nodes[nodes.length - 1];
      const p1Top = p1.getBoundingClientRect().top;
      const p5Top = p5.getBoundingClientRect().top;
      const travel = p5Top - p1Top;

      if (travel > 0) {
        const rawProgress = (focalY - p1Top) / travel;
        clampedProgress = Math.min(Math.max(rawProgress, 0), 1);
      }

      // Zone determination (Chapter 5 commands a full 100vh fold before releasing into footer)
      const pageFoldH = travel / 4;
      if (p1Top > focalY + 120) {
        zone = 'above';
      } else if (p5Top < focalY - pageFoldH * 0.75) {
        zone = 'below';
      } else {
        zone = 'inside';
      }

      // Find closest node to focal eye-level
      let minDistance = Infinity;
      nodes.forEach(node => {
        const stageNum = Number(node.dataset.node);
        if (!isNaN(stageNum)) {
          const nodeTop = node.getBoundingClientRect().top;
          const dist = Math.abs(focalY - nodeTop);
          if (dist < minDistance) {
            minDistance = dist;
            stage = stageNum;
          }
        }
      });
    } else {
      // Fallback if milestone nodes have not mounted yet
      const rect = containerRef.current.getBoundingClientRect();
      const travel = rect.height - vh;
      if (travel > 0) {
        clampedProgress = Math.min(Math.max((focalY - rect.top) / travel, 0), 1);
      }
      if (rect.top > focalY) {
        zone = 'above';
      } else if (rect.bottom < focalY) {
        zone = 'below';
      }
    }

    // Broadcast progress to direct subscribers with zero React re-renders
    progressRef.current = clampedProgress;
    progressListenersRef.current.forEach(listener => listener(clampedProgress));

    // Update state only if changed
    if (scrollZoneRef.current !== zone) {
      scrollZoneRef.current = zone;
      setScrollZone(zone);
    }
    const active = zone === 'inside';
    if (isEngineActiveRef.current !== active) {
      isEngineActiveRef.current = active;
      setIsEngineActive(active);
    }
    if (activeStageRef.current !== stage) {
      activeStageRef.current = stage;
      setActiveStage(stage);
    }
  }, [containerRef]);

  const subscribeProgress = useCallback((callback: (progress: number) => void) => {
    progressListenersRef.current.add(callback);
    callback(progressRef.current);
    return () => {
      progressListenersRef.current.delete(callback);
    };
  }, []);

  const scrollToStage = useCallback(
    (stage: number, onComplete?: () => void) => {
      if (!containerRef.current) return;
      const targetNode = containerRef.current.querySelector<HTMLElement>(`[data-node="${stage}"]`);

      if (targetNode) {
        const nodeRect = targetNode.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;
        const vh = window.innerHeight;
        // Position milestone comfortably lower on screen (~26% vh, 180-260px) away from header
        const topMargin = Math.min(260, Math.max(180, Math.round(vh * 0.26)));
        const targetScrollY = scrollY + nodeRect.top - topMargin;

        cinematicScrollTo({
          top: Math.max(0, targetScrollY),
          interruptible: false,
          onComplete,
        });
      } else {
        // Fallback: fraction of container height
        const rect = containerRef.current.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;
        const vh = window.innerHeight;
        const topMargin = Math.min(260, Math.max(180, Math.round(vh * 0.26)));
        const targetFraction = (stage - 1) / 4;
        const targetScrollY = scrollY + rect.top + targetFraction * (rect.height - vh * 0.5) - topMargin;

        cinematicScrollTo({
          top: Math.max(0, targetScrollY),
          interruptible: false,
          onComplete,
        });
      }
    },
    [containerRef]
  );

  useEffect(() => {
    computeScroll();

    const handleScroll = () => {
      if (!isTickingRef.current) {
        window.requestAnimationFrame(() => {
          computeScroll();
          isTickingRef.current = false;
        });
        isTickingRef.current = true;
      }
    };

    const handleResize = () => {
      computeScroll();
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (!isTickingRef.current) {
          window.requestAnimationFrame(() => {
            computeScroll();
            isTickingRef.current = false;
          });
          isTickingRef.current = true;
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [computeScroll]);

  return {
    progressRef,
    activeStage,
    scrollZone,
    isEngineActive,
    scrollToStage,
    subscribeProgress,
  };
};
