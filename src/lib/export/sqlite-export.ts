/**
 * SQLite Export
 *
 * Exports a table from the working database into a standalone SQLite file.
 * Uses better-sqlite3 to create a temporary database, copies the schema
 * and data, reads the file into a Buffer, then cleans up.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Export a single table from the working database as a self-contained SQLite file.
 *
 * @param table - Name of the table to export
 * @param workingDbPath - Path to the working database file
 * @returns Buffer containing the complete SQLite database file
 */
export function exportSQLite(table: string, workingDbPath: string): Buffer {
  // Validate table name
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
    throw new Error('Invalid table name');
  }

  const sourceDb = new Database(workingDbPath, { readonly: true });
  const tmpPath = path.join(
    os.tmpdir(),
    `dataforge_sqlite_export_${Date.now()}_${Math.random().toString(36).slice(2)}.db`
  );

  try {
    // Verify table exists
    const tableExists = sourceDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
      )
      .get(table);
    if (!tableExists) {
      throw new Error(`Table '${table}' not found in working database`);
    }

    // Get the original CREATE TABLE statement
    const schemaDef = sourceDb
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?"
      )
      .get(table) as { sql: string } | undefined;
    if (!schemaDef?.sql) {
      throw new Error(`Could not retrieve schema for table '${table}'`);
    }

    // Create the destination database
    const destDb = new Database(tmpPath);
    destDb.pragma('journal_mode = WAL');

    try {
      // Create the table with the same schema
      destDb.exec(schemaDef.sql);

      // Read all rows from source
      const rows = sourceDb
        .prepare(`SELECT * FROM "${table}"`)
        .all() as Record<string, unknown>[];

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const quotedCols = columns.map((c) => `"${c}"`).join(', ');
        const insertStmt = destDb.prepare(
          `INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders})`
        );

        const insertBatch = destDb.transaction(
          (batch: Record<string, unknown>[]) => {
            for (const row of batch) {
              const values = columns.map((c) => row[c] ?? null);
              insertStmt.run(...values);
            }
          }
        );

        // Insert in batches of 1000
        const BATCH_SIZE = 1000;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          insertBatch(rows.slice(i, i + BATCH_SIZE));
        }
      }

      // Copy indexes for this table
      const indexes = sourceDb
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name = ? AND sql IS NOT NULL"
        )
        .all(table) as Array<{ sql: string }>;
      for (const idx of indexes) {
        try {
          destDb.exec(idx.sql);
        } catch {
          // Skip indexes that fail (e.g., duplicate names)
        }
      }
    } finally {
      destDb.close();
    }

    // Read the file into a Buffer
    const buffer = fs.readFileSync(tmpPath);
    return buffer;
  } finally {
    sourceDb.close();
    // Clean up temp file
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    // Also try to remove WAL/SHM files
    try {
      fs.unlinkSync(tmpPath + '-wal');
    } catch { /* ignore */ }
    try {
      fs.unlinkSync(tmpPath + '-shm');
    } catch { /* ignore */ }
  }
}
