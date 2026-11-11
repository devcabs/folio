import { describe, it, expect } from 'vitest';
import {
  calculateTargetVersion,
  compareSemver,
  isValidSemver,
} from '../../scripts/lib/semver-utils';
import {
  calculateTargetVersion as srcCalculateTargetVersion,
  compareSemver as srcCompareSemver,
  isValidSemver as srcIsValidSemver,
} from '../../src/utils/semver-utils';

// ─────────────────────────────────────────────
// calculateTargetVersion
// ─────────────────────────────────────────────
describe('calculateTargetVersion', () => {
  // Required verification criteria from task 1.1
  it('patch bumps from 0.1.3 to 0.1.4', () => {
    expect(calculateTargetVersion('0.1.3', 'patch')).toBe('0.1.4');
  });

  it('minor bumps from 0.1.3 to 0.2.0', () => {
    expect(calculateTargetVersion('0.1.3', 'minor')).toBe('0.2.0');
  });

  it('major bumps from 0.1.3 to 1.0.0', () => {
    expect(calculateTargetVersion('0.1.3', 'major')).toBe('1.0.0');
  });

  // Extended coverage
  it('prepatch bumps from 0.1.3 to 0.1.4-0', () => {
    expect(calculateTargetVersion('0.1.3', 'prepatch')).toBe('0.1.4-0');
  });

  it('preminor bumps from 0.1.3 to 0.2.0-0', () => {
    expect(calculateTargetVersion('0.1.3', 'preminor')).toBe('0.2.0-0');
  });

  it('premajor bumps from 0.1.3 to 1.0.0-0', () => {
    expect(calculateTargetVersion('0.1.3', 'premajor')).toBe('1.0.0-0');
  });

  it('prerelease increments trailing numeric pre-release identifier', () => {
    expect(calculateTargetVersion('1.0.0-alpha.1', 'prerelease')).toBe('1.0.0-alpha.2');
  });

  it('prerelease on release version acts like prepatch', () => {
    expect(calculateTargetVersion('1.0.0', 'prerelease')).toBe('1.0.1-0');
  });

  it('explicit semver passes through unchanged', () => {
    expect(calculateTargetVersion('0.1.3', '0.2.0')).toBe('0.2.0');
  });

  it('major resets minor and patch', () => {
    expect(calculateTargetVersion('2.5.9', 'major')).toBe('3.0.0');
  });

  it('minor resets patch only', () => {
    expect(calculateTargetVersion('2.5.9', 'minor')).toBe('2.6.0');
  });
});

// ─────────────────────────────────────────────
// compareSemver
// ─────────────────────────────────────────────
describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('0.1.3', '0.1.3')).toBe(0);
  });

  it('returns -1 when a < b (patch)', () => {
    expect(compareSemver('0.1.3', '0.1.4')).toBe(-1);
  });

  it('returns 1 when a > b (patch)', () => {
    expect(compareSemver('0.1.4', '0.1.3')).toBe(1);
  });

  it('returns -1 when a < b (minor)', () => {
    expect(compareSemver('0.1.9', '0.2.0')).toBe(-1);
  });

  it('returns -1 when a < b (major)', () => {
    expect(compareSemver('0.9.9', '1.0.0')).toBe(-1);
  });

  it('release beats pre-release of same version', () => {
    expect(compareSemver('1.0.0', '1.0.0-alpha')).toBe(1);
    expect(compareSemver('1.0.0-alpha', '1.0.0')).toBe(-1);
  });
});

// ─────────────────────────────────────────────
// isValidSemver
// ─────────────────────────────────────────────
describe('isValidSemver', () => {
  // Required verification criteria from task 1.1
  it('returns true for bare semver', () => {
    expect(isValidSemver('0.1.4')).toBe(true);
  });

  it('returns false for semver with v prefix', () => {
    expect(isValidSemver('v0.1.4')).toBe(false);
  });

  // Extended coverage
  it('returns true for pre-release semver', () => {
    expect(isValidSemver('1.0.0-alpha.1')).toBe(true);
  });

  it('returns false for partial version strings', () => {
    expect(isValidSemver('1.0')).toBe(false);
    expect(isValidSemver('1')).toBe(false);
  });

  it('returns false for non-semver strings', () => {
    expect(isValidSemver('latest')).toBe(false);
    expect(isValidSemver('')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// src/utils/semver-utils parity tests
// ─────────────────────────────────────────────
describe('src/utils/semver-utils parity', () => {
  it('exports identical compareSemver functionality in src bundle', () => {
    expect(srcCompareSemver('0.1.3', '0.1.4')).toBe(-1);
    expect(srcCompareSemver('0.1.4', '0.1.3')).toBe(1);
    expect(srcCompareSemver('0.1.3', '0.1.3')).toBe(0);
    expect(srcCompareSemver('1.0.0', '1.0.0-alpha')).toBe(1);
  });

  it('exports identical isValidSemver functionality in src bundle', () => {
    expect(srcIsValidSemver('0.1.4')).toBe(true);
    expect(srcIsValidSemver('v0.1.4')).toBe(false);
    expect(srcIsValidSemver('1.0.0-alpha.1')).toBe(true);
    expect(srcIsValidSemver('')).toBe(false);
  });

  it('exports calculateTargetVersion in src bundle', () => {
    expect(srcCalculateTargetVersion('0.1.3', 'patch')).toBe('0.1.4');
    expect(srcCalculateTargetVersion('0.1.3', 'minor')).toBe('0.2.0');
    expect(srcCalculateTargetVersion('0.1.3', 'major')).toBe('1.0.0');
  });
});

