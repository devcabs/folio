import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateAiMigrationPrompt,
  type PromptFormatterOptions,
} from '../../src/utils/migrationPromptFormatter';
import { generateAiMigrationPrompt as serviceReExport } from '../../src/services/migrationService';
import * as rootExports from '../../src/index';
import type { PendingMigrationReport } from '../../src/types/migration';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('migrationPromptFormatter (Utils Layer Isolation & Purity)', () => {
  const sampleReport: PendingMigrationReport = {
    currentEngineVersion: '0.2.0',
    contentVersionWatermark: '0.1.0',
    hasPendingContentChanges: true,
    unappliedVersions: ['0.1.5', '0.2.0'],
    pendingContentChanges: [
      {
        id: 'nav-migration-1',
        title: 'Primary Navigation Schema Restructure',
        required: true,
        description: 'Updates navigation items to consume canonical section IDs.',
        affectedEntities: ['navigationConfig', 'headerItems'],
        migrationPrompt: 'Replace legacy nav anchors with canonical section references in navigationConfig.',
      },
      {
        id: 'card-migration-2',
        title: 'Project Card Aspect Ratio Standard',
        required: false,
        description: 'Migrate card thumbnail aspect ratio from 4:3 to 16:9.',
        // affectedEntities omitted
        // migrationPrompt omitted
      },
    ],
  };

  describe('Architectural Purity & Layer Isolation', () => {
    it('contains zero imports from services or contexts in source file', () => {
      const filePath = path.join(ROOT, 'src/utils/migrationPromptFormatter.ts');
      const source = fs.readFileSync(filePath, 'utf8');

      // Disallow importing services or contexts
      expect(source).not.toMatch(/from\s+['"].*services/i);
      expect(source).not.toMatch(/from\s+['"].*context/i);

      // Only allowed import is types/migration
      const importLines = source
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('import '));

      for (const line of importLines) {
        expect(line).toMatch(/from\s+['"]\.\.\/types\/migration['"]/);
      }
    });

    it('is exported from root index and re-exported from migrationService', () => {
      expect(rootExports.generateAiMigrationPrompt).toBeDefined();
      expect(typeof rootExports.generateAiMigrationPrompt).toBe('function');
      expect(serviceReExport).toBe(generateAiMigrationPrompt);
    });
  });

  describe('Deterministic & Pure Formatting', () => {
    it('produces identical output for identical inputs across invocations', () => {
      const output1 = generateAiMigrationPrompt(sampleReport);
      const output2 = generateAiMigrationPrompt(sampleReport);

      expect(output1).toBe(output2);
      expect(typeof output1).toBe('string');
      expect(output1.length).toBeGreaterThan(0);
    });

    it('formats correct header and version transition subtitle', () => {
      const prompt = generateAiMigrationPrompt(sampleReport);

      expect(prompt).toContain('# AI Migration Prompt');
      expect(prompt).toContain('Updating from v0.1.0 → v0.2.0');
    });

    it('formats numbered headings, required status, affected entities, and instructions', () => {
      const prompt = generateAiMigrationPrompt(sampleReport);

      // Heading 1
      expect(prompt).toContain('## 1. Primary Navigation Schema Restructure');
      expect(prompt).toContain('**Required:** Yes');
      expect(prompt).toContain('**Affected Entities:** navigationConfig, headerItems');
      expect(prompt).toContain('Updates navigation items to consume canonical section IDs.');
      expect(prompt).toContain(
        '**Instructions:**\nReplace legacy nav anchors with canonical section references in navigationConfig.'
      );

      // Heading 2
      expect(prompt).toContain('## 2. Project Card Aspect Ratio Standard');
      expect(prompt).toContain('**Required:** No');
      expect(prompt).toContain('Migrate card thumbnail aspect ratio from 4:3 to 16:9.');
    });

    it('omits affected entities and instructions when undefined or empty', () => {
      const prompt = generateAiMigrationPrompt(sampleReport);

      // Change #2 does not have affectedEntities or migrationPrompt
      const change2Section = prompt.split('## 2. Project Card Aspect Ratio Standard')[1] || '';
      expect(change2Section).not.toContain('**Affected Entities:**');
      expect(change2Section).not.toContain('**Instructions:**');
    });

    it('omits affected entities when empty array', () => {
      const reportWithEmptyEntities: PendingMigrationReport = {
        ...sampleReport,
        pendingContentChanges: [
          {
            id: 'test-1',
            title: 'Empty Entities Change',
            required: true,
            description: 'Change with empty entities list.',
            affectedEntities: [],
          },
        ],
      };

      const prompt = generateAiMigrationPrompt(reportWithEmptyEntities);
      expect(prompt).not.toContain('**Affected Entities:**');
    });

    it('includes required footer comment block', () => {
      const prompt = generateAiMigrationPrompt(sampleReport);

      expect(prompt).toContain('<!-- Generated by @devcabs/folio-engine migrationService -->');
    });

    it('produces valid string with no numbered entries when pendingContentChanges is empty', () => {
      const emptyReport: PendingMigrationReport = {
        currentEngineVersion: '0.1.3',
        contentVersionWatermark: '0.1.3',
        hasPendingContentChanges: false,
        pendingContentChanges: [],
        unappliedVersions: [],
      };

      const prompt = generateAiMigrationPrompt(emptyReport);

      expect(prompt).toContain('# AI Migration Prompt');
      expect(prompt).toContain('Updating from v0.1.3 → v0.1.3');
      expect(prompt).not.toContain('## ');
      expect(prompt).toContain('<!-- Generated by @devcabs/folio-engine migrationService -->');
    });

    it('produces valid string when pendingContentChanges is undefined', () => {
      const undefinedChangesReport = {
        currentEngineVersion: '0.1.3',
        contentVersionWatermark: '0.1.1',
        hasPendingContentChanges: false,
        unappliedVersions: [],
      } as unknown as PendingMigrationReport;

      const prompt = generateAiMigrationPrompt(undefinedChangesReport);

      expect(prompt).toContain('# AI Migration Prompt');
      expect(prompt).toContain('Updating from v0.1.1 → v0.1.3');
      expect(prompt).not.toContain('## ');
      expect(prompt).toContain('<!-- Generated by @devcabs/folio-engine migrationService -->');
    });

    it('supports agentHint option while remaining deterministic across hints', () => {
      const hints: PromptFormatterOptions['agentHint'][] = [
        'claude',
        'cursor',
        'antigravity',
        'generic',
        undefined,
      ];

      const baseline = generateAiMigrationPrompt(sampleReport);

      for (const hint of hints) {
        const output = generateAiMigrationPrompt(sampleReport, { agentHint: hint });
        expect(output).toBe(baseline);
      }
    });
  });
});

