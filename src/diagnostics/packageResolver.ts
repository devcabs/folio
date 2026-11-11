/**
 * Folio Engine — Monorepo-Safe Package & Content Path Resolution
 * Location: src/diagnostics/packageResolver.ts
 *
 * Resolves the consumer's installed `@devcabs/folio-engine` package, the
 * consumer's own `package.json`, and known consumer content files without
 * brittle relative-path assumptions. All filesystem and module-resolution
 * operations degrade gracefully and never throw.
 */

import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENGINE_PACKAGE_NAME = '@devcabs/folio-engine';
const ENGINE_PACKAGE_JSON_SPECIFIER = '@devcabs/folio-engine/package.json';

const CONSUMER_CONTENT_CANDIDATES = [
  'sample-nodes.json',
  'src/engine-setup.ts',
  'engine-setup.ts',
  'src/folio/engine-setup.ts',
] as const;

export interface InstalledEngineInfo {
  version: string;
  pkgPath: string;
}

export interface ConsumerPackageInfo {
  version: string;
  name: string;
  path: string;
}

/**
 * Safely reads and parses a JSON file as a plain record.
 * Returns null on missing files, permissions errors, or invalid JSON.
 */
function readPackageJsonSafe(pkgPath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(pkgPath)) return null;
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Walks up from `startDir` checking for `node_modules/@devcabs/folio-engine/package.json`.
 * Used when Node package `exports` blocks direct subpath access to `./package.json`.
 */
function findEnginePackageJsonInNodeModules(startDir: string): string | null {
  let currentDir = path.resolve(startDir);

  while (true) {
    const candidate = path.join(
      currentDir,
      'node_modules',
      '@devcabs',
      'folio-engine',
      'package.json'
    );
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore inaccessible directories and keep walking.
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

/**
 * Walks up from a resolved module entrypoint to locate its enclosing `@devcabs/folio-engine` package.json.
 */
function findEnginePackageJsonFromEntry(entryPath: string): string | null {
  let currentDir = path.dirname(path.resolve(entryPath));

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(currentDir, 'package.json');
    const parsed = readPackageJsonSafe(candidate);
    if (parsed && parsed.name === ENGINE_PACKAGE_NAME) {
      return candidate;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return null;
}

/**
 * Obtains a `require.resolve`-compatible function anchored at `cwd`.
 */
function getRequireResolve(cwd: string): RequireResolve | null {
  try {
    if (typeof createRequire === 'function') {
      const anchor = path.join(path.resolve(cwd), '__folio_package_resolver__.cjs');
      return createRequire(anchor).resolve;
    }
  } catch {
    // Fall through to global require check.
  }

  if (typeof require === 'function' && typeof require.resolve === 'function') {
    return require.resolve;
  }

  return null;
}

/**
 * Resolves the filesystem path to the installed `@devcabs/folio-engine/package.json`
 * starting from `cwd`, supporting CJS, ESM, hoisted monorepos, and restricted `exports`.
 */
function resolveEnginePackageJsonPath(cwd: string): string | null {
  const resolvedCwd = path.resolve(cwd);
  const resolveFn = getRequireResolve(resolvedCwd);

  if (resolveFn) {
    try {
      return resolveFn(ENGINE_PACKAGE_JSON_SPECIFIER, { paths: [resolvedCwd] });
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string }).code
          : undefined;

      // When the installed engine's "exports" map omits "./package.json",
      // Node throws ERR_PACKAGE_PATH_NOT_EXPORTED even though the package exists.
      if (code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
        const nodeModulesMatch = findEnginePackageJsonInNodeModules(resolvedCwd);
        if (nodeModulesMatch) {
          return nodeModulesMatch;
        }

        // Support PnP or NODE_PATH installs via main entrypoint resolution.
        try {
          const entryPath = resolveFn(ENGINE_PACKAGE_NAME, { paths: [resolvedCwd] });
          const fromEntry = findEnginePackageJsonFromEntry(entryPath);
          if (fromEntry && path.dirname(fromEntry) !== resolvedCwd) {
            return fromEntry;
          }
        } catch {
          return null;
        }
      }

      return null;
    }
  }

  // Fallback for pure ESM contexts where createRequire/require is unavailable.
  try {
    if (typeof import.meta !== 'undefined' && typeof import.meta.resolve === 'function') {
      const resolvedUrl = import.meta.resolve(ENGINE_PACKAGE_JSON_SPECIFIER);
      return resolvedUrl.startsWith('file://') ? fileURLToPath(resolvedUrl) : resolvedUrl;
    }
  } catch {
    // Ignore resolution failures and fall back to node_modules walk.
  }

  return findEnginePackageJsonInNodeModules(resolvedCwd);
}

/**
 * Resolves the consumer's installed `@devcabs/folio-engine` version and `package.json` path.
 * Never throws; returns `null` when the package cannot be resolved or parsed.
 */
export function resolveInstalledEngineVersion(
  cwd: string = process.cwd()
): InstalledEngineInfo | null {
  try {
    const pkgPath = resolveEnginePackageJsonPath(cwd);
    if (!pkgPath) return null;

    const parsed = readPackageJsonSafe(pkgPath);
    if (!parsed || typeof parsed.version !== 'string' || parsed.version.trim().length === 0) {
      return null;
    }

    return {
      version: parsed.version,
      pkgPath,
    };
  } catch {
    return null;
  }
}

/**
 * Walks up from `cwd` to find the nearest consumer `package.json` where
 * `name !== '@devcabs/folio-engine'`. Stops at `.git` root or filesystem root (`/`).
 * Never throws; returns `null` when no suitable `package.json` is found.
 */
export function resolveConsumerPackageJson(
  cwd: string = process.cwd()
): ConsumerPackageInfo | null {
  try {
    let currentDir = path.resolve(cwd);

    while (true) {
      const pkgPath = path.join(currentDir, 'package.json');
      const parsed = readPackageJsonSafe(pkgPath);

      if (parsed && parsed.name !== ENGINE_PACKAGE_NAME) {
        return {
          name: typeof parsed.name === 'string' ? parsed.name : '',
          version: typeof parsed.version === 'string' ? parsed.version : '',
          path: pkgPath,
        };
      }

      // Stop at git repository root (supports both .git directories and worktree .git files).
      try {
        if (fs.existsSync(path.join(currentDir, '.git'))) {
          return null;
        }
      } catch {
        return null;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        return null;
      }
      currentDir = parentDir;
    }
  } catch {
    return null;
  }
}

/**
 * Checks known consumer content/setup file locations under `consumerRoot`
 * and returns only the paths that exist. Never throws.
 */
export function resolveContentFiles(consumerRoot: string): string[] {
  if (!consumerRoot || typeof consumerRoot !== 'string') {
    return [];
  }

  const existing: string[] = [];

  for (const relativeCandidate of CONSUMER_CONTENT_CANDIDATES) {
    try {
      const fullPath = path.join(consumerRoot, relativeCandidate);
      if (fs.existsSync(fullPath)) {
        existing.push(fullPath);
      }
    } catch {
      // Degrade gracefully on inaccessible paths.
    }
  }

  return existing;
}
