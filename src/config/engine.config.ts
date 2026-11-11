import { z } from "zod";
import type { NodeItem } from "../types/node";

export const EngineBrandingConfigSchema = z.object({
  appName: z.string().min(1, "appName is required"),
  tagline: z.string().optional(),
  logoText: z.string().optional(),
  markSides: z.number().int().min(3).max(32).optional(),
  markWaviness: z.number().min(0).max(1).optional(),
  heroKicker: z.string().optional(),
  heroTitle: z.string().optional(),
  heroSubtitle: z.string().optional(),
  orgName: z.string().optional(),
});

export const EngineConfigSchema = z.object({
  appId: z.string().min(1, "appId is required"),
  appNamespace: z.string().min(1, "appNamespace is required"),
  basePath: z.string().optional(),
  contentVersion: z.string().optional(),
  nodes: z.array(z.any()).default([]),
  branding: EngineBrandingConfigSchema,
  securitySalt: z.string().optional(),
  expectedPinHash: z.string().optional(),
  features: z.object({
    enableChartDrawer: z.boolean().optional(),
    enableEditorMode: z.boolean().optional(),
    enableHistoryLedger: z.boolean().optional(),
  }).optional(),
});

export interface EngineBrandingConfig {
  appName: string;
  tagline?: string;
  logoText?: string;
  markSides?: number;       // For ParametricShape (default: 8)
  markWaviness?: number;    // Bézier ripple amplitude (default: 0.15)
  heroKicker?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  orgName?: string;
}

export interface EngineConfig {
  appId: string;
  appNamespace: string;      // Storage & event prefix (e.g. 'folio_app')
  basePath?: string;         // Optional hosting subpath (e.g. '/portal' or '')
  contentVersion?: string;   // Content watermark declared by consumer app
  nodes: NodeItem[];
  branding: EngineBrandingConfig;
  securitySalt?: string;
  expectedPinHash?: string;
  features?: {
    enableChartDrawer?: boolean;
    enableEditorMode?: boolean;
    enableHistoryLedger?: boolean;
  };
}

export function createDefaultEngineConfig(overrides?: Partial<EngineConfig>): EngineConfig {
  return {
    appId: "default-app",
    appNamespace: "folio",
    branding: {
      appName: "Folio Engine",
      tagline: "Parametric Stepped Sequence & Document AST Platform",
      logoText: "FOLIO",
      markSides: 8,
      markWaviness: 0.15,
    },
    nodes: [],
    contentVersion: undefined,
    securitySalt: undefined,
    expectedPinHash: undefined,
    features: {
      enableChartDrawer: true,
      enableEditorMode: true,
      enableHistoryLedger: true,
    },
    ...overrides,
  };
}

let activeEngineConfig: EngineConfig = createDefaultEngineConfig();

export function getEngineConfig(): EngineConfig {
  return activeEngineConfig;
}

export function setEngineConfig(config: Partial<EngineConfig>): EngineConfig {
  activeEngineConfig = createDefaultEngineConfig({ ...activeEngineConfig, ...config });
  return activeEngineConfig;
}

export function resetEngineConfig(): void {
  activeEngineConfig = createDefaultEngineConfig();
}

export function getStorageNamespace(): string {
  return activeEngineConfig.appNamespace || "folio";
}

export function getStorageKey(key: string, namespace?: string): string {
  const ns = namespace || getStorageNamespace();
  return ns + "_" + key;
}
