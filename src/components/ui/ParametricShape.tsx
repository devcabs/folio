import React, { useMemo } from 'react';
import styles from './ParametricShape.module.css';

export interface ParametricPolygonOptions {
  /** Number of polygon lobes/sides (default: 8) */
  sides?: number;
  /** Base radius in coordinate space (default: 45) */
  radius?: number;
  /** Wave amplitude: crest height vs trough depth (default: 8) */
  waviness?: number;
  /** Corner roundness factor / tangent handle tension (default: 1) */
  roundness?: number;
  /** Outline path stroke width (default: 10) */
  strokeWidth?: number;
}

export interface ParametricPolygonResult {
  pathData: string;
  viewBox: string;
}

/**
 * Mathematically generates an auto-centered, tangent-continuous closed cubic-bezier wavy polygon path
 * with an auto-fitted viewBox that guarantees zero clipping.
 * Formula: r(theta) = R * (1 + w * cos(S * theta))
 */
export function generateParametricPolygonPath({
  sides = 8,
  radius = 45,
  waviness = 8,
  roundness = 1,
  strokeWidth = 10,
}: ParametricPolygonOptions = {}): ParametricPolygonResult {
  const safeSides = Math.max(3, Math.round(sides));
  const totalNodes = safeSides * 2;
  const rawNodes: Array<{ x: number; y: number; tx: number; ty: number }> = [];

  for (let i = 0; i < totalNodes; i++) {
    const theta = -Math.PI / 2 + (i * Math.PI) / safeSides;
    const isPeak = i % 2 === 0;
    const r = isPeak ? radius + waviness : radius - waviness;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    const tx = -Math.sin(theta);
    const ty = Math.cos(theta);
    rawNodes.push({ x, y, tx, ty });
  }

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

  const width = tightMaxX - tightMinX;
  const height = tightMaxY - tightMinY;
  const maxDim = Math.max(width, height);
  const midX = (tightMinX + tightMaxX) / 2;
  const midY = (tightMinY + tightMaxY) / 2;

  const boxOriginX = (midX - maxDim / 2).toFixed(2);
  const boxOriginY = (midY - maxDim / 2).toFixed(2);
  const boxSize = maxDim.toFixed(2);
  const viewBox = `${boxOriginX} ${boxOriginY} ${boxSize} ${boxSize}`;

  return { pathData, viewBox };
}

export interface ParametricShapeProps extends ParametricPolygonOptions {
  /** Size preset or custom pixel number */
  size?: 'sm' | 'md' | 'lg' | number;
  /** Outline path stroke width (default: 10) */
  strokeWidth?: number;
  /** Optional glyph or letter centered in the outline */
  letter?: string;
  /** Custom additional CSS class */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Accessibility label */
  ariaLabel?: string;
  /** Whether screen readers should ignore the visual mark */
  ariaHidden?: boolean;
  /** Optional nested children */
  children?: React.ReactNode;
}

export const ParametricShape: React.FC<ParametricShapeProps> = ({
  sides = 8,
  radius = 45,
  waviness = 8,
  roundness = 1,
  strokeWidth = 10,
  size = 'md',
  letter,
  className,
  style,
  ariaLabel = 'Brand Mark',
  ariaHidden = true,
  children,
}) => {
  const { pathData, viewBox } = useMemo(
    () => generateParametricPolygonPath({ sides, radius, waviness, roundness, strokeWidth }),
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
        ['--shape-size' as string]: `${size}px`,
      }
    : (style ?? {});

  return (
    <div
      className={`${styles.container} ${sizeClass ?? ''} ${className ?? ''}`.trim()}
      style={customStyle}
      role={ariaHidden ? 'presentation' : 'img'}
      aria-label={ariaHidden ? undefined : ariaLabel}
      aria-hidden={ariaHidden}
    >
      <svg
        className={styles.svg}
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d={pathData}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={styles.path}
        />
      </svg>
      {letter && <span className={styles.letter}>{letter}</span>}
      {children}
    </div>
  );
};

export default ParametricShape;
