import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Client } from '@neondatabase/serverless';

const DB_PATH = path.join(process.cwd(), 'src/db', 'data.db');
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
const DB_PROVIDER = process.env.DB_PROVIDER || (DATABASE_URL ? 'postgres' : 'sqlite');

const MAX_QUERY_LENGTH = 10000;
let sqliteReadOnlyDb: Database.Database | null = null;

type SqlParam = string | number | null;

function assertSafeReadOnlyQuery(query: string): string {
  if (typeof query !== 'string') {
    throw new Error('Query must be a string');
  }

  const normalized = query.trim();
  if (normalized.length === 0) {
    throw new Error('Query cannot be empty');
  }

  if (normalized.length > MAX_QUERY_LENGTH) {
    throw new Error('Query is too long');
  }

  // Disallow stacked/multi statements.
  if (normalized.includes(';')) {
    throw new Error('Multiple statements are not allowed');
  }

  // Only allow read-only SELECT/CTE queries.
  if (!/^\s*(select|with)\b/i.test(normalized)) {
    throw new Error('Only read-only SELECT queries are allowed');
  }

  // Block common write/admin SQL even if hidden in CTE text.
  if (/\b(insert|update|delete|drop|alter|create|replace|truncate|attach|detach|pragma|vacuum|reindex)\b/i.test(normalized)) {
    throw new Error('Disallowed SQL keyword detected');
  }

  return normalized;
}

function assertSafeIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error('Invalid identifier');
  }
  return identifier;
}

interface QueryResult {
  results: Record<string, unknown>[];
  columns: string[];
}

type SupportedDbProvider = 'sqlite' | 'postgres';

export function getDatabaseProvider(): SupportedDbProvider {
  return DB_PROVIDER === 'postgres' ? 'postgres' : 'sqlite';
}

async function withPostgresClient<T>(work: (client: Client) => Promise<T>): Promise<T> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL (or NEON_DATABASE_URL) must be set for postgres provider');
  }

  const client = new Client(DATABASE_URL);
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

function normalizePostgresParam(value: SqlParam): string | number | null {
  return value;
}

function getSqliteReadOnlyDb(): Database.Database {
  if (!sqliteReadOnlyDb) {
    sqliteReadOnlyDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    sqliteReadOnlyDb.pragma('query_only = ON');
  }
  return sqliteReadOnlyDb;
}

export function initDatabase(): void {
  if (getDatabaseProvider() === 'postgres') {
    console.log('Skipping local SQLite initialization because DB_PROVIDER=postgres');
    return;
  }

  const db = new Database(DB_PATH);
  const schema = fs.readFileSync(path.join(process.cwd(), 'src/db/schema.sql'), 'utf8');
  db.exec(schema);
  console.log('Database initialized!');
  db.close();
}

export async function executeQuery(query: string, params: SqlParam[] = []): Promise<QueryResult> {
  const safeQuery = assertSafeReadOnlyQuery(query);

  if (getDatabaseProvider() === 'postgres') {
    return withPostgresClient(async (client) => {
      const result = await client.query(safeQuery, params.map(normalizePostgresParam));
      const columns = result.fields.map((field) => field.name);
      return {
        results: result.rows as Record<string, unknown>[],
        columns,
      };
    });
  }

  const db = getSqliteReadOnlyDb();
  const stmt = db.prepare(safeQuery);
  if (!stmt.reader) {
    throw new Error('Only read-only SELECT queries are allowed');
  }

  const results = stmt.all(...params) as Record<string, unknown>[];
  const columns = results.length > 0 ? Object.keys(results[0]) : [];
  return { results, columns };
}

interface TableInfo {
  name: string;
}

interface ColumnInfo {
  name: string;
  type: string;
}

interface PostgresSchemaRow {
  table_name: string;
  column_name: string;
  data_type: string;
}

export async function getDatabaseSchema(): Promise<string> {
  if (getDatabaseProvider() === 'postgres') {
    const rows = await withPostgresClient(async (client) => {
      const result = await client.query(
        `SELECT table_name, column_name, data_type
         FROM information_schema.columns
         WHERE table_schema = 'public'
         ORDER BY table_name, ordinal_position`
      );

      return result.rows as PostgresSchemaRow[];
    });

    const grouped = new Map<string, Array<{ name: string; type: string }>>();
    for (const row of rows) {
      if (!grouped.has(row.table_name)) {
        grouped.set(row.table_name, []);
      }
      grouped.get(row.table_name)?.push({ name: row.column_name, type: row.data_type });
    }

    let schema = '';
    for (const [tableName, columns] of grouped) {
      schema += `Table: ${tableName}\n`;
      schema += columns.map((col) => `  - ${col.name} (${col.type})`).join('\n');
      schema += '\n\n';
    }

    return schema;
  }

  const db = getSqliteReadOnlyDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as TableInfo[];
  let schema = '';
  for (const table of tables) {
    const safeTableName = assertSafeIdentifier(table.name);
    const columns = db
      .prepare(`PRAGMA table_info("${safeTableName}")`)
      .all() as ColumnInfo[];
    schema += `Table: ${safeTableName}\n`;
    schema += columns.map((col) => `  - ${col.name} (${col.type})`).join('\n');
    schema += '\n\n';
  }
  return schema;
}

export async function getRowCounts(tableName: string): Promise<number> {
  const safeTableName = assertSafeIdentifier(tableName);

  if (getDatabaseProvider() === 'postgres') {
    return withPostgresClient(async (client) => {
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM "${safeTableName}"`
      );
      const count = result.rows[0]?.count;
      return typeof count === 'number' ? count : Number(count) || 0;
    });
  }

  const db = getSqliteReadOnlyDb();
  const result = db
    .prepare(`SELECT COUNT(*) as count FROM "${safeTableName}"`)
    .get() as { count: number };
  return result?.count || 0;
}
