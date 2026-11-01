/**
 * D3 Math Primitives & Geometric Scaling Utilities
 * Document Reference: docs/tasks/task7_1_contracts_d3_math_sanitizer.md
 * 
 * Lightweight mathematical wrappers around tree-shakable d3-scale and d3-array modules.
 * Strictly adheres to bundle-barrel-imports (direct subpackage imports) and js-early-exit.
 */

import { scaleLinear, scaleBand, type ScaleLinear, type ScaleBand } from 'd3-scale';
import { extent } from 'd3-array';
import type { ChartSeries, ScatterPoint } from '../types/chart';

export interface Point2D {
  x: number;
  y: number;
}

export interface ComputedBin {
  x0: number;
  x1: number;
  count: number;
}

/**
 * Creates a continuous linear scale with optional domain rounding (.nice())
 */
export function createLinearScale(
  domain: [number, number],
  range: [number, number],
  nice = true
): ScaleLinear<number, number> {
  const scale = scaleLinear().domain(domain).range(range);
  return nice ? scale.nice() : scale;
}

/**
 * Creates a discrete band scale for categorical bar positioning
 */
export function createBandScale(
  domain: string[],
  range: [number, number],
  padding = 0.2
): ScaleBand<string> {
  return scaleBand().domain(domain).range(range).padding(padding);
}

export const HUMAN_FRIENDLY_STEPS = [1, 2, 5, 10, 20, 25, 50, 100];

export function roundToHumanFriendlyStep(raw: number): number {
  if (raw <= 0 || !Number.isFinite(raw)) return 1;
  if (raw <= 100) {
    let closest = HUMAN_FRIENDLY_STEPS[0];
    let minDiff = Math.abs(raw - closest);
    for (let i = 1; i < HUMAN_FRIENDLY_STEPS.length; i++) {
      const step = HUMAN_FRIENDLY_STEPS[i];
      const diff = Math.abs(raw - step);
      if (diff < minDiff) {
        minDiff = diff;
        closest = step;
      }
    }
    return closest;
  }
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / power;
  let best = 1;
  let minDiff = Math.abs(normalized - 1);
  for (const candidate of [1, 2, 2.5, 5, 10]) {
    const diff = Math.abs(normalized - candidate);
    if (diff < minDiff) {
      minDiff = diff;
      best = candidate;
    }
  }
  return Math.round(best * power);
}

/**
 * Calculates optimal bin width using the Freedman-Diaconis Rule:
 * h = 2 * IQR(x) / cbrt(N)
 * Rounded to the nearest human-friendly interval step (1, 2, 5, 10, 20, 25, 50, 100).
 */
export function calculateFreedmanDiaconisBinWidth(data: number[]): number {
  const valid = data.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (valid.length < 2) return 1;

  const sorted = [...valid].sort((a, b) => a - b);
  const n = sorted.length;

  const q1Index = (n - 1) * 0.25;
  const q3Index = (n - 1) * 0.75;

  const interpolate = (idx: number) => {
    const base = Math.floor(idx);
    const rest = idx - base;
    if (base + 1 < n) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  };

  const q1 = interpolate(q1Index);
  const q3 = interpolate(q3Index);
  const iqr = q3 - q1;

  let h: number;
  if (iqr > 0) {
    h = (2 * iqr) / Math.cbrt(n);
  } else {
    const stats = computeSummaryStats(sorted);
    if (stats.stdDev > 0) {
      h = (3.5 * stats.stdDev) / Math.cbrt(n);
    } else {
      const range = sorted[n - 1] - sorted[0];
      const k = Math.ceil(Math.log2(n) + 1);
      h = range > 0 ? range / k : 1;
    }
  }

  return roundToHumanFriendlyStep(h);
}

export interface SummaryStats {
  n: number;
  mean: number;
  median: number;
  mode?: number | string;
  stdDev: number;
}

/**
 * Calculates sample size, mean, median, mode, and sample standard deviation
 */
