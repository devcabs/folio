/**
 * Tabular Data Sanitizer & Range Parser
 * Document Reference: docs/tasks/task7_1_contracts_d3_math_sanitizer.md
 * 
 * Enforces pure numbers (never coerces missing values/errors into 0),
 * canonical string sanitization, automatic summary row detection,
 * bounding box cell range parsing, and public CSV receipt generation.
 */

import type { ChartSeries } from '../types/chart';

export interface CellCoordinate {
  col: number; // 0-indexed column
  row: number; // 0-indexed row
}

export interface BoundingBoxRange {
  sheetName?: string;
  startCol: number;
  startRow: number;
  endCol: number;
  endRow?: number; // Optional. If omitted, spans to the end of available data
}

/**
 * Trims whitespace and collapses consecutive spaces into single spaces.
 */
export function sanitizeString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/\s+/g, ' ');
}

/**
 * Parses numeric cell values strictly preserving null for blanks or formula errors.
 * Never coerces empty cells, hyphens, or errors into 0.
 */
export function parsePureNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str === '' || str === '-' || str.startsWith('#')) return null;

  // Clean currency symbols, commas, percent signs if present in raw string
  const cleanStr = str.replace(/[₱$,%]/g, '').trim();
  const num = Number(cleanStr);
  return Number.isFinite(num) ? num : null;
}

/**
 * Extracts semantic units enclosed in parentheses or brackets from column headers.
 * e.g., "Enrolment (learners)" -> "learners", "Budget [₱]" -> "₱", "Passing Rate (%)" -> "%"
 */
export function extractHeaderUnit(header: string): string | null {
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/\(([^)]+)\)|\[([^\]]+)\]/);
  if (!match) return null;
  const rawUnit = match[1] || match[2];
  return rawUnit ? rawUnit.trim() : null;
}

/**
 * Checks if a row label represents an aggregate summary row (Total, Grand Total, Average, Mean)
 */
export function isSummaryRow(rowLabel: string): boolean {
  const normalized = rowLabel.trim().toLowerCase();
  return (
    normalized.startsWith('total') ||
    normalized.startsWith('grand total') ||
    normalized.startsWith('average') ||
    normalized.startsWith('mean')
  );
}

/**
 * Converts spreadsheet column letters to 0-indexed column number (e.g., A -> 0, Z -> 25, AA -> 26).
 */
export function colLetterToIndex(letters: string): number {
  let index = 0;
  const clean = letters.trim().toUpperCase();
  for (let i = 0; i < clean.length; i++) {
    index = index * 26 + (clean.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Converts 0-indexed column number to spreadsheet column letters (e.g., 0 -> A, 25 -> Z, 26 -> AA).
 */
export function indexToColLetter(index: number): string {
  let temp = index + 1;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

/**
 * Parses ranges such as "A5:D12", "A1:D", "A:D", "Sheet1!B2:F20", or "'Enrolment Summary'!A1:C15"
 * into bounding 0-indexed grid coordinates. Supports open-ended column ranges.
 */
export function parseRangeNotation(rangeStr: string): BoundingBoxRange | null {
  if (!rangeStr || typeof rangeStr !== 'string') return null;

  const trimmed = rangeStr.trim();
  // Regex supporting optional SheetName! followed by COL[ROW]:COL[ROW]
  const match = trimmed.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_\s-]+))!)?([A-Za-z]+)(\d*):([A-Za-z]+)(\d*)$/);
  if (!match) return null;

  const [, quotedSheet, unquotedSheet, startColStr, startRowStr, endColStr, endRowStr] = match;
  const sheetName = quotedSheet || unquotedSheet ? sanitizeString(quotedSheet || unquotedSheet) : undefined;

  const startCol = colLetterToIndex(startColStr);
  const startRow = startRowStr ? parseInt(startRowStr, 10) - 1 : 0;
  const endCol = colLetterToIndex(endColStr);
  const endRow = endRowStr ? parseInt(endRowStr, 10) - 1 : undefined;

  if (startCol < 0 || startRow < 0 || endCol < 0) return null;
  if (endRow !== undefined && endRow < 0) return null;
  if (startCol > endCol) return null;
  if (endRow !== undefined && startRow > endRow) return null;

  return {
    ...(sheetName ? { sheetName } : {}),
    startCol,
    startRow,
    endCol,
    ...(endRow !== undefined ? { endRow } : {}),
  };
}

