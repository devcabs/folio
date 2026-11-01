import React, { useMemo } from 'react';
import styles from './ParametricShape.module.css';

export interface WavyPolygonOptions {
  /** Number of polygon lobes/sides (default: 5) */
  sides?: number;
  /** Base radius in coordinate space (default: 50) */
  radius?: number;
  /** Wave amplitude: crest height vs trough depth (default: 10, or 0-1 as fraction of radius) */
  waviness?: number;
  /** Corner roundness factor / tangent handle tension (default: 1) */
  roundness?: number;
  /** Outline path stroke width (default: 12) */
  strokeWidth?: number;
}

export interface WavyPolygonResult {
  pathData: string;
  viewBox: string;
}

/**
 * Mathematically generates an auto-centered, tangent-continuous closed cubic-bezier wavy polygon path
 * with an auto-fitted viewBox that guarantees zero clipping.
 */
export function generateWavyPolygonPath({
  sides = 5,
  radius = 50,
  waviness = 10,
  roundness = 1,
  strokeWidth = 12,
}: WavyPolygonOptions = {}): WavyPolygonResult {
  const safeSides = Math.max(3, Math.round(sides));
  const totalNodes = safeSides * 2;
  const rawNodes: Array<{ x: number; y: number; tx: number; ty: number }> = [];

  // If waviness is a fraction (0 < w <= 1), treat as proportional to radius
  const amp = waviness > 0 && waviness <= 1 ? radius * waviness : waviness;

  // Generate nodes centered at (0, 0)
  for (let i = 0; i < totalNodes; i++) {
    const theta = -Math.PI / 2 + (i * Math.PI) / safeSides;
    const isPeak = i % 2 === 0;
    const r = isPeak ? radius + amp : radius - amp;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    const tx = -Math.sin(theta);
    const ty = Math.cos(theta);
    rawNodes.push({ x, y, tx, ty });
  }

  // Calculate bounding box of control nodes to auto-center inside (50, 50)
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const n of rawNodes) {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  }

  const cx = 50 - (minX + maxX) / 2;
  const cy = 50 - (minY + maxY) / 2;

  const nodes = rawNodes.map((n) => ({
    x: n.x + cx,
    y: n.y + cy,
    tx: n.tx,
    ty: n.ty,
  }));

  let pathData = `M ${nodes[0].x.toFixed(2)} ${nodes[0].y.toFixed(2)}`;

  for (let i = 0; i < nodes.length; i++) {
    const curr = nodes[i];
    const next = nodes[(i + 1) % nodes.length];
    const dist = Math.hypot(next.x - curr.x, next.y - curr.y);
    const handleLen = dist * roundness;

    const cp1x = curr.x + curr.tx * handleLen;
    const cp1y = curr.y + curr.ty * handleLen;
    const cp2x = next.x - next.tx * handleLen;
    const cp2y = next.y - next.ty * handleLen;

    pathData += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  pathData += ' Z';

  // Compute exact tight curve bounds so the shape fills 100% of the element container
  let curveMinX = Infinity;
  let curveMaxX = -Infinity;
  let curveMinY = Infinity;
  let curveMaxY = -Infinity;

  for (let i = 0; i < nodes.length; i++) {
    const curr = nodes[i];
    const next = nodes[(i + 1) % nodes.length];
    const dist = Math.hypot(next.x - curr.x, next.y - curr.y);
    const handleLen = dist * roundness;
    const cp1x = curr.x + curr.tx * handleLen;
    const cp1y = curr.y + curr.ty * handleLen;
    const cp2x = next.x - next.tx * handleLen;
    const cp2y = next.y - next.ty * handleLen;

    for (let t = 0; t <= 1; t += 0.05) {
      const u = 1 - t;
      const x = u * u * u * curr.x + 3 * u * u * t * cp1x + 3 * u * t * t * cp2x + t * t * t * next.x;
      const y = u * u * u * curr.y + 3 * u * u * t * cp1y + 3 * u * t * t * cp2y + t * t * t * next.y;
      if (x < curveMinX) curveMinX = x;
      if (x > curveMaxX) curveMaxX = x;
      if (y < curveMinY) curveMinY = y;
      if (y > curveMaxY) curveMaxY = y;
    }
  }

  const halfStroke = strokeWidth / 2 + 0.5;
  const tightMinX = curveMinX - halfStroke;
  const tightMaxX = curveMaxX + halfStroke;
  const tightMinY = curveMinY - halfStroke;
  const tightMaxY = curveMaxY + halfStroke;

  const width = tightMinX === tightMaxX ? 100 : tightMaxX - tightMinX;
  const height = tightMinY === tightMaxY ? 100 : tightMaxY - tightMinY;
  const maxDim = Math.max(width, height);
  const midX = (tightMinX + tightMaxX) / 2;
  const midY = (tightMinY + tightMaxY) / 2;

  const boxOriginX = (midX - maxDim / 2).toFixed(2);
  const boxOriginY = (midY - maxDim / 2).toFixed(2);
  const boxSize = maxDim.toFixed(2);
  const viewBox = `${boxOriginX} ${boxOriginY} ${boxSize} ${boxSize}`;

  return { pathData, viewBox };
}

