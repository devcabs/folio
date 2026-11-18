import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { KVNamespace, PublicNodePayload } from '../src/types/edge';
import type { NodeCanvasDocument, ChartElement, GalleryElement } from '../src/types/canvas';
import {
  setEngineConfig,
  resetEngineConfig,
  getActiveNodes,
  getActiveNodeIds,
} from '../src/config/engine.config';
import { resolveContentWatermark } from '../src/utils/watermarkResolver';
import { getContentVersionWatermark, getPendingMigrations } from '../src/services/migrationService';
import { handleFolioEdgeRequest } from '../src/edge/router';
import { parseRoute } from '../src/hooks/use-hash-route';
import { verifyDriveFolderUrl } from '../src/services/driveVerificationService';
import { fetchLiveSheetMatrix } from '../src/services/sheetsDataService';

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const FUNCTIONS_DIR = path.join(ROOT, 'functions');

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function createMockKV(): KVNamespace & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string, typeOrOptions?: any): Promise<any> {
      const val = store.get(key) ?? null;
      if (val === null) return null;
      const mode = typeof typeOrOptions === 'string' ? typeOrOptions : typeOrOptions?.type;
      if (mode === 'json') return JSON.parse(val);
      return val;
    },
    async put(key: string, value: string | ArrayBuffer | ReadableStream) {
      store.set(key, typeof value === 'string' ? value : String(value));
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return {
        keys: Array.from(store.keys()).map((name) => ({ name })),
        list_complete: true,
        cursor: '',
      };
    },
  };
}

function createFailingKV(): KVNamespace {
  return {
    async get() {
      throw new Error('KV_READ_FAILURE');
    },
    async put() {
      throw new Error('KV_WRITE_FAILURE');
    },
    async delete() {
      throw new Error('KV_DELETE_FAILURE');
    },
    async list() {
      throw new Error('KV_LIST_FAILURE');
    },
  };
}

