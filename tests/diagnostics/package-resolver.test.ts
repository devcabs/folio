import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  resolveInstalledEngineVersion,
  resolveConsumerPackageJson,
  resolveContentFiles,
} from '../../src/diagnostics/packageResolver';
import { runMigrationDoctor } from '../../src/diagnostics/migrationDoctor';

const REPO_ROOT = path.resolve(__dirname, '../..');
const DOCTOR_SCRIPT = path.join(REPO_ROOT, 'src/diagnostics/migrationDoctor.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules/.bin/tsx');

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

describe('packageResolver (Monorepo-Safe Package Resolution)', () => {
  let tempDirs: string[] = [];

  function createTempDir(prefix = 'folio-pkg-resolver-'): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  beforeEach(() => {
    tempDirs = [];
  });

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe('resolveInstalledEngineVersion', () => {
    it('resolves @devcabs/folio-engine installed directly in cwd node_modules', () => {
      const appDir = createTempDir();
      const enginePkgPath = path.join(
        appDir,
        'node_modules/@devcabs/folio-engine/package.json'
      );
      writeJson(enginePkgPath, {
        name: '@devcabs/folio-engine',
        version: '0.1.3',
      });

      const result = resolveInstalledEngineVersion(appDir);
      expect(result).not.toBeNull();
      expect(result?.version).toBe('0.1.3');
      expect(fs.realpathSync(result!.pkgPath)).toBe(fs.realpathSync(enginePkgPath));
    });

    it('resolves hoisted @devcabs/folio-engine from a monorepo workspace subdirectory', () => {
      const monorepoRoot = createTempDir();
      const workspaceApp = path.join(monorepoRoot, 'apps/web');
      fs.mkdirSync(workspaceApp, { recursive: true });
      fs.mkdirSync(path.join(monorepoRoot, '.git'), { recursive: true });

      const hoistedEnginePkg = path.join(
        monorepoRoot,
        'node_modules/@devcabs/folio-engine/package.json'
      );
      writeJson(monorepoRoot + '/package.json', { name: 'monorepo-root', version: '1.0.0' });
      writeJson(workspaceApp + '/package.json', { name: 'web-app', version: '2.0.0' });
      writeJson(hoistedEnginePkg, {
        name: '@devcabs/folio-engine',
        version: '0.1.3',
        exports: {
          '.': { import: './dist/folio.js', require: './dist/folio.cjs' },
          './diagnostics': { import: './dist/diagnostics.js', require: './dist/diagnostics.cjs' },
        },
      });

      const result = resolveInstalledEngineVersion(workspaceApp);
      expect(result).not.toBeNull();
      expect(result?.version).toBe('0.1.3');
      expect(fs.realpathSync(result!.pkgPath)).toBe(fs.realpathSync(hoistedEnginePkg));
    });

    it('prefers workspace-local engine version over hoisted root engine version', () => {
      const monorepoRoot = createTempDir();
      const workspaceApp = path.join(monorepoRoot, 'apps/web');
      fs.mkdirSync(workspaceApp, { recursive: true });

      writeJson(
        path.join(monorepoRoot, 'node_modules/@devcabs/folio-engine/package.json'),
        { name: '@devcabs/folio-engine', version: '0.1.1' }
      );
      const localEnginePkg = path.join(
        workspaceApp,
        'node_modules/@devcabs/folio-engine/package.json'
      );
      writeJson(localEnginePkg, {
        name: '@devcabs/folio-engine',
        version: '0.1.3',
        exports: {
          '.': { import: './dist/folio.js' },
        },
      });

      const result = resolveInstalledEngineVersion(workspaceApp);
      expect(result).not.toBeNull();
      expect(result?.version).toBe('0.1.3');
      expect(fs.realpathSync(result!.pkgPath)).toBe(fs.realpathSync(localEnginePkg));
    });

    it('returns null and does not throw when @devcabs/folio-engine is not installed', () => {
      const emptyDir = createTempDir();
      expect(() => resolveInstalledEngineVersion(emptyDir)).not.toThrow();
      expect(resolveInstalledEngineVersion(emptyDir)).toBeNull();
    });

    it('returns null and does not throw when engine package.json is malformed or lacks version', () => {
      const appDir = createTempDir();
      const enginePkgPath = path.join(
        appDir,
        'node_modules/@devcabs/folio-engine/package.json'
      );
      fs.mkdirSync(path.dirname(enginePkgPath), { recursive: true });
      fs.writeFileSync(enginePkgPath, '{ invalid json', 'utf-8');
      expect(resolveInstalledEngineVersion(appDir)).toBeNull();

      writeJson(enginePkgPath, { name: '@devcabs/folio-engine' });
      expect(resolveInstalledEngineVersion(appDir)).toBeNull();
    });

    it('returns null and does not throw for nonexistent directories', () => {
      expect(() => resolveInstalledEngineVersion('/some/nonexistent/path')).not.toThrow();
      expect(resolveInstalledEngineVersion('/some/nonexistent/path')).toBeNull();
    });
  });

  describe('resolveConsumerPackageJson', () => {
    it('finds the nearest consumer package.json walking up from nested subdirectories', () => {
      const repoRoot = createTempDir();
      fs.mkdirSync(path.join(repoRoot, '.git'), { recursive: true });
      const appDir = path.join(repoRoot, 'apps/portfolio');
      const nestedDir = path.join(appDir, 'src/components');
      fs.mkdirSync(nestedDir, { recursive: true });

      writeJson(path.join(repoRoot, 'package.json'), { name: 'workspace-root', version: '0.0.1' });
      const appPkgPath = path.join(appDir, 'package.json');
      writeJson(appPkgPath, { name: 'my-portfolio', version: '1.4.0' });

      const result = resolveConsumerPackageJson(nestedDir);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('my-portfolio');
      expect(result?.version).toBe('1.4.0');
      expect(fs.realpathSync(result!.path)).toBe(fs.realpathSync(appPkgPath));
    });

    it('does not return the engine own package.json (name guard)', () => {
      const engineDir = createTempDir();
      fs.mkdirSync(path.join(engineDir, '.git'), { recursive: true });
      const subDir = path.join(engineDir, 'src/diagnostics');
      fs.mkdirSync(subDir, { recursive: true });

      writeJson(path.join(engineDir, 'package.json'), {
        name: '@devcabs/folio-engine',
        version: '0.1.3',
      });

      const result = resolveConsumerPackageJson(subDir);
      expect(result).toBeNull();
    });

    it('stops at .git root and does not read ancestor package.json outside the repo', () => {
      const outerDir = createTempDir();
      writeJson(path.join(outerDir, 'package.json'), {
        name: 'outer-unrelated-pkg',
        version: '9.9.9',
      });

      const repoRoot = path.join(outerDir, 'project');
      fs.mkdirSync(path.join(repoRoot, '.git'), { recursive: true });
      const nestedDir = path.join(repoRoot, 'src');
      fs.mkdirSync(nestedDir, { recursive: true });

      const result = resolveConsumerPackageJson(nestedDir);
      expect(result).toBeNull();
    });

    it('handles malformed JSON gracefully without throwing', () => {
      const dir = createTempDir();
      fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), '{ bad json', 'utf-8');

      expect(() => resolveConsumerPackageJson(dir)).not.toThrow();
      expect(resolveConsumerPackageJson(dir)).toBeNull();
    });
  });

  describe('resolveContentFiles', () => {
    it('returns [] and does not throw for nonexistent path', () => {
      expect(() => resolveContentFiles('/some/nonexistent/path')).not.toThrow();
      expect(resolveContentFiles('/some/nonexistent/path')).toEqual([]);
    });

    it('returns only known consumer content files that exist', () => {
      const consumerRoot = createTempDir();
      const sampleNodes = path.join(consumerRoot, 'sample-nodes.json');
      const folioSetup = path.join(consumerRoot, 'src/folio/engine-setup.ts');
      const unrelated = path.join(consumerRoot, 'src/other.ts');

      writeJson(sampleNodes, []);
      fs.mkdirSync(path.dirname(folioSetup), { recursive: true });
      fs.writeFileSync(folioSetup, 'export {};', 'utf-8');
      fs.writeFileSync(unrelated, 'export {};', 'utf-8');

      const found = resolveContentFiles(consumerRoot);
      expect(found).toEqual([sampleNodes, folioSetup]);
    });
  });

  describe('migrationDoctor (pre-wired resolution)', () => {
    it('prints warning and returns exit code 0 when @devcabs/folio-engine is not installed', () => {
      const emptyDir = createTempDir();
      const logs: string[] = [];

      const exitCode = runMigrationDoctor({
        cwd: emptyDir,
        log: (msg) => logs.push(msg),
      });

      expect(exitCode).toBe(0);
      const output = logs.join('\n');
      expect(output).toContain('Could not resolve @devcabs/folio-engine installation.');
      expect(output).toContain('Run from within a project that has @devcabs/folio-engine installed.');
    });

    it('prints warning and continues with reduced diagnostics when consumer package.json is missing', () => {
      const dir = createTempDir();
      fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
      writeJson(
        path.join(dir, 'node_modules/@devcabs/folio-engine/package.json'),
        { name: '@devcabs/folio-engine', version: '0.1.3' }
      );
      const logs: string[] = [];

      const exitCode = runMigrationDoctor({
        cwd: dir,
        log: (msg) => logs.push(msg),
      });

      expect(exitCode).toBe(0);
      const output = logs.join('\n');
      expect(output).toContain('0.1.3');
      expect(output.toLowerCase()).toContain('reduced diagnostics');
    });

    it('CLI execution in empty directory prints warning and exits with code 0', () => {
      const emptyDir = createTempDir();
      const result = spawnSync(TSX_BIN, [DOCTOR_SCRIPT], {
        cwd: emptyDir,
        encoding: 'utf-8',
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Could not resolve @devcabs/folio-engine installation.');
      expect(result.stdout).toContain('Run from within a project that has @devcabs/folio-engine installed.');
    });

    it('CLI execution in monorepo workspace subdirectory resolves workspace engine version', () => {
      const monorepoRoot = createTempDir();
      const workspaceApp = path.join(monorepoRoot, 'apps/web');
      fs.mkdirSync(path.join(monorepoRoot, '.git'), { recursive: true });
      fs.mkdirSync(workspaceApp, { recursive: true });

      writeJson(path.join(monorepoRoot, 'package.json'), {
        name: 'monorepo-root',
        version: '9.0.0',
      });
      writeJson(
        path.join(monorepoRoot, 'node_modules/@devcabs/folio-engine/package.json'),
        { name: '@devcabs/folio-engine', version: '0.1.1' }
      );
      writeJson(path.join(workspaceApp, 'package.json'), {
        name: 'consumer-web',
        version: '1.2.0',
      });
      writeJson(
        path.join(workspaceApp, 'node_modules/@devcabs/folio-engine/package.json'),
        { name: '@devcabs/folio-engine', version: '0.1.3' }
      );

      const stdout = execFileSync(TSX_BIN, [DOCTOR_SCRIPT], {
        cwd: workspaceApp,
        encoding: 'utf-8',
      });

      expect(stdout).toContain('0.1.3');
      expect(stdout).toContain('consumer-web');
      expect(stdout).not.toContain('9.0.0');
    });
  });
});

