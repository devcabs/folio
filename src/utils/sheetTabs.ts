export interface SheetTabOption {
  title: string;
  sheetId: string | number;
}

/**
 * Builds the dropdown tab options list for Google Sheets source panels,
 * ensuring the currently selected tabName is always selectable even if not
 * yet present in discoveredTabs.
 */
export function buildSheetTabOptions<T extends SheetTabOption>(
  discoveredTabs: ReadonlyArray<T>,
  tabName: string
): Array<T | SheetTabOption> {
  if (discoveredTabs.length > 0) {
    const hasCurrent = discoveredTabs.some((t) => t.title === tabName);
    if (tabName && !hasCurrent) {
      return [{ title: tabName, sheetId: 'current' }, ...discoveredTabs];
    }
    return [...discoveredTabs];
  }
  return [{ title: tabName || 'Sheet1', sheetId: 'default' }];
}
