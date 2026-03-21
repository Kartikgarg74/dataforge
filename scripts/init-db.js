const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'working.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Run all migrations
const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

for (const file of files) {
  console.log(`Running migration: ${file}`);
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  try {
    db.exec(sql);
  } catch (err) {
    console.log(`  Skipped (already exists): ${err.message.split('\n')[0]}`);
  }
}

console.log('\nAll tables:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
tables.forEach(t => console.log(`  - ${t.name}`));

db.close();
console.log('\nDatabase initialized');