export function computeSummaryStats(data: number[]): SummaryStats {
  const valid = data.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const n = valid.length;
  if (n === 0) {
    return { n: 0, mean: 0, median: 0, mode: undefined, stdDev: 0 };
  }

  const sum = valid.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  const sorted = [...valid].sort((a, b) => a - b);
  let median = 0;
  if (n % 2 === 1) {
    median = sorted[Math.floor(n / 2)];
  } else {
    median = (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  }

  // Calculate Mode (discrete frequency or modal continuous bin)
  const freqMap = new Map<number, number>();
  let maxFreq = 0;
  for (const v of valid) {
    const count = (freqMap.get(v) || 0) + 1;
    freqMap.set(v, count);
    if (count > maxFreq) maxFreq = count;
  }

  let mode: number | string | undefined;
  if (maxFreq > 1) {
    const modes: number[] = [];
    for (const [val, count] of freqMap.entries()) {
      if (count === maxFreq) modes.push(val);
    }
    modes.sort((a, b) => a - b);
    mode = modes.length === 1 ? modes[0] : modes.length <= 3 ? modes.join(', ') : 'Multimodal';
  } else {
    // When observations are unique, determine the modal range from auto bins
    const bins = computeHistogramBins(valid);
    if (bins.length > 0) {
      let topBin = bins[0];
      for (const b of bins) {
        if (b.count > topBin.count) topBin = b;
      }
      mode = `${topBin.x0}–${topBin.x1}`;
    }
  }

  const variance = valid.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    n,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    mode,
    stdDev: Number(stdDev.toFixed(2)),
  };
}

export interface HistogramBinOptions {
  strategy?: 'auto' | 'custom';
  binCount?: number;
  bucketSize?: number;
  min?: number;
  max?: number;
}

/**
 * Computes frequency distribution bins with standard half-open intervals [x0, x1),
 * with the maximum value included in the final bin [xk-1, xk].
 */
export function computeHistogramBins(
  data: number[],
  options?: number | HistogramBinOptions
): ComputedBin[] {
  const validData = data.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (validData.length === 0) return [];

  const opts: HistogramBinOptions =
    typeof options === 'number' ? { binCount: options } : options || {};

  const minVal = opts.min !== undefined ? opts.min : Math.min(...validData);
  const maxVal = opts.max !== undefined ? opts.max : Math.max(...validData);

  let step: number;
  if (opts.strategy === 'custom') {
    if (opts.bucketSize && opts.bucketSize > 0) {
      step = opts.bucketSize;
    } else if (opts.binCount && opts.binCount > 0) {
      const range = maxVal - minVal;
      step = range > 0 ? Math.max(1, Math.round(range / opts.binCount)) : 1;
    } else {
      step = calculateFreedmanDiaconisBinWidth(validData);
    }
  } else if (opts.bucketSize && opts.bucketSize > 0) {
    step = opts.bucketSize;
  } else if (opts.binCount && opts.binCount > 0 && opts.strategy !== 'auto') {
    const range = maxVal - minVal;
    step = range > 0 ? Math.max(1, Math.round(range / opts.binCount)) : 1;
  } else {
    step = calculateFreedmanDiaconisBinWidth(validData);
  }

  if (step <= 0 || !Number.isFinite(step)) step = 1;

  const start = Math.floor(minVal / step) * step;
  let end = Math.ceil(maxVal / step) * step;
  if (end <= start) end = start + step;

  const bins: ComputedBin[] = [];
  for (let edge = start; edge < end; edge += step) {
    const x0 = Number(edge.toFixed(4));
    const x1 = Number((edge + step).toFixed(4));
    bins.push({ x0, x1, count: 0 });
  }

  if (bins.length === 0) {
    bins.push({ x0: minVal, x1: minVal + step, count: 0 });
  }

  const lastIdx = bins.length - 1;
  for (const val of validData) {
    for (let i = 0; i <= lastIdx; i++) {
      const b = bins[i];
      const isInside =
        i === lastIdx
          ? val >= b.x0 && val <= b.x1
          : val >= b.x0 && val < b.x1;

      if (isInside) {
        b.count++;
        break;
      }
    }
  }

  return bins;
}

/**
 * Calculates extent [min, max] safely ignoring nulls, NaNs, and infinite values
 */
export function computeDataExtent(values: (number | null)[]): [number, number] {
  const validNums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (validNums.length === 0) return [0, 100];
  const [eMin, eMax] = extent(validNums);
  return [eMin ?? 0, eMax ?? 100];
}

/**
 * Generates a smooth cubic Bézier SVG path string ("M... C...") for line charts
 */
