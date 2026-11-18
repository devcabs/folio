/**
 * Folio Engine — Edge Delegation & Anti-Duplication Auditor
 * Location: src/diagnostics/edgeDelegation.ts
 *
 * Scans consumer repositories to detect duplicated edge route logic,
 * shadow utility files, and missing worker delegation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DiagnosticResult } from './verifyEngineSetup';

export interface EdgeDelegationOptions {
  cwd?: string;
  workerPath?: string;
  isEngineSelfTest?: boolean;
}

export interface EdgeDelegationResult extends DiagnosticResult {
  duplicateFiles: string[];
  workerFound: boolean;
  isDelegated: boolean;
  workerFile: string | null;
}

const DUPLICATE_FILE_TARGETS = [
  'functions/api/publish.ts',
  'functions/api/publish.js',
  'functions/api/public/manifest.ts',
  'functions/api/public/manifest.js',
  'functions/api/public/node/[nodeId].ts',
  'functions/api/public/node/[nodeId].js',
  'functions/api/public/chart/[chartId].ts',
  'functions/api/public/chart/[chartId].js',
  'functions/api/media/drive/[fileId].ts',
  'functions/api/media/drive/[fileId].js',
  'src/utils/mediaUrl.ts',
  'src/utils/mediaUrl.js',
  'src/types/edge.ts',
];

const WORKER_CANDIDATE_PATHS = [
  'worker.ts',
  'worker.js',
  'src/worker.ts',
  'src/worker.js',
];

/**
 * Checks whether a given directory is the Folio Engine repository itself.
 */
function isFolioEngineRepository(rootDir: string): boolean {
  try {
    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed.name === '@devcabs/folio-engine';
    }
  } catch {
    // Ignore parse errors
  }
  return false;
}

/**
 * Audits a repository for duplicated edge route files and verifies worker delegation.
 */
export function verifyEdgeDelegation(
  options: EdgeDelegationOptions = {}
): EdgeDelegationResult {
  const cwd = path.resolve(options.cwd || process.cwd());
  const errors: string[] = [];
  const warnings: string[] = [];
  const duplicateFiles: string[] = [];

  // If this is Folio Engine repository itself and not an explicit self-test, skip consumer checks
  if (!options.isEngineSelfTest && isFolioEngineRepository(cwd)) {
    return {
      ok: true,
      errors: [],
      warnings: [],
      duplicateFiles: [],
      workerFound: false,
      isDelegated: true,
      workerFile: null,
    };
  }

  // 1. Scan for duplicated edge files
  for (const relPath of DUPLICATE_FILE_TARGETS) {
    const fullPath = path.join(cwd, relPath);
    if (fs.existsSync(fullPath)) {
      duplicateFiles.push(relPath);
      errors.push(
        `[Edge Duplication] Detected duplicate edge file "${relPath}". Consumer applications must not maintain local edge logic. Delete this file and delegate to @devcabs/folio-engine/edge.`
      );
    }
  }

  // Check functions/api directory if populated
  const functionsApiDir = path.join(cwd, 'functions', 'api');
  if (fs.existsSync(functionsApiDir) && duplicateFiles.length === 0) {
    warnings.push(
      `[Edge Duplication] "functions/api" directory detected in consumer repo. Ensure all routes are delegated to @devcabs/folio-engine/edge.`
    );
  }

  // 2. Audit Cloudflare Worker delegation
  let workerFile: string | null = null;
  let isDelegated = false;

  const candidateWorkerPaths = options.workerPath
    ? [options.workerPath]
    : WORKER_CANDIDATE_PATHS;

  for (const candidate of candidateWorkerPaths) {
    const fullPath = path.isAbsolute(candidate) ? candidate : path.join(cwd, candidate);
    if (fs.existsSync(fullPath)) {
      workerFile = path.relative(cwd, fullPath) || candidate;
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const importsEdge =
          content.includes('@devcabs/folio-engine/edge') ||
          content.includes('@devcabs/folio-engine');
        const callsRouter =
          content.includes('handleFolioEdgeRequest') ||
          content.includes('handlePublishRoute');

        if (importsEdge && callsRouter) {
          isDelegated = true;
        } else {
          errors.push(
            `[Edge Router] "${workerFile}" does not delegate to handleFolioEdgeRequest from @devcabs/folio-engine/edge.`
          );
        }
      } catch {
        warnings.push(`[Edge Router] Could not read worker file at "${workerFile}".`);
      }
      break;
    }
  }

  const workerFound = workerFile !== null;

  // If wrangler config exists, audit worker presence and required Edge KV / security vars
  const wranglerJsonPath = path.join(cwd, 'wrangler.json');
  const wranglerTomlPath = path.join(cwd, 'wrangler.toml');
  const activeWranglerPath = fs.existsSync(wranglerJsonPath)
    ? wranglerJsonPath
    : fs.existsSync(wranglerTomlPath)
      ? wranglerTomlPath
      : null;

  if (activeWranglerPath) {
    if (!workerFound) {
      warnings.push(
        `[Edge Router] wrangler configuration detected but no worker.ts found. Ensure host app exports a worker delegating to handleFolioEdgeRequest.`
      );
    } else {
      try {
        const wranglerRaw = fs.readFileSync(activeWranglerPath, 'utf-8');
        const wranglerFile = path.basename(activeWranglerPath);
        if (!wranglerRaw.includes('KV_ENGINE_PUBLIC')) {
          warnings.push(
            `[Edge KV] "${wranglerFile}" does not reference KV_ENGINE_PUBLIC. Bind KV_ENGINE_PUBLIC so edge handlers do not return HTTP 503.`
          );
        }
        if (
          !wranglerRaw.includes('DEV_SECURITY_SALT') ||
          !wranglerRaw.includes('DEV_PIN_HASH')
        ) {
          warnings.push(
            `[Edge Security] "${wranglerFile}" is missing DEV_SECURITY_SALT or DEV_PIN_HASH in vars. Configure both so POST /api/lock does not return HTTP 503.`
          );
        }
      } catch {
        // Ignore unreadable wrangler config
      }
    }
  }

  const ok = errors.length === 0;

  return {
    ok,
    errors,
    warnings,
    duplicateFiles,
    workerFound,
    isDelegated,
    workerFile,
  };
}
