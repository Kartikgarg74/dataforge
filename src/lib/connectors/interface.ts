/**
 * Database Connector Interface
 *
 * Defines the contract that all database connectors must implement.
 * This abstraction allows the app to work with Postgres, MySQL, MongoDB,
 * BigQuery, SQLite, and future databases through a uniform API.
 */

export interface ConnectionConfig {
  /** Unique identifier for this connection */
  id: string;
  /** Display name for this connection */
  name: string;
  /** Database type */
  type: ConnectorType;
  /** Hostname or IP address */
  host?: string;
  /** Port number */
  port?: number;
  /** Database name */
  database?: string;
  /** Username for authentication */
  username?: string;
  /** Password for authentication */
  password?: string;
  /** SSL/TLS enabled */
  ssl?: boolean;
  /** Connection string (alternative to individual fields) */
  connectionString?: string;
  /** Additional options (connector-specific) */
  options?: Record<string, unknown>;
}

export type ConnectorType =
  | 'sqlite'
  | 'postgres'
  | 'mysql'
  | 'mongodb'
  | 'bigquery'
  | 'supabase'
  | 'clickhouse'
  | 'duckdb';

export interface TableInfo {
  /** Table name */
  name: string;
  /** Schema/namespace (e.g., 'public' for Postgres) */
  schema?: string;
  /** Estimated row count */
  rowCount?: number;
  /** Table type: base table or view */
  type: 'table' | 'view' | 'collection';
}

export interface ColumnInfo {
  /** Column name */
  name: string;
  /** Database-native type (e.g., 'VARCHAR(255)', 'INT', 'TIMESTAMP') */
  nativeType: string;
  /** Normalized type for cross-database compatibility */
  normalizedType: NormalizedColumnType;
  /** Whether the column allows NULL values */
  nullable: boolean;
  /** Whether this column is a primary key */
  isPrimaryKey: boolean;
  /** Whether this column is a foreign key */
  isForeignKey: boolean;
  /** Referenced table if foreign key */
  foreignKeyTable?: string;
  /** Referenced column if foreign key */
  foreignKeyColumn?: string;
  /** Default value expression */
  defaultValue?: string;
  /** Column comment/description (if available) */
  comment?: string;
}

export type NormalizedColumnType =
  | 'integer'
  | 'float'
  | 'string'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'json'
  | 'binary'
  | 'unknown';

export interface SchemaInfo {
  /** Database name */
  database: string;
  /** List of tables with their columns */
  tables: Array<{
    table: TableInfo;
    columns: ColumnInfo[];
  }>;
}

export interface QueryResult {
  /** Array of row objects */
  rows: Record<string, unknown>[];
  /** Column names in order */
  columns: string[];
  /** Column types */
  columnTypes?: NormalizedColumnType[];
  /** Total rows returned */
  rowCount: number;
  /** Query execution time in milliseconds */
  executionTimeMs: number;
  /** Whether the result was truncated */
  truncated?: boolean;
}

export interface ConnectorStatus {
  /** Whether the connector is currently connected */
  connected: boolean;
  /** Human-readable status message */
  message: string;
  /** Server version (if connected) */
  serverVersion?: string;
  /** Latency of last health check in ms */
  latencyMs?: number;
}

/**
 * The core interface that all database connectors must implement.
 */
export interface DatabaseConnector {
  /** The type of this connector */
  readonly type: ConnectorType;

  /** The connection configuration */
  readonly config: ConnectionConfig;

  /**
   * Establish a connection to the database.
   * Should be idempotent — calling connect() when already connected is a no-op.
   */
  connect(): Promise<void>;

  /**
   * Close the database connection and release resources.
   * Should be idempotent — calling disconnect() when not connected is a no-op.
   */
  disconnect(): Promise<void>;

  /**
   * Test the connection without fully establishing it.
   * Returns status info including whether the connection is valid.
   */
  testConnection(): Promise<ConnectorStatus>;

  /**
   * Execute a read-only SQL query and return results.
   * Implementations MUST enforce read-only access.
   *
   * @param sql - The SQL query to execute
   * @param params - Optional parameterized query values
   * @param limit - Maximum number of rows to return (default: 1000)
   */
  executeQuery(
    sql: string,
    params?: unknown[],
    limit?: number
  ): Promise<QueryResult>;

  /**
   * Discover the full schema of the connected database.
   * Returns all tables and their columns.
   */
  getSchema(): Promise<SchemaInfo>;

  /**
   * List all tables (and views) in the database.
   */
  getTables(): Promise<TableInfo[]>;

  /**
   * Get column information for a specific table.
   *
   * @param tableName - The name of the table
   * @param schema - Optional schema name (defaults to database default schema)
   */
  getColumns(tableName: string, schema?: string): Promise<ColumnInfo[]>;

  /**
   * Get the row count for a specific table.
   * Implementations may use approximate counts for large tables.
   *
   * @param tableName - The name of the table
   */
  getRowCount(tableName: string): Promise<number>;
}

/**
 * Factory function type for creating connector instances.
 */
export type ConnectorFactory = (config: ConnectionConfig) => DatabaseConnector;

/**
 * Map a database-native type string to a normalized type.
 * Useful for cross-database compatibility.
 */
export function normalizeColumnType(
  nativeType: string,
  dbType: ConnectorType
): NormalizedColumnType {
  const upper = nativeType.toUpperCase();

  // Integer types
  if (
    /^(INT|INTEGER|SMALLINT|BIGINT|TINYINT|MEDIUMINT|SERIAL|BIGSERIAL)/.test(
      upper
    )
  ) {
    return 'integer';
  }

  // Float types
  if (
    /^(FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL|MONEY|NUMBER)/.test(upper)
  ) {
    return 'float';
  }

  // Boolean types
  if (/^(BOOL|BOOLEAN|BIT)/.test(upper)) {
    return 'boolean';
  }

  // Date-only types
  if (/^DATE$/.test(upper)) {
    return 'date';
  }

  // DateTime types
  if (
    /^(DATETIME|TIMESTAMP|TIMESTAMPTZ|TIMESTAMP WITH TIME ZONE)/.test(upper)
  ) {
    return 'datetime';
  }

  // Time types
  if (/^(TIME|TIMETZ|TIME WITH TIME ZONE)/.test(upper)) {
    return 'time';
  }

  // JSON types
  if (/^(JSON|JSONB|BSON)/.test(upper)) {
    return 'json';
  }

  // Binary types
  if (/^(BLOB|BINARY|VARBINARY|BYTEA|RAW|IMAGE)/.test(upper)) {
    return 'binary';
  }

  // String types (catch-all for text types)
  if (
    /^(VARCHAR|CHAR|TEXT|NVARCHAR|NCHAR|NTEXT|CLOB|STRING|UUID|ENUM|SET)/.test(
      upper
    )
  ) {
    return 'string';
  }

  // SQLite specific: TEXT is the most common
  if (dbType === 'sqlite' && /^TEXT/.test(upper)) {
    return 'string';
  }

  // SQLite REAL
  if (dbType === 'sqlite' && /^REAL/.test(upper)) {
    return 'float';
  }

  return 'unknown';
}
