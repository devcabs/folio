/**
 * Folio Engine — Edge KV Pre-Baking Pipeline Service
 * Location: src/services/edgePreBakeService.ts
 * Specification: docs/tasks/task15_3_edge_kv_pre_baking_pipeline.md
 *
 * Implements:
 * 1. Publish-time AST compiler for all 5 nodes.
 * 2. Deterministic Google Drive URL rewriting to edge proxy endpoints (/api/media/drive/:fileId?w=800).
 * 3. Pre-calculated multi-density responsive srcSet (400w, 800w, 1600w).
 * 4. Bundles indicator chart datasets & source metadata directly into public payloads.
 * 5. Atomic bulk deployment to Cloudflare KV REST API with resilient offline fallback.
 */

import type {
  PublicNodePayload,
  PublicPortalManifestPayload,
  CachedIndicatorDataset,
  SyncedSourceMetadata,
} from '../types/edge';
import {
  VALID_NODES,
  PublicNodePayloadSchema,
  PublicPortalManifestPayloadSchema,
} from '../types/edge';
import type {
  NodeCanvasDocument,
  SectionElement,
  SubsectionElement,
  PhotoElement,
  CanvasChildElement,
  CanvasLeafElement,
} from '../types/canvas';
import { isPhotoElement, isSubsectionElement } from '../types/canvas';
import type { PublishedSnapshot } from '../types/history';
import {
  extractDriveFileId,
  buildEdgeMediaUrl,
  buildEdgeSrcSet,
} from '../utils/mediaUrl';
import bakedChartsData from '../data/baked-charts.json';
import baselineSourcesRaw from '../data/source-sources.json';
import type { ChartDataset } from '../types/chart';
import type { SourceSourceRegistry } from '../types/source';

export const TRANSFORM_BREAKPOINTS = [400, 800, 1600] as const;
export const DEFAULT_SIZES_ATTRIBUTE = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px';
export const DEFAULT_PHOTO_ASPECT_RATIO = '16/9';

export interface CloudflareKVCredentials {
  accountId?: string;
  namespaceId?: string;
  apiToken?: string;
}

export interface KVPairPayload {
  key: string;
  value: string;
  expiration?: number;
  expiration_ttl?: number;
  metadata?: unknown;
}

export interface KVDeployResult {
  success: boolean;
  deployedCount: number;
  warning?: string;
  error?: string;
}

export interface PreBakeResult {
  success: boolean;
  snapshotId: string;
  transformedNodes: string[];
  totalKvKeys: number;
  deployResult: KVDeployResult;
}

export interface PreBakeCompileOptions {
  nodeIds?: string[];
  chartDatasets?: Record<string, CachedIndicatorDataset>;
  sourceMetadata?: Record<string, SyncedSourceMetadata>;
  credentials?: CloudflareKVCredentials;
}

/**
 * Safely reads environment variables across Node, CLI, and browser environments.
 */
function getSafeEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * Recursively walks the Canvas AST and pre-bakes responsive edge proxy URLs for all photo elements.
 * Preserves local assets, data URLs, and custom aspect ratios untouched.
 */
export function transformCanvasAst(canvasDoc: NodeCanvasDocument): NodeCanvasDocument {
  if (!canvasDoc || !Array.isArray(canvasDoc.sections)) {
    return canvasDoc;
  }

  // Deep clone to ensure immutability
  const cloned: NodeCanvasDocument = JSON.parse(JSON.stringify(canvasDoc));

  cloned.sections = cloned.sections.map((section: SectionElement) => {
    if (!section || !Array.isArray(section.elements)) return section;

    const transformedElements = section.elements.map((el: CanvasChildElement) => {
      // 1. Nested subsection traversal
      if (isSubsectionElement(el)) {
        const sub = el as SubsectionElement;
        if (Array.isArray(sub.elements)) {
          const transformedSubElements = sub.elements.map((child: CanvasLeafElement) => {
            if (isPhotoElement(child)) {
              return transformPhotoElement(child);
            }
            return child;
          });
          return {
            ...sub,
            elements: transformedSubElements,
          };
        }
        return sub;
      }

      // 2. Direct section photo element
      if (isPhotoElement(el)) {
        return transformPhotoElement(el);
      }

      return el;
    });

    return {
      ...section,
      elements: transformedElements,
    };
  });

  return cloned;
}

/**
 * Transforms an individual PhotoElement into a pre-baked edge responsive photo node.
 */
