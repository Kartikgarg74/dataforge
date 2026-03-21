/**
 * File Parser
 *
 * Detects file format and parses various data file types into uniform row arrays.
 * Supports CSV, TSV, JSON, JSONL. Parquet and Excel require additional dependencies.
 */

import type { SupportedFileFormat, ParseResult, IngestOptions } from './types';
import { inferColumnTypes } from './type-inference';

/**
 * Detect file format from filename extension and/or content.
 */
export function detectFileFormat(
  filename: string,
  contentHead?: string
): SupportedFileFormat {
  const ext = filename.toLowerCase().split('.').pop();

  switch (ext) {
    case 'csv':
      return 'csv';
    case 'tsv':
    case 'tab':
      return 'tsv';
    case 'json':
      // Check if it's JSONL (each line is valid JSON)
      if (contentHead) {
        const lines = contentHead.split('\n').filter((l) => l.trim());
        if (lines.length > 1) {
          try {
            JSON.parse(lines[0]);
            JSON.parse(lines[1]);
            // If each line parses independently, it's JSONL
            return 'jsonl';
          } catch {
            // Not JSONL, regular JSON
          }
        }
      }
      return 'json';
    case 'jsonl':
    case 'ndjson':
      return 'jsonl';
    case 'parquet':
      return 'parquet';
    case 'db':
    case 'sqlite':
    case 'sqlite3':
      return 'sqlite';
    case 'xlsx':
    case 'xls':
      return 'excel';
    default:
      // Try to detect from content
      if (contentHead) {
        const trimmed = contentHead.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
        // Default to CSV for unknown text files
        return 'csv';
      }
      return 'csv';
  }
}

/**
 * Detect CSV delimiter from content.
 */
function detectDelimiter(content: string): string {
  const firstLines = content.split('\n').slice(0, 5).join('\n');
  const delimiters = [',', '\t', ';', '|'];
  let bestDelimiter = ',';
  let bestConsistency = 0;

  for (const d of delimiters) {
    const counts = firstLines
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        // Count delimiters outside of quotes
        let count = 0;
        let inQuote = false;
        for (const ch of line) {
          if (ch === '"') inQuote = !inQuote;
          else if (ch === d && !inQuote) count++;
        }
        return count;
      });

    if (counts.length < 2) continue;
    // Check if all lines have the same count (consistency)
    const allSame = counts.every((c) => c === counts[0] && c > 0);
    if (allSame && counts[0] > bestConsistency) {
      bestConsistency = counts[0];
      bestDelimiter = d;
    }
  }

  return bestDelimiter;
}

/**
 * Parse CSV/TSV content into rows.
 */
function parseCSV(
  content: string,
  options: IngestOptions
): { rows: Record<string, unknown>[]; columns: string[]; delimiter: string } {
  const delimiter = options.delimiter || detectDelimiter(content);
  const lines = content.split('\n').filter((l) => l.trim());

  if (lines.length === 0) {
    return { rows: [], columns: [], delimiter };
  }

  // Parse a CSV line respecting quoted fields
  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === delimiter && !inQuote) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const hasHeader = options.hasHeader !== false; // Default: true
  let columns: string[];
  let dataStartIndex: number;

  if (hasHeader) {
    columns = parseLine(lines[0]).map((col, i) =>
      col || `column_${i + 1}`
    );
    dataStartIndex = 1;
  } else {
    // Auto-generate column names
    const firstRow = parseLine(lines[0]);
    columns = firstRow.map((_, i) => `column_${i + 1}`);
    dataStartIndex = 0;
  }

  // Sanitize column names (remove special chars, ensure uniqueness)
  const seenNames = new Set<string>();
  columns = columns.map((name) => {
    let sanitized = name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
    if (!sanitized || /^\d/.test(sanitized)) {
      sanitized = `col_${sanitized}`;
    }
    // Ensure uniqueness
    let finalName = sanitized;
    let counter = 1;
    while (seenNames.has(finalName)) {
      finalName = `${sanitized}_${counter}`;
      counter++;
    }
    seenNames.add(finalName);
    return finalName;
  });

  const maxRows = options.maxRows || Infinity;
  const rows: Record<string, unknown>[] = [];

  for (let i = dataStartIndex; i < lines.length && rows.length < maxRows; i++) {
    const values = parseLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;

    const row: Record<string, unknown> = {};
    for (let j = 0; j < columns.length; j++) {
      row[columns[j]] = values[j] ?? null;
    }
    rows.push(row);
  }

  return { rows, columns, delimiter };
}

/**
 * Parse JSON content (array of objects).
 */
