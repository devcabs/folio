import { z } from 'zod';
import { NodeItemSchema } from '../types/node';

/**
 * EngineBrandingConfig
 * Visual identity and mark parameters for the tenant instance.
 */
export const EngineBrandingConfigSchema = z.object({
  appName: z.string().min(1, 'App name is required'),
  tagline: z.string().optional(),
  logoText: z.string().optional(),
  markSides: z.number().int().min(3).default(8),
  markWaviness: z.number().min(0).max(1).default(0.15),
});

export type EngineBrandingConfig = z.infer<typeof EngineBrandingConfigSchema>;

/**
 * EngineFeaturesConfig
 * Feature flags for interactive capabilities.
 */
export const EngineFeaturesConfigSchema = z.object({
  enableChartDrawer: z.boolean().default(true),
  enableEditorMode: z.boolean().default(true),
  enableHistoryLedger: z.boolean().default(true),
});

export type EngineFeaturesConfig = z.infer<typeof EngineFeaturesConfigSchema>;

/**
 * EngineConfig
 * Central single source of truth for the runtime instance.
 */
export const EngineConfigSchema = z.object({
  appId: z.string().min(1, 'App ID is required'),
  appNamespace: z.string().min(1, 'App namespace is required'),
  nodes: z.array(NodeItemSchema).default([]),
  branding: EngineBrandingConfigSchema,
  features: EngineFeaturesConfigSchema.default({
    enableChartDrawer: true,
    enableEditorMode: true,
    enableHistoryLedger: true,
  }),
});

export type EngineConfig = z.infer<typeof EngineConfigSchema>;

/**
 * Factory creating default engine configuration with optional overrides.
 */
export function createDefaultEngineConfig(overrides?: Partial<EngineConfig>): EngineConfig {
  const baseConfig: EngineConfig = {
    appId: 'default-app',
    appNamespace: 'engine',
    branding: {
      appName: 'Folio Engine',
      tagline: 'Parametric Stepped Sequence & Document Platform',
      logoText: 'FOLIO',
      markSides: 8,
      markWaviness: 0.15,
    },
    nodes: [],
    features: {
      enableChartDrawer: true,
      enableEditorMode: true,
      enableHistoryLedger: true,
    },
  };

  if (!overrides) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    ...overrides,
    branding: {
      ...baseConfig.branding,
      ...(overrides.branding || {}),
    },
    features: {
      ...baseConfig.features,
      ...(overrides.features || {}),
    },
    nodes: overrides.nodes ?? baseConfig.nodes,
  };
}