/**
 * Computes an SVG closed path string using the parametric rosette formula.
 */
export function generateParametricPath(sides: number = 8, waviness: number = 0.15, radius: number = 24): string {
  return generateWavyPolygonPath({ sides, waviness, radius }).pathData;
}

export interface ParametricShapeProps extends WavyPolygonOptions {
  /** Size preset or custom pixel number */
  size?: 'sm' | 'md' | 'lg' | number;
  /** Outline path stroke width (default: 12) */
  strokeWidth?: number;
  /** Optional glyph or letter centered in the outline (e.g. "P") */
  letter?: string;
  /** Custom additional CSS class */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** SVG fill color if rendering direct vector */
  fill?: string;
  /** SVG stroke color */
  stroke?: string;
  /** Accessibility label */
  ariaLabel?: string;
  /** Whether screen readers should ignore the visual mark */
  ariaHidden?: boolean;
  /** Optional child elements */
  children?: React.ReactNode;
}

/**
 * ParametricShape — Parametric Geometric Brand Mark
 * Renders an auto-centered, tangent-continuous cubic-Bézier wavy polygon
 * with CSS `--gradient-conic` design token masking or direct SVG fill.
 */
export const ParametricShape: React.FC<ParametricShapeProps> = ({
  sides = 5,
  radius = 50,
  waviness = 10,
  roundness = 1,
  strokeWidth = 12,
  size = 'sm',
  letter,
  className,
  style,
  fill,
  stroke = 'none',
  ariaLabel = 'Parametric Brand Mark',
  ariaHidden = true,
  children,
}) => {
  // Compute parametric path and adaptive viewBox
  const { pathData, viewBox } = useMemo(
    () => generateWavyPolygonPath({ sides, radius, waviness, roundness, strokeWidth }),
    [sides, radius, waviness, roundness, strokeWidth]
  );

  const isCustomSize = typeof size === 'number';
  const sizeClass = !isCustomSize
    ? size === 'lg'
      ? styles.sizeLg
      : size === 'md'
        ? styles.sizeMd
        : styles.sizeSm
    : undefined;

  const customStyle: React.CSSProperties = isCustomSize
    ? {
        ...style,
        ['--logo-size' as string]: `${size}px`,
      }
    : (style ?? {});

  // If a direct vector fill or children are provided, render as SVG
  if (fill || children) {
    const pixelDim = isCustomSize ? size : size === 'lg' ? 54 : size === 'md' ? 42 : 36;
    return (
      <svg
        width={pixelDim}
        height={pixelDim}
        viewBox={viewBox}
        className={`${styles.parametricShape} ${sizeClass ?? ''} ${className ?? ''}`.trim()}
        style={customStyle}
        role={ariaHidden ? 'presentation' : 'img'}
        aria-label={ariaHidden ? undefined : ariaLabel}
        aria-hidden={ariaHidden}
      >
        <path d={pathData} fill={fill || 'currentColor'} stroke={stroke} strokeWidth={strokeWidth} />
        {children}
      </svg>
    );
  }

  // Generate SVG mask data URI to clip the conic-gradient background
  const maskUrl = `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="${pathData}" fill="none" stroke="black" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  )}")`;

  return (
    <div
      className={`${styles.parametricShape} ${sizeClass ?? ''} ${className ?? ''}`.trim()}
      style={customStyle}
      role={ariaHidden ? 'presentation' : 'img'}
      aria-label={ariaHidden ? undefined : ariaLabel}
      aria-hidden={ariaHidden}
    >
      <div
        className={styles.conicShape}
        style={{
          WebkitMaskImage: maskUrl,
          maskImage: maskUrl,
        }}
      />
      {letter && <span className={styles.letter}>{letter}</span>}
    </div>
  );
};

export default ParametricShape;

// Backward-compatibility aliases
export { ParametricShape as EnzoLogo };
export type { ParametricShapeProps as EnzoLogoProps };
