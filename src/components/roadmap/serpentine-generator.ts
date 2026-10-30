/**
 * serpentine-generator.ts
 * Real-time mathematical generator for responsive serpentine progression track.
 * 
 * Computes smooth S-curves and exact milestone coordinates dynamically
 * based on viewport dimensions. Guaranteed 100% synchronized camera glide
 * and precision ink touch at all screen sizes.
 *
 * Parameterized to support arbitrary sequence length N >= 1.
 */

export interface GeneratedNodePoint {
  stage: number;
  id: string;
  x: number;
  y: number;
  threshold: number;
  accentColorVar: string;
  label: string;
  flank: "left" | "right" | "center";
}

export interface GeneratedRoadmap {
  pathData: string;
  totalLength: number;
  cumLengths: number[];
  points: GeneratedNodePoint[];
  totalHeight: number;
  y0: number;
  travelY: number;
}

export interface SerpentineNodeConfig {
  stage?: number;
  id?: string;
  threshold?: number;
  accentColorVar?: string;
  label?: string;
}

interface Point2D {
  x: number;
  y: number;
}

/**
 * Evaluates a cubic Bezier curve at parameter t in [0, 1]
 */
function evaluateCubicBezier(p0: Point2D, cp1: Point2D, cp2: Point2D, p1: Point2D, t: number): Point2D {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t2 * t * p1.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t2 * t * p1.y,
  };
}

/**
 * Calculates arc length of a cubic Bezier curve using 80 segment approximations (~0.003ms)
 */
function computeCubicArcLength(p0: Point2D, cp1: Point2D, cp2: Point2D, p1: Point2D, steps = 80): number {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= steps; i++) {
    const pt = evaluateCubicBezier(p0, cp1, cp2, p1, i / steps);
    length += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return length;
}

export interface SerpentineGeneratorOptions {
  /** Lateral edge padding ratio (default: 0.06 = 6% of container width) */
  paddingRatio?: number;
  /** Minimum lateral padding in pixels (default: 48px to prevent node radius clipping) */
  minPadding?: number;
  /** Maximum lateral padding in pixels (default: 80px for expansive desktop layout) */
  maxPadding?: number;
  /** Corner fillet radius for boxy architectural conduit (default: 36px) */
  cornerFilletRadius?: number;
  /** Track style: "conduit" (boxy rounded architectural) | "curved" (classic S-curve) (default: "conduit") */
  trackStyle?: "conduit" | "curved";
  /** Number of sequence milestone nodes (default: 5 or nodes.length) */
  nodeCount?: number;
  /** Custom node configurations */
  nodes?: SerpentineNodeConfig[];
}

/**
 * Generates the complete serpentine roadmap layout for any viewport width, height, and sequence length N >= 1
 */
