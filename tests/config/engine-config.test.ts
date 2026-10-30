import { describe, it, expect } from 'vitest';
import { createDefaultEngineConfig } from '../../src/config/engine.config';

describe('Central Engine Configuration', () => {
  it('supplies solid, pro-generic defaults without tenant hardcoding', () => {
    const config = createDefaultEngineConfig();

    expect(config.appId).toBe('default-app');
    expect(config.appNamespace).toBe('folio');
    expect(config.branding.appName).toBe('Folio Engine');
    expect(config.branding.markSides).toBe(8);
    expect(config.branding.markWaviness).toBe(0.15);
    expect(config.nodes).toEqual([]);
    expect(config.features?.enableChartDrawer).toBe(true);
    expect(config.features?.enableEditorMode).toBe(true);
  });

  it('merges tenant overrides cleanly', () => {
    const custom = createDefaultEngineConfig({
      appId: 'civic-report',
      appNamespace: 'civic',
      branding: {
        appName: 'Civic Report 2026',
        tagline: 'Transparent Community Accountability',
        logoText: 'CIVIC',
        markSides: 12,
        markWaviness: 0.2,
      },
      nodes: [
        {
          id: 'step-alpha',
          index: 0,
          title: 'Infrastructure',
          accentColor: '#059669',
        },
      ],
      features: {
        enableChartDrawer: false,
        enableEditorMode: true,
        enableHistoryLedger: false,
      },
    });

    expect(custom.appId).toBe('civic-report');
    expect(custom.branding.appName).toBe('Civic Report 2026');
    expect(custom.branding.markSides).toBe(12);
    expect(custom.nodes).toHaveLength(1);
    expect(custom.nodes[0].id).toBe('step-alpha');
    expect(custom.features?.enableChartDrawer).toBe(false);
  });
});
