import React from 'react';

export interface ParametricShapeProps {
  /** Number of radial lobes / sides (S) */
  sides?: number;
  /** Bézier ripple amplitude (w) */
  waviness?: number;
  /** Base radius in pixels (R) */
  radius?: number;
  className?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  children?: React.ReactNode;
}

/**
 * Computes an SVG closed path string using the parametric rosette formula:
 * r(theta) = R * (1 + w * cos(S * theta))
 */
export function generateParametricPath(sides: number = 8, waviness: number = 0.15, radius: number = 24): string {
  const steps = Math.max(32, sides * 8);
  const cx = radius * (1 + Math.abs(waviness));
  const cy = cx;
  const points: [number, number][] = [];

  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const r = radius * (1 + waviness * Math.cos(sides * theta));
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    points.push([x, y]);
  }

  return points.reduce((acc, [x, y], idx) => {
    return idx === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `${acc} L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }, '') + ' Z';
}

export const ParametricShape: React.FC<ParametricShapeProps> = ({
  sides = 8,
  waviness = 0.15,
  radius = 24,
  className,
  fill = 'currentColor',
  stroke = 'none',
  strokeWidth = 1,
  children,
}) => {
  const size = Math.ceil(radius * (1 + Math.abs(waviness)) * 2);
  const pathData = generateParametricPath(sides, waviness, radius);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-hidden={!children}
    >
      <path d={pathData} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {children}
    </svg>
  );
};

export default ParametricShape;
