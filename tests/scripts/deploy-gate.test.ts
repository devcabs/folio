import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { verifyLedgerReleaseGate, runLedgerReleaseGate } from '../../scripts/deploy';

describe('deploy.ts Pre-Release Ledger Verification Gate', () => {
  let tempDir: string;
  let ledgerPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-deploy-gate-'));
    ledgerPath = path.join(tempDir, 'ledger.ts');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('blocks when src/migrations/ledger.ts does not exist', () => {
    const result = verifyLedgerReleaseGate({
      currentVersion: '0.1.3',
      bumpType: 'patch',
      ledgerPath,
    });

    expect(result.valid).toBe(false);
    expect(result.targetVersion).toBe('0.1.4');
    expect(result.reason).toBe('ledger-missing');
  });

  it('blocks when target version entry is missing and formats clear error output', () => {
    fs.writeFileSync(
      ledgerPath,
      `export const LEDGER = [{ version: '0.1.3', breakingChanges: ['none'], codeActions: [], contentChanges: [{ id: 'a' }] }];`,
      'utf-8'
    );

    const errors: string[] = [];
    const passed = runLedgerReleaseGate({
      currentVersion: '0.1.3',
      bumpType: 'patch',
      ledgerPath,
      writeError: (msg) => errors.push(msg),
    });

    expect(passed).toBe(false);
    const output = errors.join('\n');
    expect(output).toContain('❌ DEPLOY BLOCKED: Missing migration ledger entry for v0.1.4!');
    expect(output).toContain('breakingChanges');
    expect(output).toContain('codeActions');
    expect(output).toContain('contentChanges');
  });

  it('blocks when breakingChanges or contentChanges is empty', () => {
    fs.writeFileSync(
      ledgerPath,
      `export const LEDGER = [{
        version: '0.1.4',
        releaseDate: '2026-11-11',
        title: 'Test',
        summary: 'Test summary',
        breakingChanges: [],
        codeActions: [],
        contentChanges: [],
      }];`,
      'utf-8'
    );

    const result = verifyLedgerReleaseGate({
      currentVersion: '0.1.3',
      bumpType: 'patch',
      ledgerPath,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('incomplete-entry');
    expect(result.missingFields).toEqual(
      expect.arrayContaining([
        expect.stringContaining('breakingChanges'),
        expect.stringContaining('contentChanges'),
      ])
    );
  });

  it('correctly extracts entry bounds even with nested objects inside codeActions and contentChanges', () => {
    fs.writeFileSync(
      ledgerPath,
      `export const LEDGER = [
        {
          version: '0.1.4',
          releaseDate: '2026-11-11',
          title: 'Nested objects test',
          summary: 'Has multiple nested objects.',
          breakingChanges: ['Breaking note'],
          codeActions: [
            { description: 'Step 1', exampleBefore: 'const a = { x: 1 };' },
            { description: 'Step 2', exampleAfter: 'const a = { y: 2 };' },
          ],
          contentChanges: [
            { id: 'c1', title: 'C1', required: false, description: 'desc', affectedEntities: ['A'] },
            { id: 'c2', title: 'C2', required: true, description: 'desc2' },
          ],
        },
        {
          version: '0.1.5',
          releaseDate: '2026-11-12',
          title: 'Next',
          summary: 'Next release',
          breakingChanges: [],
          codeActions: [],
          contentChanges: [],
        },
      ];`,
      'utf-8'
    );

    const validResult = verifyLedgerReleaseGate({
      currentVersion: '0.1.3',
      bumpType: 'patch',
      ledgerPath,
    });
    expect(validResult.valid).toBe(true);
    expect(validResult.targetVersion).toBe('0.1.4');

    const invalidResult = verifyLedgerReleaseGate({
      currentVersion: '0.1.4',
      bumpType: 'patch',
      ledgerPath,
    });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.targetVersion).toBe('0.1.5');
    expect(invalidResult.reason).toBe('incomplete-entry');
  });

  it('blocks when target version is not greater than current version', () => {
    fs.writeFileSync(
      ledgerPath,
      `export const LEDGER = [{
        version: '0.1.3',
        releaseDate: '2026-11-01',
        title: 'Old',
        summary: 'Old',
        breakingChanges: ['x'],
        codeActions: [],
        contentChanges: [{ id: 'c' }],
      }];`,
      'utf-8'
    );

    const result = verifyLedgerReleaseGate({
      currentVersion: '0.1.4',
      bumpType: '0.1.3',
      ledgerPath,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('version-not-greater');
  });

  it('passes against the real src/migrations/ledger.ts when bumping to v0.1.4 from v0.1.3', () => {
    const realLedgerPath = path.resolve(__dirname, '../../src/migrations/ledger.ts');
    const result = verifyLedgerReleaseGate({
      currentVersion: '0.1.3',
      bumpType: 'patch',
      ledgerPath: realLedgerPath,
    });

    expect(result.valid).toBe(true);
    expect(result.targetVersion).toBe('0.1.4');
  });
});

