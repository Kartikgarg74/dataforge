const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { Client } = require('@neondatabase/serverless');

const cwd = process.cwd();
const DB_PATH = path.join(cwd, 'src/db', 'data.db');
const MIGRATIONS_DIR = path.join(cwd, 'db', 'migrations');

function getProvider() {
  const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  const provider = process.env.DB_PROVIDER || (databaseUrl ? 'postgres' : 'sqlite');
  return { provider, databaseUrl };
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function migratePostgres(databaseUrl, files) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or NEON_DATABASE_URL) is required for postgres migrations');
  }

  const client = new Client(databaseUrl);
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const exists = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1 LIMIT 1',
        [file]
      );

      if (exists.rowCount && exists.rowCount > 0) {
        console.log(`skip ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`apply ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

function migrateSqlite(files) {
  const db = new Database(DB_PATH);

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const hasMigration = db.prepare('SELECT 1 FROM _migrations WHERE filename = ? LIMIT 1');
    const recordMigration = db.prepare('INSERT INTO _migrations (filename) VALUES (?)');

    for (const file of files) {
      const exists = hasMigration.get(file);
      if (exists) {
        console.log(`skip ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`apply ${file}`);

      const applyTransaction = db.transaction(() => {
        db.exec(sql);
        recordMigration.run(file);
      });

      applyTransaction();
    }
  } finally {
    db.close();
  }
}

async function main() {
  const files = getMigrationFiles();
  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  const { provider, databaseUrl } = getProvider();
  console.log(`Running migrations with provider=${provider}`);

  if (provider === 'postgres') {
    await migratePostgres(databaseUrl, files);
  } else {
    migrateSqlite(files);
  }

  console.log('Migrations complete.');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
