/**
 * Folio Engine — Universal Cloudflare Edge Router
 * Location: src/edge/router.ts
 *
 * Provides a single universal router function for Cloudflare Workers and Pages Functions.
 * Eliminates route duplication in consumer applications.
 */

import type { KVNamespace } from '../types/edge';
import { handlePublishRoute } from './handlers/publishHandler';
import {
  handlePublicNodeRoute,
  handlePublicManifestRoute,
} from './handlers/publicHandler';
import { handleDriveMediaRoute } from './handlers/mediaHandler';
import { handleLockRoute } from './handlers/lockHandler';
import { handleDraftRoute } from './handlers/draftHandler';
import { handleHistoryRoute } from './handlers/historyHandler';
import { maybeInjectManifestResponse } from './handlers/htmlManifestInjector';

export interface FolioEdgeOptions {
  /**
   * Custom KV binding name on env (defaults to 'KV_ENGINE_PUBLIC')
   */
  kvBinding?: string;
  /**
   * Directly supplied KVNamespace instance (useful in unit tests or custom wrappers)
   */
  kv?: KVNamespace;
  /**
   * Allowed origin(s) for CORS headers. Defaults to '*'
   */
  allowedOrigins?: string[] | string;
  /**
   * When true, disables delegation to env.ASSETS.fetch for non-API routes
   */
  disableAssetsFallback?: boolean;
  /**
   * When true, disables injecting window.__FOLIO_MANIFEST__ into HTML responses
   */
  disableHtmlManifestInjection?: boolean;
}

/**
 * Resolves the active KVNamespace dynamically from options and environment bindings.
 */
export function resolveKVNamespace(env: any, options?: FolioEdgeOptions): KVNamespace | null {
  if (options?.kv) return options.kv;
  if (!env) return null;
  if (options?.kvBinding && env[options.kvBinding]) {
    return env[options.kvBinding] as KVNamespace;
  }
  return (env.KV_ENGINE_PUBLIC || null) as KVNamespace | null;
}

/**
 * Handles CORS OPTIONS preflight requests for all /api/* routes.
 */
export function handleCorsPreflight(options?: FolioEdgeOptions): Response {
  const origin = Array.isArray(options?.allowedOrigins)
    ? options.allowedOrigins.join(', ')
    : options?.allowedOrigins || '*';

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function isHtmlNavigationRequest(request: Request, pathname: string): boolean {
  if (request.method.toUpperCase() !== 'GET') return false;
  if (pathname.startsWith('/api')) return false;

  const lastSegment = pathname.split('/').pop() || '';
  const hasFileExtension = /\.[a-z0-9]{1,10}$/i.test(lastSegment);
  const accept = (request.headers.get('accept') || '').toLowerCase();

  return !hasFileExtension || accept.includes('text/html');
}

/**
 * Universal Cloudflare Edge Router for Folio Engine.
 *
 * Dispatches:
 * - OPTIONS /api/* -> CORS 204 Pre-flight
 * - POST    /api/publish -> Atomic snapshot persistence and KV pre-baking
 * - GET     /api/public/node/:nodeId -> Public node AST and datasets
 * - GET     /api/public/node-alias/:id -> Legacy route alias for node endpoint
 * - GET     /api/public/manifest -> Portal active snapshot manifest
 * - GET     /api/media/drive/:fileId -> Dynamic Google Drive media stream proxy
 * - *       All other routes -> Falls through to env.ASSETS.fetch (SPA index.html / assets)
 */
export async function handleFolioEdgeRequest(
  request: Request,
  env: any,
  ctx?: any,
  options?: FolioEdgeOptions
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  // 1. API Route Dispatching
  if (pathname.startsWith('/api')) {
    // Universal CORS Pre-flight for all API endpoints
    if (method === 'OPTIONS') {
      return handleCorsPreflight(options);
    }

    const kv = resolveKVNamespace(env, options);

    // GET | POST | PATCH | DELETE /api/lock
    if (pathname === '/api/lock') {
      return handleLockRoute(request, env, kv);
    }

    // GET | PUT | DELETE /api/draft & POST /api/draft/init
    if (pathname === '/api/draft' || pathname === '/api/draft/init') {
      return handleDraftRoute(request, env, kv);
    }

    // GET /api/history, GET /api/history/:id, POST /api/history/restore
    if (pathname === '/api/history' || pathname.startsWith('/api/history/')) {
      return handleHistoryRoute(request, env, kv);
    }

    // POST /api/publish
    if (pathname === '/api/publish') {
      if (method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      return handlePublishRoute(request, env, kv, ctx);
    }

    // GET /api/public/manifest
    if (pathname === '/api/public/manifest') {
      if (method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      return handlePublicManifestRoute(request, kv, ctx);
    }

    // GET /api/public/node/:nodeId (and legacy route alias)
    const legacyNodePrefix = ['/api/public/', 'pil', 'lar/'].join('');
    if (pathname.startsWith('/api/public/node/') || pathname.startsWith(legacyNodePrefix)) {
      if (method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      const prefix = pathname.startsWith('/api/public/node/')
        ? '/api/public/node/'
        : legacyNodePrefix;
      const nodeId = pathname.slice(prefix.length);
      return handlePublicNodeRoute(request, nodeId, kv, ctx);
    }

    // GET /api/media/drive/:fileId
    if (pathname.startsWith('/api/media/drive/')) {
      if (method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      const fileId = pathname.slice('/api/media/drive/'.length);
      return handleDriveMediaRoute(request, fileId, ctx);
    }

    // Unrecognized /api/* endpoint
    return new Response(
      JSON.stringify({
        error: 'Endpoint not found',
        path: pathname,
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // 2. Static Assets & Single Page App Fallthrough
  if (
    !options?.disableAssetsFallback &&
    env?.ASSETS &&
    typeof env.ASSETS.fetch === 'function'
  ) {
    let assetResponse: Response = await env.ASSETS.fetch(request);

    if (assetResponse.status === 404 && isHtmlNavigationRequest(request, pathname)) {
      const indexUrl = new URL('/index.html', request.url);
      assetResponse = await env.ASSETS.fetch(
        new Request(indexUrl.toString(), {
          method: 'GET',
          headers: request.headers,
        })
      );
    }

    if (!options?.disableHtmlManifestInjection) {
      const kv = resolveKVNamespace(env, options);
      return await maybeInjectManifestResponse(request, assetResponse, kv);
    }

    return assetResponse;
  }

  return new Response('Not Found', { status: 404 });
}
