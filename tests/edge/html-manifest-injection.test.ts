import { describe, it, expect, vi } from 'vitest';
import type { KVNamespace, PublicPortalManifestPayload } from '../../src/types/edge';
import {
  serializeManifestForHtmlScript,
  injectManifestIntoHtml,
  maybeInjectManifestResponse,
} from '../../src/edge/handlers/htmlManifestInjector';
import { handleFolioEdgeRequest } from '../../src/edge/router';

function createMockKV(
  initial: Record<string, string> = {},
  options?: { throwOnGet?: boolean }
): KVNamespace & { getSpy: ReturnType<typeof vi.fn> } {
  const store = new Map<string, string>(Object.entries(initial));
  const getSpy = vi.fn(async (key: string) => {
    if (options?.throwOnGet) {
      throw new Error('KV read failure');
    }
    return store.get(key) ?? null;
  });

  return {
    getSpy,
    get: getSpy as KVNamespace['get'],
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return {
        keys: Array.from(store.keys()).map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
}

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Folio Portal</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

function createSampleManifest(overrides: Partial<PublicPortalManifestPayload> = {}): PublicPortalManifestPayload {
  return {
    activeSnapshotId: 'snap-2026-11-19',
    publishedAt: '2026-11-19T00:00:00.000Z',
    nodeIds: ['access'],
    schemaVersion: 1,
    pages: {
      'page-notes': {
        id: 'page-notes',
        slug: '2026-notes',
        title: '2026 Notes',
        parentId: 'access',
        order: 0,
        createdAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:00:00.000Z',
      },
    },
    ...overrides,
  };
}

describe('Subtask 13.5: Edge HTML window.__FOLIO_MANIFEST__ Injection Middleware', () => {
  it('1. injects <script id="folio-manifest-bootstrap">window.__FOLIO_MANIFEST__=...</script> before </head> on deep HTML routes', async () => {
    const manifest = createSampleManifest();
    const kv = createMockKV({
      'portal:manifest': JSON.stringify(manifest),
    });

    const env = {
      KV_ENGINE_PUBLIC: kv,
      ASSETS: {
        fetch: vi.fn(async () =>
          new Response(SAMPLE_HTML, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Length': String(SAMPLE_HTML.length),
              'ETag': '"stale-etag"',
            },
          })
        ),
      },
    };

    const req = new Request('https://example.com/node/access/research/2026-notes/', {
      method: 'GET',
      headers: { Accept: 'text/html' },
    });

    const res = await handleFolioEdgeRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.text();

    const expectedScriptPrefix = '<script id="folio-manifest-bootstrap">window.__FOLIO_MANIFEST__=';
    expect(body).toContain(expectedScriptPrefix);
    expect(body).toContain(`${expectedScriptPrefix}${JSON.stringify(manifest)};</script></head>`);

    // Verify parsed pages intact
    const match = body.match(/window\.__FOLIO_MANIFEST__=(.+?);<\/script>/);
    expect(match).not.toBeNull();
    const evaluated = JSON.parse(match![1]);
    expect(evaluated.activeSnapshotId).toBe('snap-2026-11-19');
    expect(evaluated.pages['page-notes'].slug).toBe('2026-notes');
  });

  it('2. strictly escapes XSS sequences (</script>, <, >, &, \\u2028, \\u2029) and evaluates cleanly to original string', () => {
    const maliciousTitle = '</script><img src=x onerror=alert(1)> & \u2028 \u2029 <!-- comment -->';
    const manifest = createSampleManifest({
      pages: {
        'page-xss': {
          id: 'page-xss',
          slug: 'xss-test',
          title: maliciousTitle,
          parentId: 'access',
          order: 0,
          createdAt: '2026-11-19T00:00:00.000Z',
          updatedAt: '2026-11-19T00:00:00.000Z',
        },
      },
    });

    const scriptTag = serializeManifestForHtmlScript(JSON.stringify(manifest));

    // Must NOT contain raw </script> or raw <, >, & inside the JSON payload
    const innerPayload = scriptTag
      .replace('<script id="folio-manifest-bootstrap">window.__FOLIO_MANIFEST__=', '')
      .replace(';</script>', '');

    expect(innerPayload).not.toContain('</script>');
    expect(innerPayload).not.toContain('<');
    expect(innerPayload).not.toContain('>');
    expect(innerPayload).not.toContain('&');
    expect(innerPayload).not.toContain('\u2028');
    expect(innerPayload).not.toContain('\u2029');
    expect(innerPayload).toContain('\\u003c/script\\u003e');
    expect(innerPayload).toContain('\\u003cimg');
    expect(innerPayload).toContain('\\u0026');
    expect(innerPayload).toContain('\\u2028');
    expect(innerPayload).toContain('\\u2029');

    // Evaluating in JS produces the exact original string
    const evaluated = new Function(`return (${innerPayload});`)();
    expect(evaluated.pages['page-xss'].title).toBe(maliciousTitle);
  });

  it('3. passes through non-HTML assets (JS, CSS, WebP) without touching KV', async () => {
    const kv = createMockKV({
      'portal:manifest': JSON.stringify(createSampleManifest()),
    });

    const assetCases = [
      { path: '/assets/app.js', contentType: 'application/javascript; charset=utf-8', body: 'console.log(1);' },
      { path: '/assets/styles.css', contentType: 'text/css; charset=utf-8', body: 'body{margin:0}' },
      { path: '/images/hero.webp', contentType: 'image/webp', body: 'RIFF....WEBP' },
    ];

    for (const asset of assetCases) {
      kv.getSpy.mockClear();
      const originalRes = new Response(asset.body, {
        status: 200,
        headers: { 'Content-Type': asset.contentType, 'ETag': '"asset-etag"' },
      });

      const req = new Request(`https://example.com${asset.path}`, { method: 'GET' });
      const res = await maybeInjectManifestResponse(req, originalRes, kv);

      expect(res).toBe(originalRes);
      expect(kv.getSpy).not.toHaveBeenCalled();
      expect(await res.text()).toBe(asset.body);
    }
  });

  it('4. passes through untouched on HEAD/POST requests, null KV, missing manifest, KV error, or malformed JSON', async () => {
    const manifestRaw = JSON.stringify(createSampleManifest());
    const validKv = createMockKV({ 'portal:manifest': manifestRaw });

    // HEAD / POST passthrough
    for (const method of ['HEAD', 'POST']) {
      validKv.getSpy.mockClear();
      const htmlRes = new Response(SAMPLE_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
      const res = await maybeInjectManifestResponse(
        new Request('https://example.com/node/access', { method }),
        htmlRes,
        validKv
      );
      expect(res).toBe(htmlRes);
      expect(validKv.getSpy).not.toHaveBeenCalled();
    }

    // Null KV
    {
      const htmlRes = new Response(SAMPLE_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
      const res = await maybeInjectManifestResponse(
        new Request('https://example.com/node/access'),
        htmlRes,
        null
      );
      expect(res).toBe(htmlRes);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(SAMPLE_HTML);
    }

    // Missing portal:manifest
    {
      const emptyKv = createMockKV();
      const htmlRes = new Response(SAMPLE_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
      const res = await maybeInjectManifestResponse(
        new Request('https://example.com/node/access'),
        htmlRes,
        emptyKv
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(SAMPLE_HTML);
    }

    // KV throws
    {
      const throwingKv = createMockKV({}, { throwOnGet: true });
      const htmlRes = new Response(SAMPLE_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
      const res = await maybeInjectManifestResponse(
        new Request('https://example.com/node/access'),
        htmlRes,
        throwingKv
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(SAMPLE_HTML);
    }

    // Malformed JSON in KV
    {
      const corruptKv = createMockKV({ 'portal:manifest': '{not-valid-json' });
      const htmlRes = new Response(SAMPLE_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
      const res = await maybeInjectManifestResponse(
        new Request('https://example.com/node/access'),
        htmlRes,
        corruptKv
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(SAMPLE_HTML);
    }

    // Direct injectManifestIntoHtml with malformed JSON
    expect(injectManifestIntoHtml(SAMPLE_HTML, '{broken')).toBe(SAMPLE_HTML);
  });

  it('5. performs multi-segment SPA fallback to /index.html and injects manifest, while missing static assets still return 404', async () => {
    const manifest = createSampleManifest();
    const kv = createMockKV({
      'portal:manifest': JSON.stringify(manifest),
    });

    const assetsFetch = vi.fn(async (req: Request) => {
      const url = new URL(req.url);
      if (url.pathname === '/index.html') {
        return new Response(SAMPLE_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const env = {
      KV_ENGINE_PUBLIC: kv,
      ASSETS: { fetch: assetsFetch },
    };

    // Deep subpage route -> 404 from ASSETS -> fallback to /index.html -> 200 with injected manifest
    const deepReq = new Request('https://example.com/node/access/deep/subpage/', { method: 'GET' });
    const deepRes = await handleFolioEdgeRequest(deepReq, env);
    expect(deepRes.status).toBe(200);
    expect(assetsFetch).toHaveBeenCalledTimes(2);
    const secondCallReq = assetsFetch.mock.calls[1][0] as Request;
    expect(new URL(secondCallReq.url).pathname).toBe('/index.html');

    const deepBody = await deepRes.text();
    expect(deepBody).toContain('window.__FOLIO_MANIFEST__=');

    // Missing static asset -> remains 404, no fallback to /index.html
    assetsFetch.mockClear();
    const missingAssetReq = new Request('https://example.com/assets/missing.js', { method: 'GET' });
    const missingAssetRes = await handleFolioEdgeRequest(missingAssetReq, env);
    expect(missingAssetRes.status).toBe(404);
    expect(assetsFetch).toHaveBeenCalledTimes(1);
  });

  it('6. removes stale Content-Length and ETag and sets Cache-Control: public, max-age=0, must-revalidate', async () => {
    const kv = createMockKV({
      'portal:manifest': JSON.stringify(createSampleManifest()),
    });

    const htmlRes = new Response(SAMPLE_HTML, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': '123',
        'ETag': '"old-etag"',
        'Cache-Control': 'public, max-age=3600',
      },
    });

    const res = await maybeInjectManifestResponse(
      new Request('https://example.com/node/access'),
      htmlRes,
      kv
    );

    expect(res.headers.get('Content-Length')).toBeNull();
    expect(res.headers.get('ETag')).toBeNull();
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
  });

  it('7. respects disableHtmlManifestInjection option in FolioEdgeOptions', async () => {
    const kv = createMockKV({
      'portal:manifest': JSON.stringify(createSampleManifest()),
    });

    const env = {
      KV_ENGINE_PUBLIC: kv,
      ASSETS: {
        fetch: vi.fn(async () =>
          new Response(SAMPLE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        ),
      },
    };

    const res = await handleFolioEdgeRequest(
      new Request('https://example.com/node/access'),
      env,
      undefined,
      { disableHtmlManifestInjection: true }
    );

    expect(res.status).toBe(200);
    expect(kv.getSpy).not.toHaveBeenCalled();
    expect(await res.text()).toBe(SAMPLE_HTML);
  });
});
