import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Step1SourceRange, type Step1SourceRangeProps } from '../../src/components/chart/drawer/panels/Step1SourceRange';
import type { AccessStatus } from '../../src/components/chart/drawer/hooks/useSheetVerification';

function renderStep1(overrides: Partial<Step1SourceRangeProps> = {}): string {
  const props: Step1SourceRangeProps = {
    sheetUrl: 'https://docs.google.com/spreadsheets/d/abc123/edit',
    setSheetUrl: vi.fn(),
    accessStatus: 'idle',
    statusMessage: '',
    discoveredTabs: [{ title: 'Sheet1', sheetId: 0, index: 0 }],
    tabName: 'Sheet1',
    sheetGid: '0',
    setTabName: vi.fn(),
    executeVerification: vi.fn(),
    handleTabChange: vi.fn(),
    isSyncing: false,
    range: 'A1:D6',
    isRangeValid: true,
    isSelectingRange: false,
    setIsSelectingRange: vi.fn(),
    executeSync: vi.fn(),
    isTabRefreshed: false,
    ...overrides,
  };

  return ReactDOMServer.renderToString(React.createElement(Step1SourceRange, props));
}

describe('Step1SourceRange progressive disclosure', () => {
  it.each<AccessStatus>(['idle', 'checking', 'invalid', 'restricted'])(
    'hides Select a Tab and Select Range when accessStatus is %s',
    (accessStatus) => {
      const html = renderStep1({ accessStatus, isTabRefreshed: true });
      expect(html).toContain('1. Paste your Google Sheets Link');
      expect(html).not.toContain('2. Select a Tab');
      expect(html).not.toContain('3. Select Range');
    }
  );

  it('shows Select a Tab and hides Select Range when verified but tab is not refreshed', () => {
    const html = renderStep1({ accessStatus: 'public', isTabRefreshed: false });
    expect(html).toContain('1. Paste your Google Sheets Link');
    expect(html).toContain('2. Select a Tab');
    expect(html).not.toContain('3. Select Range');
  });

  it('shows both Select a Tab and Select Range when verified and tab is refreshed', () => {
    const html = renderStep1({ accessStatus: 'public', isTabRefreshed: true });
    expect(html).toContain('1. Paste your Google Sheets Link');
    expect(html).toContain('2. Select a Tab');
    expect(html).toContain('3. Select Range');
  });
});
