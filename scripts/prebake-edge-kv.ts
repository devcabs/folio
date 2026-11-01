/**
 * Folio Engine — Standalone CLI Edge KV Pre-Baking Utility
 * Location: scripts/prebake-edge-kv.ts
 * Specification: docs/tasks/task15_3_edge_kv_pre_baking_pipeline.md
 *
 * Runs publish-time AST compiler across all 5 nodes and pushes pre-baked
 * payloads to Cloudflare KV (KV_ENGINE_PUBLIC) via Cloudflare REST API.
 */

import { compileAndDeployToEdgeKV } from '../src/services/edgePreBakeService.js';
import { getDefaultSystemBaselineSnapshot } from '../src/services/historyService.js';

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

async function main() {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}  ⚡ Engine — Cloudflare Edge KV Pre-Baking Pipeline${colors.reset}`);
  console.log(`${colors.dim}  Compiling 5 nodes, rewriting Google Drive URLs & syncing KV${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════${colors.reset}\n`);

  const startTime = Date.now();

  // 1. Resolve baseline or active published snapshot
  console.log(`${colors.dim}[1/3] Loading active snapshot...${colors.reset}`);
  const snapshot = getDefaultSystemBaselineSnapshot(true);
  console.log(`  ${colors.green}✓${colors.reset} Loaded baseline snapshot: ${colors.bright}${snapshot.title}${colors.reset} (${snapshot.id})`);

  // 2. Run AST transformation and bundle payloads
  console.log(`\n${colors.dim}[2/3] Transforming Canvas AST & compiling responsive multi-density descriptors...${colors.reset}`);
  const result = await compileAndDeployToEdgeKV(snapshot);

  console.log(`  ${colors.green}✓${colors.reset} Processed ${result.transformedNodes.length} nodes: ${result.transformedNodes.join(', ')}`);
  console.log(`  ${colors.green}✓${colors.reset} Generated ${result.totalKvKeys} total KV key-value entries (manifest, nodes, charts)`);

  // 3. Cloudflare KV Deployment Result
  console.log(`\n${colors.dim}[3/3] Synchronizing with Cloudflare KV...${colors.reset}`);
  if (result.deployResult.deployedCount > 0) {
    console.log(`  ${colors.green}✓ SUCCESS:${colors.reset} Atomically uploaded ${result.deployResult.deployedCount} keys to Cloudflare KV!`);
  } else if (result.deployResult.warning) {
    console.log(`  ${colors.yellow}⚠ NOTICE:${colors.reset} ${result.deployResult.warning}`);
  } else if (result.deployResult.error) {
    console.error(`  ${colors.red}❌ ERROR:${colors.reset} ${result.deployResult.error}`);
    process.exit(1);
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
