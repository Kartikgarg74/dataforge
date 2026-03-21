/**
 * SQLite Ingestion
 *
 * Ingests parsed data rows into a SQLite working database.
 * Creates tables with inferred types and bulk-inserts rows.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { InferredColumn, IngestResult, ParseResult } from './types';
import { toSQLiteType, coerceValue } from './type-inference';

/** Path to the working database for uploaded files */
const WORKING_DB_DIR = path.join(process.cwd(), 'data');
const WORKING_DB_PATH = path.join(WORKING_DB_DIR, 'working.db');

/** Batch size for bulk inserts */
const INSERT_BATCH_SIZE = 1000;

/**
 * Get or create the working SQLite database for ingested data.
 */
function getWorkingDb(): Database.Database {
  // Ensure directory exists
  if (!fs.existsSync(WORKING_DB_DIR)) {
    fs.mkdirSync(WORKING_DB_DIR, { recursive: true });
  }

  const db = new Database(WORKING_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Create metadata table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      table_name TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL DEFAULT 'upload',
      row_count INTEGER,
      column_count INTEGER,
      file_size_bytes INTEGER,
      columns_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

/**
 * Get list of existing table names in the working database.
 */
export function getExistingTables(): string[] {
  const db = getWorkingDb();
  try {
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_%'")
      .all() as Array<{ name: string }>;
    return rows.map((r) => r.name);
  } finally {
    db.close();
  }
}

/**
 * Ingest parsed data into a SQLite table.
 */
export function ingestIntoSQLite(
  parseResult: ParseResult,
  tableName: string,
  fileSizeBytes: number
): IngestResult {
  const start = Date.now();
  const db = getWorkingDb();
  const warnings: string[] = [...parseResult.warnings];

  try {
    const { rows, columns } = parseResult;

    if (columns.length === 0) {
      throw new Error('No columns found in parsed data');
    }

    // Create table
    const columnDefs = columns
      .map((col) => `"${col.name}" ${toSQLiteType(col.type)}`)
      .join(', ');

    db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
    db.exec(`CREATE TABLE "${tableName}" (${columnDefs})`);

    // Bulk insert with parameterized queries
    const placeholders = columns.map(() => '?').join(', ');
    const insertStmt = db.prepare(
      `INSERT INTO "${tableName}" VALUES (${placeholders})`
    );

    const insertBatch = db.transaction((batch: Record<string, unknown>[]) => {
      for (const row of batch) {
        const values = columns.map((col) =>
          coerceValue(row[col.name], col.type)
        );
        insertStmt.run(...values);
      }
    });

    // Insert in batches
    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
      insertBatch(batch);
    }

    // Verify row count
    const countResult = db
      .prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`)
      .get() as { count: number };
    const actualRowCount = countResult?.count || 0;

    if (actualRowCount !== rows.length) {
      warnings.push(
        `Expected ${rows.length} rows but inserted ${actualRowCount}`
      );
    }

    // Save metadata
    const datasetId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO _datasets (id, name, table_name, source_type, row_count, column_count, file_size_bytes, columns_json)
       VALUES (?, ?, ?, 'upload', ?, ?, ?, ?)`
    ).run(
      datasetId,
      tableName,
      tableName,
      actualRowCount,
      columns.length,
      fileSizeBytes,
      JSON.stringify(columns)
    );

    const ingestTimeMs = Date.now() - start;

    return {
      tableName,
      rowCount: actualRowCount,
      columnCount: columns.length,
      columns,
      fileSizeBytes,
      ingestTimeMs,
      warnings,
    };
  } finally {
    db.close();
  }
}

/**
 * Get the working database path (for connector to mount).
 */
export function getWorkingDbPath(): string {
  return WORKING_DB_PATH;
}

/**
 * List all ingested datasets.
 */
export function listDatasets(): Array<{
  id: string;
  name: string;
  tableName: string;
  rowCount: number;
  columnCount: number;
  createdAt: string;
}> {
  const db = getWorkingDb();
  try {
    return db
      .prepare('SELECT id, name, table_name as tableName, row_count as rowCount, column_count as columnCount, created_at as createdAt FROM _datasets ORDER BY created_at DESC')
      .all() as Array<{
        id: string;
        name: string;
        tableName: string;
        rowCount: number;
        columnCount: number;
        createdAt: string;
      }>;
  } finally {
    db.close();
  }
}
