/**
 * Dataset Splitter
 *
 * Splits datasets into train/val/test sets using various strategies.
 */

import Database from 'better-sqlite3';
import path from 'path';
import type { SplitConfig, SplitResult } from './types';

const WORKING_DB_PATH = path.join(process.cwd(), 'data', 'working.db');

/**
 * Simple seedable pseudo-random number generator (Mulberry32).
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Split a dataset table into train/val/test tables.
 */
export function splitDataset(
  sourceTable: string,
  config: SplitConfig
): SplitResult {
  const db = new Database(WORKING_DB_PATH);
  const seed = config.seed ?? 42;
  const { train: trainRatio, val: valRatio, test: testRatio } = config.ratios;

  // Validate ratios
  const total = trainRatio + valRatio + testRatio;
  if (Math.abs(total - 1.0) > 0.01) {
    throw new Error(`Split ratios must sum to 1.0 (got ${total})`);
  }

  const trainTable = `${sourceTable}_train`;
  const valTable = `${sourceTable}_val`;
  const testTable = `${sourceTable}_test`;

  try {
    // Get all rowids
    const totalRows = (db.prepare(`SELECT COUNT(*) AS c FROM "${sourceTable}"`).get() as { c: number }).c;

    if (totalRows === 0) {
      throw new Error('Cannot split an empty table');
    }

    // Drop existing split tables
    db.exec(`DROP TABLE IF EXISTS "${trainTable}"`);
    db.exec(`DROP TABLE IF EXISTS "${valTable}"`);
    db.exec(`DROP TABLE IF EXISTS "${testTable}"`);

    let distribution: Record<string, Record<string, number>> | undefined;

    switch (config.strategy) {
      case 'random':
        randomSplit(db, sourceTable, trainTable, valTable, testTable, config.ratios, seed);
        break;

      case 'stratified':
        if (!config.stratifyColumn) {
          throw new Error('stratifyColumn is required for stratified split');
        }
        distribution = stratifiedSplit(
          db, sourceTable, trainTable, valTable, testTable,
          config.ratios, config.stratifyColumn, seed
        );
        break;

      case 'temporal':
        if (!config.timeColumn) {
          throw new Error('timeColumn is required for temporal split');
        }
        temporalSplit(db, sourceTable, trainTable, valTable, testTable, config.ratios, config.timeColumn);
        break;

      case 'group':
        if (!config.groupColumn) {
          throw new Error('groupColumn is required for group split');
        }
        groupSplit(db, sourceTable, trainTable, valTable, testTable, config.ratios, config.groupColumn, seed);
        break;

      case 'kfold': {
        const k = config.kFolds ?? 5;
        if (k < 2) throw new Error('kFolds must be at least 2');
        const foldResult = kfoldSplit(db, sourceTable, k, seed);
        return foldResult;
      }

      default:
        throw new Error(`Unsupported split strategy: ${config.strategy}`);
    }

    // Get final counts
    const trainCount = (db.prepare(`SELECT COUNT(*) AS c FROM "${trainTable}"`).get() as { c: number }).c;
    const valCount = (db.prepare(`SELECT COUNT(*) AS c FROM "${valTable}"`).get() as { c: number }).c;
    const testCount = (db.prepare(`SELECT COUNT(*) AS c FROM "${testTable}"`).get() as { c: number }).c;

    return {
      splits: {
        train: { rowCount: trainCount, table: trainTable },
        val: { rowCount: valCount, table: valTable },
        test: { rowCount: testCount, table: testTable },
      },
      metadata: {
        strategy: config.strategy,
        seed,
        ratios: config.ratios,
        distribution,
      },
    };
  } finally {
    db.close();
  }
}

