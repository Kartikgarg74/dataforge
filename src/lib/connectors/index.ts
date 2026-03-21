/**
 * Connectors Index
 *
 * Re-exports all connector types and provides a pre-configured
 * ConnectionManager with all available connector factories registered.
 */

export type {
  ConnectionConfig,
  ConnectorType,
  DatabaseConnector,
  ConnectorStatus,
  QueryResult,
  SchemaInfo,
  TableInfo,
  ColumnInfo,
  NormalizedColumnType,
  ConnectorFactory,
} from './interface';

export { normalizeColumnType } from './interface';
export { ConnectionManager } from './manager';
export type { ConnectionInfo } from './manager';

export { SQLiteConnector, createSQLiteConnector } from './sqlite';
export { PostgresConnector, createPostgresConnector } from './postgres';
export { MySQLConnector, createMySQLConnector } from './mysql';
export { MongoDBConnector, createMongoDBConnector } from './mongodb';
export { BigQueryConnector, createBigQueryConnector } from './bigquery';
export { SupabaseConnector, createSupabaseConnector } from './supabase';

import { ConnectionManager } from './manager';
import { createSQLiteConnector } from './sqlite';
import { createPostgresConnector } from './postgres';
import { createMySQLConnector } from './mysql';
import { createMongoDBConnector } from './mongodb';
import { createBigQueryConnector } from './bigquery';
import { createSupabaseConnector } from './supabase';

/**
 * Get a pre-configured ConnectionManager with all available factories registered.
 */
export function getConnectionManager(): ConnectionManager {
  const manager = ConnectionManager.getInstance();

  // Register factories if not already registered
  if (!manager.hasFactory('sqlite')) {
    manager.registerFactory('sqlite', createSQLiteConnector);
  }
  if (!manager.hasFactory('postgres')) {
    manager.registerFactory('postgres', createPostgresConnector);
  }
  if (!manager.hasFactory('mysql')) {
    manager.registerFactory('mysql', createMySQLConnector);
  }
  if (!manager.hasFactory('mongodb')) {
    manager.registerFactory('mongodb', createMongoDBConnector);
  }
  if (!manager.hasFactory('bigquery')) {
    manager.registerFactory('bigquery', createBigQueryConnector);
  }
  if (!manager.hasFactory('supabase')) {
    manager.registerFactory('supabase', createSupabaseConnector);
  }

  return manager;
}
