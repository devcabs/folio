import { isWriteAllowed, isProductionBuild, currentTargetLabel } from './runtime-env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
let installed = false;

interface GuardTarget {
  fetch: typeof fetch;
  location?: { hostname: string };
}

/**
 * Wraps fetch. Any mutating request whose URL starts with the configured
 * Supabase URL is rejected (HTTP 403 Response, never sent) unless isWriteAllowed().
 * Idempotent. Call once, before any service module issues requests.
 */
export function installSupabaseWriteGuard(
  supabaseUrl: string | undefined = import.meta.env?.VITE_SUPABASE_URL,
  target: GuardTarget = globalThis as unknown as GuardTarget,
  prodBuild: boolean = isProductionBuild()
): void {
  if (installed || !supabaseUrl) return;
  installed = true;
  const base = supabaseUrl.replace(/\/+$/, '');
  const realFetch = target.fetch.bind(globalThis);
  target.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const reqMethod = typeof input === 'object' && 'method' in input ? input.method : undefined;
    const method = (init?.method || reqMethod || 'GET').toUpperCase();
    if (url.startsWith(base) && !SAFE_METHODS.has(method)) {
      const host = target.location?.hostname ?? '';
      if (!isWriteAllowed(base, host, prodBuild)) {
        console.error(`[write-guard] BLOCKED ${method} ${url} (${currentTargetLabel(base)} from host "${host}")`);
        return new Response(
          JSON.stringify({ message: 'Write blocked by environment guard', code: 'ENV_WRITE_BLOCKED' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

/** Test helper only. */
export function resetWriteGuardForTesting(): void {
  installed = false;
}
