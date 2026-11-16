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
    codeActions: [
      {
        description:
          'Bind individual Google Drive folder URLs directly to gallery elements instead of relying on parent node photo sync fallback.',
        affectedFiles: ['sample-nodes.json', 'src/components/source/SourceGallery.tsx'],
        exampleBefore:
          '<SourceGallery nodeId={nodeId} />',
        exampleAfter:
          '<SourceGallery nodeId={nodeId} pointId={element.id} driveUrl={element.driveUrl} />',
      },
    ],
    contentChanges: [
      {
        id: 'gallery-element-ownership-0.1.8',
        title: 'Element-Level Photo Gallery Ownership & Isolation',
        required: true,
        description:
          'Photo streams, Google Drive folder attachments, and sync states are now keyed by unique gallery IDs (pointId / element.id), allowing multiple independent galleries on a single canvas document.',
        affectedEntities: ['CanvasGallery', 'SourceGallery', 'useDrivePhotoSync', 'SourceFolderAttachment'],
        migrationPrompt:
          'Ensure canvas gallery elements have a dedicated driveUrl configured. Galleries without a linked Drive folder will display an unlinked prompt and throw an error if sync is attempted.',
      },
    ],
  },
  {
    version: '0.1.9',
    releaseDate: '2026-11-13',
    title: 'Single-Source Data Architecture & Pure AST Revision Rollback',
    summary:
      'Streamlined Folio Engine single-source data architecture: eliminated phantom content override diffs, enforced pure Canvas AST revision rollback, added resilient image and chart fallbacks, and optimized history manifests strictly under 5 KB.',
    breakingChanges: [
      'No breaking API removals; historical snapshots now restore pure Canvas ASTs without flat content override re-hydration, and changelog diffs calculate purely from AST text elements.',
    ],
    codeActions: [
      {
        description:
          'Route public canvas reads through Cloudflare Edge KV (/api/public/node/:nodeId) and eliminate synchronous localStorage reads or writes on public page visits.',
        affectedFiles: ['functions/api/public/node/[nodeId].ts', 'src/hooks/useDocumentCanvas.ts'],
        exampleBefore:
          'const cached = localStorage.getItem(`folio_live_canvas_${nodeId}`);',
        exampleAfter:
          'const { document, isHydrating } = useDocumentCanvas(nodeId);',
      },
      {
        description:
          'Restore historical snapshots into draft sandboxes using pure Canvas AST injection without legacy flat content override re-hydration.',
        affectedFiles: ['src/services/historyService.ts'],
        exampleBefore:
          'restoreSnapshotToDraft(snapshot);\nmigrateCanvasOverridesIntoAst("draft");',
        exampleAfter:
          'restoreSnapshotToDraft(snapshot);',
      },
    ],
    contentChanges: [
      {
        id: 'pure-ast-rollback-0.1.9',
        title: 'Pure AST Snapshot Rollback & History Manifest Optimization',
        required: true,
        description:
          'Revision rollback now restores canvas AST trees directly into draft sandboxes without legacy content override re-hydration. History manifests in localStorage are strictly capped < 5 KB.',
        affectedEntities: ['historyService', 'restoreSnapshotToDraft', 'computeMetricsSummary', 'HistoryHubModal'],
        migrationPrompt:
          'Verify Cloudflare Edge KV public endpoint is deployed. Historical snapshots will restore AST nodes cleanly without flat content override re-hydration.',
      },
    ],
  },
  {
    version: '0.1.10',
    releaseDate: '2026-11-15',
    title: 'Consumer App Migration Action Suite & Watermark Sync (0.1.8 -> 0.1.10)',
    summary:
      'Actionable migration suite for consumer applications upgrading across versions 0.1.8 to 0.1.10: element-level gallery isolation, public Edge KV single-source pipeline, pure AST revision history, and EngineConfig watermark synchronization.',
    breakingChanges: [
      'Consumer applications upgrading from 0.1.8 must configure dedicated driveUrl properties on individual gallery elements (parent node fallback is eliminated).',
      'Public canvas reading requires active Cloudflare Edge KV (/api/public/node/:nodeId) or pre-baked AST payloads; synchronous localStorage reading and public client caching are purged.',
    ],
    codeActions: [
      {
        description:
          'Bind explicit driveUrl and element id properties to all canvas gallery elements in consumer templates and sample data.',
        affectedFiles: ['sample-nodes.json', 'src/components/source/SourceGallery.tsx'],
        exampleBefore:
          '{\n  "type": "gallery",\n  "title": "Field Photos"\n}',
        exampleAfter:
          '{\n  "type": "gallery",\n  "id": "gallery-elem-1",\n  "driveUrl": "https://drive.google.com/drive/folders/YOUR_FOLDER_ID",\n  "title": "Field Photos"\n}',
      },
      {
        description:
          'Verify Cloudflare Pages Functions /api/public/node/:nodeId is enabled to serve published AST documents to public visitors with zero localStorage dependency.',
        affectedFiles: ['functions/api/public/node/[nodeId].ts', 'wrangler.toml'],
        exampleBefore:
          '// Relying on localStorage live canvas caching:\nlocalStorage.getItem(`folio_live_canvas_${nodeId}`);',
        exampleAfter:
          '// Unconditional Edge KV fetch with skeleton wireframe:\nfetch(`/api/public/node/${nodeId}`).then(res => res.json());',
      },
      {
        description:
          'Update contentVersion watermark to "0.1.10" in your EngineConfig setup to acknowledge migration completion and clear doctor alerts.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore:
          'setEngineConfig({\n  contentVersion: "0.1.8",\n});',
        exampleAfter:
          'setEngineConfig({\n  contentVersion: "0.1.10",\n});',
      },
    ],
    contentChanges: [
      {
        id: 'gallery-drive-url-check-0.1.10',
        title: 'Verify Gallery Element Drive Attachments',
        required: true,
        description:
          'Inspect all gallery canvas elements in sample-nodes.json or remote storage to ensure each gallery has its own driveUrl set. Galleries without a driveUrl will prompt to connect a folder.',
        affectedEntities: ['CanvasGallery', 'SourceGallery', 'sample-nodes.json'],
        migrationPrompt:
          'Check sample-nodes.json or live canvas ASTs for gallery elements and verify that each element defines a valid `driveUrl` attribute.',
      },
      {
        id: 'edge-kv-single-source-0.1.10',
        title: 'Deploy Edge KV Public Endpoints',
        required: true,
        description:
          'Ensure your Cloudflare Pages deployment includes the public node endpoint (/api/public/node/:nodeId) backed by Edge KV, supporting cold-boot skeleton wireframes.',
        affectedEntities: ['functions/api/public/node/[nodeId].ts', 'wrangler.toml'],
        migrationPrompt:
          'Confirm that Cloudflare Pages Functions and Edge KV namespace bindings are deployed so public visitors can load published canvas AST documents.',
      },
      {
        id: 'content-version-watermark-0.1.10',
        title: 'Advance contentVersion Watermark to 0.1.10',
        required: true,
        description:
          'Update the contentVersion watermark in EngineConfig to 0.1.10 to acknowledge all migration items and silence Dev Mode pending migration warnings.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.1.10"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.1.11',
    releaseDate: '2026-11-15',
    title: 'Universal Edge Router & Edge Duplication Safeguards',
    summary:
      'Extracted universal Cloudflare Edge router into @devcabs/folio-engine/edge with dynamic KV resolution, zero-duplication anti-drift checks, and 5-line worker delegation.',
    breakingChanges: [
      'No breaking API changes; additive features and edge consolidation only.',
    ],
    codeActions: [
      {
        description:
          'Replace custom 100-line worker.ts router with 5-line handleFolioEdgeRequest delegation and delete duplicate functions/api/ and mediaUrl.ts in consumer apps.',
        affectedFiles: [
          'worker.ts',
          'functions/api/publish.ts',
          'functions/api/public/node/[nodeId].ts',
          'src/utils/mediaUrl.ts',
        ],
        exampleBefore:
          '// Consumer-maintained custom edge routing\nexport default { fetch: (req, env) => { ... 100 lines ... } };',
        exampleAfter:
          'import { handleFolioEdgeRequest } from "@devcabs/folio-engine/edge";\n\nexport default {\n  fetch(request: Request, env: any, ctx: any) {\n    return handleFolioEdgeRequest(request, env, ctx);\n  },\n};',
      },
    ],
    contentChanges: [
      {
        id: 'universal-edge-router-0.1.11',
        title: 'Adopt Universal Edge Router Delegation',
        required: true,
        description:
          'Consumer applications must delegate edge routing to handleFolioEdgeRequest from @devcabs/folio-engine/edge, removing duplicate route handlers.',
        affectedEntities: ['worker.ts', 'functions/api/'],
        migrationPrompt:
          'Delete duplicate local `functions/api/` route files and update `worker.ts` to delegate to `handleFolioEdgeRequest` from `@devcabs/folio-engine/edge`.',
      },
      {
        id: 'content-version-watermark-0.1.11',
        title: 'Advance contentVersion Watermark to 0.1.11',
        required: true,
        description:
          'Update the contentVersion watermark in EngineConfig to 0.1.11 to acknowledge the edge router migration and silence pending warnings.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.1.11"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.1.12',
    releaseDate: '2026-11-16',
    title: 'Canvas Fetch Error Resilience, Baseline Hydration & Chart Node Isolation',
    summary:
      'Added TopErrorBanner viewport error recovery with retry action, refined dignified public draft notice, edge baseline hydration for drafts, post-publish draft storage purge with remote draft cleanup, and reinforced chart source node_id database isolation.',
    breakingChanges: [
      'No breaking API removals; additive TopErrorBanner feedback component and extended useDocumentCanvas return contract (fetchError, retryFetch).',
    ],
    codeActions: [
      {
        description:
          'Consume fetchError and retryFetch from useDocumentCanvas to handle edge fetch failures or render the canonical TopErrorBanner feedback component.',
        affectedFiles: [
          'src/components/canvas/DocumentCanvas.tsx',
          'src/hooks/useDocumentCanvas.ts',
          'src/App.tsx',
        ],
        exampleBefore:
          'const { document, isHydrating, saveError, clearSaveError } = useDocumentCanvas(nodeId);',
        exampleAfter:
          'const { document, isHydrating, saveError, clearSaveError, fetchError, retryFetch } = useDocumentCanvas(nodeId);',
      },
      {
        description:
          'Execute Supabase SQL migration to ensure chart_sources table includes node_id column with index for per-node chart isolation.',
        affectedFiles: [
          'supabase/migrations/20261116000000_ensure_chart_sources_node_id.sql',
        ],
        exampleBefore:
          '-- chart_sources table queried without node_id scoping',
        exampleAfter:
          'ALTER TABLE chart_sources ADD COLUMN IF NOT EXISTS node_id TEXT NOT NULL DEFAULT \'node-financial-model\';\nCREATE INDEX IF NOT EXISTS idx_chart_sources_node_id ON chart_sources(node_id);',
      },
    ],
    contentChanges: [
      {
        id: 'chart-sources-node-id-0.1.12',
        title: 'Apply chart_sources node_id Schema Migration',
        required: true,
        description:
          'Ensure the chart_sources table in Supabase includes the node_id column to prevent multi-node chart collisions.',
        affectedEntities: [
          'chart_sources',
          'supabase/migrations/20261116000000_ensure_chart_sources_node_id.sql',
        ],
        migrationPrompt:
          'Run `supabase/migrations/20261116000000_ensure_chart_sources_node_id.sql` in your Supabase SQL editor to add the `node_id` column and index to `chart_sources`.',
      },
      {
        id: 'canvas-fetch-error-handling-0.1.12',
        title: 'Adopt Canvas TopErrorBanner & Error State Handling',
        required: false,
        description:
          'Public mode DocumentCanvas now renders TopErrorBanner at top of viewport with a retry action upon edge fetch failure, suppressing false empty notices.',
        affectedEntities: ['DocumentCanvas', 'TopErrorBanner', 'useDocumentCanvas'],
        migrationPrompt:
          'Import TopErrorBanner from @devcabs/folio-engine if constructing custom canvas error handling, or verify DocumentCanvas retryFetch recovery on network errors.',
      },
      {
        id: 'content-version-watermark-0.1.12',
        title: 'Advance contentVersion Watermark to 0.1.12',
        required: true,
        description:
          'Update the contentVersion watermark in EngineConfig to 0.1.12 to acknowledge all migration items and silence Dev Mode pending migration warnings.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.1.12"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.1.13',
    releaseDate: '2026-11-16',
    title: 'Public Canvas Hydration Isolation & Edge Single-Source Defense',
    summary:
      'Gated Supabase cloud hydration strictly to active Developer Mode sessions, preventing public visitors from executing redundant cloud fetches. Defended public canvas subscriptions against wildcard aggregate event wipeouts, guaranteeing Edge KV single-source integrity.',
    breakingChanges: [
      'No breaking API removals; internal event guard and public hydration lifecycle hardening.',
    ],
    codeActions: [
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.1.13 to acknowledge public canvas hydration isolation.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.1.12" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.1.13" });',
      },
    ],
    contentChanges: [
      {
        id: 'public-hydration-isolation-0.1.13',
        title: 'Public Canvas Edge Single-Source Isolation',
        required: false,
        description:
          'Public visitors no longer execute background Supabase sync on startup, preserving Edge KV as the unconditional single source of truth.',
        affectedEntities: ['DeveloperModeContext', 'useDocumentCanvas', 'DocumentCanvas'],
        migrationPrompt:
          'No code changes required. Verify that public node refresh renders Edge KV documents without flashing empty draft notices.',
      },
      {
        id: 'content-version-watermark-0.1.13',
        title: 'Advance contentVersion Watermark to 0.1.13',
        required: true,
        description:
          'Update contentVersion watermark in EngineConfig to 0.1.13 to silence doctor drift warnings.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.1.13"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.1.14',
    releaseDate: '2026-11-17',
    title: 'Single-Source Stabilization, Fail-Stop Publish Pipeline & Edge Sanitization',
    summary:
      'Stabilized single-source publishing architecture: enforced fail-stop semantics on publish network errors, bundled dynamic chart configurations and portal chrome text directly into published snapshots and edge payloads with in-memory public hydration (zero storage pollution), purged cold-miss Cloudflare KV poisoning and client-side credential exposure, and enabled instant worldwide propagation with max-age=0 must-revalidate manifest caching.',
    breakingChanges: [
      'Removed deprecated compileAndDeployToEdgeKV and deployPayloadsToCloudflareKV from @devcabs/folio-engine client services (Cloudflare KV deployment is strictly handled via server edge Worker bindings in /api/publish).',
      'Fail-stop publish semantics: publishNewSnapshot() now truthfully returns { success: false, localSaved: false, edgeDeployed: false } and retains dirty draft state upon network or server errors instead of falling back to fake local publishing.',
    ],
    codeActions: [
      {
        description:
          'Remove direct imports and calls to compileAndDeployToEdgeKV or deployPayloadsToCloudflareKV in client-side applications.',
        affectedFiles: [
          'src/components/dev/DevPublishModal.tsx',
          'src/services/historyService.ts',
        ],
        exampleBefore:
          'import { compileAndDeployToEdgeKV } from "@devcabs/folio-engine";\nawait compileAndDeployToEdgeKV(snapshot);',
        exampleAfter:
          '// Remote edge KV deployment is handled automatically by the server-side /api/publish handler.\nawait publishNewSnapshot("Release title");',
      },
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.1.14 to acknowledge fail-stop publishing and edge sanitization.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.1.13" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.1.14" });',
      },
    ],
    contentChanges: [
      {
        id: 'edge-runtime-cache-control-0.1.14',
        title: 'Edge Runtime Sanitization & Instant Manifest Cache Revalidation',
        required: false,
        description:
          'Cloudflare KV cold misses no longer write synthetic empty documents into KV storage, and /api/public/manifest now responds with max-age=0, must-revalidate for instantaneous cache updates.',
        affectedEntities: ['publicHandler', 'portal:manifest', 'DocumentCanvas'],
        migrationPrompt:
          'No manual database migration required. Verify that freshly published portal updates reflect immediately upon public reload without 24-hour cache lag.',
      },
      {
        id: 'content-version-watermark-0.1.14',
        title: 'Advance contentVersion Watermark to 0.1.14',
        required: true,
        description:
          'Update contentVersion watermark in EngineConfig to 0.1.14 to clear pending migration notifications in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.1.14"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
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

