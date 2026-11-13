import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { DataPendingCard } from '../../src/components/chart/DataPendingCard';
import { ChartCard } from '../../src/components/chart/ChartCard';
import * as developerModeHook from '../../src/hooks/useDeveloperMode';
import type { SheetChartConfig } from '../../src/types/chart';

describe('Subtask 3.3: Chart Error vs. Loading Visual Differentiation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DataPendingCard Component', () => {
    it('renders transient loading state with aria-busy="true", aria-label="Loading indicator data", and ghost wireframe when isLoading is true', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
        canUnlock: true,
        isUnlocked: false,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      const html = ReactDOMServer.renderToString(
        React.createElement(DataPendingCard, {
          chartId: 'chart-test-1',
          isLoading: true,
        })
      );

      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading indicator data"');
      expect(html).toContain('Fetching latest data...');
      // Ghost wireframe SVG lines/rects are rendered
      expect(html).toContain('viewBox="0 0 540 220"');
    });

    it('renders static problem state without ghost wireframe and aria-busy="false" when isLoading is false', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
        canUnlock: true,
        isUnlocked: false,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      const html = ReactDOMServer.renderToString(
        React.createElement(DataPendingCard, {
          chartId: 'chart-test-1',
          isLoading: false,
          headline: 'Indicator Data Pending',
        })
      );

      expect(html).toContain('aria-busy="false"');
      expect(html).toContain('aria-label="Indicator Data Notice"');
      expect(html).not.toContain('Fetching latest data...');
      // Ghost wireframe SVG viewBox 0 0 540 220 is NOT rendered
      expect(html).not.toContain('viewBox="0 0 540 220"');
      // Public notice with brand mark is rendered
      expect(html).toContain('Indicator Data Pending');
    });

    it('displays concrete error message in diagnostic panel in coordinator mode when category is connection_error', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: true,
        isDesktop: true,
        canUnlock: true,
        isUnlocked: true,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      const html = ReactDOMServer.renderToString(
        React.createElement(DataPendingCard, {
          chartId: 'chart-error-1',
          category: 'connection_error',
          errorMessage: 'Google Sheet 404: Spreadsheet not found',
          hasSheetUrl: true,
          isLoading: false,
          onEdit: vi.fn(),
        })
      );

      expect(html).toContain('Connection Issue');
      expect(html).toContain('Unable to Access Google Sheet');
      expect(html).toContain('Google Sheet 404: Spreadsheet not found');
      expect(html).not.toContain('viewBox="0 0 540 220"');
      expect(html).toContain('✎ Edit');
    });

    it('defaults to isLoading=false when prop is omitted and does not render ghost wireframe', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
        canUnlock: true,
        isUnlocked: false,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      const html = ReactDOMServer.renderToString(
        React.createElement(DataPendingCard, {
          chartId: 'chart-default',
        })
      );

      expect(html).toContain('aria-busy="false"');
      expect(html).not.toContain('viewBox="0 0 540 220"');
    });
  });

  describe('ChartCard Integration', () => {
    const mockConfig: SheetChartConfig = {
      chartId: 'chart-test',
      nodeId: 'access',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/12345/edit',
      tabName: 'Sheet1',
      range: 'A1:B10',
      defaultType: 'bar',
      titleOverride: 'Active Sync Chart',
    };

    it('passes isLoading={true} to DataPendingCard when status === "syncing" or isSyncing={true}', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
        canUnlock: true,
        isUnlocked: false,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      const html = ReactDOMServer.renderToString(
        React.createElement(ChartCard, {
          chartId: 'chart-syncing',
          config: mockConfig,
          status: 'syncing',
          isSyncing: true,
        })
      );

      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading indicator data"');
      expect(html).toContain('Fetching latest data...');
      expect(html).toContain('viewBox="0 0 540 220"');
    });

    it('renders static diagnostic state when status === "error", omitting ghost wireframe and displaying error', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: true,
        isDesktop: true,
        canUnlock: true,
        isUnlocked: true,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      const html = ReactDOMServer.renderToString(
        React.createElement(ChartCard, {
          chartId: 'chart-error',
          config: mockConfig,
          status: 'error',
          errorMessage: 'Sheet permission denied (HTTP 403)',
        })
      );

      expect(html).toContain('aria-busy="false"');
      expect(html).toContain('aria-label="Indicator Data Notice"');
      expect(html).not.toContain('viewBox="0 0 540 220"');
      expect(html).toContain('Connection Issue');
      expect(html).toContain('Sheet permission denied (HTTP 403)');
    });

    it('renders serene static card for public visitors when chart has unlinked state', () => {
      vi.spyOn(developerModeHook, 'useDeveloperMode').mockReturnValue({
        isDevMode: false,
        isDesktop: true,
        canUnlock: true,
        isUnlocked: false,
        toggleDevMode: vi.fn(),
        unlockWithPin: vi.fn(),
      } as any);

      const html = ReactDOMServer.renderToString(
        React.createElement(ChartCard, {
          chartId: 'chart-unlinked',
          config: null,
          status: 'idle',
        })
      );

      expect(html).toContain('aria-busy="false"');
      expect(html).toContain('aria-label="Indicator Data Notice"');
      expect(html).not.toContain('viewBox="0 0 540 220"');
      expect(html).toContain('Indicator Data Pending');
    });
  });
});
