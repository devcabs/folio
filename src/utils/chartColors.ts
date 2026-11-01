/**
 * Canonical Chart Color Engine & Palette System
 * Document Reference: docs/tasks/task7_6_common_chart_engine_drawer_components.md
 * 
 * Enforces:
 * 1. Deduplicated base palette (replacing duplicate indices 6 & 7 with Academic Indigo and Rich Academic Teal).
 * 2. Guaranteed intra-chart uniqueness: No chart element ever shares the same color twice.
 * 3. Automatic Tiered Variants: When chart elements exceed 5, the engine switches to high-contrast
 *    Super-Dark jewel shades (or Super-Light tints) to prevent collisions.
 * 4. Token Purity: Strictly consumes CSS custom properties from tokens.css.
 */

import type { NodeCode } from '../types/node';

export const NODE_ACCENT_TOKENS: Record<NodeCode, string> = {
  access: 'var(--color-node-1)',
  equity: 'var(--color-node-2)',
  quality: 'var(--color-node-3)',
  resiliency: 'var(--color-node-4)',
  governance: 'var(--color-node-5)',
};

/**
 * 7 Distinct Base Palette Colors (Preserved for backward-compatibility)
 */
export const CHART_BASE_PALETTE: readonly string[] = [
  'var(--folio-primary)',       // 1. Primary (#881337)
  'var(--folio-accent)',         // 2. Sunburst Gold (#f59e0b)
  'var(--color-node-1)',     // 3. Access Sky Blue (#0284c7)
  'var(--color-node-4)',     // 4. Resiliency Forest Green (#15803d)
  'var(--color-node-5)',     // 5. Governance Amber (#d97706)
  'var(--color-chart-indigo)', // 6. Academic Indigo (#4f46e5) - Replaced duplicate primary
  'var(--color-chart-teal)',   // 7. Academic Teal (#0d9488) - Replaced duplicate accent
] as const;

/**
 * 14 Distinct Bright Palette Colors (Prioritizing vibrant, high-contrast academic hues over dull darks)
 */
export const CHART_BRIGHT_PALETTE: readonly string[] = [
  ...CHART_BASE_PALETTE,
  'var(--color-chart-cyan)',   // 8. Academic Cyan (#06b6d4)
  'var(--color-chart-purple)', // 9. Academic Purple (#9333ea)
  'var(--color-chart-rose)',   // 10. Academic Rose (#e11d48)
  'var(--color-chart-coral)',  // 11. Academic Coral (#ea580c)
  'var(--color-chart-lime)',   // 12. Academic Lime (#65a30d)
  'var(--color-chart-blue)',   // 13. Academic Cobalt Blue (#2563eb)
  'var(--color-chart-violet)', // 14. Academic Violet (#7c3aed)
] as const;

/**
 * Super-Dark Jewel Tone Palette (>7:1 contrast on light canvas)
 */
export const CHART_DARK_PALETTE: readonly string[] = [
  'var(--color-chart-primary-dark)', // Deep Burgundy (#5b061c)
  'var(--color-chart-accent-dark)',   // Deep Bronze Amber (#78350f)
  'var(--color-chart-blue-dark)',   // Midnight Navy (#0c4a6e)
  'var(--color-chart-green-dark)',  // Deep Forest Pine (#052e16)
  'var(--color-chart-amber-dark)',  // Deep Russet Espresso (#451a03)
  'var(--color-chart-indigo-dark)', // Deep Night Indigo (#312e81)
  'var(--color-chart-teal-dark)',   // Deep Pine Teal (#134e4a)
] as const;

/**
 * Super-Light Pastel Tint Palette (for soft fills and secondary tiers)
 */
export const CHART_LIGHT_PALETTE: readonly string[] = [
  'var(--brand-primary-tint)',   // Soft Rose (#ffe4e6)
  'var(--brand-accent-tint)',     // Soft Amber (#fef3c7)
  'var(--color-node-1-tint)', // Soft Sky (#e0f2fe)
  'var(--color-node-4-tint)', // Soft Sage (#dcfce7)
  'var(--color-node-5-tint)', // Soft Peach (#ffedd5)
  'var(--color-chart-indigo-tint)', // Soft Periwinkle (#e0e7ff)
  'var(--color-chart-teal-tint)',   // Soft Aquamarine (#ccfbf1)
  'var(--color-chart-cyan-tint)',
  'var(--color-chart-purple-tint)',
  'var(--color-chart-rose-tint)',
  'var(--color-chart-coral-tint)',
  'var(--color-chart-lime-tint)',
  'var(--color-chart-blue-tint)',
  'var(--color-chart-violet-tint)',
] as const;