function parseJSON(content: string, options: IngestOptions): Record<string, unknown>[] {
  const parsed = JSON.parse(content);

  if (Array.isArray(parsed)) {
    return options.maxRows ? parsed.slice(0, options.maxRows) : parsed;
  }

  // If it's a single object, wrap in array
  if (typeof parsed === 'object' && parsed !== null) {
    // Check for common patterns: { data: [...] }, { results: [...] }, { rows: [...] }
    for (const key of ['data', 'results', 'rows', 'records', 'items']) {
      if (Array.isArray(parsed[key])) {
        const arr = parsed[key] as Record<string, unknown>[];
        return options.maxRows ? arr.slice(0, options.maxRows) : arr;
      }
    }
    return [parsed];
  }

  throw new Error('JSON content must be an array of objects or an object with a data array');
}

/**
 * Parse JSONL (newline-delimited JSON) content.
 */
function parseJSONL(content: string, options: IngestOptions): Record<string, unknown>[] {
  const lines = content.split('\n').filter((l) => l.trim());
  const maxRows = options.maxRows || Infinity;
  const rows: Record<string, unknown>[] = [];

  for (const line of lines) {
    if (rows.length >= maxRows) break;
    try {
      const obj = JSON.parse(line);
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        rows.push(obj);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return rows;
}

/**
 * Flatten nested JSON objects into dot-notation keys.
 * e.g., { user: { name: "John" } } → { "user.name": "John" }
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}_${key}` : key;

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      // Store arrays as JSON strings
      result[fullKey] = JSON.stringify(value);
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}

/**
 * Parse a file buffer into rows based on detected format.
 */
export function parseFile(
  content: string | Buffer,
  filename: string,
  options: IngestOptions = {}
): ParseResult {
  const textContent = typeof content === 'string' ? content : content.toString(options.encoding || 'utf-8');
  const format = detectFileFormat(filename, textContent.substring(0, 2000));
  const warnings: string[] = [];

  let rows: Record<string, unknown>[];
  let detectedDelimiter: string | undefined;
  let hasHeader = options.hasHeader !== false;

  switch (format) {
    case 'csv':
    case 'tsv': {
      const csvResult = parseCSV(textContent, {
        ...options,
        delimiter: format === 'tsv' ? '\t' : options.delimiter,
      });
      rows = csvResult.rows;
      detectedDelimiter = csvResult.delimiter;
      break;
    }
    case 'json': {
      rows = parseJSON(textContent, options);
      // Flatten nested objects
      rows = rows.map((row) => flattenObject(row));
      hasHeader = true; // JSON always has "headers" (keys)
      break;
    }
    case 'jsonl': {
      rows = parseJSONL(textContent, options);
      rows = rows.map((row) => flattenObject(row));
      hasHeader = true;
      break;
    }
    case 'parquet': {
      throw new Error('Parquet parsing requires parquetjs-lite. Install it with: npm install parquetjs-lite');
    }
    case 'excel': {
      throw new Error('Excel parsing requires xlsx. Install it with: npm install xlsx');
    }
    case 'sqlite': {
      throw new Error('SQLite files should be mounted directly, not parsed.');
    }
    default:
      throw new Error(`Unsupported file format: ${format}`);
  }

  if (rows.length === 0) {
    return {
      rows: [],
      columns: [],
      totalRows: 0,
      format,
      delimiter: detectedDelimiter,
      hasHeader,
      warnings: ['File contains no data rows'],
    };
  }

  // Get all unique column names across all rows
  const columnNameSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columnNameSet.add(key);
    }
  }
  const columnNames = [...columnNameSet];

  // Ensure every row has all columns (fill missing with null)
  for (const row of rows) {
    for (const col of columnNames) {
      if (!(col in row)) {
        row[col] = null;
      }
    }
  }

  // Infer column types
  const columns = inferColumnTypes(rows, columnNames);

  // Check for potential issues
  const nullHeavyCols = columns.filter(
    (c) => c.nullCount / rows.length > 0.5
  );
  if (nullHeavyCols.length > 0) {
    warnings.push(
      `Columns with >50% null values: ${nullHeavyCols.map((c) => c.name).join(', ')}`
    );
  }

  return {
    rows,
    columns,
    totalRows: rows.length,
    format,
    delimiter: detectedDelimiter,
    hasHeader,
    warnings,
  };
}

/**
 * Generate a safe table name from a filename.
 */
export function generateTableName(filename: string, existingTables: string[] = []): string {
  // Remove extension and sanitize
  const baseName = filename
    .replace(/\.[^.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9_]/g, '_') // Replace special chars
    .replace(/^_+|_+$/g, '') // Trim underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .toLowerCase();

  const safeName = baseName || 'imported_data';

  // Check for duplicates and version
  if (!existingTables.includes(safeName)) {
    return safeName;
  }

  let version = 1;
  while (existingTables.includes(`${safeName}_v${version}`)) {
    version++;
  }
  return `${safeName}_v${version}`;
}
