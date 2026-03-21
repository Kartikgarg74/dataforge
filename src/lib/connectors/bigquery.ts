/**
 * BigQuery Connector
 *
 * Implements the DatabaseConnector interface for Google BigQuery.
 * Uses @google-cloud/bigquery with lazy loading.
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
  NormalizedColumnType,
} from './interface';
import { normalizeColumnType } from './interface';

/**
 * @google-cloud/bigquery is lazy-loaded to avoid import errors when not installed.
 * Install with: npm install @google-cloud/bigquery
 */
let bigqueryModule: any = null;

async function getBigQuery(): Promise<any> {
  if (!bigqueryModule) {
    try {
      bigqueryModule = await import('@google-cloud/bigquery' as string);
    } catch {
      throw new Error(
        '@google-cloud/bigquery is not installed. Run: npm install @google-cloud/bigquery'
      );
    }
  }
  return bigqueryModule;
}

const MAX_QUERY_LENGTH = 10_000;

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
    /\b(insert|update|delete|drop|alter|create|replace|truncate|grant|revoke|merge)\b/i.test(
      normalized
    )
  ) {
    throw new Error('Disallowed SQL keyword detected');
  }
  return normalized;
}

export class BigQueryConnector implements DatabaseConnector {
  readonly type: ConnectorType = 'bigquery';
  readonly config: ConnectionConfig;
  private client: any = null;
  private connected = false;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  private getProjectId(): string {
    return (this.config.options?.projectId as string) || this.config.database || '';
  }

  private getDataset(): string {
    return (this.config.options?.dataset as string) || '';
  }

  private getKeyFilename(): string | undefined {
    return this.config.options?.keyFilename as string | undefined;
  }

  async connect(): Promise<void> {
    if (this.connected && this.client) return;

    const bq = await getBigQuery();
    const BigQuery = bq.BigQuery;

    const options: any = {
      projectId: this.getProjectId(),
    };

    const keyFilename = this.getKeyFilename();
    if (keyFilename) {
      options.keyFilename = keyFilename;
    }

    this.client = new BigQuery(options);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.connected = false;
  }

  async testConnection(): Promise<ConnectorStatus> {
    const start = Date.now();
    try {
      await this.connect();
      const dataset = this.getDataset();

      // Run a simple query to verify connectivity
      const [rows] = await this.client.query({
        query: 'SELECT 1 AS test',
        location: this.config.options?.location as string | undefined,
      });

      return {
        connected: true,
        message: `Connected to BigQuery project: ${this.getProjectId()}`,
        serverVersion: 'BigQuery',
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

  private async ensureClient(): Promise<any> {
    if (!this.client || !this.connected) {
      await this.connect();
    }
    return this.client;
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

    const queryOptions: any = {
      query: finalSql,
      location: this.config.options?.location as string | undefined,
    };

    if (params.length > 0) {
      queryOptions.params = params;
    }

    const [rows, , metadata] = await client.query(queryOptions);
    const executionTimeMs = Date.now() - start;

    const resultRows = rows as Record<string, unknown>[];
    const columns = resultRows.length > 0 ? Object.keys(resultRows[0]) : [];

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
      database: this.getDataset() || this.getProjectId() || 'unknown',
      tables: [],
    };

    for (const table of tables) {
      const columns = await this.getColumns(table.name);
      schemaInfo.tables.push({ table, columns });
    }

    return schemaInfo;
  }

  async getTables(): Promise<TableInfo[]> {
    const client = await this.ensureClient();
    const dataset = this.getDataset();

    if (!dataset) {
      throw new Error('BigQuery dataset is required. Set it in options.dataset.');
    }

    const [tables] = await client.dataset(dataset).getTables();

    return (tables || []).map((table: any) => ({
      name: table.id as string,
      schema: dataset,
      type: (table.metadata?.type === 'VIEW' ? 'view' : 'table') as 'table' | 'view',
      rowCount: Number(table.metadata?.numRows) || 0,
    }));
  }

  async getColumns(tableName: string, schema?: string): Promise<ColumnInfo[]> {
    const client = await this.ensureClient();
    const dataset = schema || this.getDataset();

    if (!dataset) {
      throw new Error('BigQuery dataset is required. Set it in options.dataset.');
    }

    const [metadata] = await client.dataset(dataset).table(tableName).getMetadata();
    const fields = metadata.schema?.fields || [];

    return fields.map((field: any) => ({
      name: field.name as string,
      nativeType: field.type as string,
      normalizedType: normalizeBigQueryType(field.type as string),
      nullable: field.mode !== 'REQUIRED',
      isPrimaryKey: false, // BigQuery does not have primary keys
      isForeignKey: false,
      defaultValue: undefined,
      comment: field.description || undefined,
    }));
  }

  async getRowCount(tableName: string): Promise<number> {
    const client = await this.ensureClient();
    const dataset = this.getDataset();

    if (!dataset) {
      throw new Error('BigQuery dataset is required. Set it in options.dataset.');
    }

    const [metadata] = await client.dataset(dataset).table(tableName).getMetadata();
    return Number(metadata.numRows) || 0;
  }
}

function normalizeBigQueryType(bqType: string): NormalizedColumnType {
  const upper = bqType.toUpperCase();
  switch (upper) {
    case 'INT64':
    case 'INTEGER':
      return 'integer';
    case 'FLOAT64':
    case 'FLOAT':
    case 'NUMERIC':
    case 'BIGNUMERIC':
      return 'float';
    case 'BOOL':
    case 'BOOLEAN':
      return 'boolean';
    case 'STRING':
      return 'string';
    case 'DATE':
      return 'date';
    case 'DATETIME':
    case 'TIMESTAMP':
      return 'datetime';
    case 'TIME':
      return 'time';
    case 'BYTES':
      return 'binary';
    case 'JSON':
    case 'STRUCT':
    case 'RECORD':
      return 'json';
    default:
      return 'unknown';
  }
}

export function createBigQueryConnector(config: ConnectionConfig): DatabaseConnector {
  return new BigQueryConnector(config);
}
