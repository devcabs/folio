/**
 * Shared Edge Utilities for Cloudflare Pages Functions
 * Location: functions/api/public/_shared.ts
 * Specification: docs/tasks/task15_1_edge_routing_and_kv_schema_architecture.md
 */

import type { PagesFunctionEventContext, EdgeEnv } from '../../../src/types/edge';

export { computeWeakEtag, VALID_NODES, type ValidNodeId } from '../../../src/types/edge';
export {
  createEdgeJsonResponse,
  checkConditionalGet,
  CACHE_CONTROL_EDGE,
  CACHE_CONTROL_FALLBACK,
  type ResponseOptions,
} from '../../../src/edge/handlers/publicHandler';

export type PublicApiContext<P extends string = string> = PagesFunctionEventContext<EdgeEnv, P>;
