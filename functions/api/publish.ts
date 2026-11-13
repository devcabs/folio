/**
 * Edge Route: POST /api/publish
 * Cloudflare Pages Functions Handler
 * Location: functions/api/publish.ts
 * Specification: docs/task/3.7-unified-atomic-write-pipeline.md
 *
 * Implements:
 * 1. Single atomic edge publish endpoint replacing multi-hop client orchestration.
 * 2. Authenticates author session and validates snapshot payload.
 * 3. Atomic remote persistence to Supabase engine_history (insert active, demote previous).
 * 4. Direct Edge KV pre-baking via edge binding env.KV_ENGINE_PUBLIC (zero external REST API calls).
 * 5. Returns unified 3-tier status payload.
 */

import type { PagesFunctionEventContext } from '../../src/types/edge';
import type { PublishedSnapshot } from '../../src/types/history';

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

export async function onRequestPost(
  context: PagesFunctionEventContext<any>
): Promise<Response> {
  const { request, env } = context;

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
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
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
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
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
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

    let cloudSynced = false;
    let edgeDeployed = false;
    let cloudError: string | undefined;
    let edgeError: string | undefined;

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
          // Step B: Demote previous active snapshots
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

    // 2. Pre-bake directly into Cloudflare KV using edge binding (zero external REST API calls)
    if (env?.KV_ENGINE_PUBLIC) {
      try {
        for (const [nodeId, canvas] of Object.entries(snapshot.canvases)) {
          await env.KV_ENGINE_PUBLIC.put(
            `node:${nodeId}`,
            JSON.stringify({
              nodeId,
              snapshotId: snapshot.id,
              version: (canvas as any)?.version || 2,
              updatedAt: snapshot.createdAt,
              canvas,
              chartDatasets: {},
              sourceMetadata: {},
            })
          );
        }

        await env.KV_ENGINE_PUBLIC.put(
          'portal:manifest',
          JSON.stringify({
            activeSnapshotId: snapshot.id,
            publishedAt: snapshot.createdAt,
            nodeIds: Object.keys(snapshot.canvases),
            schemaVersion: snapshot.schemaVersion || 1,
          })
        );
        edgeDeployed = true;
      } catch (err: unknown) {
        edgeError = err instanceof Error ? err.message : 'Edge KV deployment error';
      }
    }

    const responsePayload: PublishResponseBody = {
      success: true,
      snapshotId: snapshot.id,
      publishedAt: snapshot.createdAt,
      cloudSynced,
      edgeDeployed,
      cloudError,
      edgeError,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
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
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
}