function transformPhotoElement(photo: PhotoElement): PhotoElement {
  if (!photo.src || typeof photo.src !== 'string') {
    return photo;
  }

  const rawSrc = photo.src.trim();
  const fileId = extractDriveFileId(rawSrc);

  // If not a Google Drive link (e.g. data URL or /images/local.png), leave intact
  if (!fileId) {
    return photo;
  }

  const edgeSrc = buildEdgeMediaUrl(fileId, { width: 800 });
  const edgeSrcSet = buildEdgeSrcSet(fileId, TRANSFORM_BREAKPOINTS);
  const sizes = photo.sizes || DEFAULT_SIZES_ATTRIBUTE;
  const aspectRatio = photo.aspectRatio || DEFAULT_PHOTO_ASPECT_RATIO;

  return {
    ...photo,
    src: edgeSrc,
    srcSet: edgeSrcSet,
    sizes,
    aspectRatio,
    rawDriveUrl: photo.rawDriveUrl || rawSrc,
  };
}

/**
 * Gathers cached indicator datasets for a node document.
 */
export function gatherIndicatorDatasets(
  nodeId: string,
  provided?: Record<string, CachedIndicatorDataset>
): Record<string, CachedIndicatorDataset> {
  const result: Record<string, CachedIndicatorDataset> = {};

  // 1. Ingest static baseline charts
  if (Array.isArray(bakedChartsData)) {
    for (const item of bakedChartsData as ChartDataset[]) {
      if (item && item.chartId) {
        if (!item.nodeId || item.nodeId.toLowerCase() === nodeId.toLowerCase()) {
          result[item.chartId] = item;
        }
      }
    }
  }

  // 2. Merge provided / dynamic datasets
  if (provided) {
    for (const [k, v] of Object.entries(provided)) {
      result[k] = v;
    }
  }

  return result;
}

/**
 * Gathers synced source metadata for a node document.
 */
export function gatherSourceMetadata(
  nodeId: string,
  provided?: Record<string, SyncedSourceMetadata>
): Record<string, SyncedSourceMetadata> {
  const result: Record<string, SyncedSourceMetadata> = {};

  // 1. Ingest baseline sources
  const baseline = baselineSourcesRaw as SourceSourceRegistry;
  if (baseline && typeof baseline === 'object') {
    for (const [pointId, source] of Object.entries(baseline)) {
      if (pointId.toLowerCase().includes(nodeId.toLowerCase())) {
        result[pointId] = {
          pointId,
          folderUrl: source.folderUrl,
          folderTitle: source.folderTitle,
          description: source.description,
          lastSyncedAt: source.lastVerified,
        };
      }
    }
  }

  // 2. Merge provided
  if (provided) {
    for (const [k, v] of Object.entries(provided)) {
      result[k] = v;
    }
  }

  return result;
}

/**
 * Compiles a single node's pre-baked PublicNodePayload ready for KV deployment.
 */
export function compilePublicNodePayload(
  nodeId: string,
  snapshot: PublishedSnapshot,
  options?: PreBakeCompileOptions
): PublicNodePayload {
  const rawCanvas = snapshot.canvases?.[nodeId] || {
    nodeId,
    version: snapshot.schemaVersion || 1,
    sections: [],
    updatedAt: snapshot.createdAt,
  };

  const transformedCanvas = transformCanvasAst(rawCanvas);
  const chartDatasets = gatherIndicatorDatasets(nodeId, options?.chartDatasets);
  const sourceMetadata = gatherSourceMetadata(nodeId, options?.sourceMetadata);

  const payload: PublicNodePayload = {
    nodeId,
    snapshotId: snapshot.id,
    version: snapshot.schemaVersion || 1,
    updatedAt: snapshot.createdAt,
    canvas: transformedCanvas,
    chartDatasets,
    sourceMetadata,
  };

  // Validate contract schema
  PublicNodePayloadSchema.parse(payload);

  return payload;
}

/**
 * Compiles the PublicPortalManifestPayload pointing to the active published snapshot.
 */
export function compilePortalManifest(
  snapshot: PublishedSnapshot,
  nodeIds?: string[]
): PublicPortalManifestPayload {
  const activeNodeIds = nodeIds && nodeIds.length > 0
    ? nodeIds
    : (snapshot.canvases && Object.keys(snapshot.canvases).length > 0
      ? Object.keys(snapshot.canvases)
      : [...VALID_NODES]);

  const manifest: PublicPortalManifestPayload = {
    activeSnapshotId: snapshot.id,
    publishedAt: snapshot.createdAt,
    nodeIds: activeNodeIds,
    schemaVersion: snapshot.schemaVersion || 1,
  };

  // Validate contract schema
  PublicPortalManifestPayloadSchema.parse(manifest);

  return manifest;
}

