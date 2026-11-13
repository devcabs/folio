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
import { compareSemver } from '../utils/semver-utils';

export { compareSemver };

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
    contentChanges: [
      {
        id: 'hero-accent-markdown-0.1.2',
        title: 'Hero Title Accent Markdown Support',
        required: false,
        description:
          'Hero titles now parse inline **accent** markdown segments for editorial emphasis.',
        affectedEntities: ['EngineBrandingConfig.heroTitle', 'HeroWelcome'],
        migrationPrompt:
          'Review branding.heroTitle in your EngineConfig setup and optionally wrap emphasized phrases in **double asterisks** to leverage accent text rendering.',
      },
    ],
  },
  {
    version: '0.1.3',
    releaseDate: '2026-11-01',
    title: 'Standalone Library Distribution & Deploy Gate',
    summary:
      'Standalone library distribution (dist/folio.js, dist/edge.js, dist/diagnostics.js), token CSS bundles, and deploy automation.',
    breakingChanges: [],
    codeActions: [],
    contentChanges: [
      {
        id: 'milestone-photo-flight-0.1.3',
        title: 'Milestone Photo Flight & Hero Media Configuration',
        required: false,
        description:
          'Nodes with hero photos now support PhotoFlightEngine transitions via node photo configs and milestone image URLs.',
        affectedEntities: ['nodes', 'sample-nodes.json', 'node-photo-configs'],
        migrationPrompt:
          'Verify milestone node heroImage URLs and optional getNodePhotoConfig overrides so roadmap-to-canvas photo flight transitions align with your node IDs.',
      },
    ],
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
        affectedEntities: ['EngineConfig', 'src/App.tsx'],
        migrationPrompt:
          'Add contentVersion to your EngineConfig object in your app entry point (e.g., contentVersion: "0.1.4") so Folio Engine tracks acknowledged content migrations.',
      },
    ],
  },
  {
    version: '0.1.5',
    releaseDate: '2026-11-12',
    title: 'Migration Doctor CLI, Dev Migration Modal & Packaged Docs',
    summary:
      'Added the folio-engine CLI migration doctor, in-app DevMigrationModal notification flow, and bundled Diátaxis documentation in the npm package.',
    breakingChanges: [
      'No breaking API removals; introduces the folio-engine CLI binary, DevMigrationModal, and packaged docs/folio-engine/ documentation.',
    ],
    codeActions: [],
    contentChanges: [
      {
        id: 'migration-doctor-and-docs-0.1.5',
        title: 'Run folio-engine doctor & Review Packaged Docs',
        required: false,
        description:
          'Consumer apps now receive docs/folio-engine/ inside @devcabs/folio-engine and can run npx folio-engine doctor to inspect migration watermarks.',
        affectedEntities: ['package.json', 'EngineConfig', 'DevMigrationModal'],
        migrationPrompt:
          'Run `npx folio-engine doctor` in your consumer app after upgrading to 0.1.5 and review node_modules/@devcabs/folio-engine/docs/folio-engine/README.md for setup and migration guides.',
      },
    ],
  },
  {
    version: '0.1.6',
    releaseDate: '2026-11-13',
    title: 'Data Layer Integrity, Edge KV Await & Observability Pipeline',
    summary:
      'Hardened dual-channel storage with tombstone resets, Drive photo pagination loop & link variants, Sheets empty-data guards, IndexedDB quota alerts, 3-tier Edge KV await with retry, and cold-boot skeleton wireframes.',
    breakingChanges: [
      'No breaking API removals; additive observability events, tombstone isolation in content overrides, and 3-tier publishing status contracts.',
    ],
    codeActions: [],
    contentChanges: [
      {
        id: 'data-layer-integrity-0.1.6',
        title: 'Data Layer Integrity & Observability Upgrades',
        required: false,
        description:
          'Consumer apps receive improved Drive sync resilience, instant single-photo preview variants, and zero-flash cold boot wireframes.',
        affectedEntities: ['DocumentCanvas', 'DevPublishModal', 'mediaUrl'],
        migrationPrompt:
          'Review consumer app publishing flows to take advantage of 3-tier publishing status and ensure DocumentCanvas leverages the new zero-flash wireframe state during cold boot.',
      },
    ],
  },
  {
    version: '0.1.7',
    releaseDate: '2026-11-13',
    title: 'TOC Container Isolation & Minimal Footer Version Tag',
    summary:
      'Eliminated duplicate TOC numbering by skipping wrapper containers and scoping section queries; added minimal typographic version control tag in AppFooter.',
    breakingChanges: [
      'No breaking API removals; additive container wrapper filtering in useAutoTableOfContents and version prop on AppFooter.',
    ],
    codeActions: [],
    contentChanges: [
      {
        id: 'toc-and-footer-version-0.1.7',
        title: 'TOC Wrapper Filtering & Footer Version Tag',
        required: false,
        description:
          'Table of Contents automatically excludes outer canvas containers, and AppFooter cleanly displays the active engine version.',
        affectedEntities: ['AppFooter', 'useAutoTableOfContents', 'App.tsx'],
        migrationPrompt:
          'No action required; consumer applications automatically receive improved TOC sidebar hierarchy and clean footer version branding.',
      },
    ],
  },
  {
    version: '0.1.8',
    releaseDate: '2026-11-13',
    title: 'Decoupled Photo Gallery Architecture & Element-Level Ownership',
    summary:
      'Decoupled photo synchronization and Google Drive folder attachments from parent canvas nodes to individual gallery elements, strictly isolating gallery streams without parent fallback.',
    breakingChanges: [
      'Gallery elements now strictly require their own Google Drive folder attachment and do not silently fall back to parent node photo streams.',
    ],
    codeActions: [],
    contentChanges: [
      {
        id: 'gallery-element-ownership-0.1.8',
        title: 'Element-Level Photo Gallery Ownership & Isolation',
        required: false,
        description:
          'Photo streams, Google Drive folder attachments, and sync states are now keyed by unique gallery IDs (pointId / element.id), allowing multiple independent galleries on a single canvas document.',
        affectedEntities: ['CanvasGallery', 'SourceGallery', 'useDrivePhotoSync', 'SourceFolderAttachment'],
        migrationPrompt:
          'Ensure canvas gallery elements have a dedicated driveUrl configured. Galleries without a linked Drive folder will display an unlinked prompt and throw an error if sync is attempted.',
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

/**
 * Current published engine semver dynamically resolved from the migration ledger.
 */
export const CURRENT_ENGINE_VERSION: string =
  FOLIO_MIGRATION_LEDGER.length > 0
    ? FOLIO_MIGRATION_LEDGER[FOLIO_MIGRATION_LEDGER.length - 1].version
    : '0.1.6';

