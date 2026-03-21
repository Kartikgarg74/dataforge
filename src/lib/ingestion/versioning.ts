/**
 * Dataset Versioning
 *
 * Tracks versions of datasets through transform pipeline executions.
 * Stores pipeline steps (not full copies) for efficiency.
 */

import Database from 'better-sqlite3';
import path from 'path';

const WORKING_DB_PATH = path.join(process.cwd(), 'data', 'working.db');

export interface DatasetVersion {
  id: string;
  datasetId: string;
  versionNumber: number;
  pipelineId?: string;
  rowCount: number;
  columnCount: number;
  snapshotTable: string;
  description?: string;
  createdAt: string;
}

function getDb(): Database.Database {
  const db = new Database(WORKING_DB_PATH);
  db.pragma('journal_mode = WAL');
  ensureTables(db);
  return db;
}

function ensureTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dataset_versions (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      pipeline_id TEXT,
      row_count INTEGER,
      column_count INTEGER,
      snapshot_table TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_versions_dataset ON dataset_versions(dataset_id, version_number);
  `);
}

/**
 * Create a new version for a dataset.
 */
export function createVersion(
  datasetId: string,
  snapshotTable: string,
  options?: {
    pipelineId?: string;
    description?: string;
  }
): DatasetVersion {
  const db = getDb();
  try {
    // Get next version number
    const lastVersion = db.prepare(
      'SELECT MAX(version_number) AS max_version FROM dataset_versions WHERE dataset_id = ?'
    ).get(datasetId) as { max_version: number | null };
    const versionNumber = (lastVersion?.max_version || 0) + 1;

    // Get row and column counts
    let rowCount = 0;
    let columnCount = 0;
    try {
      const countResult = db.prepare(`SELECT COUNT(*) AS c FROM "${snapshotTable}"`).get() as { c: number };
      rowCount = countResult?.c || 0;
      const colInfo = db.prepare(`PRAGMA table_info("${snapshotTable}")`).all();
      columnCount = colInfo.length;
    } catch { /* table might not exist yet */ }

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO dataset_versions (id, dataset_id, version_number, pipeline_id, row_count, column_count, snapshot_table, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, datasetId, versionNumber, options?.pipelineId || null, rowCount, columnCount, snapshotTable, options?.description || null);

    return {
      id,
      datasetId,
      versionNumber,
      pipelineId: options?.pipelineId,
      rowCount,
      columnCount,
      snapshotTable,
      description: options?.description,
      createdAt: new Date().toISOString(),
    };
  } finally {
    db.close();
  }
}

/**
 * List all versions of a dataset.
 */
export function listVersions(datasetId: string): DatasetVersion[] {
  const db = getDb();
  try {
    const rows = db.prepare(
      'SELECT * FROM dataset_versions WHERE dataset_id = ? ORDER BY version_number DESC'
    ).all(datasetId) as Array<Record<string, unknown>>;

    return rows.map(mapRow);
  } finally {
    db.close();
  }
}

/**
 * Get a specific version.
 */
export function getVersion(versionId: string): DatasetVersion | null {
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM dataset_versions WHERE id = ?').get(versionId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  } finally {
    db.close();
  }
}

/**
 * Compare two versions (row count delta, column changes).
 */
export function compareVersions(
  versionId1: string,
  versionId2: string
): {
  v1: DatasetVersion;
  v2: DatasetVersion;
  rowDelta: number;
  columnDelta: number;
  newColumns: string[];
  removedColumns: string[];
} | null {
  const v1 = getVersion(versionId1);
  const v2 = getVersion(versionId2);
  if (!v1 || !v2) return null;

  const db = getDb();
  try {
    const cols1 = (db.prepare(`PRAGMA table_info("${v1.snapshotTable}")`).all() as Array<{ name: string }>).map((c) => c.name);
    const cols2 = (db.prepare(`PRAGMA table_info("${v2.snapshotTable}")`).all() as Array<{ name: string }>).map((c) => c.name);

    const set1 = new Set(cols1);
    const set2 = new Set(cols2);
    const newColumns = cols2.filter((c) => !set1.has(c));
    const removedColumns = cols1.filter((c) => !set2.has(c));

    return {
      v1,
      v2,
      rowDelta: v2.rowCount - v1.rowCount,
      columnDelta: v2.columnCount - v1.columnCount,
      newColumns,
      removedColumns,
    };
  } finally {
    db.close();
  }
}

/**
 * Revert to a specific version by copying its snapshot table.
 */
export function revertToVersion(versionId: string, targetTable: string): DatasetVersion | null {
  const version = getVersion(versionId);
  if (!version) return null;

  const db = getDb();
  try {
    db.exec(`DROP TABLE IF EXISTS "${targetTable}"`);
    db.exec(`CREATE TABLE "${targetTable}" AS SELECT * FROM "${version.snapshotTable}"`);
    return version;
  } finally {
    db.close();
  }
}

function mapRow(row: Record<string, unknown>): DatasetVersion {
  return {
    id: row.id as string,
    datasetId: row.dataset_id as string,
    versionNumber: row.version_number as number,
    pipelineId: row.pipeline_id as string | undefined,
    rowCount: row.row_count as number,
    columnCount: row.column_count as number,
    snapshotTable: row.snapshot_table as string,
    description: row.description as string | undefined,
    createdAt: row.created_at as string,
  };
}
