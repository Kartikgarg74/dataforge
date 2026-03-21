/**
 * Column Statistics Calculator
 *
 * Computes per-column statistics using SQL aggregates for performance.
 * Works with any SQLite database (working db or connected db).
 */

import Database from 'better-sqlite3';
import type {
  ColumnProfile,
  NumericStats,
  StringStats,
  DateStats,
  BooleanStats,
  HistogramBucket,
  OutlierInfo,
} from './types';

const HISTOGRAM_BUCKETS = 20;
const TOP_FREQUENT_COUNT = 10;

/** Pattern regexes for string columns */
const PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'email', regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ },
  { name: 'url', regex: /^https?:\/\/[^\s]+$/ },
  { name: 'uuid', regex: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i },
  { name: 'phone', regex: /^[+]?[\d\s()-]{7,20}$/ },
  { name: 'ip_address', regex: /^(\d{1,3}\.){3}\d{1,3}$/ },
];

/**
 * Detect a pattern in sample string values.
 */
function detectPattern(values: string[]): string | undefined {
  if (values.length === 0) return undefined;

  for (const { name, regex } of PATTERNS) {
    const matchCount = values.filter((v) => regex.test(v)).length;
    if (matchCount / values.length >= 0.8) {
      return name;
    }
  }
  return undefined;
}

/**
 * Profile a single column.
 */
