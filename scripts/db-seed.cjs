const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { Client } = require('@neondatabase/serverless');

const cwd = process.cwd();
const DB_PATH = path.join(cwd, 'src/db', 'data.db');
const SEEDS_DIR = path.join(cwd, 'db', 'seeds');

function getProvider() {
  const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  const provider = process.env.DB_PROVIDER || (databaseUrl ? 'postgres' : 'sqlite');
  return { provider, databaseUrl };
}

function getSeedFiles() {
  if (!fs.existsSync(SEEDS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(SEEDS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function seedPostgres(databaseUrl, files) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or NEON_DATABASE_URL) is required for postgres seeding');
  }

  const client = new Client(databaseUrl);
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _seed_runs (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const exists = await client.query(
        'SELECT 1 FROM _seed_runs WHERE filename = $1 LIMIT 1',
        [file]
      );

      if (exists.rowCount && exists.rowCount > 0) {
        console.log(`skip ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');
      console.log(`apply ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _seed_runs (filename) VALUES ($1)', [file]);
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

function seedSqlite(files) {
  const db = new Database(DB_PATH);

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _seed_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const hasSeed = db.prepare('SELECT 1 FROM _seed_runs WHERE filename = ? LIMIT 1');
    const recordSeed = db.prepare('INSERT INTO _seed_runs (filename) VALUES (?)');

    for (const file of files) {
      const exists = hasSeed.get(file);
      if (exists) {
        console.log(`skip ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');
      console.log(`apply ${file}`);

      const applyTransaction = db.transaction(() => {
        db.exec(sql);
        recordSeed.run(file);
      });

      applyTransaction();
    }
  } finally {
    db.close();
  }
}

async function main() {
  const files = getSeedFiles();
  if (files.length === 0) {
    console.log('No seed files found.');
    return;
  }

  const { provider, databaseUrl } = getProvider();
  console.log(`Running seeds with provider=${provider}`);

  if (provider === 'postgres') {
    await seedPostgres(databaseUrl, files);
  } else {
    seedSqlite(files);
  }

  console.log('Seeding complete.');
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
});
