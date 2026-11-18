/**
 * watermarkResolver.ts
 *
 * Single-source content watermark resolver.
 * Resolves the active content version watermark strictly from EngineConfig.contentVersion.
 */

/**
 * Resolves the active content watermark version strictly from EngineConfig.contentVersion.
 * - If configVersion is a non-empty string, returns configVersion.trim().
 * - Otherwise returns '0.0.0'.
 */
export function resolveContentWatermark(configVersion?: string): string {
  if (typeof configVersion === 'string' && configVersion.trim() !== '') {
    return configVersion.trim();
  }
  return '0.0.0';
}
