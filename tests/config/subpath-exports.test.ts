import { describe, it, expect } from 'vitest';
import * as rootExports from '../../src/index';
import * as edgeExports from '../../src/edge';
import * as diagnosticsExports from '../../src/diagnostics';

describe('Subpath Exports & Multi-Entry Architecture', () => {
  it('exposes the App component and UI tokens in root export', () => {
    expect(rootExports.App).toBeDefined();
    expect(typeof rootExports.App).toBe('function');
    expect(rootExports.getEngineConfig).toBeDefined();
  });

  it('exposes edge and KV contracts without importing React components', () => {
    expect(edgeExports.VALID_NODES).toBeDefined();
    expect(edgeExports.computeWeakEtag).toBeDefined();
    expect(typeof edgeExports.computeWeakEtag).toBe('function');
    expect(edgeExports.buildEdgeMediaUrl).toBeDefined();
    // Edge subpath must not export React UI components
    expect((edgeExports as any).App).toBeUndefined();
    expect((edgeExports as any).DocumentCanvas).toBeUndefined();
  });

  it('exposes diagnostic tools and validation schemas in diagnostics export', () => {
    expect(diagnosticsExports.validateNodePayload).toBeDefined();
    expect(typeof diagnosticsExports.validateNodePayload).toBe('function');
    expect(diagnosticsExports.verifyEngineWiring).toBeDefined();
    expect(diagnosticsExports.PublicNodePayloadSchema).toBeDefined();
    expect(diagnosticsExports.EngineConfigSchema).toBeDefined();
    // Diagnostics subpath must not export React UI components
    expect((diagnosticsExports as any).App).toBeUndefined();
  });
});
