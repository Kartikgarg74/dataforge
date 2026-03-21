/**
 * CSV Export
 *
 * Exports query results to CSV format with CSV injection prevention.
 */

/**
 * Sanitize a cell value to prevent CSV injection (formula injection in Excel).
 */
function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = String(value);

  // Prefix with single quote if starts with dangerous characters
  if (/^[=+\-@\t\r|]/.test(str)) {
    return `'${str}`;
  }

  return str;
}

/**
 * Escape a CSV field (wrap in quotes if needed).
 */
function escapeCSVField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert rows to CSV string.
 */
export function rowsToCSV(
  rows: Record<string, unknown>[],
  columns: string[],
  options?: { sanitize?: boolean }
): string {
  const sanitize = options?.sanitize !== false;
  const lines: string[] = [];

  // Header row
  lines.push(columns.map((c) => escapeCSVField(c)).join(','));

  // Data rows
  for (const row of rows) {
    const fields = columns.map((col) => {
      const raw = sanitize ? sanitizeCell(row[col]) : String(row[col] ?? '');
      return escapeCSVField(raw);
    });
    lines.push(fields.join(','));
  }

  return lines.join('\n');
}

/**
 * Convert rows to CSV Buffer.
 */
export function exportCSV(
  rows: Record<string, unknown>[],
  columns: string[]
): Buffer {
  const csv = rowsToCSV(rows, columns);
  return Buffer.from(csv, 'utf-8');
}
