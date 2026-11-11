/**
 * Folio Engine Migration Ledger
 *
 * Single source of truth for version transitions, breaking changes, code actions,
 * and content migrations. Validated at module load time via Zod so malformed
 * entries fail loudly on startup rather than silently skewing semver checks.
 */

import { z } from 'zod';
import {
  MigrationEntrySchema,
  type MigrationEntry,
  type MigrationEntryInput,
} from '../types/migration';

const _RAW_LEDGER: MigrationEntryInput[] = [
  {
    version: '0.1.0',
    releaseDate: '2026-10-28',
    title: 'Initial Folio Engine Release',
    summary:
      'Initial release of Folio Engine with Document AST and Stepped Sequence roadmap.',
    // Omit optional arrays to exercise Zod .default([]) coercion on module load.
  },
  {
    version: '0.1.1',
    releaseDate: '2026-10-30',
    title: 'Cloud Draft Sync & Persistence Layer',
    summary:
      'Added cloud draft sync, local storage mutex locks, and undo/redo service.',
    breakingChanges: undefined,
  },
  {
    version: '0.1.2',
    releaseDate: '2026-10-31',
    title: 'Vector Chart Studio & Media Sync',
    summary:
      'Enhanced Google Sheets chart sync, Drive photo verification, and vector chart drawers.',
    breakingChanges: [],
    codeActions: [],
    contentChanges: [],
  },
  {
    version: '0.1.3',
    releaseDate: '2026-11-01',
    title: 'Standalone Library Distribution & Deploy Gate',
    summary:
      'Standalone library distribution (dist/folio.js, dist/edge.js, dist/diagnostics.js), token CSS bundles, and deploy automation.',
    breakingChanges: [],
    codeActions: [],
    contentChanges: [],
  },
  {
    version: '0.1.4',
    releaseDate: '2026-11-11',
    title: 'Migration Ledger Pre-Flight Infrastructure & Changelog Strategy',
    summary:
      'Added migration data contracts, storage adapter, watermark resolver, MigrationContext isolation, prompt formatter, doctor package resolver, and changelog CLI pre-wiring.',
    breakingChanges: [
      'No breaking API removals; introduces additive migration tracking contracts and optional EngineConfig.contentVersion.',
    ],
    codeActions: [],
    contentChanges: [
      {
        id: 'content-version-watermark-0.1.4',
        title: 'Optional contentVersion Config Watermark',
        required: false,
        description:
          'Set optional contentVersion in EngineConfig to track consumer app content migrations across engine upgrades.',
      },
    ],
  },
];

/**
 * Validates raw ledger entries against MigrationEntrySchema and returns Zod-coerced entries.
 * Throws loudly with a descriptive message if any entry is malformed.
 */
export function validateMigrationLedger(rawLedger: unknown): MigrationEntry[] {
  const validation = z.array(MigrationEntrySchema).safeParse(rawLedger);
  if (!validation.success) {
    throw new Error(
      `[folio-engine] FOLIO_MIGRATION_LEDGER is malformed:\n${validation.error.message}`
    );
  }
  return validation.data;
}

/**
 * Validated, Zod-coerced migration ledger exported for runtime inspection.
 * Raw unvalidated ledger data is never exported.
 */
export const FOLIO_MIGRATION_LEDGER: MigrationEntry[] =
  validateMigrationLedger(_RAW_LEDGER);

