/**
 * Excel Parser
 *
 * Parses .xlsx and .xls files into row arrays.
 * Requires: npm install xlsx
 */

import type { ParseResult, IngestOptions } from './types';
import { inferColumnTypes } from './type-inference';

export async function parseExcel(
  buffer: Buffer,
  filename: string,
  options: IngestOptions = {}
): Promise<ParseResult> {
  let XLSX: any;
  try {
    XLSX = await import('xlsx' as string);
  } catch {
    throw new Error('Excel parsing requires xlsx. Install with: npm install xlsx');
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const warnings: string[] = [];

  // Select sheet
  const sheetName = options.sheetName || workbook.SheetNames[0];
  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`);
  }

  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, {
    header: options.hasHeader === false ? 1 : undefined,
    defval: null,
  }) as Record<string, unknown>[];

  if (workbook.SheetNames.length > 1) {
    warnings.push(`Workbook has ${workbook.SheetNames.length} sheets. Using: "${sheetName}"`);
  }

  const rows = options.maxRows ? jsonData.slice(0, options.maxRows) : jsonData;

  if (rows.length === 0) {
    return {
      rows: [],
      columns: [],
      totalRows: 0,
      format: 'excel',
      hasHeader: options.hasHeader !== false,
      warnings: ['Sheet contains no data'],
    };
  }

  // Get column names
  const columnNames = [...new Set(rows.flatMap((r) => Object.keys(r)))];

  // Sanitize column names
  const sanitizedColumns = columnNames.map((name) => {
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')
      .toLowerCase() || 'column';
  });

  // Rename rows to use sanitized column names
  const renamedRows = rows.map((row) => {
    const newRow: Record<string, unknown> = {};
    columnNames.forEach((origName, i) => {
      newRow[sanitizedColumns[i]] = row[origName];
    });
    return newRow;
  });

  const columns = inferColumnTypes(renamedRows, sanitizedColumns);

  return {
    rows: renamedRows,
    columns,
    totalRows: renamedRows.length,
    format: 'excel',
    hasHeader: options.hasHeader !== false,
    warnings,
  };
}
