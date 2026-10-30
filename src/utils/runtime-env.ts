/**
 * Runtime environment separation (Task 11.98).
 * Pure functions: no globals read inside decision logic, so they are unit-testable.
 */
export const PROD_PROJECT_REF = 'mjuwqlxdxhujqiqpkcaj';
/** Hostnames allowed to WRITE to the production database. */
export const PROD_WRITE_HOSTS: readonly string[] = ['engine.example.com'];

export type TargetVerdict = { ok: true } | { ok: false; code: string; message: string };

export function urlTargetsProdProject(url: string): boolean {
  return url.toLowerCase().includes(PROD_PROJECT_REF);
}

export function isProductionBuild(): boolean {
  return typeof import.meta !== 'undefined' && import.meta.env?.PROD === true;
}

/** L2: does the configured DB match the build mode? */
export function evaluateSupabaseTarget(url: string, prodBuild: boolean): TargetVerdict {
  const isProdDb = urlTargetsProdProject(url);
  if (!prodBuild && isProdDb) {
    return {
      ok: false,
      code: 'DEV_BUILD_WITH_PROD_DB',
      message: 'Development build is pointed at the PRODUCTION database. Cloud disabled. Fix .env.development.',
    };
  }
  if (prodBuild && !isProdDb) {
    return {
      ok: false,
      code: 'PROD_BUILD_WITH_NON_PROD_DB',
      message: 'Production build is pointed at a non-production database. Cloud disabled. Fix .env.production.',
    };
  }
  return { ok: true };
}

/** L3: may a mutating request to this Supabase URL be sent from this page host? */
export function isWriteAllowed(supabaseUrl: string, pageHostname: string, prodBuild: boolean): boolean {
  if (!urlTargetsProdProject(supabaseUrl)) return true; // dev / mock DB: free to write
  return prodBuild && PROD_WRITE_HOSTS.includes(pageHostname.toLowerCase());
}

export function currentTargetLabel(supabaseUrl: string): 'PROD-DB' | 'DEV-DB' {
  return urlTargetsProdProject(supabaseUrl) ? 'PROD-DB' : 'DEV-DB';
}
