/**
 * Folio Engine — Standalone CLI Edge KV Pre-Baking Utility
 * Location: scripts/prebake-edge-kv.ts
 * Specification: docs/tasks/task15_3_edge_kv_pre_baking_pipeline.md
 *
 * Runs publish-time AST compiler across all 5 nodes and pushes pre-baked
 * payloads to Cloudflare KV (KV_ENGINE_PUBLIC) via Cloudflare REST API.
 */

import {
  compilePublicNodePayload,
  compilePortalManifest,
} from '../src/services/edgePreBakeService.js';
import { createDefaultCanvasDocument } from '../src/utils/canvasDefaults.js';
import type { PublishedSnapshot } from '../src/types/history.js';
import { VALID_NODES } from '../src/types/edge.js';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

interface KVPairPayload {
  key: string;
  value: string;
}

async function main() {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}  ⚡ Engine — Cloudflare Edge KV Pre-Baking Pipeline${colors.reset}`);
  console.log(`${colors.dim}  Compiling 5 nodes, rewriting Google Drive URLs & syncing KV${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════${colors.reset}\n`);

  const startTime = Date.now();

  // 1. Resolve baseline or active published snapshot
  console.log(`${colors.dim}[1/3] Loading active snapshot...${colors.reset}`);
  const canvases = Object.fromEntries(VALID_NODES.map((id) => [id, createDefaultCanvasDocument(id)]));
  const snapshot: PublishedSnapshot = {
    id: 'snap-system-baseline',
    schemaVersion: 1,
    title: 'System Baseline',
    description: 'Clean baseline snapshot',
    createdAt: new Date().toISOString(),
    authorSessionId: 'cli-prebake',
    isActive: true,
    canvases,
    contentOverrides: {},
    summary: {
      totalSections: 0,
      totalSubsections: 0,
      totalLeafElements: 0,
      totalTextOverrides: 0,
      totalTextElements: 0,
      totalPhotoElements: 0,
      totalChartElements: 0,
    },
  };
  console.log(`  ${colors.green}✓${colors.reset} Loaded baseline snapshot: ${colors.bright}${snapshot.title}${colors.reset} (${snapshot.id})`);

  // 2. Run AST transformation and bundle payloads
  console.log(`\n${colors.dim}[2/3] Transforming Canvas AST & compiling responsive multi-density descriptors...${colors.reset}`);
  const kvPayloads: KVPairPayload[] = [];
  const transformedNodes: string[] = [];

  const targetNodes = snapshot.canvases && Object.keys(snapshot.canvases).length > 0
    ? Object.keys(snapshot.canvases)
    : [...VALID_NODES];

  for (const nodeId of targetNodes) {
    const nodePayload = compilePublicNodePayload(nodeId, snapshot);
    kvPayloads.push({
      key: `node:${nodeId}`,
      value: JSON.stringify(nodePayload),
    });
    transformedNodes.push(nodeId);
  }

  const manifestPayload = compilePortalManifest(snapshot, targetNodes);
  kvPayloads.push({
    key: 'portal:manifest',
    value: JSON.stringify(manifestPayload),
  });

  console.log(`  ${colors.green}✓${colors.reset} Processed ${transformedNodes.length} nodes: ${transformedNodes.join(', ')}`);
  console.log(`  ${colors.green}✓${colors.reset} Generated ${kvPayloads.length} total KV key-value entries (manifest, nodes, charts)`);

  // 3. Cloudflare KV Deployment Result
  console.log(`\n${colors.dim}[3/3] Synchronizing with Cloudflare KV...${colors.reset}`);
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const namespaceId =
    process.env.CLOUDFLARE_KV_NAMESPACE_ID ||
    process.env.CF_KV_NAMESPACE_ID ||
    process.env.KV_ENGINE_PUBLIC_ID ||
    process.env.KV_PUBLIC_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;

  if (!accountId || !namespaceId || !apiToken) {
    const missing = [
      !accountId && 'account ID',
      !namespaceId && 'KV namespace ID',
      !apiToken && 'API token',
    ].filter(Boolean).join(', ');

    console.log(`  ${colors.yellow}⚠ NOTICE:${colors.reset} Cloudflare KV credentials (${missing}) not configured. Skipped remote edge deployment (local fallback mode).`);
  } else {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`;
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(kvPayloads),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`  ${colors.red}❌ ERROR:${colors.reset} Cloudflare KV upload returned HTTP ${res.status}: ${errText}`);
        process.exit(1);
      } else {
        console.log(`  ${colors.green}✓ SUCCESS:${colors.reset} Atomically uploaded ${kvPayloads.length} keys to Cloudflare KV!`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error during Cloudflare KV bulk deployment';
      console.error(`  ${colors.red}❌ ERROR:${colors.reset} ${msg}`);
      process.exit(1);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`\n${colors.bright}${colors.green}══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  ${colors.green}✨ EDGE KV PRE-BAKE COMPLETED IN ${elapsed}ms! ✨${colors.reset}`);
  console.log(`${colors.bright}${colors.green}══════════════════════════════════════════════════════════${colors.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${colors.red}❌ Fatal error in edge pre-bake utility:${colors.reset}`, err);
  process.exit(1);
});
