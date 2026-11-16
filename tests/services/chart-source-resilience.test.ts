import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveChartConfigDetailed,
  mapChartConfigToDbRow,
  mapDbRowToChartConfig,
  resetChartSourceCache,
} from '../../src/services/chartSourceService';
import type { SheetChartConfig } from '../../src/types/chart';
import * as supabaseConfigModule from '../../src/utils/supabase-config';

describe('chartSourceService Schema Resilience & node_id Graceful Degradation', () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;

  const sampleConfig: SheetChartConfig = {
    chartId: 'chart-enrollment-growth',
    nodeId: 'governance',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/test-sheet-id/edit#gid=0',
    tabName: 'Enrollment',
    sheetGid: '0',
    range: 'A1:C10',
    defaultType: 'bar',
    titleOverride: 'Enrollment Growth',
    subtitleOverride: 'Year-over-Year',
    cachedDataset: [
      ['Year', 'Count'],
      ['2024', 120],
      ['2025', 150],
    ],
  };

  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const mockLocalStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    (globalThis as any).window = {
      localStorage: mockLocalStorage,
      dispatchEvent: vi.fn(),
    };

    resetChartSourceCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
    resetChartSourceCache();
    vi.restoreAllMocks();
  });

  it('embeds __node_id and __cached_dataset into visual_config for zero-data-loss fallback', () => {
    const dbRow = mapChartConfigToDbRow(sampleConfig);
    expect(dbRow.node_id).toBe('governance');
    expect(dbRow.cached_dataset).toEqual(sampleConfig.cachedDataset);
    expect((dbRow.visual_config as any)?.__node_id).toBe('governance');
    expect((dbRow.visual_config as any)?.__cached_dataset).toEqual(sampleConfig.cachedDataset);
  });

  it('restores nodeId from visual_config.__node_id when db row.node_id is missing or null', () => {
    const restored = mapDbRowToChartConfig({
      chart_id: 'chart-enrollment-growth',
      node_id: null as any,
      sheet_url: 'https://docs.google.com/spreadsheets/d/test-sheet-id/edit',
      visual_config: {
        __node_id: 'pedagogy',
        __cached_dataset: [['Category', 'Val'], ['A', 1]],
      },
    });

    expect(restored.nodeId).toBe('pedagogy');
    expect(restored.cachedDataset).toEqual([['Category', 'Val'], ['A', 1]]);
    expect(restored.visualConfig).not.toHaveProperty('__node_id');
    expect(restored.visualConfig).not.toHaveProperty('__cached_dataset');
  });

  it('retries write omitting node_id when Supabase schema cache rejects node_id', async () => {
    vi.spyOn(supabaseConfigModule, 'getSupabaseConfig').mockReturnValue({
      url: 'https://test.supabase.co',
      anonKey: 'anon-test-token',
    });

    const fetchCalls: Array<{ url: string; body: any }> = [];

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const parsedBody = init?.body ? JSON.parse(init.body as string) : {};
      fetchCalls.push({ url, body: parsedBody });

      // First call fails with PostgREST schema cache rejection for node_id
      if (fetchCalls.length === 1) {
        return new Response(
          JSON.stringify({
            code: 'PGRST204',
            message: "Could not find the 'node_id' column of 'chart_sources' in the schema cache",
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Second call (retry without node_id) succeeds
      return new Response(JSON.stringify([{ chart_id: parsedBody.chart_id }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await saveChartConfigDetailed(sampleConfig);

    expect(result.success).toBe(true);
    expect(result.savedLocally).toBe(true);
    expect(result.savedToCloud).toBe(true);

    // Assert two fetch attempts were made
    expect(fetchCalls.length).toBe(2);

    // Initial attempt included node_id
    expect(fetchCalls[0].body.node_id).toBe('governance');

    // Retry attempt stripped node_id but preserved __node_id inside visual_config
    expect(fetchCalls[1].body.node_id).toBeUndefined();
    expect(fetchCalls[1].body.visual_config.__node_id).toBe('governance');
  });

  it('retries write omitting both node_id and cached_dataset when Supabase schema cache rejects both consecutively', async () => {
    vi.spyOn(supabaseConfigModule, 'getSupabaseConfig').mockReturnValue({
      url: 'https://test.supabase.co',
      anonKey: 'anon-test-token',
    });

    const fetchCalls: Array<{ url: string; body: any }> = [];

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const parsedBody = init?.body ? JSON.parse(init.body as string) : {};
      fetchCalls.push({ url, body: parsedBody });

      if (fetchCalls.length === 1) {
        return new Response(
          JSON.stringify({
            code: 'PGRST204',
            message: "Could not find the 'node_id' column of 'chart_sources' in the schema cache",
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (fetchCalls.length === 2) {
        return new Response(
          JSON.stringify({
            code: 'PGRST204',
            message: "Could not find the 'cached_dataset' column of 'chart_sources' in the schema cache",
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Third attempt succeeds
      return new Response(JSON.stringify([{ chart_id: parsedBody.chart_id }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await saveChartConfigDetailed(sampleConfig);

    expect(result.success).toBe(true);
    expect(result.savedToCloud).toBe(true);
    expect(fetchCalls.length).toBe(3);

    expect(fetchCalls[2].body.node_id).toBeUndefined();
    expect(fetchCalls[2].body.cached_dataset).toBeUndefined();
    expect(fetchCalls[2].body.visual_config.__node_id).toBe('governance');
    expect(fetchCalls[2].body.visual_config.__cached_dataset).toEqual(sampleConfig.cachedDataset);
  });
});