function randomSplit(
  db: Database.Database,
  source: string,
  trainTable: string,
  valTable: string,
  testTable: string,
  ratios: { train: number; val: number; test: number },
  seed: number
): void {
  // Assign each row to a split using seeded random
  const rows = db.prepare(`SELECT rowid FROM "${source}"`).all() as Array<{ rowid: number }>;
  const rng = seededRandom(seed);

  const trainIds: number[] = [];
  const valIds: number[] = [];
  const testIds: number[] = [];

  for (const row of rows) {
    const r = rng();
    if (r < ratios.train) {
      trainIds.push(row.rowid);
    } else if (r < ratios.train + ratios.val) {
      valIds.push(row.rowid);
    } else {
      testIds.push(row.rowid);
    }
  }

  createSplitTable(db, source, trainTable, trainIds);
  createSplitTable(db, source, valTable, valIds);
  createSplitTable(db, source, testTable, testIds);
}

function stratifiedSplit(
  db: Database.Database,
  source: string,
  trainTable: string,
  valTable: string,
  testTable: string,
  ratios: { train: number; val: number; test: number },
  stratifyColumn: string,
  seed: number
): Record<string, Record<string, number>> {
  // Group rows by the stratify column
  const groups = db.prepare(
    `SELECT rowid, "${stratifyColumn}" AS label FROM "${source}" ORDER BY "${stratifyColumn}"`
  ).all() as Array<{ rowid: number; label: string }>;

  const byLabel = new Map<string, number[]>();
  for (const row of groups) {
    const label = String(row.label ?? 'NULL');
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label)!.push(row.rowid);
  }

  const trainIds: number[] = [];
  const valIds: number[] = [];
  const testIds: number[] = [];
  const distribution: Record<string, Record<string, number>> = {};

  const rng = seededRandom(seed);

  for (const [label, ids] of byLabel) {
    // Shuffle within each group
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    const trainEnd = Math.round(ids.length * ratios.train);
    const valEnd = trainEnd + Math.round(ids.length * ratios.val);

    const labelTrain = ids.slice(0, trainEnd);
    const labelVal = ids.slice(trainEnd, valEnd);
    const labelTest = ids.slice(valEnd);

    trainIds.push(...labelTrain);
    valIds.push(...labelVal);
    testIds.push(...labelTest);

    distribution[label] = {
      train: labelTrain.length,
      val: labelVal.length,
      test: labelTest.length,
    };
  }

  createSplitTable(db, source, trainTable, trainIds);
  createSplitTable(db, source, valTable, valIds);
  createSplitTable(db, source, testTable, testIds);

  return distribution;
}

function temporalSplit(
  db: Database.Database,
  source: string,
  trainTable: string,
  valTable: string,
  testTable: string,
  ratios: { train: number; val: number; test: number },
  timeColumn: string
): void {
  const totalRows = (db.prepare(`SELECT COUNT(*) AS c FROM "${source}"`).get() as { c: number }).c;
  const trainEnd = Math.round(totalRows * ratios.train);
  const valEnd = trainEnd + Math.round(totalRows * ratios.val);

  // Train: earliest rows
  db.exec(`CREATE TABLE "${trainTable}" AS SELECT * FROM "${source}" ORDER BY "${timeColumn}" LIMIT ${trainEnd}`);
  // Val: middle rows
  db.exec(`CREATE TABLE "${valTable}" AS SELECT * FROM "${source}" ORDER BY "${timeColumn}" LIMIT ${valEnd - trainEnd} OFFSET ${trainEnd}`);
  // Test: latest rows
  db.exec(`CREATE TABLE "${testTable}" AS SELECT * FROM "${source}" ORDER BY "${timeColumn}" LIMIT -1 OFFSET ${valEnd}`);
}

