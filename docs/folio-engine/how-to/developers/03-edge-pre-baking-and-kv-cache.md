# How-To: Edge Pre-Baking & Cloudflare KV Static Cache

This guide demonstrates how to pre-bake dynamic application datasets into static JSON bundles for distribution on Cloudflare Pages Functions and KV storage.

---

## 🎯 Problem Statement

Calling Supabase and Google Sheets APIs dynamically on every user page load introduces latency, rate limiting, and egress costs. Folio Engine includes an **Edge Pre-Baking Pipeline** that compiles AST documents, remote images, and sheet datasets into static payloads served from Cloudflare's global edge network in $<15\text{ms}$.

---

## 🏗️ The Pre-Baking & Distribution Pipeline

```
[ Build Machine / CI ]
         │
         ▼
[ scripts/prebake-edge-kv.ts ]
         │
         ├── Fetches live Node items and Canvas ASTs
         ├── Pre-fetches and verifies Google Sheets CSV matrices
         ├── Resolves Google Drive photo candidates & creates responsive srcSet
         │
         ▼
[ Compiled JSON Payloads in dist/api/ ]
         ├── manifest.json
         ├── node/[nodeId].json
         └── chart/[chartId].json
         │
         ▼
[ wrangler pages deploy ] ──> [ Cloudflare Global Edge KV ]
                                          │
                                          ▼
                               [ Client Instant Hydration ]
```

---

## Step 1: Run the Pre-Bake Script

Execute the pre-bake script from the root of the repository:

```bash
npx tsx scripts/prebake-edge-kv.ts
```

The script performs the following actions:
1. Connects to `edgePreBakeService.ts` via the `@devcabs/folio-engine/edge` entrypoint.
2. Compiles `PublicPortalManifestPayloadSchema`, recording all available nodes, titles, and hash routes.
3. For each node, compiles `PublicNodePayloadSchema`, combining:
   - Node metadata and hero photo configurations.
   - Recursive `NodeCanvasDocument` AST.
   - Synchronized source attachment records (`SyncedSourceMetadata`).
   - Baked chart series data (`CachedIndicatorDataset`).
4. Emits compiled JSON files into `public/api/` or `dist/api/`.

---

## Step 2: Configure Cloudflare Pages Functions

Cloudflare Pages Functions reside in the `functions/api/` directory:

```
functions/
├── api/
│   ├── public/
│   │   ├── manifest.ts          # GET /api/public/manifest
│   │   └── node/
│   │       └── [id].ts          # GET /api/public/node/:id
│   └── media/
│       └── drive/
│           └── [fileId].ts      # Media edge proxy & WebP stream cache
```

### Example: Dynamic Node Edge Route

```typescript
// functions/api/public/node/[id].ts
import type { EventContext } from '@cloudflare/workers-types';

interface Env {
  FOLIO_KV?: KVNamespace;
}

export async function onRequestGet(context: EventContext<Env, 'id', unknown>) {
  const { params, env } = context;
  const nodeId = params.id as string;

  // 1. Attempt edge KV cache retrieval
  if (env.FOLIO_KV) {
    const cachedPayload = await env.FOLIO_KV.get(`node_${nodeId}`, 'text');
    if (cachedPayload) {
      return new Response(cachedPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }
  }

  // 2. Fallback to pre-baked static file
  return context.next();
}
```

---

## Step 3: Deploy to Cloudflare

Deploy the application and edge functions atomically using the official deploy pipeline:

```bash
npm run deploy
```

This runs:
1. `npm run test:tokens` & `npm test`.
2. `npm run build` & `npm run build:lib`.
3. Pre-bakes KV assets.
4. Executes `wrangler pages deploy dist`.

---

## 🔍 Validating Edge Delivery

Verify the edge deployment using curl:

```bash
curl -I https://your-domain.com/api/public/node/architecture
```

Expected response headers:
```http
HTTP/2 200
content-type: application/json
cf-cache-status: HIT
cache-control: public, max-age=300, s-maxage=3600
```
