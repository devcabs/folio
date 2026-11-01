import { useState, useCallback, useMemo } from 'react';
import { fetchLiveSheetMatrix } from '../../../../services/sheetsDataService';
import { extractSpreadsheetId } from '../../../../services/sheetsVerificationService';
import { detectFilledRange, parseRangeNotation } from '../../../../utils/chartSanitizer';

interface UseLiveMatrixSyncProps {
  sheetUrl: string;
  tabName: string;
  sheetGid: string;
  range: string;
  previewMatrix?: (string | number | null)[][] | null | undefined;
}

export function useLiveMatrixSync({
  sheetUrl,
  tabName,
  sheetGid,
  range,
  previewMatrix,
}: UseLiveMatrixSyncProps) {
  const [fetchedMatrix, setFetchedMatrix] = useState<(string | number | null)[][]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const executeSync = useCallback(
    async (
      targetUrl = sheetUrl,
      targetTab = tabName,
      targetGid = sheetGid
    ) => {
      const trimmedUrl = targetUrl.trim();
      if (!trimmedUrl || !extractSpreadsheetId(trimmedUrl)) {
        setFetchedMatrix([]);
        return;
      }

      setIsSyncing(true);
      try {
        // Fetch full sheet tab without range constraint to display the entire sheet
        const matrix = await fetchLiveSheetMatrix({
          sheetUrl: trimmedUrl,
          tabName: targetTab ? targetTab.trim() : undefined,
          sheetGid: targetGid ? targetGid.trim() : undefined,
          timeoutMs: 8000,
        });
        setFetchedMatrix(matrix || []);
      } catch {
        setFetchedMatrix([]);
      } finally {
        setIsSyncing(false);
      }
    },
    [sheetUrl, tabName, sheetGid]
  );

  const fullMatrix = useMemo<(string | number | null)[][]>(() => {
    return fetchedMatrix;
  }, [fetchedMatrix]);

  // Dynamically detect bounding cell range of filled content
  const detectedRange = useMemo(() => {
    return detectFilledRange(fullMatrix);
  }, [fullMatrix]);

  // Slices the full sheet matrix dynamically according to the active range notation
  const liveMatrix = useMemo<(string | number | null)[][]>(() => {
    if (fetchedMatrix && fetchedMatrix.length > 0) {
      const bbox = parseRangeNotation(range);
      if (!bbox) return fetchedMatrix;

      const startRow = Math.max(0, bbox.startRow);
      const endRow =
        typeof bbox.endRow === 'number'
          ? Math.min(fetchedMatrix.length - 1, bbox.endRow)
          : fetchedMatrix.length - 1;
      const startCol = Math.max(0, bbox.startCol);
      const endCol = Math.max(startCol, bbox.endCol);

      const sliced: (string | number | null)[][] = [];
      for (let r = startRow; r <= endRow && r < fetchedMatrix.length; r++) {
        const row = fetchedMatrix[r] || [];
        const slicedRow: (string | number | null)[] = [];
        for (let c = startCol; c <= endCol; c++) {
          slicedRow.push(row[c] !== undefined ? row[c] : null);
        }
        sliced.push(slicedRow);
      }
      return sliced;
    }
    if (previewMatrix && previewMatrix.length > 0) {
      return previewMatrix;
    }
    return [];
  }, [fetchedMatrix, previewMatrix, range]);

  const activeMatrix = liveMatrix.length > 0 ? liveMatrix : previewMatrix || [];
  const headerRow = activeMatrix[0] || [];

  const detectedColumns = useMemo(() => {
    return headerRow.map((col, idx) => ({
      index: idx,
      label:
        col !== null && col !== undefined && String(col).trim() !== ''
          ? String(col).trim()
          : `Col ${idx + 1}`,
    }));
  }, [headerRow]);

  return {
    fetchedMatrix,
    fullMatrix,
    isSyncing,
    liveMatrix,
    activeMatrix,
    detectedColumns,
    detectedRange,
    executeSync,
  };
}
