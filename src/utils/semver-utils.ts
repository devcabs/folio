/**
 * semver-utils.ts
 *
 * Pure semver arithmetic and comparison helpers for the Folio Engine runtime.
 * Zero external dependencies — safe for SSR, browser, and edge runtimes.
 *
 * Exports:
 *   - compareSemver(a: string, b: string): -1 | 0 | 1
 *   - isValidSemver(v: string): boolean
 *   - calculateTargetVersion(current: string, bump: BumpType | string): string
 */

export type BumpType =
  | 'patch'
  | 'minor'
  | 'major'
  | 'prepatch'
  | 'preminor'
  | 'premajor'
  | 'prerelease';

/**
 * Parse a semver string into its numeric parts.
 * Accepts bare semver without a 'v' prefix.
 */
function parse(v: string): { major: number; minor: number; patch: number; pre: string } {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(-(.+))?$/);
  if (!m) throw new Error(`Invalid semver: "${v}"`);
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    pre: m[5] ?? '',
  };
}

/**
 * Replicates npm's `npm version <bump>` semver arithmetic for all standard bump
 * types plus explicit semver targets.
 *
 * @param current - The current version string (no 'v' prefix), e.g. '0.1.3'
 * @param bump    - A BumpType keyword or an explicit semver target string.
 * @returns       The computed next version string (no 'v' prefix).
 */
export function calculateTargetVersion(current: string, bump: BumpType | string): string {
  // Explicit semver target — validate and return as-is.
  if (isValidSemver(bump)) return bump;

  const { major, minor, patch, pre } = parse(current);

  switch (bump) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'premajor':
      return `${major + 1}.0.0-0`;
    case 'preminor':
      return `${major}.${minor + 1}.0-0`;
    case 'prepatch':
      return `${major}.${minor}.${patch + 1}-0`;
    case 'prerelease': {
      if (pre) {
        // Increment trailing numeric identifier if present.
        const preNum = pre.match(/^(.*?)(\d+)$/);
        if (preNum) {
          return `${major}.${minor}.${patch}-${preNum[1]}${parseInt(preNum[2], 10) + 1}`;
        }
        return `${major}.${minor}.${patch}-${pre}.0`;
      }
      // No existing pre-release — treat like prepatch.
      return `${major}.${minor}.${patch + 1}-0`;
    }
    default:
      throw new Error(`Unknown bump type: "${bump}"`);
  }
}

/**
 * Pure numeric comparison of two semver strings (no 'v' prefix).
 *
 * @returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parse(a);
  const pb = parse(b);

  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;

  // Pre-release handling: a release beats a pre-release of the same version.
  if (pa.pre === pb.pre) return 0;
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre && !pb.pre) return -1;

  // Both have pre-release identifiers — compare lexicographically.
  return pa.pre < pb.pre ? -1 : pa.pre > pb.pre ? 1 : 0;
}

/**
 * Validates that a string is a bare semver (no 'v' prefix allowed).
 * Accepts optional pre-release identifiers.
 *
 * Valid:   '0.1.4', '1.0.0-alpha.1'
 * Invalid: 'v0.1.4', '1.0', 'latest'
 */
export function isValidSemver(v: string): boolean {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(v);
}

