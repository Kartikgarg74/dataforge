/* eslint-disable */
/**
 * MongoDB Connector
 *
 * Implements the DatabaseConnector interface for MongoDB.
 * Presents collections as "tables" with inferred schema from document sampling.
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
} from './interface';

let mongoModule: any = null;

async function getMongo(): Promise<any> {
  if (!mongoModule) {
    try {
      mongoModule = await import('mongodb' as string);
    } catch {
      throw new Error('mongodb is not installed. Run: npm install mongodb');
    }
  }
  return mongoModule;
}

const CONNECTION_TIMEOUT_MS = 10_000;
const SAMPLE_SIZE = 100;

export class MongoDBConnector implements DatabaseConnector {
  readonly type: ConnectorType = 'mongodb';
  readonly config: ConnectionConfig;
  private client: any = null;
  private connected = false;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  private getConnectionString(): string {
    if (this.config.connectionString) return this.config.connectionString;
    const { host, port, database, username, password } = this.config;
    const auth = username && password ? `${username}:${password}@` : '';
    return `mongodb://${auth}${host || 'localhost'}:${port || 27017}/${database || ''}`;
  }

  async connect(): Promise<void> {
    if (this.connected && this.client) return;
    const { MongoClient } = await getMongo();
    this.client = new MongoClient(this.getConnectionString(), {
      connectTimeoutMS: CONNECTION_TIMEOUT_MS,
      serverSelectionTimeoutMS: CONNECTION_TIMEOUT_MS,
    });
    await this.client.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try { await this.client.close(); } catch { /* ignore */ }
      this.client = null;
      this.connected = false;
    }
  }

  async testConnection(): Promise<ConnectorStatus> {
    const start = Date.now();
    try {
      await this.connect();
      const admin = this.client.db().admin();
      const info = await admin.serverInfo();
      return {
        connected: true,
        message: 'Connected to MongoDB',
        serverVersion: info.version,
        latencyMs: Date.now() - start,
      };
    } catch (error: any) {
      return {
        connected: false,
        message: error?.message || 'Connection failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  private getDb() {
    const dbName = this.config.database || 'test';
    return this.client.db(dbName);
  }

  async executeQuery(
    sql: string,
    _params: unknown[] = [],
    limit: number = 1000
  ): Promise<QueryResult> {
    await this.connect();
    const start = Date.now();

    // Parse simple "SQL-like" queries for MongoDB
    // Supports: SELECT * FROM collection WHERE field = value LIMIT n
    const match = sql.match(/^\s*select\s+(.+?)\s+from\s+(\w+)(?:\s+where\s+(.+?))?(?:\s+limit\s+(\d+))?\s*$/i);
    if (!match) {
      throw new Error('MongoDB connector supports basic SELECT queries only. Format: SELECT * FROM collection [WHERE field = value] [LIMIT n]');
    }

    const [, , collection, whereClause, limitStr] = match;
    const db = this.getDb();
    const col = db.collection(collection);

    // Parse simple WHERE clause
    let filter: Record<string, any> = {};
    if (whereClause) {
      const conditions = whereClause.split(/\s+and\s+/i);
      for (const cond of conditions) {
        const m = cond.trim().match(/^(\w+)\s*(=|!=|>|<|>=|<=)\s*['"]?(.+?)['"]?\s*$/);
        if (m) {
          const [, field, op, value] = m;
          const numVal = Number(value);
          const typedVal = !isNaN(numVal) && value !== '' ? numVal : value;
          switch (op) {
            case '=': filter[field] = typedVal; break;
            case '!=': filter[field] = { $ne: typedVal }; break;
            case '>': filter[field] = { $gt: typedVal }; break;
            case '<': filter[field] = { $lt: typedVal }; break;
            case '>=': filter[field] = { $gte: typedVal }; break;
            case '<=': filter[field] = { $lte: typedVal }; break;
          }
        }
      }
    }

    const queryLimit = limitStr ? parseInt(limitStr, 10) : limit;
    const docs = await col.find(filter).limit(queryLimit).toArray();

    // Flatten documents and extract columns
    const rows = docs.map((doc: any) => {
      const flat: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(doc)) {
        if (key === '_id') {
          flat._id = String(value);
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
            flat[`${key}_${subKey}`] = subVal;
          }
        } else if (Array.isArray(value)) {
          flat[key] = JSON.stringify(value);
        } else {
          flat[key] = value;
        }
      }
      return flat;
    });

    const colSet = new Set<string>();
    for (const r of rows) { for (const k of Object.keys(r as Record<string, unknown>)) { colSet.add(k); } }
    const columns: string[] = Array.from(colSet);

    return {
      rows,
      columns,
      rowCount: rows.length,
      executionTimeMs: Date.now() - start,
      truncated: rows.length >= queryLimit,
    };
  }

  async getSchema(): Promise<SchemaInfo> {
    const tables = await this.getTables();
    const schema: SchemaInfo = {
      database: this.config.database || 'test',
      tables: [],
    };
    for (const table of tables) {
      const columns = await this.getColumns(table.name);
      schema.tables.push({ table, columns });
    }
    return schema;
  }

  async getTables(): Promise<TableInfo[]> {
    await this.connect();
    const db = this.getDb();
    const collections = await db.listCollections().toArray();
    const tables: TableInfo[] = [];

    for (const col of collections) {
      let rowCount = 0;
      try {
        rowCount = await db.collection(col.name).estimatedDocumentCount();
      } catch { /* ignore */ }
      tables.push({ name: col.name, type: 'collection', rowCount });
    }

    return tables.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    await this.connect();
    const db = this.getDb();
    const col = db.collection(tableName);

    // Sample documents to infer schema
    const sample = await col.find().limit(SAMPLE_SIZE).toArray();
    if (sample.length === 0) return [];

    // Collect all field names and their types
    const fieldTypes = new Map<string, Set<string>>();
    for (const doc of sample) {
      for (const [key, value] of Object.entries(doc)) {
        if (!fieldTypes.has(key)) fieldTypes.set(key, new Set());
        const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
        fieldTypes.get(key)!.add(type);
      }
    }

    return [...fieldTypes.entries()].map(([name, types]) => {
      const typeArr = [...types].filter((t) => t !== 'null');
      const primaryType = typeArr[0] || 'string';
      const nativeType = typeArr.length > 1 ? 'mixed' : primaryType;

      return {
        name,
        nativeType,
        normalizedType: mongoTypeToNormalized(nativeType),
        nullable: types.has('null') || fieldTypes.get(name)!.size < sample.length,
        isPrimaryKey: name === '_id',
        isForeignKey: false,
      };
    });
  }

  async getRowCount(tableName: string): Promise<number> {
    await this.connect();
    const db = this.getDb();
    return db.collection(tableName).estimatedDocumentCount();
  }
}

function mongoTypeToNormalized(type: string): 'integer' | 'float' | 'string' | 'boolean' | 'date' | 'datetime' | 'json' | 'unknown' {
  switch (type) {
    case 'number': return 'float';
    case 'string': return 'string';
    case 'boolean': return 'boolean';
    case 'object': return 'json';
    case 'array': return 'json';
    default: return 'unknown';
  }
}

export function createMongoDBConnector(config: ConnectionConfig): DatabaseConnector {
  return new MongoDBConnector(config);
}
