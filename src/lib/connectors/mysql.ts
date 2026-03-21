/**
 * MySQL Connector
 *
 * Implements the DatabaseConnector interface for MySQL databases.
 * Uses mysql2 with connection pooling and promise-based API.
 */

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

/* eslint-disable */

/**
 * mysql2 is lazy-loaded to avoid import errors when not installed.
 * Install with: npm install mysql2
 */
let mysql2Module: any = null;

async function getMysql2(): Promise<any> {
  if (!mysql2Module) {
    try {
      mysql2Module = await import('mysql2/promise' as string);
    } catch {
      throw new Error(
        'mysql2 is not installed. Run: npm install mysql2'
      );
    }
  }
  return mysql2Module;
}

const MAX_QUERY_LENGTH = 10_000;
const CONNECTION_TIMEOUT_MS = 10_000;

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
    /\b(insert|update|delete|drop|alter|create|replace|truncate|grant|revoke|load)\b/i.test(
      normalized
    )
  ) {
    throw new Error('Disallowed SQL keyword detected');
  }
  return normalized;
}

export class MySQLConnector implements DatabaseConnector {
  readonly type: ConnectorType = 'mysql';
  readonly config: ConnectionConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any = null;
  private connected = false;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connected && this.pool) return;

    const m = await getMysql2();

    if (this.config.connectionString) {
      this.pool = m.createPool({
        uri: this.config.connectionString,
        connectionLimit: 5,
        connectTimeout: CONNECTION_TIMEOUT_MS,
        waitForConnections: true,
      });
    } else {
      this.pool = m.createPool({
        host: this.config.host || 'localhost',
        port: this.config.port || 3306,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl ? { rejectUnauthorized: true } : undefined,
        connectionLimit: 5,
        connectTimeout: CONNECTION_TIMEOUT_MS,
        waitForConnections: true,
      });
    }

    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
      } catch {
        // Ignore disconnect errors
      }
      this.pool = null;
      this.connected = false;
    }
  }

  async testConnection(): Promise<ConnectorStatus> {
    const start = Date.now();
    try {
      await this.connect();
      const [rows] = await this.pool.query('SELECT VERSION() AS version');
      const version = (rows as Array<Record<string, unknown>>)[0]?.version as string;

      return {
        connected: true,
        message: 'Connected to MySQL',
        serverVersion: version,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  private async ensurePool() {
    if (!this.pool || !this.connected) {
      await this.connect();
    }
    return this.pool;
  }

  async executeQuery(
    sql: string,
    params: unknown[] = [],
    limit: number = 1000
  ): Promise<QueryResult> {
    const safeSql = assertSafeReadOnlyQuery(sql);
    const pool = await this.ensurePool();
    const start = Date.now();

    const hasLimit = /\blimit\b/i.test(safeSql);
    const finalSql = hasLimit ? safeSql : `${safeSql} LIMIT ${limit}`;

    const [rows, fields] = await pool.query(finalSql, params);
    const resultRows = rows as Record<string, unknown>[];
    const columns = (fields as Array<{ name: string }>).map((f) => f.name);
    const executionTimeMs = Date.now() - start;

    return {
      rows: resultRows,
      columns,
      rowCount: resultRows.length,
      executionTimeMs,
      truncated: !hasLimit && resultRows.length >= limit,
    };
  }

  async getSchema(): Promise<SchemaInfo> {
    const tables = await this.getTables();
    const schemaInfo: SchemaInfo = {
      database: this.config.database || 'unknown',
      tables: [],
    };

    for (const table of tables) {
      const columns = await this.getColumns(table.name);
      schemaInfo.tables.push({ table, columns });
    }

    return schemaInfo;
  }

  async getTables(): Promise<TableInfo[]> {
    const pool = await this.ensurePool();
    const dbName = this.config.database;

    const [rows] = await pool.query(
      `SELECT
        TABLE_NAME AS name,
        TABLE_TYPE AS table_type,
        TABLE_ROWS AS estimated_rows
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME`,
      [dbName]
    );

    return (rows as Array<Record<string, unknown>>).map((row) => ({
      name: row.name as string,
      type: (row.table_type === 'VIEW' ? 'view' : 'table') as 'table' | 'view',
      rowCount: Number(row.estimated_rows) || 0,
    }));
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    const pool = await this.ensurePool();
    const dbName = this.config.database;

    const [rows] = await pool.query(
      `SELECT
        COLUMN_NAME AS name,
        COLUMN_TYPE AS native_type,
        DATA_TYPE AS data_type,
        IS_NULLABLE AS is_nullable,
        COLUMN_KEY AS column_key,
        COLUMN_DEFAULT AS column_default,
        COLUMN_COMMENT AS comment
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION`,
      [dbName, tableName]
    );

    // Get foreign keys
    const [fkRows] = await pool.query(
      `SELECT
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbName, tableName]
    );

    const fkMap = new Map<string, { table: string; column: string }>();
    for (const fk of fkRows as Array<Record<string, unknown>>) {
      fkMap.set(fk.COLUMN_NAME as string, {
        table: fk.REFERENCED_TABLE_NAME as string,
        column: fk.REFERENCED_COLUMN_NAME as string,
      });
    }

    return (rows as Array<Record<string, unknown>>).map((row) => {
      const name = row.name as string;
      const nativeType = row.native_type as string;
      const dataType = row.data_type as string;
      const fk = fkMap.get(name);

      return {
        name,
        nativeType,
        normalizedType: normalizeColumnType(dataType, 'mysql') as NormalizedColumnType,
        nullable: (row.is_nullable as string) === 'YES',
        isPrimaryKey: (row.column_key as string) === 'PRI',
        isForeignKey: fkMap.has(name),
        foreignKeyTable: fk?.table,
        foreignKeyColumn: fk?.column,
        defaultValue: (row.column_default as string) ?? undefined,
        comment: (row.comment as string) || undefined,
      };
    });
  }

  async getRowCount(tableName: string): Promise<number> {
    const pool = await this.ensurePool();
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count FROM \`${tableName}\``
    );
    return Number((rows as Array<Record<string, unknown>>)[0]?.count) || 0;
  }
}

export function createMySQLConnector(config: ConnectionConfig): DatabaseConnector {
  return new MySQLConnector(config);
}