/**
 * Detects the bounding cell range of filled content within a 2D sheet matrix.
 * Determines the minimum and maximum row and column indices containing non-empty cells,
 * and returns the bounding A1-notation range (e.g. "A1:D14"), or null if matrix is empty.
 */
export function detectFilledRange(matrix: (string | number | null)[][]): string | null {
  if (!matrix || matrix.length === 0) return null;

  let minRow = -1;
  let maxRow = -1;
  let minCol = -1;
  let maxCol = -1;

  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row) continue;

    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const isFilled = cell !== null && cell !== undefined && String(cell).trim() !== '';
      if (isFilled) {
        if (minRow === -1 || r < minRow) minRow = r;
        if (maxRow === -1 || r > maxRow) maxRow = r;
        if (minCol === -1 || c < minCol) minCol = c;
        if (maxCol === -1 || c > maxCol) maxCol = c;
      }
    }
  }

  if (minRow === -1 || minCol === -1) return null;

  const startCoord = `${indexToColLetter(minCol)}${minRow + 1}`;
  const endCoord = `${indexToColLetter(maxCol)}${maxRow + 1}`;
  return `${startCoord}:${endCoord}`;
}

/**
 * Generates an RFC 4180-compliant public CSV blob with all internal URLs and sensitive metadata stripped.
 */
export function generatePublicCsv(
  categories: string[],
  series: ChartSeries[],
  title?: string,
  unit?: string
): string {
  const rows: string[][] = [];
  if (title) {
    rows.push([`# Title: ${sanitizeString(title)}${unit ? ` (${sanitizeString(unit)})` : ''}`]);
  }

  // Header row
  const headers = ['Category', ...series.map((s) => sanitizeString(s.name))];
  rows.push(headers);

  // Data rows
  for (let i = 0; i < categories.length; i++) {
    const row: string[] = [sanitizeString(categories[i])];
    for (const s of series) {
      const val = s.data[i];
      row.push(val !== null && val !== undefined && Number.isFinite(val) ? String(val) : '');
    }
    rows.push(row);
  }

  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(',')
    )
    .join('\n');
}

/**
 * Formats a timestamp string safe for filesystem usage (e.g. "2026-10-24_032503").
 */
export function formatFilenameTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

/**
 * Strips or replaces filesystem-reserved and control characters.
 */
export function sanitizeFilename(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/[/\\:]+/g, '-')      // Replace separators and colons with dashes
    .replace(/[*?"<>|]+/g, '')     // Remove illegal filename characters
    .replace(/\s+/g, ' ')          // Collapse whitespace
    .trim()
    .replace(/^[.-]+|[.-]+$/g, ''); // Remove leading or trailing dots and dashes
}

export interface CsvFilenameOptions {
  title?: string | null;
  sheetName?: string | null;
  chartId?: string | null;
  date?: Date;
}

/**
 * Generates the CSV export filename.
 * Rules:
 * - Uses the Chart Title if present.
 * - If absent, falls back to the Sheet Name (tab name).
 * - If both are absent, falls back to chartId or 'chart-data'.
 * - Appends a timestamp: `${cleanBase}_${timestamp}.csv`
 */
export function generateCsvDownloadFilename(options: CsvFilenameOptions): string {
  const cleanTitle = sanitizeFilename(options.title || '');
  const cleanSheetName = sanitizeFilename(options.sheetName || '');
  const cleanChartId = sanitizeFilename(options.chartId || '');

  const base = cleanTitle || cleanSheetName || cleanChartId || 'chart-data';
  const timestamp = formatFilenameTimestamp(options.date || new Date());

  return `${base}_${timestamp}.csv`;
}

