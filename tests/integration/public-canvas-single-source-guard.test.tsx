import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentCanvas } from '../../src/components/canvas/DocumentCanvas';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import { dispatchAggregateCanvasChange } from '../../src/services/canvasLayoutService';
import { FOLIO_MIGRATION_LEDGER, validateMigrationLedger } from '../../src/migrations/ledger';
import * as historyService from '../../src/services/historyService';

describe('Public Canvas Single-Source Guard & Event Isolation (v0.1.13)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
      isDevMode: false,
      isDesktop: true,
      canUnlock: false,
      isUnlocked: false,
      toggleDevMode: vi.fn(),
      unlockWithPin: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Edge KV published section and resists wildcard aggregate change wipeouts', async () => {
    const publishedCanvas = {
      nodeId: 'access',
      version: 2,
      sections: [
        {
          id: 'sec-published-research',
          type: 'section',
          title: 'Research Congress',
          number: '01',
          elements: [
            {
              id: 'text-desc',
              type: 'text',
              pointId: 'node.access.text.desc',
              content: 'Publicly verified research initiatives and findings.',
            },
          ],
        },
      ],
      updatedAt: '2026-11-16T00:51:44.854Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        nodeId: 'access',
        snapshotId: 'pub-edge-valid-123',
        version: 1,
        updatedAt: '2026-11-16T00:51:44.854Z',
        canvas: publishedCanvas,
      }),
    });

    const { unmount } = render(
      <DocumentCanvas
        nodeId="access"
        nodeTitle="Access"
      />
    );

    // Wait for Edge KV fetch to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    // 1. Must render published section title
    expect(screen.getByText('Research Congress')).toBeDefined();
    expect(screen.queryByTestId('canvas-empty-notice')).toBeNull();

    // 2. Simulate aggregate live event broadcast (nodeId: '*') without document payload
    await act(async () => {
      dispatchAggregateCanvasChange(false);
      await new Promise((r) => setTimeout(r, 30));
    });

    // 3. DocumentCanvas must STILL render the section and NOT wipe to empty draft notice
    expect(screen.getByText('Research Congress')).toBeDefined();
    expect(screen.queryByTestId('canvas-empty-notice')).toBeNull();

    unmount();
  });

  it('validates migration ledger entry for v0.1.13', () => {
    const validated = validateMigrationLedger(FOLIO_MIGRATION_LEDGER);
    const entry0113 = validated.find((e) => e.version === '0.1.13');
    expect(entry0113).toBeDefined();
    expect(entry0113?.title).toContain('Public Canvas Hydration Isolation');
    expect(entry0113?.breakingChanges.length).toBeGreaterThan(0);
    expect(entry0113?.codeActions.length).toBeGreaterThan(0);
    expect(entry0113?.contentChanges.length).toBeGreaterThan(0);
  });

  it('does NOT call hydrateActiveVersionFromCloud when in public mode', async () => {
    const hydrateSpy = vi.spyOn(historyService, 'hydrateActiveVersionFromCloud').mockResolvedValue(true);
    const { DeveloperModeProvider } = await import('../../src/context/DeveloperModeContext');
    const devSecurity = await import('../../src/utils/devSecurity');
    vi.spyOn(devSecurity, 'isSessionValid').mockReturnValue(false);

    const { unmount } = render(
      <DeveloperModeProvider>
        <div>Child</div>
      </DeveloperModeProvider>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(hydrateSpy).not.toHaveBeenCalled();
    unmount();
  });

  it('calls hydrateActiveVersionFromCloud when in Developer Mode', async () => {
    const hydrateSpy = vi.spyOn(historyService, 'hydrateActiveVersionFromCloud').mockResolvedValue(true);
    const { DeveloperModeProvider } = await import('../../src/context/DeveloperModeContext');
    const devSecurity = await import('../../src/utils/devSecurity');
    vi.spyOn(devSecurity, 'isDesktopDevice').mockReturnValue(true);
    vi.spyOn(devSecurity, 'isSessionValid').mockReturnValue(true);

    const { unmount } = render(
      <DeveloperModeProvider>
        <div>Child</div>
      </DeveloperModeProvider>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(hydrateSpy).toHaveBeenCalled();
    unmount();
  });
});
