import { describe, it, expect } from 'vitest';
import { resolveContentWatermark } from '../../src/utils/watermarkResolver';

describe('watermarkResolver (Single-Source EngineConfig.contentVersion)', () => {
  it("returns '0.0.0' when configVersion is undefined", () => {
    expect(resolveContentWatermark(undefined)).toBe('0.0.0');
  });

  it("returns '0.0.0' when configVersion is empty string or whitespace", () => {
    expect(resolveContentWatermark('')).toBe('0.0.0');
    expect(resolveContentWatermark('   ')).toBe('0.0.0');
  });

  it('returns trimmed configVersion when provided', () => {
    expect(resolveContentWatermark('0.1.3')).toBe('0.1.3');
    expect(resolveContentWatermark('  0.2.0  ')).toBe('0.2.0');
    expect(resolveContentWatermark('1.0.0')).toBe('1.0.0');
  });
});
