/**
 * PostgreSQL Connector
 *
 * Implements the DatabaseConnector interface for PostgreSQL databases.
 * Uses @neondatabase/serverless for Neon, but compatible with any Postgres.
 */

import { Client } from '@neondatabase/serverless';
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
    /\b(insert|update|delete|drop|alter|create|replace|truncate|grant|revoke|copy)\b/i.test(
      normalized
    )
  ) {
    throw new Error('Disallowed SQL keyword detected');
  }
  return normalized;
}

export class PostgresConnector implements DatabaseConnector {
  readonly type: ConnectorType = 'postgres';
  readonly config: ConnectionConfig;
  private client: Client | null = null;
  private connected = false;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  private getConnectionString(): string {
    if (this.config.connectionString) {
      return this.config.connectionString;
    }
    const { host, port, database, username, password, ssl } = this.config;
    const sslParam = ssl ? '?sslmode=require' : '';
    return `postgresql://${username}:${password}@${host}:${port || 5432}/${database}${sslParam}`;
  }

  async connect(): Promise<void> {
    if (this.connected && this.client) return;

    const connStr = this.getConnectionString();
    this.client = new Client(connStr);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT_MS)
    );

    await Promise.race([this.client.connect(), timeoutPromise]);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.end();
      } catch {
        // Ignore disconnect errors
      }
      this.client = null;
      this.connected = false;
    }
  }

  async testConnection(): Promise<ConnectorStatus> {
    const start = Date.now();
    try {
      // Create a fresh client for testing
      const connStr = this.getConnectionString();
      const testClient = new Client(connStr);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT_MS)
      );
      await Promise.race([testClient.connect(), timeoutPromise]);

      const result = await testClient.query('SELECT version() AS version');
      await testClient.end();

      const version = result.rows[0]?.version as string | undefined;
      const shortVersion = version?.match(/PostgreSQL (\d+\.\d+)/)?.[1];

      return {
        connected: true,
        message: 'Connected to PostgreSQL',
        serverVersion: shortVersion || version?.substring(0, 50),
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

  private async ensureClient(): Promise<Client> {
    if (!this.client || !this.connected) {
      await this.connect();
    }
    return this.client!;
  }

  async executeQuery(
    sql: string,
    params: unknown[] = [],
    limit: number = 1000
  ): Promise<QueryResult> {
    const safeSql = assertSafeReadOnlyQuery(sql);
    const client = await this.ensureClient();
    const start = Date.now();

    const hasLimit = /\blimit\b/i.test(safeSql);
    const finalSql = hasLimit ? safeSql : `${safeSql} LIMIT ${limit}`;

    const result = await client.query(finalSql, params);
    const columns = result.fields.map((f) => f.name);
    const executionTimeMs = Date.now() - start;

    return {
      rows: result.rows as Record<string, unknown>[],
      columns,
      rowCount: result.rowCount ?? result.rows.length,
      executionTimeMs,
      truncated: !hasLimit && result.rows.length >= limit,
    };
  }

  async getSchema(): Promise<SchemaInfo> {
    const tables = await this.getTables();
    const schemaInfo: SchemaInfo = {
      database: this.config.database || 'unknown',
      tables: [],
    };

    for (const table of tables) {
      const columns = await this.getColumns(table.name, table.schema);
      schemaInfo.tables.push({ table, columns });
    }

    return schemaInfo;
  }

  async getTables(): Promise<TableInfo[]> {
    const client = await this.ensureClient();

    const result = await client.query(`
      SELECT
        t.table_name AS name,
        t.table_schema AS schema,
        t.table_type,
        (SELECT reltuples::bigint FROM pg_class WHERE relname = t.table_name LIMIT 1) AS estimated_rows
      FROM information_schema.tables t
      WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY t.table_schema, t.table_name
    `);

    return result.rows.map((row: Record<string, unknown>) => ({
      name: row.name as string,
      schema: row.schema as string,
      type: (row.table_type === 'VIEW' ? 'view' : 'table') as 'table' | 'view',
      rowCount: Math.max(0, Number(row.estimated_rows) || 0),
    }));
  }

  async getColumns(tableName: string, schema?: string): Promise<ColumnInfo[]> {
    const client = await this.ensureClient();
    const targetSchema = schema || 'public';

    // Get column info
    const colResult = await client.query(
      `
      SELECT
        c.column_name AS name,
        c.data_type AS native_type,
        c.udt_name AS udt_type,
        c.is_nullable,
        c.column_default,
        pgd.description AS comment
      FROM information_schema.columns c
      LEFT JOIN pg_catalog.pg_statio_all_tables st
        ON st.schemaname = c.table_schema AND st.relname = c.table_name
      LEFT JOIN pg_catalog.pg_description pgd
        ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position
      `,
      [targetSchema, tableName]
    );

    // Get primary keys
    const pkResult = await client.query(
      `
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE i.indisprimary AND c.relname = $1 AND n.nspname = $2
      `,
      [tableName, targetSchema]
    );
    const pkColumns = new Set(pkResult.rows.map((r: Record<string, unknown>) => r.column_name));

    // Get foreign keys
    const fkResult = await client.query(
      `
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1
        AND tc.table_schema = $2
      `,
      [tableName, targetSchema]
    );
    const fkMap = new Map<string, { table: string; column: string }>();
    for (const fk of fkResult.rows as Array<Record<string, unknown>>) {
      fkMap.set(fk.column_name as string, {
        table: fk.foreign_table as string,
        column: fk.foreign_column as string,
      });
    }

    return colResult.rows.map((row: Record<string, unknown>) => {
      const name = row.name as string;
      const nativeType = row.native_type as string;
      const fk = fkMap.get(name);

      return {
        name,
        nativeType,
        normalizedType: normalizeColumnType(nativeType, 'postgres') as NormalizedColumnType,
        nullable: (row.is_nullable as string) === 'YES',
        isPrimaryKey: pkColumns.has(name),
        isForeignKey: fkMap.has(name),
        foreignKeyTable: fk?.table,
        foreignKeyColumn: fk?.column,
        defaultValue: (row.column_default as string) ?? undefined,
        comment: (row.comment as string) ?? undefined,
      };
    });
  }

  async getRowCount(tableName: string): Promise<number> {
    const client = await this.ensureClient();
    // Use exact count for small tables, estimate for large ones
    const estimateResult = await client.query(
      `SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = $1 LIMIT 1`,
      [tableName]
    );
    const estimate = Number(estimateResult.rows[0]?.estimate) || 0;

    // If estimate is small enough, get exact count
    if (estimate < 100_000) {
      const exactResult = await client.query(
        `SELECT COUNT(*)::int AS count FROM "${tableName}"`
      );
      return Number(exactResult.rows[0]?.count) || 0;
    }

    return Math.max(0, estimate);
  }
}

export function createPostgresConnector(config: ConnectionConfig): DatabaseConnector {
  return new PostgresConnector(config);
}
