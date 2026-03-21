/**
 * Query Parameter Substitution
 *
 * Replaces {{param_name}} placeholders in SQL with actual values,
 * with proper escaping and type validation.
 */

import type { QueryParameter } from './types';

/**
 * Substitute parameters into a SQL string.
 *
 * Replaces {{param_name}} placeholders with properly escaped values.
 * Validates that all required parameters are provided and types match.
 *
 * @param sql - SQL string with {{param_name}} placeholders
 * @param params - Parameter definitions
 * @param values - Actual values keyed by parameter name
 * @returns The SQL string with parameters substituted
 * @throws Error if required parameters are missing or types don't match
 */
export function substituteParameters(
  sql: string,
  params: QueryParameter[],
  values: Record<string, unknown>
): string {
  // Validate all required params are provided
  for (const param of params) {
    const value = values[param.name];
    if (param.required && (value === undefined || value === null || value === '')) {
      throw new Error(`Required parameter "${param.label}" (${param.name}) is missing`);
    }
  }

  let result = sql;

  for (const param of params) {
    const placeholder = `{{${param.name}}}`;

    // Skip if placeholder not in SQL
    if (!result.includes(placeholder)) continue;

    const rawValue = values[param.name] ?? param.defaultValue;

    // If no value available and not required, replace with NULL
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      result = result.split(placeholder).join('NULL');
      continue;
    }

    // Validate and format based on type
    const formatted = formatValue(rawValue, param);
    result = result.split(placeholder).join(formatted);
  }

  return result;
}

/**
 * Format and escape a value based on its parameter type.
 */
function formatValue(value: unknown, param: QueryParameter): string {
  switch (param.type) {
    case 'number': {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(
          `Parameter "${param.label}" (${param.name}) must be a number, got: ${String(value)}`
        );
      }
      return String(num);
    }

    case 'date': {
      const dateStr = String(value);
      // Basic ISO date validation (YYYY-MM-DD or full ISO)
      if (!/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        throw new Error(
          `Parameter "${param.label}" (${param.name}) must be a valid date (YYYY-MM-DD), got: ${dateStr}`
        );
      }
      return escapeString(dateStr);
    }

    case 'select': {
      const strVal = String(value);
      if (param.options && param.options.length > 0 && !param.options.includes(strVal)) {
        throw new Error(
          `Parameter "${param.label}" (${param.name}) must be one of [${param.options.join(', ')}], got: ${strVal}`
        );
      }
      return escapeString(strVal);
    }

    case 'string':
    default:
      return escapeString(String(value));
  }
}

/**
 * Escape a string value for safe SQL interpolation.
 * Wraps in single quotes and escapes internal single quotes.
 */
function escapeString(value: string): string {
  const escaped = value.replace(/'/g, "''");
  return `'${escaped}'`;
}