export function profileColumn(
  db: Database.Database,
  table: string,
  columnName: string,
  columnType: string,
  totalRows: number
): ColumnProfile {
  const col = `"${columnName}"`;
  const tbl = `"${table}"`;

  // Basic counts
  const basicStats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COUNT(${col}) AS non_null,
      COUNT(DISTINCT ${col}) AS distinct_count
    FROM ${tbl}
  `).get() as { total: number; non_null: number; distinct_count: number };

  const nullCount = totalRows - basicStats.non_null;
  const nullPercent = totalRows > 0 ? (nullCount / totalRows) * 100 : 0;
  const uniqueCount = basicStats.distinct_count;
  const uniquePercent = totalRows > 0 ? (uniqueCount / totalRows) * 100 : 0;

  // Most frequent values
  const freqRows = db.prepare(`
    SELECT CAST(${col} AS TEXT) AS value, COUNT(*) AS count
    FROM ${tbl}
    WHERE ${col} IS NOT NULL
    GROUP BY ${col}
    ORDER BY count DESC
    LIMIT ${TOP_FREQUENT_COUNT}
  `).all() as Array<{ value: string; count: number }>;

  const mostFrequent = freqRows.map((r) => ({
    value: r.value,
    count: r.count,
    percent: totalRows > 0 ? (r.count / totalRows) * 100 : 0,
  }));

  const profile: ColumnProfile = {
    name: columnName,
    type: columnType,
    totalCount: totalRows,
    nullCount,
    nullPercent: Math.round(nullPercent * 100) / 100,
    uniqueCount,
    uniquePercent: Math.round(uniquePercent * 100) / 100,
    mostFrequent,
  };

  // Type-specific stats
  const normalizedType = columnType.toLowerCase();
  const isNumeric =
    normalizedType.includes('int') ||
    normalizedType.includes('real') ||
    normalizedType.includes('float') ||
    normalizedType.includes('double') ||
    normalizedType.includes('numeric') ||
    normalizedType.includes('decimal') ||
    normalizedType === 'integer' ||
    normalizedType === 'float';

  if (isNumeric) {
    profile.numericStats = computeNumericStats(db, table, columnName, totalRows);
    profile.histogram = computeHistogram(db, table, columnName, totalRows);
    profile.outliers = computeOutliers(db, table, columnName);
  } else if (normalizedType.includes('date') || normalizedType.includes('time')) {
    profile.dateStats = computeDateStats(db, table, columnName);
  } else if (normalizedType.includes('bool')) {
    profile.booleanStats = computeBooleanStats(db, table, columnName, totalRows);
  } else {
    // String type
    profile.stringStats = computeStringStats(db, table, columnName);
    // Sample values for pattern detection
    const sampleValues = db.prepare(`
      SELECT CAST(${col} AS TEXT) AS value
      FROM ${tbl}
      WHERE ${col} IS NOT NULL AND ${col} != ''
      LIMIT 100
    `).all() as Array<{ value: string }>;
    profile.detectedPattern = detectPattern(sampleValues.map((r) => r.value));
  }

  return profile;
}

function computeNumericStats(
  db: Database.Database,
  table: string,
  column: string,
  totalRows: number
): NumericStats {
  const col = `"${column}"`;
  const tbl = `"${table}"`;

  const stats = db.prepare(`
    SELECT
      MIN(CAST(${col} AS REAL)) AS min_val,
      MAX(CAST(${col} AS REAL)) AS max_val,
      AVG(CAST(${col} AS REAL)) AS mean_val,
      SUM(CAST(${col} AS REAL)) AS sum_val,
      COUNT(CASE WHEN CAST(${col} AS REAL) = 0 THEN 1 END) AS zeros,
      COUNT(CASE WHEN CAST(${col} AS REAL) < 0 THEN 1 END) AS negatives
    FROM ${tbl}
    WHERE ${col} IS NOT NULL
  `).get() as Record<string, number>;

  // Compute median and percentiles using NTILE approach
  const sortedValues = db.prepare(`
    SELECT CAST(${col} AS REAL) AS v
    FROM ${tbl}
    WHERE ${col} IS NOT NULL
    ORDER BY CAST(${col} AS REAL)
  `).all() as Array<{ v: number }>;

  const values = sortedValues.map((r) => r.v);
  const n = values.length;

  const percentile = (arr: number[], p: number): number => {
    if (arr.length === 0) return 0;
    const idx = (p / 100) * (arr.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return arr[lower];
    return arr[lower] + (arr[upper] - arr[lower]) * (idx - lower);
  };

  // Standard deviation
  const mean = stats.mean_val || 0;
  const variance =
    n > 1
      ? values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1)
      : 0;
  const stdDev = Math.sqrt(variance);

  return {
    min: stats.min_val ?? 0,
    max: stats.max_val ?? 0,
    mean: Math.round(mean * 1000) / 1000,
    median: percentile(values, 50),
    stdDev: Math.round(stdDev * 1000) / 1000,
    percentiles: {
      p25: percentile(values, 25),
      p50: percentile(values, 50),
      p75: percentile(values, 75),
      p95: percentile(values, 95),
      p99: percentile(values, 99),
    },
    sum: stats.sum_val ?? 0,
    zeros: stats.zeros ?? 0,
    negatives: stats.negatives ?? 0,
  };
}

function computeHistogram(
  db: Database.Database,
  table: string,
  column: string,
  totalRows: number
): HistogramBucket[] {
  const col = `"${column}"`;
  const tbl = `"${table}"`;

  const rangeResult = db.prepare(`
    SELECT
      MIN(CAST(${col} AS REAL)) AS min_val,
      MAX(CAST(${col} AS REAL)) AS max_val
    FROM ${tbl}
    WHERE ${col} IS NOT NULL
  `).get() as { min_val: number; max_val: number };

  if (rangeResult.min_val === null || rangeResult.max_val === null) {
    return [];
  }

  const min = rangeResult.min_val;
  const max = rangeResult.max_val;

  if (min === max) {
    return [{
      label: String(min),
      from: min,
      to: max,
      count: totalRows,
      percent: 100,
    }];
  }

  const bucketWidth = (max - min) / HISTOGRAM_BUCKETS;
  const buckets: HistogramBucket[] = [];

  for (let i = 0; i < HISTOGRAM_BUCKETS; i++) {
    const from = min + i * bucketWidth;
    const to = min + (i + 1) * bucketWidth;
    const isLast = i === HISTOGRAM_BUCKETS - 1;

    const countResult = db.prepare(`
      SELECT COUNT(*) AS count
      FROM ${tbl}
      WHERE CAST(${col} AS REAL) >= ? AND CAST(${col} AS REAL) ${isLast ? '<=' : '<'} ?
    `).get(from, to) as { count: number };

    buckets.push({
      label: `${Math.round(from * 100) / 100} - ${Math.round(to * 100) / 100}`,
      from,
      to,
      count: countResult.count,
      percent: totalRows > 0 ? Math.round((countResult.count / totalRows) * 10000) / 100 : 0,
    });
  }

  return buckets;
}

function computeOutliers(
  db: Database.Database,
  table: string,
  column: string
): OutlierInfo {
  const col = `"${column}"`;
  const tbl = `"${table}"`;

  // Get Q1 and Q3 for IQR method
  const sorted = db.prepare(`
    SELECT CAST(${col} AS REAL) AS v
    FROM ${tbl}
    WHERE ${col} IS NOT NULL
    ORDER BY CAST(${col} AS REAL)
  `).all() as Array<{ v: number }>;

  const values = sorted.map((r) => r.v);
  const n = values.length;

  if (n < 4) {
    return { method: 'iqr', lowerBound: 0, upperBound: 0, outlierCount: 0, outlierPercent: 0 };
  }

  const q1 = values[Math.floor(n * 0.25)];
  const q3 = values[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outlierCount = values.filter((v) => v < lowerBound || v > upperBound).length;

  return {
    method: 'iqr',
    lowerBound: Math.round(lowerBound * 1000) / 1000,
    upperBound: Math.round(upperBound * 1000) / 1000,
    outlierCount,
    outlierPercent: n > 0 ? Math.round((outlierCount / n) * 10000) / 100 : 0,
  };
}

function computeStringStats(
  db: Database.Database,
  table: string,
  column: string
): StringStats {
  const col = `"${column}"`;
  const tbl = `"${table}"`;

  const stats = db.prepare(`
    SELECT
      MIN(LENGTH(${col})) AS min_len,
      MAX(LENGTH(${col})) AS max_len,
      AVG(LENGTH(${col})) AS avg_len,
      COUNT(CASE WHEN ${col} = '' THEN 1 END) AS empty_count
    FROM ${tbl}
    WHERE ${col} IS NOT NULL
  `).get() as Record<string, number>;

  return {
    minLength: stats.min_len ?? 0,
    maxLength: stats.max_len ?? 0,
    avgLength: Math.round((stats.avg_len ?? 0) * 10) / 10,
    emptyCount: stats.empty_count ?? 0,
  };
}

function computeDateStats(
  db: Database.Database,
  table: string,
  column: string
): DateStats {
  const col = `"${column}"`;
  const tbl = `"${table}"`;

  const stats = db.prepare(`
    SELECT
      MIN(${col}) AS earliest,
      MAX(${col}) AS latest
    FROM ${tbl}
    WHERE ${col} IS NOT NULL
  `).get() as { earliest: string; latest: string };

  const earliest = stats.earliest || 'N/A';
  const latest = stats.latest || 'N/A';

  // Compute range in days
  let range = 'N/A';
  try {
    const d1 = new Date(earliest);
    const d2 = new Date(latest);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      range = `${diffDays} days`;
    }
  } catch {
    // Ignore date parsing errors
  }

  return { earliest, latest, range };
}

function computeBooleanStats(
  db: Database.Database,
  table: string,
  column: string,
  totalRows: number
): BooleanStats {
  const col = `"${column}"`;
  const tbl = `"${table}"`;

  const stats = db.prepare(`
    SELECT
      COUNT(CASE WHEN ${col} = 1 OR LOWER(CAST(${col} AS TEXT)) IN ('true', 'yes', 'y', 't') THEN 1 END) AS true_count,
      COUNT(CASE WHEN ${col} = 0 OR LOWER(CAST(${col} AS TEXT)) IN ('false', 'no', 'n', 'f') THEN 1 END) AS false_count
    FROM ${tbl}
    WHERE ${col} IS NOT NULL
  `).get() as { true_count: number; false_count: number };

  return {
    trueCount: stats.true_count,
    falseCount: stats.false_count,
    truePercent:
      totalRows > 0
        ? Math.round((stats.true_count / totalRows) * 10000) / 100
        : 0,
  };
}