/**
 * Dispatches bulk key-value pairs to Cloudflare KV REST API.
 * In offline dev environments or when credentials are not configured,
 * logs a friendly warning and returns cleanly without throwing.
 */
export async function deployPayloadsToCloudflareKV(
  payloads: KVPairPayload[],
  credentials?: CloudflareKVCredentials
): Promise<KVDeployResult> {
  const accountId =
    credentials?.accountId ||
    getSafeEnv('CLOUDFLARE_ACCOUNT_ID') ||
    getSafeEnv('CF_ACCOUNT_ID');

  const namespaceId =
    credentials?.namespaceId ||
    getSafeEnv('CLOUDFLARE_KV_NAMESPACE_ID') ||
    getSafeEnv('CF_KV_NAMESPACE_ID') ||
    getSafeEnv('KV_ENGINE_PUBLIC_ID') || getSafeEnv('KV_PUBLIC_ID');

  const apiToken =
    credentials?.apiToken ||
    getSafeEnv('CLOUDFLARE_API_TOKEN') ||
    getSafeEnv('CF_API_TOKEN');

  // Graceful Local Fallback: If credentials are not present, do not fail publish
  if (!accountId || !namespaceId || !apiToken) {
    const missing = [
      !accountId && 'account ID',
      !namespaceId && 'KV namespace ID',
      !apiToken && 'API token',
    ].filter(Boolean).join(', ');

    return {
      success: true,
      deployedCount: 0,
      warning: `Cloudflare KV credentials (${missing}) not configured. Skipped remote edge deployment (local fallback mode).`,
    };
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`;

  try {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloads),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[edgePreBakeService] Cloudflare KV bulk API returned HTTP ${res.status}:`, errText);
      return {
        success: false,
        deployedCount: 0,
        error: `Cloudflare KV upload returned HTTP ${res.status}: ${errText}`,
      };
    }

    return {
      success: true,
      deployedCount: payloads.length,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error during Cloudflare KV bulk deployment';
    console.warn('[edgePreBakeService] Cloudflare KV bulk dispatch failure:', msg);
    return {
      success: false,
      deployedCount: 0,
      error: msg,
    };
  }
}

/**
 * Top-level Orchestrator: Pre-bakes all 5 nodes and manifest,
 * deploying atomically to Cloudflare KV.
 */
export async function compileAndDeployToEdgeKV(
  snapshot: PublishedSnapshot,
  options?: PreBakeCompileOptions
): Promise<PreBakeResult> {
  const kvPayloads: KVPairPayload[] = [];
  const transformedNodes: string[] = [];

  const targetNodes = options?.nodeIds && options.nodeIds.length > 0
    ? options.nodeIds
    : (snapshot.canvases && Object.keys(snapshot.canvases).length > 0
      ? Object.keys(snapshot.canvases)
      : [...VALID_NODES]);

  // 1. Compile Nodes
  for (const nodeId of targetNodes) {
    const nodePayload = compilePublicNodePayload(nodeId, snapshot, options);
    const serializedNode = JSON.stringify(nodePayload);

    kvPayloads.push({
      key: `node:${nodeId}`,
      value: serializedNode,
    });
    transformedNodes.push(nodeId);

    // 2. Also register individual chart datasets in KV for /api/public/chart/:chartId acceleration
    for (const [chartId, chartDataset] of Object.entries(nodePayload.chartDatasets)) {
      kvPayloads.push({
        key: `chart:${chartId}`,
        value: JSON.stringify(chartDataset),
      });
    }
  }

  // 3. Compile Manifest
  const manifestPayload = compilePortalManifest(snapshot, targetNodes);
  kvPayloads.push({
    key: 'portal:manifest',
    value: JSON.stringify(manifestPayload),
  });

  // 4. Deploy to Cloudflare KV
  const deployResult = await deployPayloadsToCloudflareKV(kvPayloads, options?.credentials);

  return {
    success: deployResult.success,
    snapshotId: snapshot.id,
    transformedNodes,
    totalKvKeys: kvPayloads.length,
    deployResult,
  };
}
