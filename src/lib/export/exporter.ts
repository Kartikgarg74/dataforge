/**
 * Export Engine
 *
 * Central export orchestrator that delegates to format-specific exporters.
 */

import Database from 'better-sqlite3';
import path from 'path';
import type { ExportOptions, ExportResult, ExportFormat, ExportMetadata } from './types';
import { exportCSV } from './csv';
import { exportJSON, exportJSONL } from './json';
import { exportParquet } from './parquet';
import { exportArrow } from './arrow';
import { exportSQLite } from './sqlite-export';

const WORKING_DB_PATH = path.join(process.cwd(), 'data', 'working.db');

/**
 * Get MIME type for an export format.
 */
function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'jsonl':
      return 'application/x-ndjson';
    case 'parquet':
      return 'application/vnd.apache.parquet';
    case 'arrow':
      return 'application/vnd.apache.arrow.stream';
    case 'sqlite':
      return 'application/x-sqlite3';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Get file extension for an export format.
 */
function getExtension(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'csv';
    case 'json':
      return 'json';
    case 'jsonl':
      return 'jsonl';
    case 'parquet':
      return 'parquet';
    case 'arrow':
      return 'arrow';
    case 'sqlite':
      return 'db';
    default:
      return 'bin';
  }
}

/**
 * Query data from the working database.
 */
function queryWorkingDb(
  table: string,
  columns?: string[],
  maxRows?: number
): { rows: Record<string, unknown>[]; columns: string[] } {
  const db = new Database(WORKING_DB_PATH, { readonly: true });

  try {
    // Validate table name
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
      throw new Error('Invalid table name');
    }

    // Check table exists
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(table);
    if (!tableExists) {
      throw new Error(`Table '${table}' not found`);
    }

    // Build column list
    const selectCols = columns?.length
      ? columns.map((c) => {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(c)) throw new Error(`Invalid column name: ${c}`);
          return `"${c}"`;
        }).join(', ')
      : '*';

    // Build query
    let sql = `SELECT ${selectCols} FROM "${table}"`;
    if (maxRows && maxRows > 0) {
      sql += ` LIMIT ${maxRows}`;
    }

    const rows = db.prepare(sql).all() as Record<string, unknown>[];
    const resultColumns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return { rows, columns: resultColumns };
  } finally {
    db.close();
  }
}

/**
 * Generate a metadata JSON file for the exported table.
 */
export function generateMetadataFile(table: string, options?: ExportOptions): Buffer {
  const db = new Database(WORKING_DB_PATH, { readonly: true });

  try {
    // Get column types
    const colInfo = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string; type: string }>;
    const columnTypes: Record<string, string> = {};
    for (const col of colInfo) {
      columnTypes[col.name] = col.type || 'TEXT';
    }

    // Get row count
    const countResult = db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as { count: number };

    const metadata: ExportMetadata = {
      table,
      columnTypes,
      rowCount: countResult.count,
      exportedAt: new Date().toISOString(),
    };

    // Check for profile data
    try {
      const profileRow = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = '_profiles'")
        .get();
      if (profileRow) {
        const profile = db
          .prepare("SELECT * FROM _profiles WHERE table_name = ? ORDER BY profiled_at DESC LIMIT 1")
          .get(table) as Record<string, unknown> | undefined;
        if (profile) {
          metadata.profileSummary = profile;
        }
      }
    } catch {
      // Profile data not available
    }

    // Check for transform pipeline steps
    try {
      const templateTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = '_pipeline_templates'")
        .get();
      if (templateTable) {
        const templateRow = db
          .prepare("SELECT steps_json FROM _pipeline_templates WHERE name LIKE ? ORDER BY created_at DESC LIMIT 1")
          .get(`%${table}%`) as { steps_json: string } | undefined;
        if (templateRow) {
          metadata.pipelineSteps = JSON.parse(templateRow.steps_json);
        }
      }
    } catch {
      // Pipeline data not available
    }

    // Check for split metadata
    try {
      const splitTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = '_split_metadata'")
        .get();
      if (splitTable) {
        const splitRow = db
          .prepare("SELECT * FROM _split_metadata WHERE source_table = ? ORDER BY created_at DESC LIMIT 1")
          .get(table) as Record<string, unknown> | undefined;
        if (splitRow) {
          metadata.splitMetadata = {
            strategy: (splitRow.strategy as string) || 'random',
            seed: splitRow.seed as number | undefined,
            ratios: JSON.parse((splitRow.ratios as string) || '{}'),
          };
        }
      }
    } catch {
      // Split data not available
    }

    return Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8');
  } finally {
    db.close();
  }
}

/**
 * Export data from the working database in the specified format.
 */
export async function exportData(options: ExportOptions): Promise<ExportResult> {
  // SQLite export works directly on the database file, no need to query rows
  if (options.format === 'sqlite') {
    const buffer = exportSQLite(options.table, WORKING_DB_PATH);
    return {
      buffer,
      filename: `${options.table}.${getExtension('sqlite')}`,
      contentType: getMimeType('sqlite'),
      rowCount: -1, // row count embedded in the database
      fileSizeBytes: buffer.length,
    };
  }

  const { rows, columns } = queryWorkingDb(
    options.table,
    options.columns,
    options.maxRows
  );

  if (rows.length === 0) {
    throw new Error(`Table '${options.table}' is empty`);
  }

  let buffer: Buffer;

  switch (options.format) {
    case 'csv':
      buffer = exportCSV(rows, columns);
      break;
    case 'json':
      buffer = exportJSON(rows, options.columns);
      break;
    case 'jsonl':
      buffer = exportJSONL(rows, options.columns);
      break;
    case 'parquet':
      buffer = await exportParquet(rows, columns, {
        compression: options.compression,
      });
      break;
    case 'arrow':
      buffer = await exportArrow(rows, columns);
      break;
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }

  const filename = `${options.table}.${getExtension(options.format)}`;

  const result: ExportResult = {
    buffer,
    filename,
    contentType: getMimeType(options.format),
    rowCount: rows.length,
    fileSizeBytes: buffer.length,
  };

  if (options.includeMetadata) {
    const metadataBuffer = generateMetadataFile(options.table, options);
    const metadata: ExportMetadata = JSON.parse(metadataBuffer.toString('utf-8'));
    result.metadata = metadata;
    result.metadataFile = metadataBuffer;
  }

  return result;
}
