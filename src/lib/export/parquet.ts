/**
 * Parquet Export
 *
 * Exports data to Apache Parquet format.
 * Requires: npm install parquetjs-lite
 */

export async function exportParquet(
  rows: Record<string, unknown>[],
  columns: string[],
  options?: { compression?: 'none' | 'gzip' | 'snappy' | 'zstd' }
): Promise<Buffer> {
  let parquet: any;
  try {
    parquet = await import('parquetjs-lite' as string);
  } catch {
    throw new Error('Parquet export requires parquetjs-lite. Install with: npm install parquetjs-lite');
  }

  if (rows.length === 0) {
    throw new Error('Cannot export empty dataset to Parquet');
  }

  // Infer schema from first row
  const schemaFields: Record<string, any> = {};
  for (const col of columns) {
    const sampleValue = rows.find((r) => r[col] !== null && r[col] !== undefined)?.[col];
    if (typeof sampleValue === 'number') {
      schemaFields[col] = { type: 'DOUBLE', optional: true };
    } else if (typeof sampleValue === 'boolean') {
      schemaFields[col] = { type: 'BOOLEAN', optional: true };
    } else {
      schemaFields[col] = { type: 'UTF8', optional: true };
    }
  }

  const schema = new parquet.ParquetSchema(schemaFields);
  const compression = options?.compression || 'snappy';

  // Write to buffer via temp file approach
  const tmpPath = `/tmp/dataforge_export_${Date.now()}.parquet`;
  const writer = await parquet.ParquetWriter.openFile(schema, tmpPath, {
    compression: compression.toUpperCase(),
  });

  for (const row of rows) {
    const cleanRow: Record<string, unknown> = {};
    for (const col of columns) {
      cleanRow[col] = row[col] ?? null;
    }
    await writer.appendRow(cleanRow);
  }

  await writer.close();

  const fs = await import('fs');
  const buffer = fs.readFileSync(tmpPath);
  fs.unlinkSync(tmpPath);

  return buffer;
}
