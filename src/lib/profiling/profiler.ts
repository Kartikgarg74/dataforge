/**
 * Data Profiler
 *
 * Generates comprehensive profiles for datasets in the working database.
 * Computes per-column statistics, quality alerts, and correlation matrix.
 */

import Database from 'better-sqlite3';
import path from 'path';
import type {
  DatasetProfile,
  QualityAlert,
  CorrelationEntry,
  ColumnProfile,
} from './types';
import { profileColumn } from './column-stats';

const WORKING_DB_PATH = path.join(process.cwd(), 'data', 'working.db');
const SAMPLE_THRESHOLD = 100_000;
const SAMPLE_SIZE = 50_000;
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ProfileCacheEntry {
  profile: DatasetProfile;
  rowCount: number;
  timestamp: number;
}

const profileCache = new Map<string, ProfileCacheEntry>();

/**
 * Clear the profile cache, optionally for a specific table only.
 */
export function clearProfileCache(table?: string): void {
  if (table) {
    profileCache.delete(table);
  } else {
    profileCache.clear();
  }
}

/**
 * Profile a dataset in the working database.
 */
export function profileDataset(
  table: string,
  options?: {
    columns?: string[];
    sampleSize?: number;
  }
): DatasetProfile {
  const start = Date.now();
  const db = new Database(WORKING_DB_PATH, { readonly: true });

  try {
    // Validate table exists
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
      throw new Error('Invalid table name');
    }

    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(table);
    if (!tableExists) {
      throw new Error(`Table '${table}' not found`);
    }

    // Get total row count
    const countResult = db
      .prepare(`SELECT COUNT(*) AS count FROM "${table}"`)
      .get() as { count: number };
    const totalRows = countResult.count;

    // Check profile cache
    const cached = profileCache.get(table);
    if (
      cached &&
      cached.rowCount === totalRows &&
      Date.now() - cached.timestamp < PROFILE_CACHE_TTL_MS
    ) {
      return cached.profile;
    }

    // Determine if we need to sample
    const sampleThreshold = options?.sampleSize || SAMPLE_THRESHOLD;
    const needsSampling = totalRows > sampleThreshold;
    let workingTable = table;

    if (needsSampling) {
      // Create a temporary sampled table
      const sampleSize = options?.sampleSize || SAMPLE_SIZE;
      workingTable = `_profile_sample_${table}`;

      // Re-open as writable for temp table
      db.close();
      const writableDb = new Database(WORKING_DB_PATH);

      try {
        writableDb.exec(`DROP TABLE IF EXISTS "${workingTable}"`);
        writableDb.exec(`
          CREATE TEMP TABLE "${workingTable}" AS
          SELECT * FROM "${table}"
          ORDER BY RANDOM()
          LIMIT ${sampleSize}
        `);
      } finally {
        writableDb.close();
      }

      // Re-open as readonly
      const readDb = new Database(WORKING_DB_PATH, { readonly: true });
      const sampledResult = profileWithDb(readDb, table, workingTable, totalRows, needsSampling, totalRows, options, start);
      profileCache.set(table, { profile: sampledResult, rowCount: totalRows, timestamp: Date.now() });
      return sampledResult;
    }

    const result = profileWithDb(db, table, workingTable, totalRows, needsSampling, undefined, options, start);
    profileCache.set(table, { profile: result, rowCount: totalRows, timestamp: Date.now() });
    return result;
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

function profileWithDb(
  db: Database.Database,
  originalTable: string,
  workingTable: string,
  totalRows: number,
  sampled: boolean,
  sampledFrom: number | undefined,
  options: { columns?: string[] } | undefined,
  startTime: number
): DatasetProfile {
  // Get column info
  const columnInfo = db
    .prepare(`PRAGMA table_info("${workingTable}")`)
    .all() as Array<{ name: string; type: string }>;

  // Filter columns if specified
  const targetColumns = options?.columns
    ? columnInfo.filter((c) => options.columns!.includes(c.name))
    : columnInfo;

  // Profile each column
  const profiles: ColumnProfile[] = [];
  for (const col of targetColumns) {
    const profile = profileColumn(db, workingTable, col.name, col.type || 'TEXT', totalRows);
    profiles.push(profile);
  }

  // Count duplicate rows
  const allCols = targetColumns.map((c) => `"${c.name}"`).join(', ');
  let duplicateCount = 0;
  try {
    const dupResult = db.prepare(`
      SELECT COUNT(*) AS count FROM (
        SELECT ${allCols}, COUNT(*) AS cnt
        FROM "${workingTable}"
        GROUP BY ${allCols}
        HAVING cnt > 1
      )
    `).get() as { count: number };
    duplicateCount = dupResult?.count || 0;
  } catch {
    // Skip duplicate detection if it fails
  }

  // Overall completeness
  const totalCells = totalRows * targetColumns.length;
  const totalNulls = profiles.reduce((sum, p) => sum + p.nullCount, 0);
  const completeness = totalCells > 0 ? Math.round(((totalCells - totalNulls) / totalCells) * 10000) / 100 : 100;

  // Estimate memory size
  const memorySizeBytes = totalRows * targetColumns.length * 32; // rough estimate

  // Compute correlations for numeric columns
  const numericProfiles = profiles.filter(
    (p) =>
      p.numericStats !== undefined ||
      p.type.toLowerCase().includes('int') ||
      p.type.toLowerCase().includes('real') ||
      p.type.toLowerCase().includes('float')
  );
  let correlations: CorrelationEntry[] | undefined;
  if (numericProfiles.length >= 2 && numericProfiles.length <= 30) {
    correlations = computeCorrelations(db, workingTable, numericProfiles);
  }

  // Generate quality alerts
  const alerts = generateAlerts(profiles, totalRows, duplicateCount);

  const profileTimeMs = Date.now() - startTime;

  return {
    table: originalTable,
    rowCount: totalRows,
    columnCount: targetColumns.length,
    duplicateCount,
    completeness,
    memorySizeBytes,
    columns: profiles,
    correlations,
    alerts,
    sampled,
    sampledFrom: sampled ? sampledFrom : undefined,
    profiledAt: new Date().toISOString(),
    profileTimeMs,
  };
}

/**
 * Compute Pearson correlation between numeric columns.
 */
function computeCorrelations(
  db: Database.Database,
  table: string,
  numericProfiles: ColumnProfile[]
): CorrelationEntry[] {
  const correlations: CorrelationEntry[] = [];

  for (let i = 0; i < numericProfiles.length; i++) {
    for (let j = i + 1; j < numericProfiles.length; j++) {
      const col1 = `"${numericProfiles[i].name}"`;
      const col2 = `"${numericProfiles[j].name}"`;

      try {
        // Pearson correlation using SQL
        const result = db.prepare(`
          SELECT
            (COUNT(*) * SUM(CAST(${col1} AS REAL) * CAST(${col2} AS REAL)) -
             SUM(CAST(${col1} AS REAL)) * SUM(CAST(${col2} AS REAL))) /
            NULLIF(
              SQRT(
                (COUNT(*) * SUM(CAST(${col1} AS REAL) * CAST(${col1} AS REAL)) -
                 SUM(CAST(${col1} AS REAL)) * SUM(CAST(${col1} AS REAL))) *
                (COUNT(*) * SUM(CAST(${col2} AS REAL) * CAST(${col2} AS REAL)) -
                 SUM(CAST(${col2} AS REAL)) * SUM(CAST(${col2} AS REAL)))
              ), 0
            ) AS correlation
          FROM "${table}"
          WHERE ${col1} IS NOT NULL AND ${col2} IS NOT NULL
        `).get() as { correlation: number | null };

        const corr = result?.correlation;
        if (corr !== null && corr !== undefined && Number.isFinite(corr)) {
          correlations.push({
            column1: numericProfiles[i].name,
            column2: numericProfiles[j].name,
            correlation: Math.round(corr * 1000) / 1000,
          });
        }
      } catch {
        // Skip this pair if computation fails
      }
    }
  }

  return correlations;
}

/**
 * Generate data quality alerts from profile results.
 */
function generateAlerts(
  profiles: ColumnProfile[],
  totalRows: number,
  duplicateCount: number
): QualityAlert[] {
  const alerts: QualityAlert[] = [];

  // Check for duplicate rows
  if (duplicateCount > 0) {
    alerts.push({
      severity: 'warning',
      message: `${duplicateCount} duplicate row groups detected`,
      suggestion: 'Consider removing duplicates with a dedup transform',
    });
  }

  for (const profile of profiles) {
    // High null percentage
    if (profile.nullPercent > 50) {
      alerts.push({
        severity: 'warning',
        column: profile.name,
        message: `'${profile.name}' has ${profile.nullPercent}% null values`,
        suggestion: 'Fill with mean/median, or drop this column if not useful',
      });
    } else if (profile.nullPercent > 20) {
      alerts.push({
        severity: 'info',
        column: profile.name,
        message: `'${profile.name}' has ${profile.nullPercent}% null values`,
        suggestion: 'Consider filling nulls before training',
      });
    }

    // Single value column (zero variance)
    if (profile.uniqueCount === 1 && totalRows > 1) {
      alerts.push({
        severity: 'warning',
        column: profile.name,
        message: `'${profile.name}' has only one unique value — zero variance`,
        suggestion: 'Drop this column, it provides no information',
      });
    }

    // Candidate primary key
    if (profile.uniqueCount === totalRows && totalRows > 0 && profile.nullCount === 0) {
      alerts.push({
        severity: 'info',
        column: profile.name,
        message: `'${profile.name}' is unique for all rows — candidate primary key`,
      });
    }

    // Outliers
    if (profile.outliers && profile.outliers.outlierPercent > 1) {
      alerts.push({
        severity: 'info',
        column: profile.name,
        message: `'${profile.name}' has ${profile.outliers.outlierCount} outliers (${profile.outliers.outlierPercent}%)`,
        suggestion: 'Consider clipping outliers or investigating their cause',
      });
    }

    // High cardinality string columns (potential ID or unique field)
    if (
      profile.type.toLowerCase().includes('text') &&
      profile.uniquePercent > 95 &&
      totalRows > 100
    ) {
      alerts.push({
        severity: 'info',
        column: profile.name,
        message: `'${profile.name}' has ${profile.uniquePercent}% unique values — might be an ID column`,
        suggestion: 'Consider dropping if not needed for training',
      });
    }

    // PII detection
    if (profile.detectedPattern === 'email') {
      alerts.push({
        severity: 'warning',
        column: profile.name,
        message: `'${profile.name}' appears to contain email addresses (PII)`,
        suggestion: 'Consider removing before exporting for ML training',
      });
    }
    if (profile.detectedPattern === 'phone') {
      alerts.push({
        severity: 'warning',
        column: profile.name,
        message: `'${profile.name}' appears to contain phone numbers (PII)`,
        suggestion: 'Consider removing before exporting for ML training',
      });
    }
  }

  return alerts;
}
