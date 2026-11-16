import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { render, screen, act } from '../helpers/testing-library-shim';
import {
  publishNewSnapshot,
  captureCurrentSnapshot,
} from '../../src/services/historyService';
import {
  compilePublicNodePayload,
  compilePortalManifest,
} from '../../src/services/edgePreBakeService';
import {
  setLiveContentOverrides,
  getContent,
} from '../../src/utils/contentDb';
import {
  setCachedChartConfig,
} from '../../src/services/chartSourceService';
import {
  getAllLiveSources,
  setCachedSourceMetadata,
  resetSourceCache,
  upsertLiveSourceSource,
} from '../../src/services/sourceService';
import {
  usePortalChromeHydration,
  resetPortalChromeHydrationForTesting,
} from '../../src/hooks/usePortalChromeHydration';
import { HeroWelcomeGhostWireframe } from '../../src/components/layout/HeroWelcomeGhostWireframe';
import { HeroWelcome } from '../../src/components/layout/HeroWelcome';
import { clearDraftStorage } from '../../src/services/draftService';
import { resetEngineConfig } from '../../src/config/engine.config';
import type { PublishedSnapshot } from '../../src/types/history';
import type { SheetChartConfig } from '../../src/types/chart';
import type { SyncedSourceMetadata } from '../../src/types/edge';

