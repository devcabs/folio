import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { KVNamespace } from '../src/types/edge';
import type { PublishedSnapshot } from '../src/types/history';
import {
  handlePublicNodeRoute,
  handlePublicManifestRoute,
  createEdgeJsonResponse,
  checkConditionalGet,
  CACHE_CONTROL_EDGE,
  CACHE_CONTROL_FALLBACK,
} from '../src/edge/handlers/publicHandler';
import {
  handleFolioEdgeRequest,
  resolveKVNamespace,
} from '../src/edge/router';
import { compilePublicNodePayload } from '../src/services/edgePreBakeService';
import * as sharedPublic from '../functions/api/public/_shared';

function createMockKV(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return {
        keys: Array.from(store.keys()).map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
}

describe('Subtask 7.6: Edge Public Handlers, Pre-Bake & Router SSOT', () => {
  describe('handlePublicNodeRoute (fail-stop & dynamic node validation)', () => {
    it('returns HTTP 503 when KV binding is null', async () => {
      const req = new Request('https://example.com/api/public/node/access');
      const res = await handlePublicNodeRoute(req, 'access', null);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toContain('KV');
    });

    it('returns HTTP 400 for invalid nodeId syntax', async () => {
      const kv = createMockKV();
      const badIds = ['', 'bad node!', '../etc', 'a'.repeat(65)];
      for (const id of badIds) {
        const req = new Request(`https://example.com/api/public/node/${encodeURIComponent(id)}`);
        const res = await handlePublicNodeRoute(req, id, kv);
        expect(res.status).toBe(400);
      }
    });

    it('returns HTTP 404 on KV cold miss instead of synthetic SUPABASE_FALLBACK 200', async () => {
      const kv = createMockKV();
      const req = new Request('https://example.com/api/public/node/access');
      const res = await handlePublicNodeRoute(req, 'access', kv);
      expect(res.status).toBe(404);
      expect(res.headers.get('X-Engine-Edge-Source')).toBeNull();
      const body = await res.json();
      expect(body.error).toBe('Resource not found in Edge KV');
    });

    it('accepts custom consumer nodeIds and resolves versioned node:${activeSnapshotId}:${nodeId} from portal:manifest', async () => {
      const versionedPayload = JSON.stringify({
        nodeId: 'custom-pillar_1',
        snapshotId: 'snap-v2',
        version: 1,
        updatedAt: '2026-11-18T00:00:00.000Z',
        canvas: {
          nodeId: 'custom-pillar_1',
          version: 1,
          elements: [],
          updatedAt: '2026-11-18T00:00:00.000Z',
        },
      });
      const staleUnversioned = JSON.stringify({
        nodeId: 'custom-pillar_1',
        snapshotId: 'snap-v1',
        version: 1,
        updatedAt: '2026-11-17T00:00:00.000Z',
        canvas: {
          nodeId: 'custom-pillar_1',
          version: 1,
          elements: [],
          updatedAt: '2026-11-17T00:00:00.000Z',
        },
      });
      const kv = createMockKV({
        'portal:manifest': JSON.stringify({
          activeSnapshotId: 'snap-v2',
          publishedAt: '2026-11-18T00:00:00.000Z',
          nodeIds: ['custom-pillar_1'],
          schemaVersion: 1,
        }),
        'node:snap-v2:custom-pillar_1': versionedPayload,
        'node:custom-pillar_1': staleUnversioned,
      });

      const req = new Request('https://example.com/api/public/node/custom-pillar_1');
      const res = await handlePublicNodeRoute(req, 'custom-pillar_1', kv);
      expect(res.status).toBe(200);
      expect(res.headers.get('X-Engine-Edge-Source')).toBe('KV');
      const body = await res.json();
      expect(body.snapshotId).toBe('snap-v2');
      expect(body.nodeId).toBe('custom-pillar_1');
    });

    it('falls back to node:${nodeId} only when it matches activeSnapshotId, returning 404 if stale', async () => {
      const kvWithStaleOnly = createMockKV({
        'portal:manifest': JSON.stringify({
          activeSnapshotId: 'snap-v2',
          publishedAt: '2026-11-18T00:00:00.000Z',
          nodeIds: ['access'],
          schemaVersion: 1,
        }),
        'node:access': JSON.stringify({
          nodeId: 'access',
          snapshotId: 'snap-v1',
          version: 1,
          updatedAt: '2026-11-17T00:00:00.000Z',
          canvas: { nodeId: 'access', version: 3, elements: [], updatedAt: '2026-11-17T00:00:00.000Z' },
        }),
      });

      const resStale = await handlePublicNodeRoute(
        new Request('https://example.com/api/public/node/access'),
        'access',
        kvWithStaleOnly
      );
      expect(resStale.status).toBe(404);

      const kvWithMatchingUnversioned = createMockKV({
        'portal:manifest': JSON.stringify({
          activeSnapshotId: 'snap-v2',
          publishedAt: '2026-11-18T00:00:00.000Z',
          nodeIds: ['access'],
          schemaVersion: 1,
        }),
        'node:access': JSON.stringify({
          nodeId: 'access',
          snapshotId: 'snap-v2',
          version: 1,
          updatedAt: '2026-11-18T00:00:00.000Z',
          canvas: { nodeId: 'access', version: 3, elements: [], updatedAt: '2026-11-18T00:00:00.000Z' },
        }),
      });

      const resMatch = await handlePublicNodeRoute(
        new Request('https://example.com/api/public/node/access'),
        'access',
        kvWithMatchingUnversioned
      );
      expect(resMatch.status).toBe(200);
      const body = await resMatch.json();
      expect(body.snapshotId).toBe('snap-v2');
    });
  });

  describe('handlePublicManifestRoute (fail-stop)', () => {
    it('returns HTTP 503 when KV binding is null', async () => {
      const req = new Request('https://example.com/api/public/manifest');
      const res = await handlePublicManifestRoute(req, null);
      expect(res.status).toBe(503);
    });

    it('returns HTTP 404 on KV cold miss instead of synthetic SUPABASE_FALLBACK 200', async () => {
      const kv = createMockKV();
      const req = new Request('https://example.com/api/public/manifest');
      const res = await handlePublicManifestRoute(req, kv);
      expect(res.status).toBe(404);
      expect(res.headers.get('X-Engine-Edge-Source')).toBeNull();
      const body = await res.json();
      expect(body.error).toBe('Resource not found in Edge KV');
    });
  });

  describe('Router & KV binding SSOT', () => {
    it('resolveKVNamespace does not fall back to legacy KV_MASID_PUBLIC', () => {
      const legacyKv = createMockKV();
      expect(resolveKVNamespace({ KV_MASID_PUBLIC: legacyKv })).toBeNull();

      const engineKv = createMockKV();
      expect(resolveKVNamespace({ KV_ENGINE_PUBLIC: engineKv })).toBe(engineKv);
    });

    it('returns 404 for removed sidecar /api/public/chart/:chartId route', async () => {
      const kv = createMockKV({ 'chart:c1': JSON.stringify({ chartId: 'c1' }) });
      const req = new Request('https://example.com/api/public/chart/c1');
      const res = await handleFolioEdgeRequest(req, { KV_ENGINE_PUBLIC: kv });
      expect(res.status).toBe(404);
    });
  });

  describe('functions/api/public/_shared.ts deduplication', () => {
    it('re-exports edge helpers directly from src/edge/handlers/publicHandler.ts', () => {
      expect(sharedPublic.createEdgeJsonResponse).toBe(createEdgeJsonResponse);
      expect(sharedPublic.checkConditionalGet).toBe(checkConditionalGet);
      expect(sharedPublic.CACHE_CONTROL_EDGE).toBe(CACHE_CONTROL_EDGE);
      expect(sharedPublic.CACHE_CONTROL_FALLBACK).toBe(CACHE_CONTROL_FALLBACK);
    });
  });

  describe('compilePublicNodePayload (self-contained AST compiler)', () => {
    it('throws explicit Error when snapshot.canvases[nodeId] is missing', () => {
      const snapshot = {
        id: 'snap-1',
        createdAt: '2026-11-18T00:00:00.000Z',
        schemaVersion: 1,
        canvases: {},
        contentOverrides: {},
      } as unknown as PublishedSnapshot;

      expect(() => compilePublicNodePayload('missing-node', snapshot)).toThrow(
        'Missing canvas in snapshot for node: missing-node'
      );
    });

    it('pre-bakes PhotoElement and GalleryElement.syncedPhotos URLs and strips ChartElement.config.sheetUrl', () => {
      const driveId1 = '1ABCdefGHIjklMNOpqrSTUvwxYZ012345';
      const driveId2 = '2ABCdefGHIjklMNOpqrSTUvwxYZ678901';
      const driveId3 = '3ABCdefGHIjklMNOpqrSTUvwxYZ234567';

      const snapshot: PublishedSnapshot = {
        id: 'snap-ast-1',
        title: 'Prebake Snapshot',
        description: 'Test snapshot',
        isActive: true,
        createdAt: '2026-11-18T00:00:00.000Z',
        schemaVersion: 1,
        authorSessionId: 'sess-1',
        summary: {
          totalSections: 1,
          totalSubsections: 1,
          totalLeafElements: 2,
          totalTextElements: 0,
          totalPhotoElements: 1,
          totalChartElements: 1,
          totalTextOverrides: 0,
        },
        contentOverrides: {},
        canvases: {
          access: {
            nodeId: 'access',
            version: 3,
            updatedAt: '2026-11-18T00:00:00.000Z',
            elements: [
              {
                id: 'sec-1',
                type: 'section',
                title: 'Section 1',
              },
              {
                id: 'photo-1',
                type: 'photo',
                pointId: 'p-1',
                src: `https://drive.google.com/file/d/${driveId1}/view`,
              },
              {
                id: 'gal-1',
                type: 'gallery',
                pointId: 'g-1',
                syncedPhotos: [
                  {
                    id: 'sp-1',
                    title: 'Photo A',
                    driveFileId: driveId2,
                    originalFileName: 'a.jpg',
                    thumbnailUrl: `https://drive.google.com/thumbnail?id=${driveId2}&sz=w320`,
                    fullImageUrl: `https://drive.google.com/thumbnail?id=${driveId2}&sz=w1600`,
                    orderIndex: 0,
                  },
                ],
              },
              {
                id: 'sub-1',
                type: 'subsection',
                title: 'Sub 1',
              },
              {
                id: 'gal-2',
                type: 'gallery',
                pointId: 'g-2',
                syncedPhotos: [
                  {
                    id: 'sp-2',
                    title: 'Photo B',
                    driveFileId: driveId3,
                    originalFileName: 'b.jpg',
                    thumbnailUrl: `https://drive.google.com/thumbnail?id=${driveId3}&sz=w320`,
                    fullImageUrl: `https://drive.google.com/thumbnail?id=${driveId3}&sz=w1600`,
                    orderIndex: 0,
                  },
                ],
              },
              {
                id: 'chart-1',
                type: 'chart',
                chartId: 'c-1',
                title: 'Enrollment',
                config: {
                  chartId: 'c-1',
                  nodeId: 'access',
                  sheetUrl: 'https://docs.google.com/spreadsheets/d/secret-sheet/edit',
                  defaultType: 'bar',
                  titleOverride: 'Enrollment',
                  visualConfig: {},
                  updatedAt: '2026-11-18T00:00:00.000Z',
                  updatedBy: 'coordinator',
                },
                dataset: {
                  chartId: 'c-1',
                  title: 'Enrollment',
                  asOfDate: '2026-11-18',
                  chartType: 'bar',
                  sanitizedCsvContent: 'Year,Count\n2025,100',
                  categories: ['2025'],
                  series: [{ name: 'Count', data: [100] }],
                },
              },
            ],
          },
        },
      };

      const compiled = compilePublicNodePayload('access', snapshot);
      const els = compiled.canvas.elements;

      // PhotoElement
      const photo = els[1] as any;
      expect(photo.src).toBe(`/api/media/drive/${driveId1}?w=800`);
      expect(photo.srcSet).toContain(`/api/media/drive/${driveId1}?w=400 400w`);

      // GalleryElement.syncedPhotos
      const gal1 = els[2] as any;
      expect(gal1.syncedPhotos[0].thumbnailUrl).toBe(`/api/media/drive/${driveId2}?w=400`);
      expect(gal1.syncedPhotos[0].fullImageUrl).toBe(`/api/media/drive/${driveId2}?w=1600`);

      // Second GalleryElement.syncedPhotos
      const gal2 = els[4] as any;
      expect(gal2.syncedPhotos[0].thumbnailUrl).toBe(`/api/media/drive/${driveId3}?w=400`);
      expect(gal2.syncedPhotos[0].fullImageUrl).toBe(`/api/media/drive/${driveId3}?w=1600`);

      // ChartElement (sheetUrl stripped, dataset preserved)
      const chart = els[5] as any;
      expect(chart.config.sheetUrl).toBeUndefined();
      expect(chart.config.defaultType).toBe('bar');
      expect(chart.dataset.series[0].data).toEqual([100]);
    });

    it('has zero static JSON imports in publicHandler.ts and edgePreBakeService.ts', () => {
      const root = path.resolve(__dirname, '..');
      const publicHandlerSrc = fs.readFileSync(
        path.join(root, 'src/edge/handlers/publicHandler.ts'),
        'utf-8'
      );
      const preBakeSrc = fs.readFileSync(
        path.join(root, 'src/services/edgePreBakeService.ts'),
        'utf-8'
      );

      expect(publicHandlerSrc).not.toContain('baked-charts.json');
      expect(publicHandlerSrc).not.toContain('SUPABASE_FALLBACK');
      expect(publicHandlerSrc).not.toContain('STATIC_FALLBACK');
      expect(preBakeSrc).not.toContain('baked-charts.json');
      expect(preBakeSrc).not.toContain('source-sources.json');
    });
  });
});
