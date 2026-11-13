import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSheetChartData } from '../../src/hooks/useSheetChartData';
import { useDocumentCanvas } from '../../src/hooks/useDocumentCanvas';
import { isAuthoringPlaceholder } from '../../src/utils/canvasDefaults';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import * as chartSourceService from '../../src/services/chartSourceService';
import type { PublicNodePayload } from '../../src/types/edge';

describe('Epic 3 — Single-Source Data Architecture & Integrity Gates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('3.1 Public Single-Source Reading Pipeline & Storage Purge', () => {
    it('queries Edge KV endpoint and avoids localStorage reads during public canvas hydration', async () => {
      // Mock public visitor mode (isDevMode: false)
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
        canUnlock: false,
        isUnlocked: false,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      const mockPayload: PublicNodePayload = {
        nodeId: 'access',
        snapshotId: 'snap-1',
        version: 1,
        updatedAt: '2026-11-13T00:00:00.000Z',
        canvas: {
          nodeId: 'access',
          version: 1,
          sections: [
            {
              id: 'sec-edge-1',
              type: 'section',
              title: 'Access Infrastructure Initiatives',
              number: '01',
              elements: [],
            },
          ],
          updatedAt: '2026-11-13T00:00:00.000Z',
        },
        chartDatasets: {},
        sourceMetadata: {},
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPayload,
      });
      (global as any).fetch = fetchMock;

      const getItemSpy = vi.spyOn(window.localStorage, 'getItem');
      const setItemSpy = vi.spyOn(window.localStorage, 'setItem');

      const { result, unmount } = renderHook(() => useDocumentCanvas('access'));

      // 1. Must fetch from edge endpoint
      expect(fetchMock).toHaveBeenCalledWith('/api/public/node/access');

      // 2. localStorage must NOT be queried for node canvas keys in public mode
      const canvasKeyAccesses = getItemSpy.mock.calls.filter((call) =>
        String(call[0]).includes('canvas_access')
      );
      expect(canvasKeyAccesses.length).toBe(0);

      // Wait for edge hydration resolution
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // 3. Hydrated document matches edge payload
      expect(result.current.document.sections.length).toBe(1);
      expect(result.current.document.sections[0].title).toBe('Access Infrastructure Initiatives');

      // 4. Public visitors must NEVER write to localStorage
      expect(setItemSpy).not.toHaveBeenCalled();

      unmount();
    });
  });

  describe('3.2 Purging Misleading Sibling Chart Fallback', () => {
    it('returns null dataset for unrecognized chartId even if valid nodeId is provided', () => {
      vi.spyOn(chartSourceService, 'fetchChartConfig').mockResolvedValue(null);
      vi.spyOn(chartSourceService, 'getCachedChartConfig').mockReturnValue(null);

      const { result } = renderHook(() =>
        useSheetChartData({
          chartId: 'non-existent-chart-id',
          nodeId: 'access',
          isDevMode: false,
        })
      );

      // CRITICAL GATE: Must never borrow sibling charts from the same node
      expect(result.current.dataset).toBeNull();
      expect(result.current.status).toBe('pending_data');
    });

    it('successfully resolves verified dataset when chartId explicitly matches a configured chart', () => {
      vi.spyOn(chartSourceService, 'fetchChartConfig').mockResolvedValue(null);
      vi.spyOn(chartSourceService, 'getCachedChartConfig').mockReturnValue(null);

      const { result } = renderHook(() =>
        useSheetChartData({
          chartId: 'chart-access-enrolment',
          nodeId: 'access',
          isDevMode: false,
        })
      );

      expect(result.current.dataset).not.toBeNull();
      expect(result.current.dataset?.chartId).toBe('chart-access-enrolment');
      expect(result.current.status).toBe('success');
    });
  });

  describe('3.5 Authoring Placeholder Sanitization Gate', () => {
    it('correctly identifies all factory authoring default strings', () => {
      expect(isAuthoringPlaceholder('Click Edit to add narrative text for this section.')).toBe(true);
      expect(isAuthoringPlaceholder('Photo documentation.')).toBe(true);
      expect(isAuthoringPlaceholder('Section Title')).toBe(true);
      expect(isAuthoringPlaceholder('Subsection Title')).toBe(true);
      expect(isAuthoringPlaceholder('   ')).toBe(true);
      expect(isAuthoringPlaceholder(null)).toBe(true);
      expect(isAuthoringPlaceholder(undefined)).toBe(true);
    });

    it('preserves genuine user-authored narratives', () => {
      expect(
        isAuthoringPlaceholder('Our district attained a 94.2% completion rate across all cohorts.')
      ).toBe(false);
      expect(isAuthoringPlaceholder('Annual Financial Transparency Report')).toBe(false);
      expect(isAuthoringPlaceholder('Verified Capital Investments')).toBe(false);
    });
  });
});