/**
 * Normalizes synonymous institutional tokens to detect conceptual duplicates.
 * (e.g. Node 2 #881337 is synonymous with Brand Maroon #881337)
 */
export function normalizeColorToken(token?: string): string {
  if (!token) return '';
  const trimmed = token.trim();
  if (trimmed === 'var(--color-node-2)') return 'var(--folio-primary)';
  if (trimmed === 'var(--color-node-3)') return 'var(--folio-accent)';
  return trimmed;
}

export type ChartTierMode = 'bright' | 'dark' | 'light';

export interface ResolveColorsOptions {
  count: number;
  accentColor?: string;
  tierMode?: ChartTierMode;
}

/**
 * Resolves a guaranteed unique sequence of chart colors.
 * - If accentColor is supplied, it is anchored at index 0 and removed from candidate pools.
 * - By default (tierMode: 'bright'), all 14 vibrant bright base colors are prioritized.
 * - If tierMode: 'dark' is requested, legacy behavior (5 base, then super-dark) is honored.
 * - No color is ever repeated within the resolved sequence.
 */
export function resolveUniqueChartColors(options: ResolveColorsOptions): string[] {
  const { count, accentColor, tierMode = 'bright' } = options;
  if (count <= 0) return [];

  const results: string[] = [];
  const usedTokens = new Set<string>();

  // 1. If an accentColor is provided, anchor it at index 0 and mark as used
  if (accentColor) {
    results.push(accentColor);
    usedTokens.add(normalizeColorToken(accentColor));
  }

  // Legacy 'dark' mode: strictly preserves 5 base colors + super-dark variants
  if (tierMode === 'dark') {
    const availableBase = CHART_BASE_PALETTE.filter(
      (c) => !usedTokens.has(normalizeColorToken(c))
    );
    const baseBudget = Math.min(count, 5);
    let baseIdx = 0;
    while (results.length < baseBudget && baseIdx < availableBase.length) {
      const nextColor = availableBase[baseIdx++];
      results.push(nextColor);
      usedTokens.add(normalizeColorToken(nextColor));
    }

    if (results.length < count) {
      const availableDark = CHART_DARK_PALETTE.filter(
        (c) => !usedTokens.has(normalizeColorToken(c))
      );
      let darkIdx = 0;
      while (results.length < count && darkIdx < availableDark.length) {
        const nextColor = availableDark[darkIdx++];
        results.push(nextColor);
        usedTokens.add(normalizeColorToken(nextColor));
      }
    }

    if (results.length < count) {
      const availableLight = CHART_LIGHT_PALETTE.filter(
        (c) => !usedTokens.has(normalizeColorToken(c))
      );
      let lightIdx = 0;
      while (results.length < count && lightIdx < availableLight.length) {
        const nextColor = availableLight[lightIdx++];
        results.push(nextColor);
        usedTokens.add(normalizeColorToken(nextColor));
      }
    }

    return results;
  }

  // 2. Modern Bright Mode (Default): Prioritize all 14 vibrant bright colors
  const availableBright = CHART_BRIGHT_PALETTE.filter(
    (c) => !usedTokens.has(normalizeColorToken(c))
  );

  let brightIdx = 0;
  while (results.length < count && brightIdx < availableBright.length) {
    const nextColor = availableBright[brightIdx++];
    results.push(nextColor);
    usedTokens.add(normalizeColorToken(nextColor));
  }

  // 3. For elements beyond 14, use soft pastel light tints (never dull dark mud)
  if (results.length < count) {
    const availableLight = CHART_LIGHT_PALETTE.filter(
      (c) => !usedTokens.has(normalizeColorToken(c))
    );
    let lightIdx = 0;
    while (results.length < count && lightIdx < availableLight.length) {
      const nextColor = availableLight[lightIdx++];
      results.push(nextColor);
      usedTokens.add(normalizeColorToken(nextColor));
    }
  }

  // 4. If elements still exceed 28, fall back to dark tier as last resort
  if (results.length < count) {
    const availableDark = CHART_DARK_PALETTE.filter(
      (c) => !usedTokens.has(normalizeColorToken(c))
    );
    let darkIdx = 0;
    while (results.length < count && darkIdx < availableDark.length) {
      const nextColor = availableDark[darkIdx++];
      results.push(nextColor);
      usedTokens.add(normalizeColorToken(nextColor));
    }
  }

  return results;
}
