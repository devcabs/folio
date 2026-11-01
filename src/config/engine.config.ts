import type { NodeItem } from "../types/node";

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