function groupSplit(
  db: Database.Database,
  source: string,
  trainTable: string,
  valTable: string,
  testTable: string,
  ratios: { train: number; val: number; test: number },
  groupColumn: string,
  seed: number
): void {
  // Get unique groups
  const groups = db.prepare(
    `SELECT DISTINCT "${groupColumn}" AS grp FROM "${source}"`
  ).all() as Array<{ grp: string }>;

  const rng = seededRandom(seed);

  // Shuffle groups
  const shuffled = groups.map((g) => g.grp);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const trainEnd = Math.round(shuffled.length * ratios.train);
  const valEnd = trainEnd + Math.round(shuffled.length * ratios.val);

  const trainGroups = shuffled.slice(0, trainEnd);
  const valGroups = shuffled.slice(trainEnd, valEnd);
  const testGroups = shuffled.slice(valEnd);

  const createFromGroups = (table: string, groupValues: string[]) => {
    if (groupValues.length === 0) {
      db.exec(`CREATE TABLE "${table}" AS SELECT * FROM "${source}" WHERE 0`);
      return;
    }
    const placeholders = groupValues.map(() => '?').join(', ');
    db.exec(`CREATE TABLE "${table}" AS SELECT * FROM "${source}" WHERE "${groupColumn}" IN (${placeholders})`);
    // Note: SQLite exec doesn't support params, so we use a prepared statement
    db.exec(`DROP TABLE IF EXISTS "${table}"`);
    const stmt = db.prepare(`CREATE TABLE "${table}" AS SELECT * FROM "${source}" WHERE "${groupColumn}" IN (${placeholders})`);
    // Since exec doesn't support params, use a workaround
    const inClause = groupValues.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(', ');
    db.exec(`CREATE TABLE "${table}" AS SELECT * FROM "${source}" WHERE "${groupColumn}" IN (${inClause})`);
  };

  createFromGroups(trainTable, trainGroups);
  createFromGroups(valTable, valGroups);
  createFromGroups(testTable, testGroups);
}

function kfoldSplit(
  db: Database.Database,
  sourceTable: string,
  k: number,
  seed: number
): SplitResult {
  const rows = db.prepare(`SELECT rowid FROM "${sourceTable}"`).all() as Array<{ rowid: number }>;
  const totalRows = rows.length;

  if (totalRows === 0) {
    throw new Error('Cannot split an empty table');
  }

  // Shuffle rows using seeded random
  const rng = seededRandom(seed);
  const indices = rows.map((r) => r.rowid);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Assign each row to a fold using round-robin on shuffled order
  const foldIds: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < indices.length; i++) {
    foldIds[i % k].push(indices[i]);
  }

  // Drop existing fold tables and create new ones
  const foldTables: string[] = [];
  for (let f = 0; f < k; f++) {
    const foldTable = `${sourceTable}_fold_${f + 1}`;
    foldTables.push(foldTable);
    db.exec(`DROP TABLE IF EXISTS "${foldTable}"`);
    createSplitTable(db, sourceTable, foldTable, foldIds[f]);
  }

  // Build dynamic splits record with fold keys
  const splits: Record<string, { rowCount: number; table: string }> = {};
  for (let f = 0; f < k; f++) {
    const foldTable = foldTables[f];
    const count = (db.prepare(`SELECT COUNT(*) AS c FROM "${foldTable}"`).get() as { c: number }).c;
    splits[`fold_${f + 1}`] = { rowCount: count, table: foldTable };
  }

  return {
    splits: splits as unknown as SplitResult['splits'],
    metadata: {
      strategy: 'kfold',
      seed,
      ratios: { train: 0, val: 0, test: 0 },
      distribution: undefined,
    },
  };
}

function createSplitTable(
  db: Database.Database,
  source: string,
  target: string,
  rowids: number[]
): void {
  if (rowids.length === 0) {
    db.exec(`CREATE TABLE "${target}" AS SELECT * FROM "${source}" WHERE 0`);
    return;
  }

  // Insert in batches to avoid SQL length limits
  db.exec(`CREATE TABLE "${target}" AS SELECT * FROM "${source}" WHERE 0`);

  const batchSize = 500;
  const insertBatch = db.transaction((ids: number[]) => {
    const placeholders = ids.map(() => '?').join(', ');
    db.prepare(
      `INSERT INTO "${target}" SELECT * FROM "${source}" WHERE rowid IN (${placeholders})`
    ).run(...ids);
  });

  for (let i = 0; i < rowids.length; i += batchSize) {
    insertBatch(rowids.slice(i, i + batchSize));
  }
}
