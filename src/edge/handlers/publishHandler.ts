/**
 * Folio Engine — Edge Publish Handler
 * Location: src/edge/handlers/publishHandler.ts
 */

import type { PublishedSnapshot } from '../../types/history';
import type { KVNamespace } from '../../types/edge';
import {
  compilePublicNodePayload,
  compilePortalManifest,
} from '../../services/edgePreBakeService';

export interface PublishRequestBody {
  snapshot: PublishedSnapshot;
}

export interface PublishResponseBody {
  success: boolean;
  snapshotId?: string;
  publishedAt?: string;
  cloudSynced?: boolean;
  edgeDeployed?: boolean;
  cloudError?: string;
  edgeError?: string;
  error?: string;
}

/**
 * Handles POST /api/publish
 */
export async function handlePublishRoute(
  request: Request,
  env: any,
  kv: KVNamespace | null,
  _ctx?: any
): Promise<Response> {
  try {
    let body: PublishRequestBody;
    try {
      body = (await request.json()) as PublishRequestBody;
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON request payload',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const { snapshot } = body || {};

    // Validate snapshot contract
    if (
      !snapshot ||
      typeof snapshot !== 'object' ||
      !snapshot.id ||
      typeof snapshot.id !== 'string' ||
      !snapshot.canvases ||
      typeof snapshot.canvases !== 'object'
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Malformed snapshot payload: id and canvases are required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Validate author session
    if (!snapshot.authorSessionId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: Missing author session ID',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    let cloudSynced = false;
    let edgeDeployed = false;
    let cloudError: string | undefined;

    // 1. Persist to Supabase if configured in env
    const supabaseUrl = env?.VITE_SUPABASE_URL || env?.SUPABASE_URL;
    const supabaseKey =
      env?.SUPABASE_SERVICE_ROLE_KEY ||
      env?.VITE_SUPABASE_ANON_KEY ||
      env?.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const payload = {
        id: snapshot.id,
        schema_version: snapshot.schemaVersion || 1,
        title: snapshot.title,
        description: snapshot.description,
        snapshot_data: {
          canvases: snapshot.canvases,
          contentOverrides: snapshot.contentOverrides || {},
        },
        summary: snapshot.summary,
        is_active: true,
        author_session_id: snapshot.authorSessionId,
        created_at: snapshot.createdAt,
      };

      try {
        const insertRes = await fetch(`${supabaseUrl}/rest/v1/engine_history`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(payload),
        });

        if (insertRes.ok) {
          cloudSynced = true;
          // Demote previous active snapshots
          try {
            const patchRes = await fetch(
              `${supabaseUrl}/rest/v1/engine_history?is_active=eq.true&id=neq.${snapshot.id}`,
              {
                method: 'PATCH',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                  Prefer: 'return=minimal',
                },
                body: JSON.stringify({ is_active: false }),
              }
            );
            if (!patchRes.ok) {
              console.warn(
                `[publish] Demote previous active snapshots returned HTTP ${patchRes.status}`
              );
            }
          } catch (patchErr) {
            console.warn('[publish] Failed to demote previous active snapshots:', patchErr);
          }
        } else {
          cloudError = `Cloud sync failed with HTTP ${insertRes.status}`;
        }
      } catch (err: unknown) {
        cloudError = err instanceof Error ? err.message : 'Supabase network error';
      }
    }

    // 2. Pre-bake directly into Cloudflare KV using edge binding
    if (!kv) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'KV namespace binding not configured on edge runtime',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    try {
      const targetNodes = Object.keys(snapshot.canvases);
      for (const nodeId of targetNodes) {
        const compiled = compilePublicNodePayload(nodeId, snapshot);
        await kv.put(`node:${nodeId}`, JSON.stringify(compiled));

        // Also register individual chart datasets in KV for fast chart endpoint hits
        if (compiled.chartDatasets) {
          for (const [chartId, chartDataset] of Object.entries(compiled.chartDatasets)) {
            await kv.put(`chart:${chartId}`, JSON.stringify(chartDataset));
          }
        }
      }

      const manifestPayload = compilePortalManifest(snapshot, targetNodes);
      await kv.put('portal:manifest', JSON.stringify(manifestPayload));
      edgeDeployed = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Edge KV deployment error';
      return new Response(
        JSON.stringify({
          success: false,
          error: `Cloudflare KV deployment failed: ${msg}`,
          cloudSynced,
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Success response strictly when KV deployment confirmed
    const responsePayload: PublishResponseBody = {
      success: true,
      snapshotId: snapshot.id,
      publishedAt: snapshot.createdAt,
      cloudSynced,
      edgeDeployed,
      cloudError,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown publish failure';
    return new Response(
      JSON.stringify({
        success: false,
        error: msg,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
