/**
 * node-photo-configs.ts
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   SINGLE SOURCE OF TRUTH — STICKY SEQUENCE PHOTO PLACEMENT          ║
 * ║                                                                      ║
 * ║   Unified configuration for desktop and mobile photo flight.         ║
 * ║   - Source: Center of Gravity (COG) positioning                     ║
 * ║   - Destination: Parity anchoring (Odd = Top-Left, Even = Top-Right)║
 * ║   - Viewport boundary math prevents edge clipping                    ║
 * ║   - Priority crop gravity centerpoint (focalPoint)                  ║
 * ║   - Global margins tuning object                                     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/**
 * Global Margin Settings for Destination Photos
 * Fine-tune safe viewport boundary margins for desktop and mobile in one place.
 */
export interface GlobalMarginSettings {
  desktop: {
    /** Minimum horizontal margin from viewport edge (px) */
    marginX: number;
    /** Vertical clearance from anchor (px) */
    marginY: number;
    /** Safety padding before the end of the milestone fold (px) */
    bottomPadding: number;
  };
  mobile: {
    /** Minimum horizontal margin from viewport edge (px) */
    marginX: number;
    /** Vertical clearance from anchor (px) */
    marginY: number;
    /** Safety padding before the end of the milestone fold (px) */
    bottomPadding: number;
  };
}

export const DESTINATION_GLOBAL_MARGINS: GlobalMarginSettings = {
  desktop: {
    marginX: 32,
    marginY: 24,
    bottomPadding: 70,
  },
  mobile: {
    marginX: 16,
    marginY: 16,
    bottomPadding: 32,
  },
};

/** Default maximum width limit for any docked destination photo (% of viewport width) */
export const DEFAULT_DEST_MAX_WIDTH_VW = 70;

/**
 * Timing offset for photo destination arrival.
 * Photos reach their final docked destination 10% before the scroll reaches the milestone node.
 * Expressed as a fraction of the approach flight corridor (0.10 = 10% before).
 */
export const PHOTO_DESTINATION_TIMING_OFFSET = 0.10;

/** Breakpoint: viewport widths below this value transition from side-by-side to stacked column layout */
export const PHOTO_STACKED_BREAKPOINT = 1024;
export const PHOTO_MOBILE_BREAKPOINT = PHOTO_STACKED_BREAKPOINT;

/** Priority gravity focal centerpoint for photo cropping (0 to 100%) */
export interface FocalPoint {
  /** % horizontal focal center (0 = left, 50 = center, 100 = right) */
  x: number;
  /** % vertical focal center (0 = top, 50 = center, 100 = bottom) */
  y: number;
}

/**
 * SOURCE Placement (Hero State)
 * All photos are referenced strictly based on their CENTER OF GRAVITY.
 */
export interface PhotoSourcePlacement {
  /** Which viewport edge to reference: 'left' or 'right' */
  side: 'left' | 'right';
  /** Horizontal distance (% of vw) from the referenced edge to the Center of Gravity */
  x: number;
  /** Vertical position (% of vh) from top of viewport to the Center of Gravity */
  y: number;
  /** Photo card face width (% of vw, 0–100) */
  width: number;
  /** Starting rotation in degrees (positive = clockwise) */
  rotation: number;
}

/**
 * DESTINATION Placement (Roadmap Docked State)
 * ODD nodes referenced by Upper Left; EVEN nodes referenced by Upper Right.
 */
export interface PhotoDestPlacement {
  /** Fine-tune X pixel offset from computed anchor (0 = natural dock position) */
  x?: number;
  /** Fine-tune Y pixel offset from computed anchor (0 = natural dock position) */
  y?: number;
  /** Unified limit to card face width: % of viewport width (0–100). Defaults to DEFAULT_DEST_MAX_WIDTH_VW. */
  maxWidthVw?: number;
  /** Resting rotation in degrees when fully docked (typically 0) */
  rotation?: number;
  /** Normalized timing offset before reaching milestone node (defaults to PHOTO_DESTINATION_TIMING_OFFSET = 0.10) */
  timingOffset?: number;
}

/**
 * Unified Node Photo Configuration
 */
export interface NodePhotoConfig {
  nodeNumber: number;
  source: PhotoSourcePlacement;
  destination: PhotoDestPlacement;
  focalPoint: FocalPoint;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEQUENCE NODE PHOTO PLACEMENT REGISTRY
// ─────────────────────────────────────────────────────────────────────────────
// Unified configuration for desktop and mobile.
// Dimensions and available area compute dynamically on the fly.
// ─────────────────────────────────────────────────────────────────────────────

export const NODE_PHOTO_CONFIGS: NodePhotoConfig[] = [
  // ── Node 1: Stage 01 — Left flank peeking ───────────────────────────────────
  {
    nodeNumber: 1,
    source: {
      side: 'left',
      x: 3,      // Center of gravity 3% vw inside from left edge (peeking)
      y: 24,     // 24% of vh down
      width: 14, // 14% of vw width
      rotation: 9,
    },
    destination: {
      x: 0,
      y: 0,
      rotation: 0,
    },
    focalPoint: {
      x: 50,
      y: 40,
    },
  },

  // ── Node 2: Stage 02 — Right flank upper ───────────────────────────────────
  {
    nodeNumber: 2,
    source: {
      side: 'right',
      x: 8,      // Center of gravity 8% vw inside from right edge
      y: 23,     // 23% of vh down
      width: 14,
      rotation: -7,
    },
    destination: {
      x: 0,
      y: 0,
      rotation: 0,
    },
    focalPoint: {
      x: 50,
      y: 45,
    },
  },

  // ── Node 3: Stage 03 — Right flank mid ─────────────────────────────────────
  {
    nodeNumber: 3,
    source: {
      side: 'right',
      x: 1,      // Center of gravity 1% vw inside from right edge
      y: 30,     // 30% of vh down (mid-fold)
      width: 15,
      rotation: 8,
    },
    destination: {
      x: 0,
      y: 0,
      rotation: 0,
    },
    focalPoint: {
      x: 50,
      y: 50,
    },
  },

  // ── Node 4: Stage 04 — Left flank lower ────────────────────────────────────
  {
    nodeNumber: 4,
    source: {
      side: 'left',
      x: 3,      // Center of gravity 3% vw inside from left edge
      y: 72,     // 72% of vh down
      width: 15,
      rotation: -11,
    },
    destination: {
      x: 0,
      y: 0,
      rotation: 0,
    },
    focalPoint: {
      x: 50,
      y: 40,
    },
  },

  // ── Node 5: Stage 05 — Right flank lower ───────────────────────────────────
  {
    nodeNumber: 5,
    source: {
      side: 'right',
      x: 3,      // Center of gravity 3% vw inside from right edge
      y: 82,     // 82% of vh down
      width: 14,
      rotation: -5,
    },
    destination: {
      x: 0,
      y: 0,
      rotation: 0,
    },
    focalPoint: {
      x: 50,
      y: 45,
    },
  },
];

/** Lookup helper: get unified config for a given node sequence number */
export function getNodePhotoConfig(
  nodeNumber: number
): NodePhotoConfig | undefined {
  return NODE_PHOTO_CONFIGS.find((c) => c.nodeNumber === nodeNumber);
}

