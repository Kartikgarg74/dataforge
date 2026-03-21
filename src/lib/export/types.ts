/**
 * Export Types
 */

export type ExportFormat = 'csv' | 'json' | 'jsonl' | 'parquet' | 'arrow' | 'sqlite';

export type CompressionType = 'none' | 'gzip' | 'snappy' | 'zstd';

export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Table to export */
  table: string;
  /** Subset of columns (default: all) */
  columns?: string[];
  /** Compression (for Parquet) */
  compression?: CompressionType;
  /** Include profiling + transform metadata */
  includeMetadata?: boolean;
  /** Maximum rows to export */
  maxRows?: number;
  /** Random sampling */
  sampling?: {
    enabled: boolean;
    size: number;
    seed: number;
  };
  /** Split configuration */
  splits?: {
    includeTrain: boolean;
    includeVal: boolean;
    includeTest: boolean;
    separateFiles: boolean;
  };
}

export interface ExportMetadata {
  /** Table name */
  table: string;
  /** Column types */
  columnTypes: Record<string, string>;
  /** Row count */
  rowCount: number;
  /** Export timestamp */
  exportedAt: string;
  /** Profile summary, if available */
  profileSummary?: Record<string, unknown>;
  /** Pipeline steps, if transforms were applied */
  pipelineSteps?: Array<Record<string, unknown>>;
  /** Split metadata, if the table has associated splits */
  splitMetadata?: {
    strategy: string;
    seed?: number;
    ratios: Record<string, number>;
  };
}

export interface ExportResult {
  /** File content as Buffer */
  buffer: Buffer;
  /** Suggested filename */
  filename: string;
  /** MIME type */
  contentType: string;
  /** Number of rows exported */
  rowCount: number;
  /** File size in bytes */
  fileSizeBytes: number;
  /** Optional metadata object when includeMetadata is true */
  metadata?: ExportMetadata;
  /** Optional metadata file buffer when includeMetadata is true */
  metadataFile?: Buffer;
}
