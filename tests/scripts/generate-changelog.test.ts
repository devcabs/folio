import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DEFAULT_OUTPUT_PATH,
  generateChangelog,
  parseChangelogArgs,
  runChangelogCli,
  summarizeDiff,
} from '../../scripts/generate-changelog';

describe('generate-changelog CLI', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-changelog-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseChangelogArgs', () => {
    it('returns default options when no arguments are passed', () => {
      expect(parseChangelogArgs([])).toEqual({
        outputPath: DEFAULT_OUTPUT_PATH,
        isDryRun: false,
        isVerify: false,
      });
    });

    it('parses --output <path> flag', () => {
      expect(parseChangelogArgs(['--output', 'docs/CHANGELOG.md'])).toEqual({
        outputPath: 'docs/CHANGELOG.md',
        isDryRun: false,
        isVerify: false,
      });
    });

    it('parses --output=<path> flag', () => {
      expect(parseChangelogArgs(['--output=out/CHANGES.md'])).toEqual({
        outputPath: 'out/CHANGES.md',
        isDryRun: false,
        isVerify: false,
      });
    });

    it('parses --dry-run and --verify flags', () => {
      expect(parseChangelogArgs(['--dry-run'])).toEqual({
        outputPath: DEFAULT_OUTPUT_PATH,
        isDryRun: true,
        isVerify: false,
      });
      expect(parseChangelogArgs(['--verify'])).toEqual({
        outputPath: DEFAULT_OUTPUT_PATH,
        isDryRun: false,
        isVerify: true,
      });
    });

    it('throws when --output has no value', () => {
      expect(() => parseChangelogArgs(['--output'])).toThrow(/--output/);
      expect(() => parseChangelogArgs(['--output', '--dry-run'])).toThrow(/--output/);
    });

    it('throws on unknown flags', () => {
      expect(() => parseChangelogArgs(['--unknown'])).toThrow(/Unknown flag/);
    });

    it('throws when --dry-run and --verify are combined', () => {
      expect(() => parseChangelogArgs(['--dry-run', '--verify'])).toThrow(/mutually exclusive/i);
    });
  });

  describe('generateChangelog (stub)', () => {
    it('returns an empty string stub until task 1.14', () => {
      expect(generateChangelog()).toBe('');
    });
  });

  describe('runChangelogCli', () => {
    it('writes generated output to --output path in default mode', () => {
      const targetPath = path.join(tempDir, 'nested', 'CHANGELOG.md');
      const exitCode = runChangelogCli(
        { outputPath: targetPath, isDryRun: false, isVerify: false },
        { generate: () => '# Changelog\n\n## v0.1.4\n' }
      );

      expect(exitCode).toBe(0);
      expect(fs.readFileSync(targetPath, 'utf-8')).toBe('# Changelog\n\n## v0.1.4\n');
    });

    it('prints to stdout and writes NO files in --dry-run mode', () => {
      const targetPath = path.join(tempDir, 'CHANGELOG.md');
      let stdout = '';
      const exitCode = runChangelogCli(
        { outputPath: targetPath, isDryRun: true, isVerify: false },
        {
          generate: () => '# Changelog\n',
          writeStdout: (chunk) => {
            stdout += chunk;
          },
        }
      );

      expect(exitCode).toBe(0);
      expect(stdout).toBe('# Changelog\n');
      expect(fs.existsSync(targetPath)).toBe(false);
    });

    it('exits 0 in --verify mode when file does not exist and stub output is empty', () => {
      const targetPath = path.join(tempDir, 'CHANGELOG.md');
      let stdout = '';
      const exitCode = runChangelogCli(
        { outputPath: targetPath, isDryRun: false, isVerify: true },
        {
          generate: () => '',
          writeStdout: (chunk) => {
            stdout += chunk;
          },
        }
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain('nothing to verify');
      expect(fs.existsSync(targetPath)).toBe(false);
    });

    it('exits 1 in --verify mode when file does not exist and generated output is non-empty', () => {
      const targetPath = path.join(tempDir, 'CHANGELOG.md');
      let stderr = '';
      const exitCode = runChangelogCli(
        { outputPath: targetPath, isDryRun: false, isVerify: true },
        {
          generate: () => '# Changelog\n',
          writeStderr: (chunk) => {
            stderr += chunk;
          },
        }
      );

      expect(exitCode).toBe(1);
      expect(stderr).toContain('does not exist');
    });

    it('exits 0 in --verify mode when file on disk matches generated output', () => {
      const targetPath = path.join(tempDir, 'CHANGELOG.md');
      const content = '# Changelog\n\n## v0.1.4\n';
      fs.writeFileSync(targetPath, content, 'utf-8');

      let stdout = '';
      const exitCode = runChangelogCli(
        { outputPath: targetPath, isDryRun: false, isVerify: true },
        {
          generate: () => content,
          writeStdout: (chunk) => {
            stdout += chunk;
          },
        }
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain('up to date');
    });

    it('exits 1 and prints human-readable diff summary in --verify mode when file differs', () => {
      const targetPath = path.join(tempDir, 'CHANGELOG.md');
      fs.writeFileSync(targetPath, '# Changelog\n\n## v0.1.3\n', 'utf-8');

      let stderr = '';
      const exitCode = runChangelogCli(
        { outputPath: targetPath, isDryRun: false, isVerify: true },
        {
          generate: () => '# Changelog\n\n## v0.1.4\n',
          writeStderr: (chunk) => {
            stderr += chunk;
          },
        }
      );

      expect(exitCode).toBe(1);
      expect(stderr).toContain('mismatch');
      expect(stderr).toContain('v0.1.3');
      expect(stderr).toContain('v0.1.4');
    });
  });

  describe('summarizeDiff', () => {
    it('formats differing lines with line numbers', () => {
      const summary = summarizeDiff('line1\nnew\n', 'line1\nold\n', 'CHANGELOG.md');
      expect(summary).toContain('CHANGELOG.md');
      expect(summary).toContain('Line 2');
      expect(summary).toContain('- old');
      expect(summary).toContain('+ new');
    });
  });
});

