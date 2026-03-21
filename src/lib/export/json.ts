/**
 * JSON / JSONL Export
 */

/**
 * Export rows as JSON array.
 */
export function exportJSON(
  rows: Record<string, unknown>[],
  columns?: string[]
): Buffer {
  const filtered = columns
    ? rows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const col of columns) {
          obj[col] = row[col] ?? null;
        }
        return obj;
      })
    : rows;

  const json = JSON.stringify(filtered, null, 2);
  return Buffer.from(json, 'utf-8');
}

/**
 * Export rows as JSONL (newline-delimited JSON).
 */
export function exportJSONL(
  rows: Record<string, unknown>[],
  columns?: string[]
): Buffer {
  const lines = rows.map((row) => {
    if (columns) {
      const obj: Record<string, unknown> = {};
      for (const col of columns) {
        obj[col] = row[col] ?? null;
      }
      return JSON.stringify(obj);
    }
    return JSON.stringify(row);
  });

  return Buffer.from(lines.join('\n') + '\n', 'utf-8');
}
