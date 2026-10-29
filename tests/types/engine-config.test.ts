import { describe, it, expect } from 'vitest';
import {
  createDefaultEngineConfig,
  EngineConfigSchema,
} from '../../src/config/engine.config';

describe('Engine Configuration Contract', () => {
  it('creates valid default engine configuration', () => {
    const config = createDefaultEngineConfig();
    expect(config.appId).toBe('default-app');
    expect(config.appNamespace).toBe('engine');
    expect(config.branding.appName).toBe('Folio Engine');
    expect(config.branding.markSides).toBe(8);
    expect(config.nodes).toEqual([]);
    expect(config.features?.enableChartDrawer).toBe(true);

    const parsed = EngineConfigSchema.safeParse(config);
    expect(parsed.success).toBe(true);
  });

  it('merges partial overrides correctly', () => {
    const config = createDefaultEngineConfig({
      appId: 'custom-tenant',
      branding: {
        appName: 'Acme Portal',
        markSides: 6,
        markWaviness: 0.2,
      },
      nodes: [
        {
          id: 'step-one',
          index: 0,
          title: 'Foundations',
          accentColor: '#4f46e5',
        },
      ],
    });

    expect(config.appId).toBe('custom-tenant');
    expect(config.branding.appName).toBe('Acme Portal');
    expect(config.branding.markSides).toBe(6);
    expect(config.nodes).toHaveLength(1);
    expect(config.features?.enableEditorMode).toBe(true); // preserved

    const parsed = EngineConfigSchema.safeParse(config);
    expect(parsed.success).toBe(true);
  });
});
