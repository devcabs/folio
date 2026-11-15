import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { verifyEdgeDelegation } from '../../src/diagnostics/edgeDelegation';

describe('Edge Delegation & Anti-Duplication Auditor (src/diagnostics/edgeDelegation.ts)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-edge-delegation-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('passes cleanly for the Folio Engine repository itself', () => {
    // Engine repository contains package.json with name: "@devcabs/folio-engine"
    const result = verifyEdgeDelegation({ cwd: process.cwd() });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects duplicate edge files in a consumer repository', () => {
    // Mock consumer package.json
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'consumer-masid-app', version: '1.0.0' })
    );

    // Create duplicate edge file
    const pubDir = path.join(tempDir, 'functions', 'api');
    fs.mkdirSync(pubDir, { recursive: true });
    fs.writeFileSync(path.join(pubDir, 'publish.ts'), 'export const dummy = 1;');

    const utilsDir = path.join(tempDir, 'src', 'utils');
    fs.mkdirSync(utilsDir, { recursive: true });
    fs.writeFileSync(path.join(utilsDir, 'mediaUrl.ts'), 'export const dummy = 2;');

    const result = verifyEdgeDelegation({ cwd: tempDir, isEngineSelfTest: true });
    expect(result.ok).toBe(false);
    expect(result.duplicateFiles).toContain('functions/api/publish.ts');
    expect(result.duplicateFiles).toContain('src/utils/mediaUrl.ts');
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors[0]).toContain('Detected duplicate edge file');
  });

  it('detects a non-delegating worker.ts in consumer repository', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'consumer-masid-app', version: '1.0.0' })
    );

    // Custom 100-line worker that does not delegate
    fs.writeFileSync(
      path.join(tempDir, 'worker.ts'),
      `export default {
        fetch(req) {
          return new Response("custom un-delegated route");
        }
      };`
    );

    const result = verifyEdgeDelegation({ cwd: tempDir, isEngineSelfTest: true });
    expect(result.ok).toBe(false);
    expect(result.workerFound).toBe(true);
    expect(result.isDelegated).toBe(false);
    expect(result.errors.some((e) => e.includes('does not delegate to handleFolioEdgeRequest'))).toBe(true);
  });

  it('passes with ok: true when consumer worker delegates cleanly to @devcabs/folio-engine/edge', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'consumer-masid-app', version: '1.0.0' })
    );

    // Canonical 5-line worker
    fs.writeFileSync(
      path.join(tempDir, 'worker.ts'),
      `import { handleFolioEdgeRequest } from '@devcabs/folio-engine/edge';

export default {
  fetch(request: Request, env: any, ctx: any) {
    return handleFolioEdgeRequest(request, env, ctx);
  },
};`
    );

    const result = verifyEdgeDelegation({ cwd: tempDir, isEngineSelfTest: true });
    expect(result.ok).toBe(true);
    expect(result.workerFound).toBe(true);
    expect(result.isDelegated).toBe(true);
    expect(result.duplicateFiles).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('warns when wrangler.toml is present but worker.ts is missing', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'consumer-masid-app', version: '1.0.0' })
    );
    fs.writeFileSync(path.join(tempDir, 'wrangler.toml'), 'name = "masid-edge"');

    const result = verifyEdgeDelegation({ cwd: tempDir, isEngineSelfTest: true });
    expect(result.workerFound).toBe(false);
    expect(result.warnings.some((w) => w.includes('wrangler configuration detected but no worker.ts found'))).toBe(true);
  });
});