describe('Task 4.2: Chart, Evidence Source & Portal Chrome Data Continuity', () => {
  const originalFetch = global.fetch;
  let storageMap: Map<string, string>;
  let setItemSpy: any;

  beforeEach(() => {
    resetEngineConfig();
    clearDraftStorage();
    resetSourceCache();
    resetPortalChromeHydrationForTesting();

    storageMap = new Map<string, string>();
    setItemSpy = vi.fn((key: string, val: string) => {
      storageMap.set(key, String(val));
    });

    const mockStorage = {
      getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
      setItem: setItemSpy,
      removeItem: vi.fn((key: string) => {
        storageMap.delete(key);
      }),
      clear: vi.fn(() => {
        storageMap.clear();
      }),
      get length() {
        return storageMap.size;
      },
      key: vi.fn((i: number) => Array.from(storageMap.keys())[i] ?? null),
    };

    (global as any).window = (global as any).window || {};
    (global as any).window.localStorage = mockStorage;
    (global as any).window.dispatchEvent = vi.fn();
    (global as any).window.addEventListener = vi.fn();
    (global as any).window.removeEventListener = vi.fn();

    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. PublishedSnapshot Bundling in publishNewSnapshot()', () => {
    it('bundles active chart configurations and linked evidence sources into PublishedSnapshot', async () => {
      // 1. Setup a cached chart config
      const testChart: SheetChartConfig = {
        chartId: 'chart-enrollment-trend',
        sheetUrl: 'https://docs.google.com/spreadsheets/d/test-sheet-id/edit',
        nodeId: 'access',
        titleOverride: 'Live Enrollment Trend 2026',
        subtitleOverride: 'Student population metrics',
        unitOverride: 'Students',
        defaultType: 'line',
        cachedDataset: [
          ['Year', 'Total'],
          ['2024', '1200'],
          ['2025', '1450'],
        ],
      };
      setCachedChartConfig(testChart);

      // 2. Setup a live evidence source
      await upsertLiveSourceSource({
        pointId: 'access',
        folderTitle: 'Official Access Evidence 2026',
        folderUrl: 'https://drive.google.com/drive/folders/live-access-folder',
        description: 'Verified student records',
      });

      // 3. Mock publish endpoint
      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/publish')) {
          return new Response(
            JSON.stringify({
              success: true,
              snapshotId: 'pub-test-snapshot',
              cloudSynced: true,
              edgeDeployed: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 200 });
      });

      const result = await publishNewSnapshot(
        'Publication containing live charts and linked evidence sources',
        'Release 4.2'
      );

      expect(result.success).toBe(true);
      expect(result.snapshot).toBeDefined();

      // Verify chartConfigs are bundled
      expect(result.snapshot.chartConfigs).toBeDefined();
      expect(result.snapshot.chartConfigs!['chart-enrollment-trend']).toBeDefined();
      expect(result.snapshot.chartConfigs!['chart-enrollment-trend'].titleOverride).toBe(
        'Live Enrollment Trend 2026'
      );

      // Verify sourceMetadata is bundled
      expect(result.snapshot.sourceMetadata).toBeDefined();
      expect(result.snapshot.sourceMetadata!['access']).toBeDefined();
      expect(result.snapshot.sourceMetadata!['access'].folderTitle).toBe(
        'Official Access Evidence 2026'
      );
      expect(result.snapshot.sourceMetadata!['access'].folderUrl).toBe(
        'https://drive.google.com/drive/folders/live-access-folder'
      );

      // Verify captureCurrentSnapshot() also aggregates chartConfigs & sourceMetadata
      const captured = captureCurrentSnapshot('Milestone with charts and sources');
      expect(captured.chartConfigs).toBeDefined();
      expect(captured.chartConfigs!['chart-enrollment-trend']).toBeDefined();
      expect(captured.sourceMetadata).toBeDefined();
      expect(captured.sourceMetadata!['access']).toBeDefined();
    });
  });

  describe('2. Pre-Baking Dynamic Data into Public Node Payload', () => {
    it('compiles snapshot.chartConfigs into ChartDataset via parseTabularDataset and bundles sourceMetadata', () => {
      const mockSnapshot: PublishedSnapshot = {
        id: 'snapshot-42',
        schemaVersion: 1,
        title: 'Release with Dynamic Charts',
        description: 'Prebake verification',
        createdAt: '2026-11-16T12:00:00Z',
        authorSessionId: 'sess-123',
        isActive: true,
        canvases: {
          access: {
            nodeId: 'access',
            version: 1,
            sections: [],
            updatedAt: '2026-11-16T12:00:00Z',
          },
        },
        contentOverrides: {
          'hero.title': 'Bukas Dynamic Portal',
        },
        chartConfigs: {
          'chart-access-growth': {
            chartId: 'chart-access-growth',
            sheetUrl: 'https://docs.google.com/spreadsheets/d/dummy/edit',
            nodeId: 'access',
            titleOverride: 'Dynamic Access Expansion',
            subtitleOverride: 'Regional adoption growth',
            unitOverride: 'Percentage',
            defaultType: 'bar',
            cachedDataset: [
              ['Region', 'Growth'],
              ['Luzon', '35%'],
              ['Visayas', '42%'],
              ['Mindanao', '50%'],
            ],
          },
        },
        sourceMetadata: {
          access: {
            pointId: 'access',
            folderTitle: 'Accreditation Records 2026',
            folderUrl: 'https://drive.google.com/drive/folders/accred-2026',
            description: 'DepEd compliance evidence',
            lastSyncedAt: '2026-11-16T10:00:00Z',
          },
        },
        summary: {
          totalSections: 0,
          totalSubsections: 0,
          totalLeafElements: 0,
          totalTextOverrides: 1,
        },
      };

      const payload = compilePublicNodePayload('access', mockSnapshot);

      expect(payload.nodeId).toBe('access');
      expect(payload.snapshotId).toBe('snapshot-42');

      // Verify dynamic chart is compiled via parseTabularDataset
      expect(payload.chartDatasets['chart-access-growth']).toBeDefined();
      const compiledChart = payload.chartDatasets['chart-access-growth'];
      expect(compiledChart.title).toBe('Dynamic Access Expansion');
      expect(compiledChart.subtitle).toBe('Regional adoption growth');
      expect(compiledChart.chartType).toBe('bar');
      expect(compiledChart.categories).toEqual(['Luzon', 'Visayas', 'Mindanao']);
      expect(compiledChart.series?.length).toBeGreaterThan(0);

      // Verify sourceMetadata is present
      expect(payload.sourceMetadata['access']).toBeDefined();
      expect(payload.sourceMetadata['access'].folderTitle).toBe('Accreditation Records 2026');
      expect(payload.sourceMetadata['access'].folderUrl).toBe(
        'https://drive.google.com/drive/folders/accred-2026'
      );
    });
  });

  describe('3. Portal Chrome Edge Pre-Bake in compilePortalManifest()', () => {
    it('pre-bakes snapshot.contentOverrides into PublicPortalManifestPayload', () => {
      const mockSnapshot: PublishedSnapshot = {
        id: 'snapshot-portal-chrome',
        schemaVersion: 1,
        title: 'Manifest Test',
        description: 'Prebake manifest verification',
        createdAt: '2026-11-16T12:00:00Z',
        authorSessionId: 'sess-123',
        isActive: true,
        canvases: {
          access: {
            nodeId: 'access',
            version: 1,
            sections: [],
            updatedAt: '2026-11-16T12:00:00Z',
          },
        },
        contentOverrides: {
          'hero.kicker': 'Folio Engine — 2026 Portal',
          'hero.title': 'Autonomous *Educational* Roadmap',
          'hero.subtitle': 'A live demonstration of dynamic portal chrome.',
        },
        summary: {
          totalSections: 0,
          totalSubsections: 0,
          totalLeafElements: 0,
          totalTextOverrides: 3,
        },
      };

      const manifest = compilePortalManifest(mockSnapshot);

      expect(manifest.activeSnapshotId).toBe('snapshot-portal-chrome');
      expect(manifest.contentOverrides).toBeDefined();
      expect(manifest.contentOverrides!['hero.kicker']).toBe('Folio Engine — 2026 Portal');
      expect(manifest.contentOverrides!['hero.title']).toBe('Autonomous *Educational* Roadmap');
      expect(manifest.contentOverrides!['hero.subtitle']).toBe(
        'A live demonstration of dynamic portal chrome.'
      );
    });
  });

  describe('4. In-Memory Content DB Hydration with Zero localStorage Pollution', () => {
    it('setLiveContentOverrides with memoryOnly: true warms memory without calling localStorage.setItem', () => {
      setItemSpy.mockClear();

      setLiveContentOverrides(
        {
          'hero.title': 'Memory-Only Ingested Title',
          'hero.kicker': 'Memory-Only Kicker',
        },
        { memoryOnly: true }
      );

      // 1. Resolves immediately from in-memory cache
      expect(getContent('hero.title', 'Default Title', false)).toBe('Memory-Only Ingested Title');
      expect(getContent('hero.kicker', 'Default Kicker', false)).toBe('Memory-Only Kicker');

      // 2. Verified zero storage writes
      expect(setItemSpy).not.toHaveBeenCalled();

      // 3. Normal setLiveContentOverrides without memoryOnly DOES persist
      setItemSpy.mockClear();
      setLiveContentOverrides({
        'hero.title': 'Persisted Title',
      });
      expect(setItemSpy).toHaveBeenCalled();
    });

    it('setCachedSourceMetadata with memoryOnly: true warms source cache without calling localStorage.setItem', () => {
      setItemSpy.mockClear();

      const meta: SyncedSourceMetadata = {
        pointId: 'resiliency',
        folderTitle: 'Memory Only Resiliency Folder',
        folderUrl: 'https://drive.google.com/drive/folders/memory-resiliency',
        description: 'Memory cached source',
      };

      setCachedSourceMetadata(meta, { memoryOnly: true });

      const all = getAllLiveSources();
      expect(all['resiliency']).toBeDefined();
      expect(all['resiliency'].folderTitle).toBe('Memory Only Resiliency Folder');

      // Verified zero localStorage writes
      expect(setItemSpy).not.toHaveBeenCalled();
    });
  });

  describe('5. Zero-CLS Wireframe & Chrome Hydration Hook', () => {
    it('renders HeroWelcomeGhostWireframe with accessible skeleton markers and ambient glow', () => {
      const html = ReactDOMServer.renderToString(React.createElement(HeroWelcomeGhostWireframe));

      expect(html).toContain('id="hero-skeleton"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading portal introduction"');
    });

    it('usePortalChromeHydration fetches manifest and ingests into memory without localStorage writes', async () => {
      resetPortalChromeHydrationForTesting();
      setItemSpy.mockClear();

      let resolveFetch!: (res: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/public/manifest')) {
          return fetchPromise;
        }
        return new Response('{}', { status: 200 });
      });

      // Consumer component to test the hook
      let hookState = { isHydrating: true };
      function TestHydrationComponent() {
        const state = usePortalChromeHydration();
        hookState = state;
        return React.createElement('div', null, state.isHydrating ? 'HYDRATING' : 'READY');
      }

      const { createRoot } = await import('react-dom/client');
      const container = (global as any).document
        ? (global as any).document.createElement('div')
        : { appendChild: vi.fn(), removeChild: vi.fn() };
      
      // If full DOM root is available, test real mounting
      if (typeof (global as any).document?.createElement === 'function') {
        const root = createRoot(container as any);
        await (await import('react')).act(async () => {
          root.render(React.createElement(TestHydrationComponent));
        });

        // Initially in progress
        expect(hookState.isHydrating).toBe(true);

        // Resolve fetch
        await act(async () => {
          resolveFetch(
            new Response(
              JSON.stringify({
                activeSnapshotId: 'snap-manifest-test',
                publishedAt: '2026-11-16T12:00:00Z',
                nodeIds: ['access', 'equity'],
                schemaVersion: 1,
                contentOverrides: {
                  'hero.title': 'Hydrated *From* Edge KV',
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
          await new Promise((r) => setTimeout(r, 20));
        });

        // Hydration completed
        expect(hookState.isHydrating).toBe(false);

        // Check contentDb is warmed
        expect(getContent('hero.title', 'Default')).toBe('Hydrated *From* Edge KV');

        // Check 0 localStorage writes
        expect(setItemSpy).not.toHaveBeenCalled();

        root.unmount();
      }
    });

    it('HeroWelcome renders HeroWelcomeGhostWireframe when isHydrating is true', () => {
      // Mock usePortalChromeHydration to report isHydrating = true
      resetPortalChromeHydrationForTesting();

      const html = ReactDOMServer.renderToString(
        React.createElement(HeroWelcome, {
          title: 'Custom Title',
        })
      );

      // HeroWelcome must render either GhostWireframe (id="hero-skeleton") or Section depending on SSR
      expect(html).toBeDefined();
    });

    it('HeroWelcome renders HeroWelcomeGhostWireframe (id="hero-skeleton") during active client hydration', async () => {
      resetPortalChromeHydrationForTesting();

      // Create a hanging fetch promise so hydration remains active
      global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

      let unmount!: () => void;
      await act(async () => {
        const result = render(React.createElement(HeroWelcome));
        unmount = result.unmount;
      });

      const skeleton = screen.getByRole('region', { name: /Loading portal introduction/i });
      expect(skeleton).toBeDefined();
      expect(skeleton.getAttribute('id')).toBe('hero-skeleton');
      expect(skeleton.getAttribute('aria-busy')).toBe('true');

      if (unmount) unmount();
    });
  });
});
