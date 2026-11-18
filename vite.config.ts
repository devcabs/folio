import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

function loadSampleCanvases(): Record<string, any> {
  try {
    const canvasesPath = fileURLToPath(new URL('./src/data/sample-canvases.json', import.meta.url));
    const chartsPath = fileURLToPath(new URL('./src/data/baked-charts.json', import.meta.url));
    const canvases = JSON.parse(readFileSync(canvasesPath, 'utf8')) as Record<string, any>;
    const charts = JSON.parse(readFileSync(chartsPath, 'utf8')) as Array<{ chartId: string }>;
    const chartMap = new Map(charts.map((c) => [c.chartId, c]));

    const hydrateElements = (elements: any[]): any[] =>
      elements.map((el) => {
        if (el.type === 'subsection' && Array.isArray(el.elements)) {
          return { ...el, elements: hydrateElements(el.elements) };
        }
        if (el.type === 'chart' && el.chartId && !el.dataset && chartMap.has(el.chartId)) {
          return { ...el, dataset: chartMap.get(el.chartId) };
        }
        return el;
      });

    for (const doc of Object.values(canvases)) {
      if (Array.isArray(doc?.sections)) {
        doc.sections = doc.sections.map((sec: any) => ({
          ...sec,
          elements: Array.isArray(sec.elements) ? hydrateElements(sec.elements) : [],
        }));
      }
    }
    return canvases;
  } catch {
    return {};
  }
}

function createLocalEdgeDevPlugin(): Plugin {
  const kvStore = new Map<string, string>();
  const now = new Date().toISOString();
  const sampleNodeIds = ['access', 'equity', 'quality', 'resiliency', 'governance'];
  const sampleCanvases = loadSampleCanvases();

  kvStore.set(
    'portal:manifest',
    JSON.stringify({
      activeSnapshotId: 'local-dev',
      publishedAt: now,
      nodeIds: sampleNodeIds,
      schemaVersion: 1,
      contentOverrides: {},
    })
  );

  for (const nodeId of sampleNodeIds) {
    const canvas = sampleCanvases[nodeId] ?? {
      nodeId,
      version: 2,
      sections: [],
      updatedAt: now,
    };
    kvStore.set(
      `node:${nodeId}`,
      JSON.stringify({
        nodeId,
        snapshotId: 'local-dev',
        version: 2,
        updatedAt: now,
        canvas,
      })
    );
  }

  const localKv = {
    async get(key: string, options?: unknown) {
      const val = kvStore.get(key) ?? null;
      if (val !== null && (options === 'json' || (typeof options === 'object' && options !== null && (options as { type?: string }).type === 'json'))) {
        return JSON.parse(val);
      }
      return val;
    },
    async put(key: string, value: string | ArrayBuffer | ReadableStream) {
      if (typeof value === 'string') {
        kvStore.set(key, value);
      } else if (value instanceof ArrayBuffer) {
        kvStore.set(key, new TextDecoder().decode(value));
      }
    },
    async delete(key: string) {
      kvStore.delete(key);
    },
    async list(options?: { prefix?: string; limit?: number }) {
      const prefix = options?.prefix ?? '';
      const keys = Array.from(kvStore.keys())
        .filter((k) => k.startsWith(prefix))
        .slice(0, options?.limit ?? 1000)
        .map((name) => ({ name }));
      return { keys, list_complete: true };
    },
  };

  return {
    name: 'folio-local-edge-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }
        try {
          const { handleFolioEdgeRequest } = await server.ssrLoadModule('/src/edge/router.ts');
          const origin = `http://${req.headers.host || 'localhost:5174'}`;
          const method = (req.method || 'GET').toUpperCase();
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers.set(k, v);
            else if (Array.isArray(v)) headers.set(k, v.join(', '));
          }

          let body: string | undefined;
          if (method !== 'GET' && method !== 'HEAD') {
            body = await new Promise<string>((resolve, reject) => {
              const chunks: Buffer[] = [];
              req.on('data', (chunk: Buffer) => chunks.push(chunk));
              req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
              req.on('error', reject);
            });
          }

          const webRequest = new Request(new URL(req.url, origin), {
            method,
            headers,
            ...(body !== undefined ? { body } : {}),
          });

          const devSalt = process.env.DEV_SECURITY_SALT || 'folio-local-dev-salt';
          const devPinHash =
            process.env.DEV_PIN_HASH ||
            createHash('sha256').update(`${devSalt}:1234`).digest('hex');

          const webResponse: Response = await handleFolioEdgeRequest(
            webRequest,
            {
              KV_ENGINE_PUBLIC: localKv,
              DEV_SECURITY_SALT: devSalt,
              DEV_PIN_HASH: devPinHash,
            },
            undefined,
            { kv: localKv, disableAssetsFallback: true }
          );

          res.statusCode = webResponse.status;
          webResponse.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
          const buf = Buffer.from(await webResponse.arrayBuffer());
          res.end(buf);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), createLocalEdgeDevPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@testing-library/react': fileURLToPath(new URL('./tests/helpers/testing-library-shim.tsx', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 5174,
    host: true,
  },
});
