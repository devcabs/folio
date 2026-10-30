import type { NodeItem } from '../types/node';

export interface EngineBrandingConfig {
  appName: string;
  tagline?: string;
  logoText?: string;
  markSides?: number;       // For ParametricShape (default: 8)
  markWaviness?: number;    // Bézier ripple amplitude (default: 0.15)
}

export interface EngineConfig {
  appId: string;
  appNamespace: string;      // Storage & event prefix (e.g. 'folio_app')
  nodes: NodeItem[];
  branding: EngineBrandingConfig;
  features?: {
    enableChartDrawer?: boolean;
    enableEditorMode?: boolean;
    enableHistoryLedger?: boolean;
  };
}

export function createDefaultEngineConfig(overrides?: Partial<EngineConfig>): EngineConfig {
  return {
    appId: 'default-app',
    appNamespace: 'folio',
    branding: {
      appName: 'Folio Engine',
      tagline: 'Parametric Stepped Sequence & Document AST Platform',
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
    ...overrides,
  };
}
