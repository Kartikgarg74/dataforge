/* eslint-disable */
/**
 * Arrow Export
 *
 * Exports data to Apache Arrow IPC format.
 * Requires: npm install apache-arrow
 */

/**
 * Export rows as an Arrow IPC buffer.
 * Lazy-loads apache-arrow so the rest of the app works without it installed.
 */
export async function exportArrow(
  rows: Record<string, unknown>[],
  columns: string[]
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let arrow: any;
  try {
    arrow = await import('apache-arrow' as string);
  } catch {
    throw new Error(
      'Arrow export requires apache-arrow. Install with: npm install apache-arrow'
    );
  }

  if (rows.length === 0) {
    throw new Error('Cannot export empty dataset to Arrow');
  }

  // Build column arrays
  const columnArrays: Record<string, unknown[]> = {};
  for (const col of columns) {
    columnArrays[col] = rows.map((r) => r[col] ?? null);
  }

  // Infer Arrow data types from first non-null value in each column
  const fields: Array<{ name: string; type: unknown; nullable: boolean }> = [];
  const vectors: unknown[] = [];

  for (const col of columns) {
    const values = columnArrays[col];
    const sample = values.find((v) => v !== null && v !== undefined);

    let arrowType: unknown;
    if (typeof sample === 'number') {
      arrowType = Number.isInteger(sample)
        ? new arrow.Int64()
        : new arrow.Float64();
    } else if (typeof sample === 'boolean') {
      arrowType = new arrow.Bool();
    } else {
      arrowType = new arrow.Utf8();
    }

    fields.push({ name: col, type: arrowType, nullable: true });

    // Coerce values for the vector builder
    const coerced = values.map((v) => {
      if (v === null || v === undefined) return null;
      if (typeof sample === 'number') return Number(v);
      if (typeof sample === 'boolean') return Boolean(v);
      return String(v);
    });

    vectors.push(coerced);
  }

  // Build the RecordBatch using the vectorFromArray helper
  const dataObj: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    dataObj[columns[i]] = vectors[i];
  }

  const table = arrow.tableFromArrays(dataObj);

  // Serialize to IPC stream format
  const writer = arrow.RecordBatchStreamWriter.writeAll(table);
  const ipcBytes: Uint8Array = writer.toUint8Array();

  return Buffer.from(ipcBytes);
}
