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
  {
    version: '0.1.15',
    releaseDate: '2026-11-17',
    title: 'Authoritative Published Baseline & Unified Draft Hydration Fidelity',
    summary:
      'Enforced Cloudflare Edge KV as the single authoritative source for draft baseline hydration with zero-localStorage pollution, prevented screen wipe during Dev Mode toggle, enabled clean draft automatic baseline advancement upon published snapshot rollouts, and added end-to-end integration test coverage for dev-switch reactive canvas events.',
    breakingChanges: [
      'No breaking API removals; internal baseline hydration, screen wipe prevention, and draft staleness invalidation hardening.',
    ],
    codeActions: [
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.1.15 to acknowledge authoritative draft baseline hydration and screen wipe prevention.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.1.14" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.1.15" });',
      },
    ],
    contentChanges: [
      {
        id: 'draft-baseline-fidelity-0.1.15',
        title: 'Authoritative Draft Baseline Hydration & Screen Wipe Defense',
        required: false,
        description:
          'Developer Mode draft initialization now clones strictly from Cloudflare Edge KV (/api/public/node/:nodeId) with zero localStorage document pollution, useDocumentCanvas preserves live rendered content across Dev Mode toggles until draft finishes hydrating, and clean drafts automatically track newly published snapshot baselines.',
        affectedEntities: ['useDocumentCanvas', 'draftService', 'canvasLayoutService'],
        migrationPrompt:
          'No manual database migration required. Authoring sessions automatically hydrate authoritative live baselines from Cloudflare Edge KV without screen flickering.',
      },
      {
        id: 'content-version-watermark-0.1.15',
        title: 'Advance contentVersion Watermark to 0.1.15',
        required: true,
        description:
          'Update contentVersion watermark in EngineConfig to 0.1.15 to acknowledge authoritative draft baseline hydration and clear pending migration warnings.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.1.15"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.1.16',
    releaseDate: '2026-11-17',
    title: 'Drive Gallery Auto-Sync, Zero-Flash Skeleton & Resilient Fallbacks',
    summary:
      'Enabled automatic background photo synchronization for Google Drive galleries in both public and developer modes, bundled synced photo items directly into published snapshot manifests and Edge KV node payloads, added zero-flash shimmer skeleton wireframes during SWR resolution, upgraded EmptyState with 4-state action affordances, and provided direct Google Drive escape hatches on sync error or restricted folder states.',
    breakingChanges: [
      'No breaking API removals; additive resilience enhancements for SourceGallery, useDrivePhotoSync, EmptyState, and snapshot source metadata bundling.',
    ],
    codeActions: [
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.1.16 to acknowledge gallery resilience and snapshot photo bundling.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.1.15" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.1.16" });',
      },
    ],
    contentChanges: [
      {
        id: 'gallery-resilience-0.1.16',
        title: 'Google Drive Gallery Auto-Sync & Resilient Fallback State',
        required: false,
        description:
          'Photo galleries automatically trigger background photo synchronization on mount when a Google Drive folder is attached, display responsive shimmer skeletons while loading, and present an actionable Open in Google Drive button on sync errors or permission restrictions.',
        affectedEntities: ['SourceGallery', 'useDrivePhotoSync', 'EmptyState', 'historyService'],
        migrationPrompt:
          'No manual database migration required. Galleries with linked Google Drive folders will automatically sync and render dignified empty and error states.',
      },
      {
        id: 'content-version-watermark-0.1.16',
        title: 'Advance contentVersion Watermark to 0.1.16',
        required: true,
        description:
          'Update contentVersion watermark in EngineConfig to 0.1.16 to acknowledge gallery resilience and clear pending migration warnings.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.1.16"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.2.0',
    releaseDate: '2026-11-18',
    title: 'Epic 7: Cloudflare KV Single Source of Truth (SSOT) & Self-Contained AST',
    summary:
      'Completed the Epic 7 Single Source of Truth architecture on Cloudflare KV. Removed legacy Supabase and localStorage persistence modules, embedded chart configs/datasets and source galleries directly inside self-contained Document ASTs, added Cloudflare KV edge handlers (draftHandler, historyHandler, lockHandler), introduced PortalChromeContext, and standardized on KV_ENGINE_PUBLIC.',
    breakingChanges: [
      'Removed legacy Supabase config/write-guard, browser storage adapter, runtime-env, history storage, media, source, and chart source service modules from @devcabs/folio-engine in favor of Cloudflare KV SSOT.',
      'Removed handlePublicChartRoute (/api/public/chart/:chartId) and renderPlaceholderSvg from @devcabs/folio-engine/edge; chart configs and datasets now live inline within each node AST.',
      'Removed fallback to KV_MASID_PUBLIC in resolveKVNamespace; Edge Workers must bind KV_ENGINE_PUBLIC (or pass options.kvBinding).',
    ],
    codeActions: [
      {
        description:
          'Remove imports of deleted legacy Supabase, browser storage, history storage, media, source, and chart source modules, and delegate all edge API routes (/api/draft, /api/history, /api/lock, /api/publish, /api/public/*, /api/media/*) to handleFolioEdgeRequest.',
        affectedFiles: ['src/App.tsx', 'worker.ts'],
        exampleBefore: 'import { isSupabaseConfigured } from "@devcabs/folio-engine";',
        exampleAfter: 'import { handleFolioEdgeRequest } from "@devcabs/folio-engine/edge";',
      },
      {
        description:
          'Update Cloudflare KV binding to KV_ENGINE_PUBLIC and wrap the app with PortalChromeProvider (PortalChromeContext) when consuming portal chrome state.',
        affectedFiles: ['wrangler.toml', 'src/App.tsx'],
        exampleBefore: 'kv_namespaces = [{ binding = "KV_MASID_PUBLIC", id = "..." }]',
        exampleAfter: 'kv_namespaces = [{ binding = "KV_ENGINE_PUBLIC", id = "..." }]',
      },
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.2.0 to acknowledge the Epic 7 SSOT architecture and breaking module removals.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.1.16" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.2.0" });',
      },
    ],
    contentChanges: [
      {
        id: 'kv-ssot-self-contained-ast-0.2.0',
        title: 'Cloudflare KV SSOT & Self-Contained Node AST Migration',
        required: true,
        description:
          'Node payloads in Cloudflare KV (KV_ENGINE_PUBLIC) now store self-contained Document ASTs with embedded chart configurations, datasets, and source gallery items, eliminating separate /api/public/chart/:chartId fetches and Supabase/localStorage dependencies.',
        affectedEntities: ['KV_ENGINE_PUBLIC', 'DocumentCanvas', 'draftHandler', 'historyHandler', 'lockHandler', 'PortalChromeContext'],
        migrationPrompt:
          'Ensure KV_ENGINE_PUBLIC is bound in Cloudflare, re-publish or run prebake-edge-kv to populate self-contained node AST payloads, and verify /api/draft, /api/history, and /api/lock route through handleFolioEdgeRequest.',
      },
      {
        id: 'content-version-watermark-0.2.0',
        title: 'Advance contentVersion Watermark to 0.2.0',
        required: true,
        description:
          'Update contentVersion watermark in EngineConfig to 0.2.0 to acknowledge the Epic 7 SSOT architecture and clear pending migration warnings.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.2.0"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.2.1',
    releaseDate: '2026-11-18',
    title: 'KV Hydration Freshness, Chart Step 1 Progressive Disclosure & History Ledger UI',
    summary:
      'Fixed stale KV reads with no-store/must-revalidate caching, rebuilt draft baselines from unstripped snapshot ASTs, added PortalChromeContext hasHydrated & canvas/content sync events, refined Dev Mode publish-and-exit lifecycle, added progressive disclosure to ChartConfigDrawer Step 1, and upgraded HistoryHubModal to a vertical timeline ledger.',
    breakingChanges: [
      'No breaking API changes; additive hydration, draft baseline, and UI refinements only.',
    ],
    codeActions: [
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.2.1 to acknowledge KV hydration, chart drawer, and history ledger updates.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.2.0" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.2.1" });',
      },
    ],
    contentChanges: [
      {
        id: 'kv-hydration-and-chart-step1-0.2.1',
        title: 'KV Cache Revalidation & Authoring Draft Baseline Sync',
        required: false,
        description:
          'Public node responses now use must-revalidate caching, client KV fetches use cache: "no-store", draft init rebuilds from unstripped snapshot ASTs (preserving sheetUrl and Drive URLs), and PortalChromeContext exposes hasHydrated.',
        affectedEntities: ['draftHandler', 'publicHandler', 'PortalChromeContext', 'useDocumentCanvas', 'ChartConfigDrawer', 'HistoryHubModal'],
        migrationPrompt:
          'No manual content migration required. Redeploy your Worker/Pages bundle so edge handlers serve must-revalidate headers and fresh draft baselines.',
      },
      {
        id: 'content-version-watermark-0.2.1',
        title: 'Advance contentVersion Watermark to 0.2.1',
        required: true,
        description:
          'Update contentVersion watermark in EngineConfig to 0.2.1 to clear pending migration warnings in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.2.1"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.2.2',
    releaseDate: '2026-11-18',
    title: 'Edge PIN Security Env Audit & Pre-0.2.0 KV AST Migration Guide',
    summary:
      'Added edge wrangler security env diagnostics (DEV_SECURITY_SALT and DEV_PIN_HASH), explicit 5xx PIN verification feedback in DeveloperModeContext, and migration guidance for folding pre-0.2.0 chartDatasets and sourceMetadata into self-contained Canvas AST elements.',
    breakingChanges: [
      'No breaking API changes; additive diagnostics, 5xx lock error reporting, and migration guidance only.',
    ],
    codeActions: [
      {
        description:
          'Configure DEV_SECURITY_SALT and DEV_PIN_HASH in wrangler.json / wrangler.toml vars so POST /api/lock can verify coordinator PINs on the Edge Worker without returning HTTP 503.',
        affectedFiles: ['wrangler.json', 'wrangler.toml'],
        exampleBefore:
          '"kv_namespaces": [{ "binding": "KV_ENGINE_PUBLIC", "id": "..." }]',
        exampleAfter:
          '"vars": {\n  "DEV_SECURITY_SALT": "your_salt",\n  "DEV_PIN_HASH": "your_sha256_pin_hash"\n},\n"kv_namespaces": [{ "binding": "KV_ENGINE_PUBLIC", "id": "..." }]',
      },
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.2.2 to acknowledge edge PIN security configuration.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.2.1" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.2.2" });',
      },
    ],
    contentChanges: [
      {
        id: 'edge-pin-security-vars-0.2.2',
        title: 'Configure DEV_SECURITY_SALT & DEV_PIN_HASH in Wrangler',
        required: true,
        description:
          'Edge lockHandler requires DEV_SECURITY_SALT and DEV_PIN_HASH in Cloudflare Worker environment variables to authenticate coordinator PINs via POST /api/lock.',
        affectedEntities: ['wrangler.json', 'wrangler.toml', 'lockHandler'],
        migrationPrompt:
          'Add `vars: { DEV_SECURITY_SALT, DEV_PIN_HASH }` to your `wrangler.json` or `[vars]` in `wrangler.toml` matching your application securitySalt and expectedPinHash.',
      },
      {
        id: 'content-version-watermark-0.2.2',
        title: 'Advance contentVersion Watermark to 0.2.2',
        required: true,
        description:
          'Update contentVersion watermark in EngineConfig to 0.2.2 to clear pending migration warnings in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.2.2"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.2.3',
    releaseDate: '2026-11-18',
    title: 'Google Sheets Public GViz & HTMLView Verification Without Sheets API Key',
    summary:
      'Restored public GViz CSV access verification and /htmlview tab discovery in sheetsVerificationService and eliminated duplicate parallel tab fetches in useSheetVerification so Google Sheets link verification works with zero Google Sheets API key requirement.',
    breakingChanges: [
      'No breaking API changes; restores public GViz and htmlview Google Sheets verification compatibility.',
    ],
    codeActions: [
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.2.3 to acknowledge restored public Google Sheets verification.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.2.2" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.2.3" });',
      },
    ],
    contentChanges: [
      {
        id: 'sheets-gviz-verification-0.2.3',
        title: 'Public GViz & HTMLView Google Sheets Verification',
        required: false,
        description:
          'ChartConfigDrawer Step 1 verifies public Google Sheets links via GViz CSV probe and discovers sheet tabs via /htmlview without requiring the Google Sheets API v4 to be enabled on your API key.',
        affectedEntities: ['sheetsVerificationService', 'useSheetVerification', 'ChartConfigDrawer'],
        migrationPrompt:
          'No manual migration required. Upgrade @devcabs/folio-engine to 0.2.3 to verify public Google Sheets links without a Google Sheets API key.',
      },
      {
        id: 'content-version-watermark-0.2.3',
        title: 'Advance contentVersion Watermark to 0.2.3',
        required: true,
        description:
          'Update contentVersion watermark in EngineConfig to 0.2.3 to clear pending migration warnings in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.2.3"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.2.4',
    releaseDate: '2026-11-18',
    title: 'Dev Mode Canvas Authoring Controls, Insertion Bars & Modal Unification',
    summary:
      'Rendered the post-header + Add Element bar unconditionally on canvas sections and subsections in Developer Mode, eliminated the subsection ghost hover zone and duplicate trailing insertion bar, removed the duplicate footer Sync Photos button in SourceGallery, and unified floating toolbar Edit actions with the side Edit button modals/drawers for galleries (LinkFolderModal) and charts (ChartConfigDrawer).',
    breakingChanges: [
      'No breaking API changes; additive Developer Mode canvas authoring fixes and unified edit modal/drawer routing.',
    ],
    codeActions: [
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.2.4 to acknowledge Developer Mode canvas authoring and modal unification updates.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.2.3" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.2.4" });',
      },
    ],
    contentChanges: [
      {
        id: 'canvas-authoring-modal-unification-0.2.4',
        title: 'Unified Canvas Authoring Bars & Edit Modals',
        required: false,
        description:
          'Developer Mode sections and subsections always expose a single post-header + Add Element bar without ghost hover gaps, SourceGallery renders a single side Sync button, and floating toolbar Edit triggers open the same LinkFolderModal and pre-populated ChartConfigDrawer as side Edit buttons.',
        affectedEntities: ['DocumentCanvas', 'CanvasItemControls', 'SourceGallery', 'ChartCard'],
        migrationPrompt:
          'No manual code migration required. Upgrade @devcabs/folio-engine to 0.2.4 for unified Developer Mode canvas authoring controls and edit modals.',
      },
      {
        id: 'content-version-watermark-0.2.4',
        title: 'Advance contentVersion Watermark to 0.2.4',
        required: true,
        description:
          'Update contentVersion watermark in EngineConfig to 0.2.4 to clear pending migration warnings in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.2.4"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.2.5',
    releaseDate: '2026-11-18',
    title: 'Chart Config UX Realignment (Epic 10) & Nested Editorial ToC',
    summary:
      'Realigned ChartConfigDrawer Step 2 into Shape the Data -> Encode the Visual -> Polish & Label with a segmented chart type switcher, non-exclusive accordions, Auto/Zero baseline toggles, and split Scatter analytics/scale controls; added nested subsection Table of Contents support in useAutoToc and EditorialSidebar.',
    breakingChanges: [
      'No breaking API changes; additive NavItem.level and NavItem.children properties and ChartConfigDrawer Step 2 UX realignment.',
    ],
    codeActions: [
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.2.5 to acknowledge Epic 10 chart configuration UX and nested ToC updates.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.2.4" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.2.5" });',
      },
    ],
    contentChanges: [
      {
        id: 'chart-config-ux-realignment-0.2.5',
        title: 'Chart Configuration UX Realignment & Nested Subsection ToC',
        required: false,
        description:
          'ChartConfigDrawer Step 2 now uses a segmented Chart Type switcher, non-exclusive accordions, Auto | Zero baseline toggles, and Shape -> Encode -> Polish ordering; EditorialSidebar and useAutoToc support nested subsection navigation items.',
        affectedEntities: ['ChartConfigDrawer', 'Step3ChartSetup', 'EditorialSidebar', 'useAutoToc', 'NavItem'],
        migrationPrompt:
          'No manual code migration required. Upgrade @devcabs/folio-engine to 0.2.5 for the realigned chart configuration UX and nested subsection ToC.',
      },
      {
        id: 'content-version-watermark-0.2.5',
        title: 'Advance contentVersion Watermark to 0.2.5',
        required: true,
        description:
          'Update contentVersion watermark in EngineConfig to 0.2.5 to clear pending migration warnings in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.2.5"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.2.6',
    releaseDate: '2026-11-19',
    title: 'Lightweight Canvas PDF Support (Epic 11): Inline PdfElement & Drive DocumentsElement',
    summary:
      'Added lightweight canvas PDF support without heavy client dependencies: single PdfElement (CanvasPdf) with Google Drive /preview iframe and "Open in New Tab" escape hatch, and Google Drive PDF folder sync via DocumentsElement (CanvasDocuments, SourceDocuments, PdfPreviewModal, EditDocumentModal, driveDocumentSyncService, useDriveDocumentSync), plus edge Zod schema validation, --pdf-* / --doc-* design tokens, and streamlined collapsible DevMigrationModal UI.',
    breakingChanges: [
      'No breaking API removals; additive "pdf" (PdfElement) and "documents" (DocumentsElement) variants in CanvasElementType and CanvasLeafElement unions. Consumers with exhaustive switch (leaf.type) statements without a default branch should handle "pdf" and "documents" or delegate leaf rendering to <DocumentCanvas>.',
    ],
    codeActions: [
      {
        description:
          'Handle "pdf" and "documents" leaf element types in any custom CanvasLeafElement switch statements or AST traversals (or delegate rendering to <DocumentCanvas>).',
        affectedFiles: ['src/components/canvas/DocumentCanvas.tsx'],
        exampleBefore:
          'switch (leaf.type) {\n  case "text": return ...;\n  case "photo": return ...;\n  case "gallery": return ...;\n  case "chart": return ...;\n}',
        exampleAfter:
          'switch (leaf.type) {\n  case "text": return ...;\n  case "photo": return ...;\n  case "gallery": return ...;\n  case "chart": return ...;\n  case "pdf": return <CanvasPdf element={leaf} nodeId={nodeId} />;\n  case "documents": return <CanvasDocuments element={leaf} nodeId={nodeId} />;\n}',
      },
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.2.6 to acknowledge Epic 11 PDF and Drive document folder support.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.2.5" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.2.6" });',
      },
    ],
    contentChanges: [
      {
        id: 'canvas-pdf-and-documents-0.2.6',
        title: 'Canvas Single PDF & Google Drive PDF Folder Support',
        required: false,
        description:
          'Coordinators can now embed Single PDFs (drive.google.com/file/d/{id}/view) via CanvasPdf and synchronize Google Drive PDF folders (drive.google.com/drive/folders/{id}) via CanvasDocuments / SourceDocuments directly inside any canvas section or subsection.',
        affectedEntities: [
          'CanvasPdf',
          'CanvasDocuments',
          'SourceDocuments',
          'PdfPreviewModal',
          'useDriveDocumentSync',
          'CanvasAddBar',
        ],
        migrationPrompt:
          'No manual database migration required. Coordinators can insert Single PDF or PDF Folder blocks via the + Add Element menu in Developer Mode.',
      },
      {
        id: 'content-version-watermark-0.2.6',
        title: 'Advance contentVersion Watermark to 0.2.6',
        required: true,
        description:
          'Update the contentVersion watermark in EngineConfig to 0.2.6 to acknowledge Epic 11 PDF support and clear pending migration warnings in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.2.6"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.2.7',
    releaseDate: '2026-11-19',
    title: 'Canonical UI Primitives & Anti-Duplication Consolidation (Epic 12)',
    summary:
      'Added canonical UI primitives (IconButton, InlineAlert, FormField, Input, Textarea, Select, Checkbox, SegmentedControl, ModalActions, and shared SVG icons including DocumentIcon), enforced feedback token purity, deduplicated CanvasElementFields and SourceFolderActionBar, and locked in static canonical UI regression guardrails.',
    breakingChanges: [
      'No breaking API removals; additive canonical UI primitives exported from @devcabs/folio-engine. Removed redundant internal layout/StatusPill wrapper—consume StatusPill from the root package export.',
    ],
    codeActions: [
      {
        description:
          'Adopt newly exported canonical UI primitives from @devcabs/folio-engine where building custom forms, icon buttons, modal footers, or inline alerts.',
        affectedFiles: ['src/App.tsx'],
        exampleBefore: 'import { Button, Modal } from "@devcabs/folio-engine";',
        exampleAfter:
          'import {\n  Button,\n  IconButton,\n  InlineAlert,\n  FormField,\n  Input,\n  Textarea,\n  Select,\n  Checkbox,\n  SegmentedControl,\n  Modal,\n  ModalActions,\n  DocumentIcon,\n} from "@devcabs/folio-engine";',
      },
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.2.7 to acknowledge Epic 12 canonical UI primitives.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.2.6" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.2.7" });',
      },
    ],
    contentChanges: [
      {
        id: 'canonical-ui-primitives-0.2.7',
        title: 'Canonical UI Primitives & Form System',
        required: false,
        description:
          'Added IconButton, InlineAlert, FormField, Input, Textarea, Select, Checkbox, SegmentedControl, ModalActions, and shared SVG icon primitives (DocumentIcon, EditIcon, TrashIcon, CloseIcon, SearchIcon, ArrowRightIcon, AlertCircleIcon) with full 4-state interactive matrices and token-pure CSS modules.',
        affectedEntities: [
          'IconButton',
          'InlineAlert',
          'FormField',
          'Input',
          'Textarea',
          'Select',
          'Checkbox',
          'SegmentedControl',
          'ModalActions',
          'DocumentIcon',
        ],
        migrationPrompt:
          'No manual database migration required. Use the new canonical UI primitives from @devcabs/folio-engine for consistent 4-state focus/hover styling.',
      },
      {
        id: 'content-version-watermark-0.2.7',
        title: 'Advance contentVersion Watermark to 0.2.7',
        required: true,
        description:
          'Update the contentVersion watermark in EngineConfig to 0.2.7 to acknowledge Epic 12 canonical UI consolidation and clear pending migration warnings in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.2.7"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.3.0',
    releaseDate: '2026-11-19',
    title: 'Dynamic Multi-Page & Nested Subpage Architecture (Epic 13)',
    summary:
      'Added unlimited-depth nested subpage trees backed by a normalized PageNode registry, 1:1 PageLinkElement canvas cards, single-authority PageTitle editing, cross-page workspace undo/redo with route reconciliation, guarded branch deletion (DELETE ALL SUBPAGES), 2-level AppHeader dropdowns, collapsed Breadcrumb, contextual EditorialSidebar, Smart 404 fuzzy recovery, and Edge HTML window.__FOLIO_MANIFEST__ injection for zero-wait deep-link cold loads.',
    breakingChanges: [
      'Flat Canvas AST v3 (CANVAS_SCHEMA_VERSION = 3): NodeCanvasDocument.sections (SectionElement[]) was replaced by flat NodeCanvasDocument.elements (CanvasElement[]), and SectionElement.elements / SubsectionElement.elements were removed from v3 types and Zod schemas (NodeCanvasDocumentSchema, SectionElementSchema, SubsectionElementSchema). Legacy v2 nested canvases are auto-migrated at runtime.',
      'canvasLayoutService: renumberSections(sections) was renamed to renumberCanvasElements(elements), and layout helpers (insertSection, insertSubsection, insertLeafElement, moveCanvasItem, relocateCanvasItem, removeCanvasItem, updateCanvasItem) now operate on flat CanvasElement[] documents.',
      'Consumers with exhaustive `switch (leaf.type)` statements over `CanvasLeafElement` or `CanvasModalElementType` must handle the new `"page-link"` (`PageLinkElement`) variant.',
      'RouteState.type / RouteType now includes `"hydrating"` during deep-link cold loads; exhaustive route type checks must handle `"hydrating"`.',
    ],
    codeActions: [
      {
        description:
          'Migrate any direct TypeScript references from NodeCanvasDocument.sections to flat NodeCanvasDocument.elements (v3 AST) and use LegacySectionElement / LegacySubsectionElement only when reading unmigrated v2 JSON.',
        affectedFiles: ['src/App.tsx', 'src/services/*.ts'],
        exampleBefore: 'const sections = doc.sections;\nconst items = sections.flatMap((s) => s.elements);',
        exampleAfter: 'const elements = doc.elements;\nconst sections = elements.filter((el) => el.type === "section");',
      },
      {
        description:
          'Replace renumberSections with renumberCanvasElements when invoking canvas layout helpers directly.',
        affectedFiles: ['src/App.tsx', 'src/services/*.ts'],
        exampleBefore: 'import { renumberSections } from "@devcabs/folio-engine";\nconst next = renumberSections(doc.sections);',
        exampleAfter: 'import { renumberCanvasElements } from "@devcabs/folio-engine";\nconst next = renumberCanvasElements(doc.elements);',
      },
      {
        description:
          'Ensure Cloudflare Edge consumer worker.ts delegates via handleFolioEdgeRequest from @devcabs/folio-engine/edge to enable automatic window.__FOLIO_MANIFEST__ HTML injection and multi-segment SPA fallback.',
        affectedFiles: ['worker.ts'],
        exampleBefore: 'return env.ASSETS.fetch(request);',
        exampleAfter: 'return handleFolioEdgeRequest(request, env, ctx);',
      },
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.3.0 to acknowledge Epic 13 dynamic nested subpages and v3 flat canvas AST.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.2.7" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.3.0" });',
      },
    ],
    contentChanges: [
      {
        id: 'dynamic-nested-pages-0.3.0',
        title: 'Normalized PageNode Registry & PageLinkElement AST Leaf',
        required: false,
        description:
          'Added optional `pages?: PageRegistry` to DraftWorkspacePayload, PublishedSnapshot, and PublicPortalManifestPayload, along with `page-link` canvas elements and `deletedPageIds` atomic branch purge.',
        affectedEntities: [
          'PageNode',
          'PageRegistry',
          'PageLinkElement',
          'CanvasPageLink',
          'PageIcon',
        ],
        migrationPrompt:
          'No manual database migration required. Existing flat chapter workspaces default `pages` to `{}` automatically on draft init and publish.',
      },
      {
        id: 'content-version-watermark-0.3.0',
        title: 'Advance contentVersion Watermark to 0.3.0',
        required: true,
        description:
          'Update the contentVersion watermark in EngineConfig to 0.3.0 to acknowledge Epic 13 dynamic nested subpages and clear pending migration warnings in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.3.0"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.3.1',
    releaseDate: '2026-11-20',
    title: 'CanvasPageLink Dynamic Photo Shuffling & Smart 404 Recovery Polish',
    summary:
      'Added dynamic photo shuffling with smooth crossfades for CanvasPageLink cover fallbacks, expanded Smart 404 route segment capture to top-level paths, and streamlined PageNotFound empty-state presentation.',
    breakingChanges: [
      'No breaking API changes; additive features, visual refinements, and non-breaking route recovery enhancements only.',
    ],
    codeActions: [
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.3.1 to acknowledge dynamic photo shuffle and Smart 404 recovery refinements.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.3.0" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.3.1" });',
      },
    ],
    contentChanges: [
      {
        id: 'page-link-cover-shuffle-0.3.1',
        title: 'CanvasPageLink Dynamic Photo Shuffling & Stock Fallbacks',
        required: false,
        description:
          'CanvasPageLink cards lacking explicit cover images now automatically cycle through photos registered on target pages and descendant subpages (or bundled stock photos) with smooth crossfades.',
        affectedEntities: [
          'CanvasPageLink',
          'usePageShufflePhoto',
          'pagePhotoPool',
        ],
        migrationPrompt:
          'No migration required. Page link cards will automatically display cycling photos when no coverImage is provided.',
      },
      {
        id: 'smart-404-recovery-polish-0.3.1',
        title: 'Top-Level Route Segment Capture & PageNotFound Clean Visuals',
        required: false,
        description:
          'Smart 404 now extracts attempted path segments on top-level mistyped URLs for fuzzy suggestion matching, with refined single-CTA layout and empty-state messaging.',
        affectedEntities: [
          'PageNotFound',
          'useHashRoute',
          'parseRoute',
        ],
        migrationPrompt:
          'No migration required. Top-level 404 paths now automatically offer fuzzy suggestions when close matches exist.',
      },
      {
        id: 'content-version-watermark-0.3.1',
        title: 'Advance contentVersion Watermark to 0.3.1',
        required: true,
        description:
          'Update the contentVersion watermark in EngineConfig to 0.3.1 to acknowledge photo shuffling and Smart 404 recovery polish.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.3.1"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.3.2',
    releaseDate: '2026-11-23',
    title: 'PageLinkElement Card Size Variants (Small & Large Hero) & Grid Clustering',
    summary:
      'Added cardSize ("sm" | "md" | "lg") variant to PageLinkElement, wired SegmentedControl in the page-link authoring modal General tab, implemented 2-column grid clustering for consecutive sm cards in DocumentCanvas, and added large hero rendering while keeping existing md cards 100% untouched.',
    breakingChanges: [
      'No breaking API changes; additive features and rendering variants only. Omitted cardSize gracefully defaults to "md" for complete backward compatibility with existing canvas AST documents.',
    ],
    codeActions: [
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.3.2 to acknowledge PageLinkElement card size variants and grid clustering.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.3.1" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.3.2" });',
      },
    ],
    contentChanges: [
      {
        id: 'page-link-card-sizes-0.3.2',
        title: 'PageLinkElement Card Size Variants (Small, Medium & Large)',
        required: false,
        description:
          'PageLinkElement now accepts an optional cardSize property ("sm" | "md" | "lg"). Small (sm) renders a compact vertical card with top thumbnail and Read cue, automatically clustered into a 2-column grid (>=640px) when placed consecutively in DocumentCanvas. Large (lg) renders a cinematic hero card with prominent cover, display typography, and an Explore CTA button. Omitted cardSize renders the existing medium editorial card.',
        affectedEntities: [
          'PageLinkElement',
          'PageLinkCardSize',
          'CanvasPageLink',
          'DocumentCanvas',
          'UniversalEditModal',
          'CanvasElementFields',
        ],
        migrationPrompt:
          'No migration required. Existing page link elements default to "md" automatically. Authors can select Small, Medium, or Large from the Card Size SegmentedControl in the General tab of the Page Link edit modal.',
      },
      {
        id: 'content-version-watermark-0.3.2',
        title: 'Advance contentVersion Watermark to 0.3.2',
        required: true,
        description:
          'Update the contentVersion watermark in EngineConfig to 0.3.2 to acknowledge PageLinkElement card size variants and clear pending migration warnings in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.3.2"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.3.3',
    releaseDate: '2026-11-23',
    title: 'Atomic Page Link Mutations & Optimistic Concurrency Conflict Resolution',
    summary:
      'Resolved concurrent write / stale expectedUpdatedAt conflict when editing page-link canvas elements by unifying canvas element updates and page metadata updates into a single atomic draft workspace transaction, lazy-reading authoritative timestamps, and auto-recovering from 409 concurrency collisions.',
    breakingChanges: [
      'No breaking API changes; bug fix patch release ensuring atomic multi-entity workspace persistence.',
    ],
    codeActions: [
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.3.3 to acknowledge atomic page link mutations and concurrency conflict fixes.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.3.2" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.3.3" });',
      },
    ],
    contentChanges: [
      {
        id: 'atomic-page-link-mutations-0.3.3',
        title: 'Atomic Page Link Mutations in Draft Workspace',
        required: false,
        description:
          'Editing a page-link element now atomically persists both canvas card size AST changes and page metadata changes in a single PUT /api/draft transaction, eliminating HTTP 409 optimistic concurrency races and maintaining unified undo history.',
        affectedEntities: [
          'DocumentCanvas',
          'PortalChromeContext',
          'draftService',
        ],
        migrationPrompt:
          'No migration required. Update @devcabs/folio-engine to 0.3.3 to benefit from unified atomic page-link transactions and automatic 409 concurrency conflict recovery.',
      },
      {
        id: 'content-version-watermark-0.3.3',
        title: 'Advance contentVersion Watermark to 0.3.3',
        required: true,
        description:
          'Update the contentVersion watermark in EngineConfig to 0.3.3 to acknowledge atomic page-link mutations and clear pending migration warnings in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.3.3"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.3.4',
    releaseDate: '2026-11-26',
    title: 'Unified Media Support — Inline Video Block & Mixed Photo/Video Drive Galleries',
    summary:
      'Added inline VideoElement (Google Drive & YouTube nocookie iframe embeds), unified CanvasAddBar Photo into a Media submenu (Single Photo, Single Video, Media Gallery), and extended drivePhotoSyncService, SourceCard, and SourceLightbox to sync and play both image/* and video/* items in GalleryElement.',
    breakingChanges: [
      'No breaking API changes; additive VideoElement AST type, CanvasVideo component, and optional SourceItem/SyncedSourceItem video fields only. Legacy GalleryElement.syncedPhotos items without mediaType default to "image".',
    ],
    codeActions: [
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.3.4 to acknowledge unified video and mixed-media gallery support.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.3.3" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.3.4" });',
      },
    ],
    contentChanges: [
      {
        id: 'unified-media-support-0.3.4',
        title: 'Inline VideoElement & Mixed Photo/Video Drive Galleries',
        required: false,
        description:
          'CanvasLeafElement now includes VideoElement ("video") rendered via <CanvasVideo> for Google Drive and YouTube URLs. SourceItem and SyncedSourceItem gain optional mediaType ("image" | "video"), embedUrl, durationMs, and mimeType fields so GalleryElement syncs both photos and videos from Google Drive folders.',
        affectedEntities: [
          'VideoElement',
          'VideoProvider',
          'CanvasVideo',
          'GalleryElement',
          'SourceItem',
          'SyncedSourceItem',
          'drivePhotoSyncService',
          'SourceLightbox',
        ],
        migrationPrompt:
          'No migration required. Legacy GalleryElement.syncedPhotos entries without mediaType default to "image". If your consumer app implements an exhaustive switch over CanvasLeafElement.type, add a case for "video" or delegate rendering to <DocumentCanvas>.',
      },
      {
        id: 'content-version-watermark-0.3.4',
        title: 'Advance contentVersion Watermark to 0.3.4',
        required: true,
        description:
          'Update the contentVersion watermark in EngineConfig to 0.3.4 to acknowledge unified video and mixed-media gallery support and clear pending migration warnings in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.3.4"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
      },
    ],
  },
  {
    version: '0.3.5',
    releaseDate: '2026-11-26',
    title: 'Mobile Chart Hardening, PDF/Document Layouts & Mobile Dev Gate',
    summary:
      'Hardened all 5 SVG chart visualizers (BarChart, LineChart, DonutChart, ScatterPlot, HistogramChart), ChartCard (mobile kebab menu & legend toggle), ChartTooltip, ChartLegend, ChartTableModal, and ChartConfigDrawer for 320px–480px viewports via container-driven ResizeObserver SVG coordinates, >= 10px–11px typography, touch hit-targets, and viewport-clamped tap-to-inspect tooltips. Added additive layout variants (list | sm | full) for PdfElement and DocumentsElement, plus mobile DevPinModal desktop-only gating and canvas/drawer responsiveness.',
    breakingChanges: [
      'No breaking API or schema changes; additive mobile chart CSS tokens, internal useChartContainerWidth hook, responsive useChartPlotArea options, optional PdfElement.layout / DocumentsElement.layout ("list" | "sm" | "full"), and mobile DevPinModal desktop-only gating.',
    ],
    codeActions: [
      {
        description:
          'Advance EngineConfig contentVersion watermark to 0.3.5 to acknowledge mobile chart hardening, PDF/document layout variants, and mobile Dev Mode updates.',
        affectedFiles: ['src/engine-setup.ts', 'src/App.tsx'],
        exampleBefore: 'setEngineConfig({ contentVersion: "0.3.4" });',
        exampleAfter: 'setEngineConfig({ contentVersion: "0.3.5" });',
      },
    ],
    contentChanges: [
      {
        id: 'mobile-chart-hardening-0.3.5',
        title: 'Mobile Chart Responsive Geometry, Kebab Menu & Touch Ergonomics',
        required: false,
        description:
          'All 5 SVG chart engines now measure container width via useChartContainerWidth and pass responsive dimensions into useChartPlotArea so rendered SVG typography stays >= 10–11px on 320px–480px screens. ChartCard adds a mobile kebab menu and legend toggle; ChartTooltip renders unit values and clamps within container bounds with unified tap-to-inspect / tap-outside-to-dismiss; ChartLegend supports compact mobile pills and tap-toggle; ChartConfigDrawer and ChartTableModal wrap cleanly with zero horizontal overflow.',
        affectedEntities: [
          'BarChart',
          'LineChart',
          'DonutChart',
          'ScatterPlot',
          'HistogramChart',
          'ChartCard',
          'ChartTooltip',
          'ChartLegend',
          'ChartConfigDrawer',
          'ChartTableModal',
          'tokens.css',
        ],
        migrationPrompt:
          'No migration required. Existing ChartConfig and CanvasElement schemas are unchanged.',
      },
      {
        id: 'pdf-documents-layout-variants-0.3.5',
        title: 'Additive PDF & Documents Layout Variants (list | sm | full)',
        required: false,
        description:
          'PdfElement and DocumentsElement now support an optional `layout` field ("list" | "sm" | "full") in canvas and edge Zod schemas, allowing compact 2-column cards ("sm"), list rows ("list"), or full-height inline PDF previews ("full") in CanvasPdf, CanvasDocuments, and SourceDocuments.',
        affectedEntities: [
          'PdfElement',
          'DocumentsElement',
          'CanvasPdf',
          'CanvasDocuments',
          'SourceDocuments',
          'DocumentsElementSchema',
          'PdfElementSchema',
        ],
        migrationPrompt:
          'No migration required; existing PDF and Documents elements default to standard layout when `layout` is omitted.',
      },
      {
        id: 'content-version-watermark-0.3.5',
        title: 'Advance contentVersion Watermark to 0.3.5',
        required: true,
        description:
          'Update the contentVersion watermark in EngineConfig to 0.3.5 to acknowledge mobile chart hardening and layout updates, clearing pending migration warnings in Dev Mode and doctor reports.',
        affectedEntities: ['EngineConfig', 'src/engine-setup.ts', 'src/App.tsx'],
        migrationPrompt:
          'Set `contentVersion: "0.3.5"` in your application EngineConfig to clear pending migration warnings in Dev Mode and doctor reports.',
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

