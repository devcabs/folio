/**
 * Folio Engine — Edge & Cloudflare Worker Entry Point
 * Location: src/edge.ts
 *
 * Dedicated zero-DOM, zero-React entry point for Cloudflare Pages Functions,
 * Workers, and Node.js prebake scripts.
 */

export * from './types/edge';
export * from './services/edgePreBakeService';
export * from './utils/mediaUrl';
export {
  handleFolioEdgeRequest,
  resolveKVNamespace,
  handleCorsPreflight,
  type FolioEdgeOptions,
} from './edge/router';
export {
  handlePublishRoute,
  type PublishRequestBody,
  type PublishResponseBody,
} from './edge/handlers/publishHandler';
export {
  handlePublicNodeRoute,
  handlePublicManifestRoute,
  createEdgeJsonResponse,
  checkConditionalGet,
  CACHE_CONTROL_EDGE,
  CACHE_CONTROL_FALLBACK,
} from './edge/handlers/publicHandler';
export {
  handleDriveMediaRoute,
  parseRequestedWidth,
} from './edge/handlers/mediaHandler';
export {
  serializeManifestForHtmlScript,
  injectManifestIntoHtml,
  maybeInjectManifestResponse,
} from './edge/handlers/htmlManifestInjector';

