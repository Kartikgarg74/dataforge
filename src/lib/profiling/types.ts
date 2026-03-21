/**
 * Profiling Types
 *
 * Type definitions for the data profiling engine.
 */

export interface ColumnProfile {
  /** Column name */
  name: string;
  /** Inferred column type */
  type: string;
  /** Total number of values */
  totalCount: number;
  /** Number of null/missing values */
  nullCount: number;
  /** Percentage of null values */
  nullPercent: number;
  /** Number of unique values */
  uniqueCount: number;
  /** Percentage of unique values */
  uniquePercent: number;
  /** Top 10 most frequent values */
  mostFrequent: Array<{ value: string; count: number; percent: number }>;
  /** Numeric stats (only for numeric columns) */
  numericStats?: NumericStats;
  /** String stats (only for string columns) */
  stringStats?: StringStats;
  /** Date stats (only for date/datetime columns) */
  dateStats?: DateStats;
  /** Boolean stats (only for boolean columns) */
  booleanStats?: BooleanStats;
  /** Histogram buckets (numeric/date columns) */
  histogram?: HistogramBucket[];
  /** Detected pattern (email, phone, URL, UUID) */
  detectedPattern?: string;
  /** Outlier info */
  outliers?: OutlierInfo;
}

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p95: number;
    p99: number;
  };
  sum: number;
  zeros: number;
  negatives: number;
}

export interface StringStats {
  minLength: number;
  maxLength: number;
  avgLength: number;
  emptyCount: number;
}

export interface DateStats {
  earliest: string;
  latest: string;
  range: string;
}

export interface BooleanStats {
  trueCount: number;
  falseCount: number;
  truePercent: number;
}

export interface HistogramBucket {
  label: string;
  from: number;
  to: number;
  count: number;
  percent: number;
}

export interface OutlierInfo {
  method: 'iqr';
  lowerBound: number;
  upperBound: number;
  outlierCount: number;
  outlierPercent: number;
}

export interface QualityAlert {
  severity: 'info' | 'warning' | 'error';
  column?: string;
  message: string;
  suggestion?: string;
}

export interface DatasetProfile {
  /** Table name */
  table: string;
  /** Total number of rows */
  rowCount: number;
  /** Total number of columns */
  columnCount: number;
  /** Number of duplicate rows */
  duplicateCount: number;
  /** Overall data completeness (1 - null%) */
  completeness: number;
  /** Estimated memory size in bytes */
  memorySizeBytes: number;
  /** Per-column profiles */
  columns: ColumnProfile[];
  /** Correlation matrix (numeric columns only) */
  correlations?: CorrelationEntry[];
  /** Data quality alerts */
  alerts: QualityAlert[];
  /** Whether the profile used sampling */
  sampled: boolean;
  /** If sampled, the original row count */
  sampledFrom?: number;
  /** When this profile was generated */
  profiledAt: string;
  /** Time to generate profile in ms */
  profileTimeMs: number;
}

export interface CorrelationEntry {
  column1: string;
  column2: string;
  correlation: number;
}
