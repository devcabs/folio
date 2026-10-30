/**
 * Folio Engine — Cloudflare Pages Functions & Edge KV Schema Contracts
 * Location: src/types/edge.ts
 * Specification: docs/tasks/task15_1_edge_routing_and_kv_schema_architecture.md
 */

import { z } from 'zod';
import type { NodeCanvasDocument } from './canvas';
import type { ChartDataset } from './chart';
import type { SyncedSourceItem } from './source';
import type { NodeCode } from './node';

export const VALID_NODES: readonly NodeCode[] = [
  'access',
  'equity',
  'quality',
  'resiliency',
  'governance',
] as const;

export type ValidNodeId = typeof VALID_NODES[number];

/**
 * Cloudflare KV Namespace Interface for Edge Bindings
 */
export interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }): Promise<string | null>;
  get<T>(key: string, type: 'json'): Promise<T | null>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: { expiration?: number; expirationTtl?: number; metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string; expiration?: number; metadata?: unknown }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

/**
 * Cloudflare Pages Functions Environment Bindings
 */
export interface EdgeEnv {
  KV_ENGINE_PUBLIC: KVNamespace;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  [key: string]: unknown;
}

/**
 * Cloudflare Pages Functions EventContext Contract
 */
export interface PagesFunctionEventContext<Env = EdgeEnv, P extends string = string, Data = unknown> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<unknown>) => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: Record<P, string | string[]>;
  data: Data;
}

/**
 * Cached Indicator Dataset (serialized tabular/D3 data stored in KV)
 */
export type CachedIndicatorDataset = ChartDataset;

/**
 * Synced Evidence Metadata
 */
export interface SyncedSourceMetadata {
  pointId: string;
  folderUrl?: string;
  folderTitle?: string;
  description?: string;
  lastSyncedAt?: string;
  items?: SyncedSourceItem[];
}

/**
 * Route Contract 1: GET /api/public/node/:nodeId
 */
export interface PublicNodePayload {
  nodeId: string;
  snapshotId: string;
  version: number;
  updatedAt: string;
  canvas: NodeCanvasDocument;
  chartDatasets: Record<string, CachedIndicatorDataset>;
  evidenceMetadata: Record<string, SyncedSourceMetadata>;
}

/**
 * Route Contract 2: GET /api/public/manifest
 */
export interface PublicPortalManifestPayload {
  activeSnapshotId: string;
  publishedAt: string;
  nodeIds: string[];
  schemaVersion: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schemas for Runtime Contract Validation
// ─────────────────────────────────────────────────────────────────────────────

export const PublicPortalManifestPayloadSchema = z.object({
  activeSnapshotId: z.string().min(1, 'activeSnapshotId is required'),
  publishedAt: z.string().min(1, 'publishedAt is required'),
  nodeIds: z.array(z.string()).min(1, 'nodeIds cannot be empty'),
  schemaVersion: z.number().int().positive(),
});

export const NodeCanvasDocumentSchema = z.object({
  nodeId: z.string(),
  version: z.number(),
  sections: z.array(z.any()),
  updatedAt: z.string(),
});

export const CachedIndicatorDatasetSchema = z.object({
  chartId: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  unit: z.string().optional(),
  asOfDate: z.string(),
  chartType: z.string(),
  sanitizedCsvContent: z.string().optional(),
}).passthrough();

export const SyncedSourceMetadataSchema = z.object({
  pointId: z.string(),
  folderUrl: z.string().optional(),
  folderTitle: z.string().optional(),
  description: z.string().optional(),
  lastSyncedAt: z.string().optional(),
  items: z.array(z.any()).optional(),
}).passthrough();

export const PublicNodePayloadSchema = z.object({
  nodeId: z.string().min(1, 'nodeId is required'),
  snapshotId: z.string().min(1, 'snapshotId is required'),
  version: z.number().int().nonnegative(),
  updatedAt: z.string().min(1, 'updatedAt is required'),
  canvas: NodeCanvasDocumentSchema,
  chartDatasets: z.record(z.string(), z.any()),
  evidenceMetadata: z.record(z.string(), z.any()),
});

/**
 * Computes a deterministic weak ETag for HTTP cache negotiation (304 Not Modified).
 * Fast, synchronous, zero-dependency, works identically in Workers, Node, and browser.
 */
export function computeWeakEtag(content: string): string {
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const len = content.length.toString(16);
  return `W/"${hex}-${len}"`;
}
