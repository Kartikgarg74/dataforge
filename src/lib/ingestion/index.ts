/**
 * Ingestion Module Index
 */

export type {
  SupportedFileFormat,
  IngestOptions,
  InferredColumn,
  InferredColumnType,
  ParseResult,
  IngestResult,
} from './types';

export {
  detectFileFormat,
  parseFile,
  generateTableName,
} from './file-parser';

export {
  inferColumnTypes,
  toSQLiteType,
  coerceValue,
} from './type-inference';

export { ingestIntoSQLite } from './ingest-sqlite';