export function generateSerpentineRoadmap(
  width: number,
  viewportHeight: number,
  options?: SerpentineGeneratorOptions
): GeneratedRoadmap {
  const paddingRatio = options?.paddingRatio ?? 0.06;
  const minPadding = options?.minPadding ?? 48;
  const maxPadding = options?.maxPadding ?? 80;
  const trackStyle = options?.trackStyle ?? "conduit";
  const requestedR = options?.cornerFilletRadius ?? 36;

  const count = Math.max(1, options?.nodeCount ?? options?.nodes?.length ?? 5);

  // Safe boundaries
  const safeWidth = Math.max(width, 320);
  const safeHeight = Math.max(viewportHeight, 480);

  // Lateral padding: comfortable breathing room away from screen edges
  const paddingX = Math.min(Math.max(safeWidth * paddingRatio, minPadding), maxPadding);
  const leftX = paddingX;
  const rightX = safeWidth - paddingX;

  // Vertical pacing: exact 100vh per milestone fold in natural document flow
  const y0 = Math.round(Math.max(160, Math.min(safeHeight * 0.26, 240)));
  const segmentH = Math.round(Math.max(safeHeight, 640));
  const travelY = Math.max(0, count - 1) * segmentH;

  // Dynamic Milestone Points (Alternating edge-to-edge sweep: Left -> Right -> Left -> Right -> ...)
  const points: GeneratedNodePoint[] = [];
  for (let i = 0; i < count; i++) {
    const stage = i + 1;
    const cfg = options?.nodes?.[i];
    const flank: "left" | "right" = i % 2 === 0 ? "left" : "right";
    const x = flank === "left" ? leftX : rightX;
    const y = y0 + i * segmentH;
    const threshold = count > 1 ? Number((i / (count - 1)).toFixed(4)) : 0;
    const id = cfg?.id ?? ("P" + stage);
    const NODE_COLOR_VARS = ["var(--color-node-1)", "var(--color-node-2)", "var(--color-node-3)", "var(--color-node-4)", "var(--color-node-5)"];
    const accentColorVar = cfg?.accentColorVar ?? NODE_COLOR_VARS[i % 5];
    const label = cfg?.label ?? ("Node " + stage);

    points.push({
      stage,
      id,
      x,
      y,
      threshold,
      accentColorVar,
      label,
      flank,
    });
  }

  // The physical track begins directly at Node 1 (0% scroll threshold).
  const startPoint = points[0];
  let pathData = "M " + startPoint.x.toFixed(1) + " " + startPoint.y.toFixed(1);
  const cumLengths: number[] = [0];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];

    if (trackStyle === "curved") {
      // Classic smooth S-curve
      const cp1: Point2D = { x: p0.x, y: p0.y + segmentH * 0.5 };
      const cp2: Point2D = { x: p1.x, y: p1.y - segmentH * 0.5 };

      pathData += " C " + cp1.x.toFixed(1) + " " + cp1.y.toFixed(1) + ", " + cp2.x.toFixed(1) + " " + cp2.y.toFixed(1) + ", " + p1.x.toFixed(1) + " " + p1.y.toFixed(1);

      const segLength = computeCubicArcLength(p0, cp1, cp2, p1);
      cumLengths.push(cumLengths[cumLengths.length - 1] + segLength);
    } else {
      // Boxy Rounded Architectural Conduit (Orthogonal Margin Drops + Smooth 90° Fillet Corners)
      const dir = p1.x > p0.x ? 1 : -1;
      const dx = Math.abs(p1.x - p0.x);

      // Safe corner radius that fits both horizontal and vertical segments
      const maxR = Math.min(requestedR, dx * 0.4, segmentH * 0.15);
      const R = Math.max(8, maxR);

      // Top-anchored destination node: horizontal crossover runs right above the milestone
      // so the node sits at the very top of the vertical path (just 24px below the corner turn)
      const topOffsetAboveNode = 24;
      const yCross = p1.y - R - topOffsetAboveNode;

      // 1. Vertical drop along margin gutter from source milestone down to crossover height
      const yTurn1 = yCross - R;
      pathData += " L " + p0.x.toFixed(1) + " " + yTurn1.toFixed(1);

      // 2. Smooth 90° corner turning into horizontal conduit
      const xTurn1 = p0.x + dir * R;
      pathData += " Q " + p0.x.toFixed(1) + " " + yCross.toFixed(1) + ", " + xTurn1.toFixed(1) + " " + yCross.toFixed(1);

      // 3. Straight horizontal cross-track (safely between/below rectangular card bays)
      const xTurn2 = p1.x - dir * R;
      pathData += " L " + xTurn2.toFixed(1) + " " + yCross.toFixed(1);

      // 4. Smooth 90° corner turning down into destination margin gutter
      const yTurn2 = yCross + R;
      pathData += " Q " + p1.x.toFixed(1) + " " + yCross.toFixed(1) + ", " + p1.x.toFixed(1) + " " + yTurn2.toFixed(1);

      // 5. Short vertical drop directly into top of destination milestone
      pathData += " L " + p1.x.toFixed(1) + " " + p1.y.toFixed(1);

      // Exact closed-form arc length for quadratic 90° fillet:
      // L_corner = R * (1 + ln(1 + sqrt(2)) / sqrt(2)) ~= 1.62322524014023 * R
      const cornerLength = (1 + Math.log(1 + Math.SQRT2) / Math.SQRT2) * R;
      const vDrop1 = yTurn1 - p0.y;
      const hCross = Math.abs(xTurn2 - xTurn1);
      const vDrop2 = p1.y - yTurn2;
      const segLength = vDrop1 + cornerLength + hCross + cornerLength + vDrop2;

      cumLengths.push(cumLengths[cumLengths.length - 1] + segLength);
    }
  }

  const totalLength = cumLengths[cumLengths.length - 1];
  // Ensure the last node commands its full 100vh fold (segmentH)
  const totalHeight = y0 + travelY + segmentH;

  return {
    pathData,
    totalLength,
    cumLengths,
    points,
    totalHeight,
    y0,
    travelY,
  };
}

/**
 * Interpolates drawn ink length from normalized scroll progress [0, 1] across N segments
 */
export function progressToDrawnLength(progress: number, cumLengths: number[]): number {
  const clamped = Math.min(Math.max(progress, 0), 1);
  if (clamped <= 0) return 0;
  if (clamped >= 1) return cumLengths[cumLengths.length - 1] ?? 0;

  const numSegments = cumLengths.length - 1;
  if (numSegments <= 0) return 0;

  const segmentFraction = 1 / numSegments;
  const interval = Math.min(Math.floor(clamped / segmentFraction), numSegments - 1);
  const t = (clamped - interval * segmentFraction) / segmentFraction;
  const startLen = cumLengths[interval] ?? 0;
  const endLen = cumLengths[interval + 1] ?? startLen;

  return startLen + t * (endLen - startLen);
}
