/**
 * Supabase Connector
 *
 * Wraps the PostgresConnector to provide a Supabase-friendly interface.
 * Accepts supabaseUrl + supabaseKey or a direct connectionString.
 */

/* eslint-disable */

import type {
  ConnectionConfig,
  ConnectorType,
  DatabaseConnector,
  ConnectorStatus,
  QueryResult,
  SchemaInfo,
  TableInfo,
  ColumnInfo,
} from './interface';
import { PostgresConnector } from './postgres';

/**
 * Derive a Postgres connection string from Supabase project URL and service key.
 *
 * Supabase project URLs follow the pattern: https://<project-ref>.supabase.co
 * The underlying Postgres database is at: <project-ref>.supabase.co:5432
 */
function buildSupabaseConnectionString(
  supabaseUrl: string,
  supabaseKey: string,
  database: string = 'postgres'
): string {
  // Extract host from the Supabase URL (e.g., https://xyz.supabase.co -> xyz.supabase.co)
  let host: string;
  try {
    const url = new URL(supabaseUrl);
    host = url.hostname;
  } catch {
    // If it's not a valid URL, treat it as a hostname directly
    host = supabaseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  // Supabase Postgres uses port 5432 with the 'postgres' user by default
  // The supabaseKey (service_role key) is used as the password
  return `postgresql://postgres:${supabaseKey}@${host}:5432/${database}?sslmode=require`;
}

export class SupabaseConnector implements DatabaseConnector {
  readonly type: ConnectorType = 'supabase';
  readonly config: ConnectionConfig;
  private pgConnector: PostgresConnector;

  constructor(config: ConnectionConfig) {
    this.config = config;

    // Build a Postgres-compatible config
    const pgConfig: ConnectionConfig = {
      ...config,
      type: 'postgres',
    };

    // If no connectionString, derive one from supabaseUrl + supabaseKey
    if (!pgConfig.connectionString) {
      const supabaseUrl = config.options?.supabaseUrl as string;
      const supabaseKey = config.options?.supabaseKey as string;

      if (supabaseUrl && supabaseKey) {
        pgConfig.connectionString = buildSupabaseConnectionString(
          supabaseUrl,
          supabaseKey,
          config.database || 'postgres'
        );
      } else {
        throw new Error(
          'Supabase connector requires either a connectionString or options.supabaseUrl + options.supabaseKey'
        );
      }
    }

    this.pgConnector = new PostgresConnector(pgConfig);
  }

  async connect(): Promise<void> {
    return this.pgConnector.connect();
  }

  async disconnect(): Promise<void> {
    return this.pgConnector.disconnect();
  }

  async testConnection(): Promise<ConnectorStatus> {
    const status = await this.pgConnector.testConnection();
    return {
      ...status,
      message: status.connected
        ? 'Connected to Supabase (PostgreSQL)'
        : status.message,
    };
  }

  async executeQuery(
    sql: string,
    params?: unknown[],
    limit?: number
  ): Promise<QueryResult> {
    return this.pgConnector.executeQuery(sql, params, limit);
  }

  async getSchema(): Promise<SchemaInfo> {
    return this.pgConnector.getSchema();
  }

  async getTables(): Promise<TableInfo[]> {
    return this.pgConnector.getTables();
  }

  async getColumns(tableName: string, schema?: string): Promise<ColumnInfo[]> {
    return this.pgConnector.getColumns(tableName, schema);
  }

  async getRowCount(tableName: string): Promise<number> {
    return this.pgConnector.getRowCount(tableName);
  }
}

export function createSupabaseConnector(config: ConnectionConfig): DatabaseConnector {
  return new SupabaseConnector(config);
}
