import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  upsertLiveSourceSource,
  EVENT_SOURCE_SYNC_STATUS,
  EVENT_EVIDENCE_SYNC_STATUS,
  subscribeToSourceSyncStatus,
  resetSourceCache,
  getSourceSourceSync,
  type SourceSyncStatusDetail,
} from '../../src/services/sourceService';
import * as supabaseConfigModule from '../../src/utils/supabase-config';

describe('Subtask 2.3: sourceService Background Sync Status & Cloud Observability', () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    // Ensure minimal DOM / window EventTarget environment for Vitest Node runner
    const eventTarget = new EventTarget();
    (globalThis as any).window = eventTarget;
    if (!(globalThis as any).CustomEvent) {
      class CustomEvent<T = any> extends Event {
        detail: T;
        constructor(type: string, params?: { detail?: T; bubbles?: boolean; cancelable?: boolean }) {
          super(type, params);
          this.detail = params?.detail as T;
        }
      }
      (globalThis as any).CustomEvent = CustomEvent;
    }

    resetSourceCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
    resetSourceCache();
    vi.restoreAllMocks();
  });

  it('exports EVENT_SOURCE_SYNC_STATUS and EVENT_EVIDENCE_SYNC_STATUS constants', () => {
    expect(EVENT_SOURCE_SYNC_STATUS).toBe('engine-source-sync-status');
    expect(EVENT_EVIDENCE_SYNC_STATUS).toBe('engine-evidence-sync-status');
  });

  it('dispatches sync status event on successful Supabase persistence', async () => {
    vi.spyOn(supabaseConfigModule, 'getSupabaseConfig').mockReturnValue({
      url: 'https://test.supabase.co',
      anonKey: 'test-anon-key',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => 'OK',
    } as Response);
    globalThis.fetch = fetchMock;

    const events: SourceSyncStatusDetail[] = [];
    const unsubscribe = subscribeToSourceSyncStatus((detail) => {
      events.push(detail);
    });

    const result = await upsertLiveSourceSource({
      pointId: 'node-alpha',
      folderUrl: 'https://drive.google.com/drive/folders/folder-1',
      folderTitle: 'Alpha Folder',
    });

    unsubscribe();

    expect(result.cloudSynced).toBe(true);
    expect(result.cloudError).toBeUndefined();
    expect(events).toHaveLength(1);
    expect(events[0].pointId).toBe('alpha');
    expect(events[0].cloudSynced).toBe(true);
    expect(events[0].error).toBeUndefined();
    expect(events[0].isBackground).toBe(false);
  });

  it('handles Supabase HTTP 401 error: logs warning, marks cloudSynced=false, dispatches event, and preserves local cache', async () => {
    vi.spyOn(supabaseConfigModule, 'getSupabaseConfig').mockReturnValue({
      url: 'https://test.supabase.co',
      anonKey: 'test-anon-key',
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'JWT expired or RLS violation',
    } as Response);
    globalThis.fetch = fetchMock;

    const events: SourceSyncStatusDetail[] = [];
    const unsubscribe = subscribeToSourceSyncStatus((detail) => {
      events.push(detail);
    });

    const result = await upsertLiveSourceSource(
      {
        pointId: 'node-beta',
        folderUrl: 'https://drive.google.com/drive/folders/folder-2',
        folderTitle: 'Beta Folder',
      },
      undefined,
      { isBackground: true }
    );

    unsubscribe();

    // 1. Result has cloud failure diagnostics
    expect(result.cloudSynced).toBe(false);
    expect(result.cloudError).toContain('HTTP 401: JWT expired or RLS violation');

    // 2. Console warning was logged with diagnostic details
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[sourceService] Supabase write failed (HTTP 401):'),
      expect.stringContaining('JWT expired or RLS violation')
    );

    // 3. Status event was dispatched with isBackground: true
    expect(events).toHaveLength(1);
    expect(events[0].pointId).toBe('beta');
    expect(events[0].cloudSynced).toBe(false);
    expect(events[0].error).toContain('HTTP 401: JWT expired or RLS violation');
    expect(events[0].isBackground).toBe(true);

    // 4. Local cache snapshot remains completely intact
    const cached = getSourceSourceSync('node-beta');
    expect(cached).toBeDefined();
    expect(cached?.folderTitle).toBe('Beta Folder');
  });

  it('handles Supabase network offline failure: logs warning, marks cloudSynced=false, and preserves local cache', async () => {
    vi.spyOn(supabaseConfigModule, 'getSupabaseConfig').mockReturnValue({
      url: 'https://test.supabase.co',
      anonKey: 'test-anon-key',
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch (offline)'));

    const events: SourceSyncStatusDetail[] = [];
    const unsubscribe = subscribeToSourceSyncStatus((detail) => {
      events.push(detail);
    });

    const result = await upsertLiveSourceSource({
      pointId: 'node-gamma',
      folderUrl: 'https://drive.google.com/drive/folders/folder-3',
      folderTitle: 'Gamma Folder',
    });

    unsubscribe();

    expect(result.cloudSynced).toBe(false);
    expect(result.cloudError).toBe('Failed to fetch (offline)');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[sourceService] Supabase network error during source upsert:'),
      'Failed to fetch (offline)'
    );

    expect(events).toHaveLength(1);
    expect(events[0].cloudSynced).toBe(false);
    expect(events[0].error).toBe('Failed to fetch (offline)');
    expect(events[0].isBackground).toBe(false);

    // Local data preserved
    const cached = getSourceSourceSync('node-gamma');
    expect(cached).toBeDefined();
    expect(cached?.folderTitle).toBe('Gamma Folder');
  });
});
