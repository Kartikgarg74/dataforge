/**
 * Ingestion Types
 *
 * Type definitions for file upload and data ingestion.
 */

export type SupportedFileFormat =
  | 'csv'
  | 'tsv'
  | 'json'
  | 'jsonl'
  | 'parquet'
  | 'sqlite'
  | 'excel';

export interface IngestOptions {
  /** Custom table name (auto-generated from filename if not provided) */
  tableName?: string;
  /** CSV/TSV delimiter override */
  delimiter?: string;
  /** Whether the file has a header row (default: true) */
  hasHeader?: boolean;
  /** File encoding (default: utf-8) */
  encoding?: BufferEncoding;
  /** Excel sheet name to parse (default: first sheet) */
  sheetName?: string;
  /** Maximum rows to ingest (default: unlimited) */
  maxRows?: number;
}

export interface InferredColumn {
  /** Column name */
  name: string;
  /** Inferred data type */
  type: InferredColumnType;
  /** Number of null/empty values in sample */
  nullCount: number;
  /** Number of unique values in sample */
  uniqueCount: number;
  /** Sample values for preview */
  sampleValues: unknown[];
}

export type InferredColumnType =
  | 'integer'
  | 'float'
  | 'string'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'json'
  | 'unknown';

export interface ParseResult {
  /** Parsed rows */
  rows: Record<string, unknown>[];
  /** Column information */
  columns: InferredColumn[];
  /** Total rows parsed */
  totalRows: number;
  /** Detected file format */
  format: SupportedFileFormat;
  /** Detected delimiter (for CSV/TSV) */
  delimiter?: string;
  /** Detected encoding */
  encoding?: string;
  /** Whether header was detected */
  hasHeader: boolean;
  /** Parse warnings (non-fatal issues) */
  warnings: string[];
}

export interface IngestResult {
  /** Name of the created table */
  tableName: string;
  /** Number of rows ingested */
  rowCount: number;
  /** Number of columns */
  columnCount: number;
  /** Column metadata */
  columns: InferredColumn[];
  /** File size in bytes */
  fileSizeBytes: number;
  /** Time taken to ingest in ms */
  ingestTimeMs: number;
  /** Any warnings during ingestion */
  warnings: string[];
}
