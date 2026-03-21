/**
 * SQLite Connector
 *
 * Implements the DatabaseConnector interface for SQLite databases.
 * Supports both the app's built-in database and user-uploaded SQLite files.
 */

import Database from 'better-sqlite3';
import path from 'path';
import type {
  ConnectionConfig,
  ConnectorType,
  DatabaseConnector,
  ConnectorStatus,
  QueryResult,
  SchemaInfo,
  TableInfo,
  ColumnInfo,
  NormalizedColumnType,
} from './interface';
import { normalizeColumnType } from './interface';

const MAX_QUERY_LENGTH = 10_000;

/** Validate a query is read-only SELECT/CTE */
function assertSafeReadOnlyQuery(query: string): string {
  if (typeof query !== 'string') throw new Error('Query must be a string');
  const normalized = query.trim();
  if (normalized.length === 0) throw new Error('Query cannot be empty');
  if (normalized.length > MAX_QUERY_LENGTH) throw new Error('Query is too long');
  if (normalized.includes(';')) throw new Error('Multiple statements are not allowed');
  if (!/^\s*(select|with)\b/i.test(normalized)) {
    throw new Error('Only read-only SELECT queries are allowed');
  }
  if (
    /\b(insert|update|delete|drop|alter|create|replace|truncate|attach|detach|pragma|vacuum|reindex)\b/i.test(
      normalized
    )
  ) {
    throw new Error('Disallowed SQL keyword detected');
  }
  return normalized;
}

function assertSafeIdentifier(id: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) {
    throw new Error('Invalid identifier');
  }
  return id;
}

export class SQLiteConnector implements DatabaseConnector {
  readonly type: ConnectorType = 'sqlite';
  readonly config: ConnectionConfig;
  private db: Database.Database | null = null;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  private getDbPath(): string {
    if (this.config.connectionString) {
      return this.config.connectionString;
    }
    if (this.config.database) {
      return this.config.database;
    }
    // Default: built-in app database
    return path.join(process.cwd(), 'src/db', 'data.db');
  }

  async connect(): Promise<void> {
    if (this.db) return;
    const dbPath = this.getDbPath();
    this.db = new Database(dbPath, { readonly: true, fileMustExist: true });
    this.db.pragma('query_only = ON');
    this.db.pragma('journal_mode = WAL');
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async testConnection(): Promise<ConnectorStatus> {
    const start = Date.now();
    try {
      await this.connect();
      const result = this.db!.prepare('SELECT 1 AS ok').get() as { ok: number };
      const latency = Date.now() - start;
      if (result?.ok === 1) {
        const versionRow = this.db!.prepare('SELECT sqlite_version() AS v').get() as { v: string };
        return {
          connected: true,
          message: 'Connected to SQLite',
          serverVersion: versionRow?.v,
          latencyMs: latency,
        };
      }
      return { connected: false, message: 'Unexpected test query result' };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  async executeQuery(
    sql: string,
    params: unknown[] = [],
    limit: number = 1000
  ): Promise<QueryResult> {
    await this.connect();
    const safeSql = assertSafeReadOnlyQuery(sql);
    const start = Date.now();

    // Add LIMIT if not already present
    const hasLimit = /\blimit\b/i.test(safeSql);
    const finalSql = hasLimit ? safeSql : `${safeSql} LIMIT ${limit}`;

    const stmt = this.db!.prepare(finalSql);
    if (!stmt.reader) {
      throw new Error('Only read-only SELECT queries are allowed');
    }

    const rows = stmt.all(...(params as (string | number | null | Buffer)[])) as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const executionTimeMs = Date.now() - start;

    return {
      rows,
      columns,
      rowCount: rows.length,
      executionTimeMs,
      truncated: !hasLimit && rows.length >= limit,
    };
  }

  async getSchema(): Promise<SchemaInfo> {
    await this.connect();
    const tables = await this.getTables();
    const schemaInfo: SchemaInfo = {
      database: path.basename(this.getDbPath()),
      tables: [],
    };

    for (const table of tables) {
      const columns = await this.getColumns(table.name);
      schemaInfo.tables.push({ table, columns });
    }

    return schemaInfo;
  }

  async getTables(): Promise<TableInfo[]> {
    await this.connect();
    const rows = this.db!
      .prepare(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%' ORDER BY name"
      )
      .all() as Array<{ name: string; type: string }>;

    const tables: TableInfo[] = [];
    for (const row of rows) {
      let rowCount: number | undefined;
      try {
        const safeName = assertSafeIdentifier(row.name);
        const countRow = this.db!
          .prepare(`SELECT COUNT(*) AS count FROM "${safeName}"`)
          .get() as { count: number };
        rowCount = countRow?.count;
      } catch {
        // Skip row count for tables we can't safely query
      }

      tables.push({
        name: row.name,
        type: row.type === 'view' ? 'view' : 'table',
        rowCount,
      });
    }

    return tables;
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    await this.connect();
    const safeName = assertSafeIdentifier(tableName);

    const pragmaRows = this.db!
      .prepare(`PRAGMA table_info("${safeName}")`)
      .all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    // Get foreign keys
    const fkRows = this.db!
      .prepare(`PRAGMA foreign_key_list("${safeName}")`)
      .all() as Array<{
      table: string;
      from: string;
      to: string;
    }>;

    const fkMap = new Map<string, { table: string; column: string }>();
    for (const fk of fkRows) {
      fkMap.set(fk.from, { table: fk.table, column: fk.to });
    }

    return pragmaRows.map((row) => {
      const fk = fkMap.get(row.name);
      return {
        name: row.name,
        nativeType: row.type || 'TEXT',
        normalizedType: normalizeColumnType(row.type || 'TEXT', 'sqlite') as NormalizedColumnType,
        nullable: row.notnull === 0,
        isPrimaryKey: row.pk > 0,
        isForeignKey: fkMap.has(row.name),
        foreignKeyTable: fk?.table,
        foreignKeyColumn: fk?.column,
        defaultValue: row.dflt_value ?? undefined,
      };
    });
  }

  async getRowCount(tableName: string): Promise<number> {
    await this.connect();
    const safeName = assertSafeIdentifier(tableName);
    const result = this.db!
      .prepare(`SELECT COUNT(*) AS count FROM "${safeName}"`)
      .get() as { count: number };
    return result?.count ?? 0;
  }
}

/**
 * Factory function for creating SQLite connectors.
 */
export function createSQLiteConnector(config: ConnectionConfig): DatabaseConnector {
  return new SQLiteConnector(config);
}
