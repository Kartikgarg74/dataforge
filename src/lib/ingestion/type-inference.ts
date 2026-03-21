/**
 * Column Type Inference Engine
 *
 * Analyzes column values to infer the most appropriate data type.
 * Uses sampling and heuristics for >90% accuracy.
 */

import type { InferredColumnType, InferredColumn } from './types';

/** Sample size for type inference */
const SAMPLE_SIZE = 500;

/** ISO date patterns */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const US_DATE_REGEX = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

/** Boolean-like values */
const TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'on', 't']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'n', 'off', 'f']);

/**
 * Infer the type of a single value.
 */
function inferValueType(value: unknown): InferredColumnType {
  if (value === null || value === undefined || value === '') {
    return 'unknown'; // Can't infer from null
  }

  // Already typed (from JSON)
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'float';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'object') {
    return 'json';
  }

  const str = String(value).trim();
  if (str === '') return 'unknown';

  // Boolean check
  if (TRUE_VALUES.has(str.toLowerCase()) || FALSE_VALUES.has(str.toLowerCase())) {
    return 'boolean';
  }

  // Integer check (no decimal point)
  if (/^-?\d{1,18}$/.test(str)) {
    const num = Number(str);
    if (Number.isSafeInteger(num)) {
      return 'integer';
    }
  }

  // Float check
  if (/^-?\d+\.\d+$/.test(str) || /^-?\d+\.?\d*[eE][+-]?\d+$/.test(str)) {
    const num = Number(str);
    if (Number.isFinite(num)) {
      return 'float';
    }
  }

  // DateTime check (before date, since datetime is more specific)
  if (DATETIME_REGEX.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return 'datetime';
  }

  // Date check
  if (DATE_REGEX.test(str) || US_DATE_REGEX.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return 'date';
  }

  // JSON check
  if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
    try {
      JSON.parse(str);
      return 'json';
    } catch {
      // Not valid JSON, fall through to string
    }
  }

  return 'string';
}

/**
 * Given an array of inferred types for a column, determine the best overall type.
 * Uses majority voting with type hierarchy.
 */
function resolveColumnType(types: InferredColumnType[]): InferredColumnType {
  // Filter out unknowns (null values)
  const nonNull = types.filter((t) => t !== 'unknown');
  if (nonNull.length === 0) return 'string'; // All null → default to string

  // Count occurrences
  const counts = new Map<InferredColumnType, number>();
  for (const t of nonNull) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }

  // If 90%+ agree, use that type
  const total = nonNull.length;
  for (const [type, count] of counts) {
    if (count / total >= 0.9) {
      return type;
    }
  }

  // Type promotion rules:
  // integer + float → float
  const intCount = counts.get('integer') || 0;
  const floatCount = counts.get('float') || 0;
  if ((intCount + floatCount) / total >= 0.9) {
    return 'float';
  }

  // date + datetime → datetime
  const dateCount = counts.get('date') || 0;
  const datetimeCount = counts.get('datetime') || 0;
  if ((dateCount + datetimeCount) / total >= 0.9) {
    return 'datetime';
  }

  // Mixed types → string
  return 'string';
}

/**
 * Infer column types from row data.
 *
 * @param rows - Array of data rows
 * @param columnNames - Column names
 * @returns Array of InferredColumn with type information
 */
export function inferColumnTypes(
  rows: Record<string, unknown>[],
  columnNames: string[]
): InferredColumn[] {
  // Sample rows if too many
  const sampleRows =
    rows.length <= SAMPLE_SIZE
      ? rows
      : rows.filter((_, i) => {
          // Deterministic sampling: evenly spaced
          const step = Math.floor(rows.length / SAMPLE_SIZE);
          return i % step === 0;
        }).slice(0, SAMPLE_SIZE);

  return columnNames.map((name) => {
    const values = sampleRows.map((row) => row[name]);
    const types = values.map(inferValueType);
    const resolvedType = resolveColumnType(types);

    // Count nulls
    const nullCount = values.filter(
      (v) => v === null || v === undefined || v === ''
    ).length;

    // Count unique values
    const uniqueSet = new Set(values.map((v) => String(v ?? '')));
    const uniqueCount = uniqueSet.size;

    // Sample values (first 5 non-null unique values)
    const sampleValues = [...uniqueSet]
      .filter((v) => v !== '' && v !== 'null' && v !== 'undefined')
      .slice(0, 5)
      .map((v) => {
        // Convert back to the inferred type for preview
        if (resolvedType === 'integer') return parseInt(v, 10) || v;
        if (resolvedType === 'float') return parseFloat(v) || v;
        if (resolvedType === 'boolean') return TRUE_VALUES.has(v.toLowerCase());
        return v;
      });

    return {
      name,
      type: resolvedType,
      nullCount,
      uniqueCount,
      sampleValues,
    };
  });
}

/**
 * Map an InferredColumnType to a SQLite column type.
 */
export function toSQLiteType(type: InferredColumnType): string {
  switch (type) {
    case 'integer':
      return 'INTEGER';
    case 'float':
      return 'REAL';
    case 'boolean':
      return 'INTEGER'; // SQLite has no boolean type
    case 'date':
    case 'datetime':
      return 'TEXT'; // Store dates as ISO strings
    case 'json':
      return 'TEXT'; // Store JSON as text
    case 'string':
    case 'unknown':
    default:
      return 'TEXT';
  }
}

/**
 * Convert a raw string value to the inferred type.
 */
export function coerceValue(value: unknown, targetType: InferredColumnType): unknown {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const str = String(value).trim();
  if (str === '') return null;

  switch (targetType) {
    case 'integer': {
      const num = Number(str);
      return Number.isFinite(num) ? Math.round(num) : str;
    }
    case 'float': {
      const num = Number(str);
      return Number.isFinite(num) ? num : str;
    }
    case 'boolean': {
      return TRUE_VALUES.has(str.toLowerCase()) ? 1 : 0;
    }
    case 'date':
    case 'datetime': {
      // Store as ISO string
      const d = new Date(str);
      return isNaN(d.getTime()) ? str : d.toISOString();
    }
    case 'json': {
      // Store as-is if it's already a string representation
      if (typeof value === 'object') return JSON.stringify(value);
      return str;
    }
    default:
      return str;
  }
}
