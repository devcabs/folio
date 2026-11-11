/**
 * Migration Ledger Data Contracts
 * Defines Zod schemas and derived TypeScript contracts for tracking version transitions,
 * breaking changes, required code actions, and pending content migrations.
 */

import { z } from 'zod';

/** Bare semver pattern (no leading 'v' prefix allowed). */
export const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;

export const ContentMigrationSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    required: z.boolean(),
    description: z.string().min(1),
    affectedEntities: z.array(z.string()).optional(),
    migrationPrompt: z.string().optional(),
  })
  .strict();

export const CodeMigrationSchema = z
  .object({
    description: z.string().min(1),
    affectedFiles: z.array(z.string()).optional(),
    exampleBefore: z.string().optional(),
    exampleAfter: z.string().optional(),
  })
  .strict();

export const MigrationEntrySchema = z
  .object({
    version: z
      .string()
      .regex(
        SEMVER_REGEX,
        'Version must be a bare semver string without a "v" prefix (e.g. "0.1.3")'
      ),
    releaseDate: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    breakingChanges: z.array(z.string()).default([]),
    codeActions: z.array(CodeMigrationSchema).default([]),
    contentChanges: z.array(ContentMigrationSchema).default([]),
  })
  .strict();

export const PendingMigrationReportSchema = z
  .object({
    currentEngineVersion: z
      .string()
      .regex(
        SEMVER_REGEX,
        'currentEngineVersion must be a bare semver string without a "v" prefix'
      ),
    contentVersionWatermark: z
      .string()
      .regex(
        SEMVER_REGEX,
        'contentVersionWatermark must be a bare semver string without a "v" prefix'
      ),
    hasPendingContentChanges: z.boolean(),
    pendingContentChanges: z.array(ContentMigrationSchema),
    unappliedVersions: z.array(z.string()),
  })
  .strict();

export type ContentMigration = z.infer<typeof ContentMigrationSchema>;
export type CodeMigration = z.infer<typeof CodeMigrationSchema>;
export type MigrationEntry = z.infer<typeof MigrationEntrySchema>;
export type MigrationEntryInput = z.input<typeof MigrationEntrySchema>;
export type PendingMigrationReport = z.infer<typeof PendingMigrationReportSchema>;
