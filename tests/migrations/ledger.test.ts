import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ContentMigrationSchema,
  CodeMigrationSchema,
  MigrationEntrySchema,
  PendingMigrationReportSchema,
  type ContentMigration,
  type CodeMigration,
  type MigrationEntry,
  type PendingMigrationReport,
} from '../../src/types/migration';
import * as rootExports from '../../src/index';
import * as ledgerModule from '../../src/migrations/ledger';
import {
  FOLIO_MIGRATION_LEDGER,
  validateMigrationLedger,
} from '../../src/migrations/ledger';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('Subtask 1.6: Ledger Runtime Zod Validation at Module Load', () => {
  describe('Zod Schema Exports & Strict Contracts (src/types/migration.ts)', () => {
    it('exports all migration Zod schemas from migration types and root index', () => {
      expect(ContentMigrationSchema).toBeDefined();
      expect(CodeMigrationSchema).toBeDefined();
      expect(MigrationEntrySchema).toBeDefined();
      expect(PendingMigrationReportSchema).toBeDefined();

      expect(rootExports.ContentMigrationSchema).toBe(ContentMigrationSchema);
      expect(rootExports.CodeMigrationSchema).toBe(CodeMigrationSchema);
      expect(rootExports.MigrationEntrySchema).toBe(MigrationEntrySchema);
      expect(rootExports.PendingMigrationReportSchema).toBe(PendingMigrationReportSchema);
    });

    it('enforces .strict() on ContentMigrationSchema and CodeMigrationSchema', () => {
      const validContent: ContentMigration = {
        id: 'content-1',
        title: 'Update Node Schema',
        required: true,
        description: 'Migrates node metadata shape.',
        affectedEntities: ['nodes'],
        migrationPrompt: 'Update metadata keys.',
      };
      expect(ContentMigrationSchema.safeParse(validContent).success).toBe(true);

      const extraKeyContent = { ...validContent, unknownField: 'bad' };
      expect(ContentMigrationSchema.safeParse(extraKeyContent).success).toBe(false);

      const validCode: CodeMigration = {
        description: 'Update import path',
        affectedFiles: ['src/App.tsx'],
        exampleBefore: 'old()',
        exampleAfter: 'new()',
      };
      expect(CodeMigrationSchema.safeParse(validCode).success).toBe(true);

      const extraKeyCode = { ...validCode, surprise: 123 };
      expect(CodeMigrationSchema.safeParse(extraKeyCode).success).toBe(false);
    });

    it('rejects v-prefixed and malformed version strings in MigrationEntrySchema', () => {
      const base = {
        releaseDate: '2026-11-11',
        title: 'Release',
        summary: 'Summary text',
      };

      expect(MigrationEntrySchema.safeParse({ ...base, version: '0.1.5' }).success).toBe(true);
      expect(MigrationEntrySchema.safeParse({ ...base, version: '1.0.0-alpha.1' }).success).toBe(true);

      expect(MigrationEntrySchema.safeParse({ ...base, version: 'v0.1.5' }).success).toBe(false);
      expect(MigrationEntrySchema.safeParse({ ...base, version: 'v1.0.0' }).success).toBe(false);
      expect(MigrationEntrySchema.safeParse({ ...base, version: '0.1' }).success).toBe(false);
      expect(MigrationEntrySchema.safeParse({ ...base, version: 'latest' }).success).toBe(false);
    });

    it('rejects null for array fields and defaults omitted/undefined fields to []', () => {
      const base = {
        version: '0.1.4',
        releaseDate: '2026-11-11',
        title: 'Test Entry',
        summary: 'Validates defaults and null rejection.',
      };

      expect(
        MigrationEntrySchema.safeParse({ ...base, breakingChanges: null }).success
      ).toBe(false);
      expect(
        MigrationEntrySchema.safeParse({ ...base, codeActions: null }).success
      ).toBe(false);
      expect(
        MigrationEntrySchema.safeParse({ ...base, contentChanges: null }).success
      ).toBe(false);

      const parsed = MigrationEntrySchema.parse({
        ...base,
        breakingChanges: undefined,
      });

      expect(parsed.breakingChanges).toEqual([]);
      expect(parsed.codeActions).toEqual([]);
      expect(parsed.contentChanges).toEqual([]);
    });

    it('validates PendingMigrationReportSchema and enforces .strict()', () => {
      const report: PendingMigrationReport = {
        currentEngineVersion: '0.1.3',
        contentVersionWatermark: '0.1.1',
        hasPendingContentChanges: false,
        pendingContentChanges: [],
        unappliedVersions: ['0.1.2', '0.1.3'],
      };

      expect(PendingMigrationReportSchema.safeParse(report).success).toBe(true);
      expect(
        PendingMigrationReportSchema.safeParse({ ...report, extra: true }).success
      ).toBe(false);
      expect(
        PendingMigrationReportSchema.safeParse({
          ...report,
          currentEngineVersion: 'v0.1.3',
        }).success
      ).toBe(false);
    });
  });

  describe('Module-Load Ledger Validation (src/migrations/ledger.ts)', () => {
    it('imports FOLIO_MIGRATION_LEDGER without throwing and coerces omitted/undefined fields to []', () => {
      expect(Array.isArray(FOLIO_MIGRATION_LEDGER)).toBe(true);
      expect(FOLIO_MIGRATION_LEDGER.length).toBeGreaterThanOrEqual(4);

      for (const entry of FOLIO_MIGRATION_LEDGER) {
        expect(Array.isArray(entry.breakingChanges)).toBe(true);
        expect(Array.isArray(entry.codeActions)).toBe(true);
        expect(Array.isArray(entry.contentChanges)).toBe(true);
        expect(MigrationEntrySchema.safeParse(entry).success).toBe(true);
      }
    });

    it('never exports _RAW_LEDGER', () => {
      expect((ledgerModule as Record<string, unknown>)._RAW_LEDGER).toBeUndefined();

      const ledgerSource = fs.readFileSync(
        path.join(ROOT, 'src/migrations/ledger.ts'),
        'utf8'
      );
      expect(ledgerSource).not.toMatch(/export\s+(const|let|var)\s+_RAW_LEDGER\b/);
    });

    it('throws a descriptive error when an entry has a v-prefixed version like v0.1.5', () => {
      const malformedLedger = [
        {
          version: 'v0.1.5',
          releaseDate: '2026-11-11',
          title: 'Bad Version',
          summary: 'Has leading v prefix',
          breakingChanges: [],
          codeActions: [],
          contentChanges: [],
        },
      ];

      expect(() => validateMigrationLedger(malformedLedger)).toThrow(
        /\[folio-engine\] FOLIO_MIGRATION_LEDGER is malformed:/
      );
    });

    it('throws a descriptive error when an entry has breakingChanges: null', () => {
      const malformedLedger = [
        {
          version: '0.1.5',
          releaseDate: '2026-11-11',
          title: 'Null Breaking Changes',
          summary: 'Has null instead of array',
          breakingChanges: null,
          codeActions: [],
          contentChanges: [],
        },
      ];

      expect(() => validateMigrationLedger(malformedLedger)).toThrow(
        /\[folio-engine\] FOLIO_MIGRATION_LEDGER is malformed:/
      );
    });

    it('does not throw when optional arrays are omitted or undefined and coerces them to []', () => {
      const rawWithOmissions = [
        {
          version: '0.1.4',
          releaseDate: '2026-11-11',
          title: 'Minimal Entry',
          summary: 'Omits optional array fields.',
          breakingChanges: undefined,
        },
      ];

      const validated: MigrationEntry[] = validateMigrationLedger(rawWithOmissions);
      expect(validated).toHaveLength(1);
      expect(validated[0].breakingChanges).toEqual([]);
      expect(validated[0].codeActions).toEqual([]);
      expect(validated[0].contentChanges).toEqual([]);
    });
  });
});

