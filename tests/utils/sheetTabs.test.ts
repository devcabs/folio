import { describe, it, expect } from 'vitest';
import { buildSheetTabOptions } from '../../src/utils/sheetTabs';

describe('buildSheetTabOptions', () => {
  it('returns discovered tabs when current tabName is already included', () => {
    const tabs = [
      { title: 'Overview', sheetId: 0 },
      { title: 'Q1 Data', sheetId: 123 },
    ];
    expect(buildSheetTabOptions(tabs, 'Q1 Data')).toEqual(tabs);
  });

  it('prepends current tabName as a synthetic option when missing from discoveredTabs', () => {
    const tabs = [
      { title: 'Overview', sheetId: 0 },
      { title: 'Q1 Data', sheetId: 123 },
    ];
    expect(buildSheetTabOptions(tabs, 'Legacy Tab')).toEqual([
      { title: 'Legacy Tab', sheetId: 'current' },
      ...tabs,
    ]);
  });

  it('returns discovered tabs as-is when tabName is empty', () => {
    const tabs = [{ title: 'Overview', sheetId: 0 }];
    expect(buildSheetTabOptions(tabs, '')).toEqual(tabs);
  });

  it('returns a default fallback option when discoveredTabs is empty', () => {
    expect(buildSheetTabOptions([], 'CustomTab')).toEqual([
      { title: 'CustomTab', sheetId: 'default' },
    ]);
    expect(buildSheetTabOptions([], '')).toEqual([
      { title: 'Sheet1', sheetId: 'default' },
    ]);
  });
});