describe('Epic 7 SSOT Invariants Verification Suite (All 10 Domains)', () => {
  beforeEach(() => {
    resetEngineConfig();
  });

  afterEach(() => {
    resetEngineConfig();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // INVARIANT 1: Live Cloudflare KV Only (Static & Runtime Scan)
  // =========================================================================
  describe('Invariant 1: Live Cloudflare KV Only (Zero Supabase, Browser Storage, or Shadow Stores)', () => {
    const allFiles = [...collectTsFiles(SRC_DIR), ...collectTsFiles(FUNCTIONS_DIR)];

    it('Domain 1: Zero localStorage, sessionStorage, indexedDB, or Supabase usage in src/ and functions/', () => {
      const forbiddenRuntimePatterns = [
        /\blocalStorage\b/,
        /\bsessionStorage\b/,
        /\bindexedDB\b/,
        /\bBroadcastChannel\b/,
        /supabase\.co/i,
        /\bengine_drafts\b/,
        /\bengine_history\b/,
        /\bchart_sources\b/,
        /\bengine_sources\b/,
        /\bdev_mode_session\b/,
      ];

      for (const filePath of allFiles) {
        if (filePath.endsWith(path.join('src', 'migrations', 'ledger.ts'))) {
          continue;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        // Strip single-line and block comments so architectural comments explaining removal don't false-positive
        const codeOnly = content
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');

        for (const pattern of forbiddenRuntimePatterns) {
          expect(
            pattern.test(codeOnly),
            `Forbidden pattern ${pattern} found in ${path.relative(ROOT, filePath)}`
          ).toBe(false);
        }
      }
    });

    it('Domain 1, 7, 8: Legacy sidecar & storage files are deleted', () => {
      const deletedFiles = [
        'src/utils/storageAdapter.ts',
        'src/utils/supabase-config.ts',
        'src/utils/supabase-write-guard.ts',
        'src/utils/runtime-env.ts',
        'src/services/mediaService.ts',
        'src/services/historyStorage.ts',
        'src/services/chartSourceService.ts',
        'src/services/sourceService.ts',
      ];
      for (const rel of deletedFiles) {
        expect(
          fs.existsSync(path.join(ROOT, rel)),
          `Legacy file ${rel} must be deleted`
        ).toBe(false);
      }
    });

    it('Domain 2, 4, 5: Zero module-level shadow stores across contentDb, draftService, and historyService', () => {
      const shadowStoreNames = [
        'liveMemoryCache',
        'draftMemoryCache',
        'inMemoryLiveStores',
        'inMemoryDraftStores',
        'draftTombstones',
        'inMemoryDraftCanvases',
        'inMemoryDraftActive',
        'inMemoryManifest',
        'inMemoryRegistry',
        'hasCompletedHydration',
      ];

      const targetFiles = [
        'src/utils/contentDb.ts',
        'src/services/draftService.ts',
        'src/services/historyService.ts',
        'src/hooks/usePortalChromeHydration.ts',
      ];

      for (const rel of targetFiles) {
        const content = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
        const codeOnly = content
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');
        for (const symbol of shadowStoreNames) {
          expect(
            codeOnly.includes(symbol),
            `Forbidden shadow store "${symbol}" found in ${rel}`
          ).toBe(false);
        }
      }
    });
  });

  // =========================================================================
  // INVARIANT 2: Self-Contained Document AST & Atomic Publish Round-Trip
  // =========================================================================
  describe('Invariant 2: Self-Contained Document AST (Domains 3, 4, 5, 6, 7, 8)', () => {
    it('round-trips embedded ChartElement and GalleryElement through draft -> publish -> public -> restore', async () => {
      const kv = createMockKV();
      const env = {
        KV_ENGINE_PUBLIC: kv,
        DEV_PIN_HASH: 'test-hash',
        DEV_SECURITY_SALT: 'test-salt',
      };

      // Seed active coordinator lock in KV so Bearer lockToken is valid
      const lockToken = 'ssot-lock-token-123';
      await kv.put(
        'lock:coordinator',
        JSON.stringify({
          lockToken,
          sessionId: 'coord-1',
          acquiredAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
      );

      const embeddedChart: ChartElement = {
        id: 'chart-el-1',
        type: 'chart',
        chartId: 'chart-enroll-1',
        title: 'Enrollment Growth',
        config: {
          chartId: 'chart-enroll-1',
          titleOverride: 'Enrollment Growth',
          defaultType: 'bar',
          sheetUrl: 'https://docs.google.com/spreadsheets/d/secret-sheet/edit',
          tabName: 'Summary',
          nodeId: 'custom-alpha',
        },
        dataset: {
          chartId: 'chart-enroll-1',
          title: 'Enrollment Growth',
          asOfDate: '2026-01-01',
          chartType: 'bar',
          categories: ['2024', '2025'],
          series: [{ name: 'Total', data: [1200, 1500] }],
          sanitizedCsvContent: 'Year,Total\n2024,1200\n2025,1500',
        },
      };

      const embeddedGallery: GalleryElement = {
        id: 'gallery-el-1',
        type: 'gallery',
        pointId: 'node.custom-alpha.gallery.1',
        driveUrl: 'https://drive.google.com/drive/folders/folder-abc',
        title: 'Field Verification Photos',
        description: 'Site inspection album',
        lastVerified: '2026-01-01T00:00:00.000Z',
        syncedPhotos: [
          {
            id: 'photo-1',
            pointId: 'node.custom-alpha.gallery.1',
            driveFileId: 'drive-file-1',
            originalFileName: 'site1.jpg',
            title: 'Site 1',
            isCustomTitle: false,
            orderIndex: 0,
            thumbnailUrl: '/api/media/drive/drive-file-1',
            fullImageUrl: '/api/media/drive/drive-file-1',
          },
        ],
      };

      const customDoc: NodeCanvasDocument = {
        nodeId: 'custom-alpha',
        version: 2,
        updatedAt: '2026-01-01T00:00:00.000Z',
        sections: [
          {
            id: 'sec-1',
            type: 'section',
            title: 'Overview',
            isNumbered: true,
            number: '01',
            elements: [embeddedChart, embeddedGallery],
          },
        ],
      };

      // 0. Initialize draft:workspace via POST /api/draft/init
      const draftInitRes = await handleFolioEdgeRequest(
        new Request('https://example.com/api/draft/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lockToken}`,
          },
          body: JSON.stringify({ nodeIds: ['custom-alpha'] }),
        }),
        env
      );
      expect(draftInitRes.status).toBe(200);

      // 1. Save to draft:workspace via PUT /api/draft
      const draftPutRes = await handleFolioEdgeRequest(
        new Request('https://example.com/api/draft', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lockToken}`,
          },
          body: JSON.stringify({
            baseSnapshotId: null,
            canvases: { 'custom-alpha': customDoc },
            contentOverrides: { 'node.custom-alpha.summary': 'Custom Alpha Summary' },
          }),
        }),
        env
      );
      expect(draftPutRes.status).toBe(200);

      // 2. Publish atomically via POST /api/publish
      const snapshotId = 'snap-ssot-roundtrip-1';
      const publishRes = await handleFolioEdgeRequest(
        new Request('https://example.com/api/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lockToken}`,
          },
          body: JSON.stringify({
            snapshot: {
              id: snapshotId,
              label: 'SSOT Round-Trip Release',
              createdAt: '2026-01-01T00:00:00.000Z',
              authorSessionId: 'coord-1',
              isMilestone: true,
              canvases: { 'custom-alpha': customDoc },
              contentOverrides: { 'node.custom-alpha.summary': 'Custom Alpha Summary' },
            },
          }),
        }),
        env
      );
      expect(publishRes.status).toBe(200);
      const publishJson = (await publishRes.json()) as { success: boolean; snapshotId: string };
      expect(publishJson.success).toBe(true);
      expect(publishJson.snapshotId).toBe(snapshotId);

      // 3. Read public node payload via GET /api/public/node/custom-alpha
      const publicNodeRes = await handleFolioEdgeRequest(
        new Request('https://example.com/api/public/node/custom-alpha'),
        env
      );
      expect(publicNodeRes.status).toBe(200);
      const publicPayload = (await publicNodeRes.json()) as PublicNodePayload;
      const publishedSection = publicPayload.canvas.sections[0];
      const publishedChart = publishedSection.elements[0] as ChartElement;
      const publishedGallery = publishedSection.elements[1] as GalleryElement;

      expect(publishedChart.dataset?.series?.[0]?.data).toEqual([1200, 1500]);
      expect(publishedChart.config?.titleOverride).toBe('Enrollment Growth');
      // Sensitive sheetUrl must be stripped on public edge payload
      expect((publishedChart.config as any)?.sheetUrl).toBeUndefined();
      expect(publishedGallery.syncedPhotos).toHaveLength(1);
      expect(publishedGallery.syncedPhotos?.[0].thumbnailUrl).toContain('/api/media/drive/drive-file-1');

      // 4. Restore snapshot back to draft:workspace via POST /api/history/restore
      const restoreRes = await handleFolioEdgeRequest(
        new Request('https://example.com/api/history/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lockToken}`,
          },
          body: JSON.stringify({ snapshotId: publishJson.snapshotId }),
        }),
        env
      );
      expect(restoreRes.status).toBe(200);

      // Verify restored draft:workspace preserves AST + contentOverrides
      const draftGetRes = await handleFolioEdgeRequest(
        new Request('https://example.com/api/draft', {
          headers: { Authorization: `Bearer ${lockToken}` },
        }),
        env
      );
      expect(draftGetRes.status).toBe(200);
      const restoredDraft = (await draftGetRes.json()) as {
        canvases: Record<string, NodeCanvasDocument>;
        contentOverrides: Record<string, string>;
      };
      expect(restoredDraft.contentOverrides['node.custom-alpha.summary']).toBe(
        'Custom Alpha Summary'
      );
      const restoredChart = restoredDraft.canvases['custom-alpha'].sections[0]
        .elements[0] as ChartElement;
      expect(restoredChart.dataset?.series?.[0]?.data).toEqual([1200, 1500]);
    });
  });

  // =========================================================================
  // INVARIANT 3: Strict Fail-Stop (Domains 6, 7, 8, 9)
  // =========================================================================
  describe('Invariant 3: Strict Fail-Stop (KV, Edge, Google Sheets, Google Drive, Media)', () => {
    it('Domain 6: Cold miss on /api/public/node/:id and /api/public/manifest returns 404 (no synthetic fallback)', async () => {
      const kv = createMockKV();
      const env = { KV_ENGINE_PUBLIC: kv };

      const nodeRes = await handleFolioEdgeRequest(
        new Request('https://example.com/api/public/node/access'),
        env
      );
      expect(nodeRes.status).toBe(404);

      const manifestRes = await handleFolioEdgeRequest(
        new Request('https://example.com/api/public/manifest'),
        env
      );
      expect(manifestRes.status).toBe(404);

      // Sidecar /api/public/chart/:id route must not exist
      const chartRes = await handleFolioEdgeRequest(
        new Request('https://example.com/api/public/chart/any-chart'),
        env
      );
      expect(chartRes.status).toBe(404);
    });

    it('Domain 6: Failing KV binding returns HTTP 503 fail-stop', async () => {
      const env = { KV_ENGINE_PUBLIC: createFailingKV() };
      const res = await handleFolioEdgeRequest(
        new Request('https://example.com/api/public/manifest'),
        env
      );
      expect(res.status).toBeGreaterThanOrEqual(500);
    });

    it('Domain 7: fetchLiveSheetMatrix throws on network/HTTP failure instead of returning []', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403 }))
      );
      await expect(
        fetchLiveSheetMatrix({
          sheetUrl: 'https://docs.google.com/spreadsheets/d/abc123/edit',
          tabName: 'Sheet1',
        })
      ).rejects.toThrow();
    });

    it('Domain 8: verifyDriveFolderUrl never returns valid on missing API key or API failure', async () => {
      const result = await verifyDriveFolderUrl(
        'https://drive.google.com/drive/folders/folder123'
      );
      expect(result.status).not.toBe('valid');

      const linkModalSource = fs.readFileSync(
        path.join(SRC_DIR, 'components/source/LinkFolderModal.tsx'),
        'utf-8'
      );
      expect(linkModalSource).toContain("verificationResult?.status === 'valid'");
    });

    it('Domain 9: /api/media/drive/:fileId fails stop on upstream 404 without synthetic SVG placeholder', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }))
      );
      const res = await handleFolioEdgeRequest(
        new Request('https://example.com/api/media/drive/missing-file-id'),
        { KV_ENGINE_PUBLIC: createMockKV() }
      );
      expect(res.status).toBe(404);
      expect(res.headers.get('Content-Type') ?? '').not.toContain('image/svg+xml');
    });
  });

  // =========================================================================
  // DOMAIN 10: EngineConfig.nodes, Unified Chrome Keys, & Single-Source Watermark
  // =========================================================================
  describe('Domain 10: EngineConfig Active Nodes, Unified Chrome Keys, & Watermark SSOT', () => {
    it('derives active nodes and IDs strictly from EngineConfig.nodes', () => {
      expect(getActiveNodes()).toEqual([]);
      expect(getActiveNodeIds()).toEqual([]);

      setEngineConfig({
        nodes: [
          {
            id: 'alpha',
            index: 1,
            nodeNumber: 1,
            title: 'Alpha Stage',
            summary: 'Alpha summary',
            accentColor: '#111111',
            tagline: '01 Alpha',
          },
          {
            id: 'beta',
            index: 2,
            nodeNumber: 2,
            title: 'Beta Stage',
            summary: 'Beta summary',
            accentColor: '#222222',
            tagline: '02 Beta',
          },
        ],
      });

      expect(getActiveNodeIds()).toEqual(['alpha', 'beta']);
      expect(getActiveNodes()).toHaveLength(2);

      const route = parseRoute('/node/beta/');
      expect(route.type).toBe('node');
      expect(route.nodeId).toBe('beta');
      expect(route.targetStage).toBe(2);
    });

    it('uses identical node.${id}.kicker, node.${id}.title, and node.${id}.summary keys in App.tsx and RoadmapNode.tsx', () => {
      const appSource = fs.readFileSync(path.join(SRC_DIR, 'App.tsx'), 'utf-8');
      const roadmapNodeSource = fs.readFileSync(
        path.join(SRC_DIR, 'components/roadmap/RoadmapNode.tsx'),
        'utf-8'
      );

      expect(appSource).not.toContain('sample-nodes.json');
      expect(appSource).toContain('kickerPointId={`node.${currentNode.id}.kicker`}');
      expect(appSource).toContain('titlePointId={`node.${currentNode.id}.title`}');
      expect(appSource).toContain('subtitlePointId={`node.${currentNode.id}.summary`}');
      expect(appSource).not.toContain('subtitlePointId={`node.${currentNode.id}.subtitle`}');

      expect(roadmapNodeSource).toContain('pointId={`node.${page.id}.kicker`}');
      expect(roadmapNodeSource).toContain('pointId={`node.${page.id}.title`}');
      expect(roadmapNodeSource).toContain('pointId={`node.${page.id}.summary`}');
      expect(roadmapNodeSource).not.toContain('pointId={`node.${page.id}.tagline`}');
    });

    it('resolves content watermark strictly from EngineConfig.contentVersion without StorageAdapter', () => {
      expect(resolveContentWatermark(undefined)).toBe('0.0.0');
      expect(resolveContentWatermark('0.1.6')).toBe('0.1.6');

      setEngineConfig({ contentVersion: '0.1.5' });
      expect(getContentVersionWatermark()).toBe('0.1.5');
      const report = getPendingMigrations();
      expect(report.contentVersionWatermark).toBe('0.1.5');
    });
  });
});
