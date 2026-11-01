import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateNodePayload,
  verifyEngineWiring,
} from '../../src/diagnostics/verifyEngineSetup';
import {
  setEngineConfig,
  resetEngineConfig,
  getStorageNamespace,
} from '../../src/config/engine.config';
import { parseRoute } from '../../src/hooks/use-hash-route';
import { getCanvasLiveStoragePrefix } from '../../src/services/canvasLayoutService';
import { getMatrixCacheKey } from '../../src/hooks/useSheetChartData';
import type { PublicNodePayload } from '../../src/types/edge';

describe('Folio Engine: Integration Assurance & Diagnostic Verification', () => {
  beforeEach(() => {
    resetEngineConfig();
  });

  afterEach(() => {
    resetEngineConfig();
  });

  describe('validateNodePayload', () => {
    const createSamplePayload = (): PublicNodePayload => ({
      nodeId: 'access',
      snapshotId: 'snap_001',
      version: 1,
      updatedAt: '2026-11-01T12:00:00Z',
      canvas: {
        nodeId: 'access',
        version: 1,
        updatedAt: '2026-11-01T12:00:00Z',
        sections: [
          {
            id: 'sec_1',
            type: 'section',
            title: 'Overview',
            elements: [
              {
                id: 'text_1',
                type: 'text',
                pointId: 'point_text_1',
                content: 'Welcome to this node overview.',
              },
              {
                id: 'chart_1',
                type: 'chart',
                chartId: 'kpi_chart_enrollment',
                title: 'Enrollment Rate',
              },
            ],
          },
        ],
      },
      chartDatasets: {
        kpi_chart_enrollment: {
          chartId: 'kpi_chart_enrollment',
          title: 'Enrollment Rate',
          asOfDate: '2026-11-01',
          chartType: 'bar',
          sanitizedCsvContent: 'Year,Value\n2025,100\n2026,120',
        },
      },
      sourceMetadata: {},
    });

    it('passes clean valid payloads with zero errors and zero warnings', () => {
      const payload = createSamplePayload();
      const result = validateNodePayload(payload);
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('fails schema validation if required root fields are missing', () => {
      const payload = createSamplePayload();
      // @ts-expect-error Testing invalid schema
      delete payload.nodeId;
      const result = validateNodePayload(payload);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('nodeId'))).toBe(true);
    });

    it('warns when a chart is referenced in canvas AST but missing from chartDatasets', () => {
      const payload = createSamplePayload();
      delete payload.chartDatasets.kpi_chart_enrollment;
      const result = validateNodePayload(payload);
      expect(result.ok).toBe(true);
      expect(result.warnings.some((w) => w.includes('kpi_chart_enrollment'))).toBe(true);
    });

    it('flags an error when duplicate element IDs exist within the canvas tree', () => {
      const payload = createSamplePayload();
      // Introduce duplicate ID
      payload.canvas.sections[0].elements.push({
        id: 'text_1', // Duplicate ID
        type: 'text',
        pointId: 'point_duplicate',
        content: 'Duplicate text element.',
      });
      const result = validateNodePayload(payload);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate element id detected'))).toBe(true);
    });
  });

  describe('verifyEngineWiring', () => {
    it('validates active engine configuration against EngineConfigSchema', () => {
      const result = verifyEngineWiring({
        appId: 'civic_portal',
        appNamespace: 'portal_ns',
        branding: {
          appName: 'Civic Engine',
        },
      });
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('catches missing or invalid appId in config', () => {
      const result = verifyEngineWiring({
        appId: '',
      });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('appId'))).toBe(true);
    });
  });

  describe('Subpath & Custom Node Routing', () => {
    it('successfully parses routes under a configured basePath', () => {
      setEngineConfig({ basePath: '/portal' });
      const state = parseRoute('/portal/node/access/', '');
      expect(state.type).toBe('node');
      expect(state.nodeId).toBe('access');
      expect(state.pathname).toBe('/node/access/');
    });

    it('supports arbitrary custom node slugs when passed to parseRoute', () => {
      const customNodes = ['safety', 'operations', 'governance'] as any;
      const state = parseRoute('/node/safety/', '', customNodes);
      expect(state.type).toBe('node');
      expect(state.nodeId).toBe('safety');
    });

    it('dynamically maps targetStage for custom nodes defined in EngineConfig', () => {
      setEngineConfig({
        nodes: [
          { id: 'alpha', title: 'Alpha Milestone' },
          { id: 'beta', title: 'Beta Milestone' },
        ] as any,
      });
      const state = parseRoute('/node/beta/', '', ['alpha', 'beta'] as any);
      expect(state.type).toBe('node');
      expect(state.nodeId).toBe('beta');
      expect(state.targetStage).toBe(2);
    });
  });

  describe('Dynamic Storage Namespace Immutability', () => {
    it('dynamically switches storage prefixes upon config change without module reloading', () => {
      setEngineConfig({ appNamespace: 'tenant_custom' });
      expect(getStorageNamespace()).toBe('tenant_custom');
      expect(getCanvasLiveStoragePrefix()).toBe('tenant_custom_live_canvas_');
      expect(getMatrixCacheKey('enrollment_kpi')).toBe('tenant_custom_chart_matrix_enrollment_kpi');

      setEngineConfig({ appNamespace: 'tenant_second' });
      expect(getStorageNamespace()).toBe('tenant_second');
      expect(getCanvasLiveStoragePrefix()).toBe('tenant_second_live_canvas_');
      expect(getMatrixCacheKey('enrollment_kpi')).toBe('tenant_second_chart_matrix_enrollment_kpi');
    });
  });
});
