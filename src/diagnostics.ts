/**
 * Folio Engine — Diagnostic Verification & Contract Testing Entry Point
 * Location: src/diagnostics.ts
 *
 * Dedicated entry point for build-time verification, CI pre-flight checks,
 * and prebake payload validation.
 */

export * from './diagnostics/verifyEngineSetup';
export {
  PublicNodePayloadSchema,
  PublicPortalManifestPayloadSchema,
  NodeCanvasDocumentSchema,
  CachedIndicatorDatasetSchema,
  SyncedSourceMetadataSchema,
} from './types/edge';
export {
  EngineConfigSchema,
  EngineBrandingConfigSchema,
} from './config/engine.config';