export function generateCubicBezierPath(points: Point2D[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * Generates a straight linear SVG path string ("M... L...") for line charts
 */
export function generateStraightLinePath(points: Point2D[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  return `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')}`;
}

export interface CornerRadii {
  tl?: number;
  tr?: number;
  br?: number;
  bl?: number;
}

/**
 * Generates an SVG path string for a rectangle with individual corner radii.
 * Essential for stacked bar charts where interior/middle boundaries must have 0 radius.
 */
export function createRoundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  radii: CornerRadii = {}
): string {
  if (w <= 0 || h <= 0) return '';

  const maxRadius = Math.min(w / 2, h / 2);
  const tl = Math.max(0, Math.min(radii.tl ?? 0, maxRadius));
  const tr = Math.max(0, Math.min(radii.tr ?? 0, maxRadius));
  const br = Math.max(0, Math.min(radii.br ?? 0, maxRadius));
  const bl = Math.max(0, Math.min(radii.bl ?? 0, maxRadius));

  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    return `M ${x.toFixed(2)} ${y.toFixed(2)} h ${w.toFixed(2)} v ${h.toFixed(2)} h ${(-w).toFixed(2)} Z`;
  }

  return [
    `M ${(x + tl).toFixed(2)} ${y.toFixed(2)}`,
    `h ${(w - tl - tr).toFixed(2)}`,
    tr > 0 ? `a ${tr.toFixed(2)} ${tr.toFixed(2)} 0 0 1 ${tr.toFixed(2)} ${tr.toFixed(2)}` : '',
    `v ${(h - tr - br).toFixed(2)}`,
    br > 0 ? `a ${br.toFixed(2)} ${br.toFixed(2)} 0 0 1 ${(-br).toFixed(2)} ${br.toFixed(2)}` : '',
    `h ${(-(w - br - bl)).toFixed(2)}`,
    bl > 0 ? `a ${bl.toFixed(2)} ${bl.toFixed(2)} 0 0 1 ${(-bl).toFixed(2)} ${(-bl).toFixed(2)}` : '',
    `v ${(-(h - bl - tl)).toFixed(2)}`,
    tl > 0 ? `a ${tl.toFixed(2)} ${tl.toFixed(2)} 0 0 1 ${tl.toFixed(2)} ${(-tl).toFixed(2)}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
}


/**
 * Universal Two-Dropdown Sorting Engine
 * Sorts tabular categories and series data consistently by category name, series values, or original order.
 */
export function applyChartSorting(
  categories: string[],
  series: ChartSeries[],
  sortField?: string,
  sortDirection: 'asc' | 'desc' = 'asc'
): { categories: string[]; series: ChartSeries[] } {
  if (!sortField || sortField === 'sheet_order' || categories.length === 0) {
    if (sortDirection === 'desc') {
      const reversedCats = [...categories].reverse();
      const reversedSeries = series.map((s) => ({
        ...s,
        data: [...s.data].reverse(),
      }));
      return { categories: reversedCats, series: reversedSeries };
    }
    return { categories, series };
  }

  const indices = categories.map((_, i) => i);

  if (sortField === 'category') {
    indices.sort((a, b) => {
      const cmp = (categories[a] || '').localeCompare(categories[b] || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  } else {
    // Specific metric series by name or default to total sum
    const targetSeries = series.find((s) => s.name === sortField);

    indices.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (targetSeries) {
        valA = typeof targetSeries.data[a] === 'number' && Number.isFinite(targetSeries.data[a])
          ? (targetSeries.data[a] as number)
          : 0;
        valB = typeof targetSeries.data[b] === 'number' && Number.isFinite(targetSeries.data[b])
          ? (targetSeries.data[b] as number)
          : 0;
      } else {
        // Aggregate across all series
        for (const s of series) {
          const vA = s.data[a];
          const vB = s.data[b];
          if (typeof vA === 'number' && Number.isFinite(vA)) valA += vA;
          if (typeof vB === 'number' && Number.isFinite(vB)) valB += vB;
        }
      }

      return sortDirection === 'desc' ? valB - valA : valA - valB;
    });
  }

  const newCategories = indices.map((i) => categories[i]);
  const newSeries = series.map((s) => ({
    ...s,
    data: indices.map((i) => s.data[i]),
  }));

  return { categories: newCategories, series: newSeries };
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  r: number;
  rSquared: number;
  n: number;
}

/**
 * Computes standard least-squares linear regression (y = mx + b),
 * Pearson correlation coefficient (r), and coefficient of determination (R²).
 */
export function computeLinearRegression(points: ScatterPoint[]): LinearRegressionResult {
  const valid = points.filter(
    (p) => typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y)
  );
  const n = valid.length;
  if (n < 2) {
    return { slope: 0, intercept: 0, r: 0, rSquared: 0, n };
  }

  const sumX = valid.reduce((acc, p) => acc + p.x, 0);
  const sumY = valid.reduce((acc, p) => acc + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let ssXX = 0;
  let ssYY = 0;
  let ssXY = 0;

  for (const p of valid) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    ssXX += dx * dx;
    ssYY += dy * dy;
    ssXY += dx * dy;
  }

  if (ssXX === 0) {
    return { slope: 0, intercept: Number(meanY.toFixed(4)), r: 0, rSquared: 0, n };
  }

  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  const denom = Math.sqrt(ssXX * ssYY);
  const r = denom > 0 ? ssXY / denom : 0;
  const rSquared = r * r;

  return {
    slope: Number(slope.toFixed(4)),
    intercept: Number(intercept.toFixed(4)),
    r: Number(r.toFixed(4)),
    rSquared: Number(rSquared.toFixed(4)),
    n,
  };
}

export interface ConfidenceBandPoint {
  x: number;
  y0: number; // lower confidence bound
  y1: number; // upper confidence bound
}

/**
 * Computes 95% confidence interval ribbon bounds around the linear regression line.
 */
export function computeConfidenceBand(
  points: ScatterPoint[],
  m: number,
  b: number
): ConfidenceBandPoint[] {
  const valid = points.filter(
    (p) => typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y)
  );
  const n = valid.length;
  if (n <= 2) return [];

  const sumX = valid.reduce((acc, p) => acc + p.x, 0);
  const meanX = sumX / n;

  let ssXX = 0;
  let sse = 0;
  for (const p of valid) {
    const dx = p.x - meanX;
    ssXX += dx * dx;
    const residual = p.y - (m * p.x + b);
    sse += residual * residual;
  }

  if (ssXX === 0) return [];

  // Standard error of regression estimate
  const s = Math.sqrt(sse / (n - 2));

  // Get sorted unique x coordinates
  const sortedX = Array.from(new Set(valid.map((p) => p.x))).sort((a, b) => a - b);

  return sortedX.map((x) => {
    const seLine = s * Math.sqrt(1 / n + Math.pow(x - meanX, 2) / ssXX);
    const yFit = m * x + b;
    const margin = 1.96 * seLine;
    return {
      x,
      y0: Number((yFit - margin).toFixed(4)),
      y1: Number((yFit + margin).toFixed(4)),
    };
  });
}

/**
 * Computes 95% confidence interval ribbon bounds along a non-linear curve (Polynomial or LOESS).
 */
export function computeCurveConfidenceBand(
  points: ScatterPoint[],
  curvePoints: Point2D[],
  degreesOfFreedom = 2
): ConfidenceBandPoint[] {
  const valid = points.filter(
    (p) => typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y)
  );
  const n = valid.length;
  if (n <= degreesOfFreedom || curvePoints.length === 0) return [];

  const sumX = valid.reduce((acc, p) => acc + p.x, 0);
  const meanX = sumX / n;

  let ssXX = 0;
  for (const p of valid) {
    const dx = p.x - meanX;
    ssXX += dx * dx;
  }
  if (ssXX === 0) return [];

  // Compute residual sum of squares by finding distance to nearest curve point
  let sse = 0;
  for (const p of valid) {
    let closestY = curvePoints[0].y;
    let minD = Math.abs(curvePoints[0].x - p.x);
    for (let i = 1; i < curvePoints.length; i++) {
      const d = Math.abs(curvePoints[i].x - p.x);
      if (d < minD) {
        minD = d;
        closestY = curvePoints[i].y;
      }
    }
    const res = p.y - closestY;
    sse += res * res;
  }

  const s = Math.sqrt(sse / Math.max(1, n - degreesOfFreedom));

  return curvePoints.map((cp) => {
    const seLine = s * Math.sqrt(1 / n + Math.pow(cp.x - meanX, 2) / ssXX);
    const margin = 1.96 * seLine;
    return {
      x: cp.x,
      y0: Number((cp.y - margin).toFixed(4)),
      y1: Number((cp.y + margin).toFixed(4)),
    };
  });
}

/**
 * Computes locally estimated scatterplot smoothing (LOESS) curve coordinates
 * using a tricube kernel weight.
 */
export function computeLoessCurve(points: ScatterPoint[], bandwidth = 0.5): Point2D[] {
  const valid = points.filter(
    (p) => typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y)
  );
  const n = valid.length;
  if (n < 2) {
    return valid.map((p) => ({ x: p.x, y: p.y }));
  }

  // Sort by x
  const sorted = [...valid].sort((a, b) => a.x - b.x);
  const k = Math.max(2, Math.floor(bandwidth * n));

  return sorted.map((targetPt) => {
    const x0 = targetPt.x;

    // Distances to all points
    const distances = sorted.map((p) => Math.abs(p.x - x0));
    const sortedDistances = [...distances].sort((a, b) => a - b);
    const maxDist = sortedDistances[k - 1] || 1;

    let sumW = 0;
    let sumWX = 0;
    let sumWY = 0;

    const weights = distances.map((d) => {
      if (maxDist === 0) return 1;
      const u = d / maxDist;
      if (u >= 1) return 0;
      // Tricube kernel: (1 - u^3)^3
      return Math.pow(1 - Math.pow(u, 3), 3);
    });

    for (let i = 0; i < n; i++) {
      const w = weights[i];
      sumW += w;
      sumWX += w * sorted[i].x;
      sumWY += w * sorted[i].y;
    }

    if (sumW === 0) return { x: x0, y: targetPt.y };

    const meanXW = sumWX / sumW;
    const meanYW = sumWY / sumW;

    let ssXXW = 0;
    let ssXYW = 0;

    for (let i = 0; i < n; i++) {
      const w = weights[i];
      const dx = sorted[i].x - meanXW;
      const dy = sorted[i].y - meanYW;
      ssXXW += w * dx * dx;
      ssXYW += w * dx * dy;
    }

    if (ssXXW === 0) {
      return { x: x0, y: Number(meanYW.toFixed(4)) };
    }

    const localSlope = ssXYW / ssXXW;
    const localY = meanYW + localSlope * (x0 - meanXW);

    return {
      x: x0,
      y: Number(localY.toFixed(4)),
    };
  });
}

export interface CohortMeans {
  meanX: number;
  meanY: number;
}

/**
 * Computes cohort averages (meanX, meanY) for mean quadrant crosshair guides.
 */
export function computeCohortMeans(points: ScatterPoint[]): CohortMeans {
  const valid = points.filter(
    (p) => typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y)
  );
  if (valid.length === 0) return { meanX: 0, meanY: 0 };

  const sumX = valid.reduce((acc, p) => acc + p.x, 0);
  const sumY = valid.reduce((acc, p) => acc + p.y, 0);

  return {
    meanX: Number((sumX / valid.length).toFixed(4)),
    meanY: Number((sumY / valid.length).toFixed(4)),
  };
}

/**
 * Sorts scatter plot points by sheet order, x, y, point label, or group name.
 */
export function sortScatterPoints(
  points: ScatterPoint[],
  sortField?: string,
  sortDirection: 'asc' | 'desc' = 'asc'
): ScatterPoint[] {
  if (!sortField || sortField === 'sheet_order' || sortField === 'sheet' || points.length === 0) {
    if (sortDirection === 'desc') {
      return [...points].reverse();
    }
    return [...points];
  }

  const sorted = [...points];

  if (sortField === 'x' || sortField === 'horizontal' || sortField === 'Horizontal Number') {
    sorted.sort((a, b) => (sortDirection === 'desc' ? b.x - a.x : a.x - b.x));
  } else if (sortField === 'y' || sortField === 'vertical' || sortField === 'Vertical Number') {
    sorted.sort((a, b) => (sortDirection === 'desc' ? b.y - a.y : a.y - b.y));
  } else if (sortField === 'label' || sortField === 'dot_label' || sortField === 'category' || sortField === 'Point Label') {
    sorted.sort((a, b) => {
      const cmp = (a.label || '').localeCompare(b.label || '', undefined, { numeric: true });
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  } else if (sortField === 'group' || sortField === 'category_group' || sortField === 'Group / Category') {
    sorted.sort((a, b) => {
      const cmp = (a.group || '').localeCompare(b.group || '', undefined, { numeric: true });
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }

  return sorted;
}

export interface PolynomialRegressionResult {
  a: number;
  b: number;
  c: number;
  rSquared: number;
  points: Point2D[];
}

/**
 * Computes quadratic polynomial regression (y = a*x^2 + b*x + c)
 * Solves the normal equations using Cramer's rule and samples smooth curve coordinates.
 */
export function computePolynomialRegression(
  points: ScatterPoint[],
  sampleCount = 40
): PolynomialRegressionResult {
  const valid = points.filter(
    (p) => typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y)
  );
  const n = valid.length;

  if (n < 3) {
    const lin = computeLinearRegression(valid);
    const sortedX = [...valid].map((p) => p.x).sort((a, b) => a - b);
    const xMin = sortedX[0] ?? 0;
    const xMax = sortedX[sortedX.length - 1] ?? 100;
    const sampled: Point2D[] = [];
    for (let i = 0; i <= sampleCount; i++) {
      const x = xMin + (i / sampleCount) * (xMax - xMin);
      sampled.push({ x, y: lin.slope * x + lin.intercept });
    }
    return { a: 0, b: lin.slope, c: lin.intercept, rSquared: lin.rSquared, points: sampled };
  }

  // Mean centering for numerical stability
  const meanX = valid.reduce((acc, p) => acc + p.x, 0) / n;
  const meanY = valid.reduce((acc, p) => acc + p.y, 0) / n;

  let s4 = 0;
  let s3 = 0;
  let s2 = 0;
  let s1 = 0;
  const s0 = n;
  let sy = 0;
  let suy = 0;
  let su2y = 0;

  for (const p of valid) {
    const u = p.x - meanX;
    const y = p.y;
    const u2 = u * u;
    s4 += u2 * u2;
    s3 += u2 * u;
    s2 += u2;
    s1 += u;
    sy += y;
    suy += u * y;
    su2y += u2 * y;
  }

  const det =
    s4 * (s2 * s0 - s1 * s1) -
    s3 * (s3 * s0 - s1 * s2) +
    s2 * (s3 * s1 - s2 * s2);

  if (Math.abs(det) < 1e-12) {
    const lin = computeLinearRegression(valid);
    const sortedX = [...valid].map((p) => p.x).sort((a, b) => a - b);
    const xMin = sortedX[0] ?? 0;
    const xMax = sortedX[sortedX.length - 1] ?? 100;
    const sampled: Point2D[] = [];
    for (let i = 0; i <= sampleCount; i++) {
      const x = xMin + (i / sampleCount) * (xMax - xMin);
      sampled.push({ x, y: lin.slope * x + lin.intercept });
    }
    return { a: 0, b: lin.slope, c: lin.intercept, rSquared: lin.rSquared, points: sampled };
  }

  const detA =
    su2y * (s2 * s0 - s1 * s1) -
    s3 * (suy * s0 - s1 * sy) +
    s2 * (suy * s1 - s2 * sy);

  const detB =
    s4 * (suy * s0 - s1 * sy) -
    su2y * (s3 * s0 - s1 * s2) +
    s2 * (s3 * sy - suy * s2);

  const detC =
    s4 * (s2 * sy - suy * s1) -
    s3 * (s3 * sy - su2y * s1) +
    su2y * (s3 * s1 - s2 * s2);

  // Model in centered coords: y = a*u^2 + b*u + c, where u = x - meanX
  const a = detA / det;
  const b = detB / det;
  const c = detC / det;

  // Calculate R^2 for polynomial fit
  let ssTot = 0;
  let ssRes = 0;
  for (const p of valid) {
    const u = p.x - meanX;
    const yPred = a * u * u + b * u + c;
    ssTot += (p.y - meanY) * (p.y - meanY);
    ssRes += (p.y - yPred) * (p.y - yPred);
  }
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  // Generate uniform samples along X range
  const sortedX = [...valid].map((p) => p.x).sort((a, b) => a - b);
  const xMin = sortedX[0];
  const xMax = sortedX[sortedX.length - 1];
  const span = xMax - xMin || 1;

  const sampledPoints: Point2D[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const curX = xMin + (i / sampleCount) * span;
    const u = curX - meanX;
    const curY = a * u * u + b * u + c;
    sampledPoints.push({ x: curX, y: curY });
  }

  // Convert back to standard polynomial form: y = A*x^2 + B*x + C
  const standardA = a;
  const standardB = b - 2 * a * meanX;
  const standardC = c - b * meanX + a * meanX * meanX;

  return { a: standardA, b: standardB, c: standardC, rSquared, points: sampledPoints };
}


