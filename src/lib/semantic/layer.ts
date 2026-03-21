/**
 * Semantic Layer Builder
 *
 * Builds enriched schema context for LLM consumption by combining raw database
 * schema information with optional semantic layer metadata including business
 * names, descriptions, relationships, metrics, and synonym mappings.
 */

import type { SchemaInfo } from '@/lib/connectors/interface';
import type { SemanticLayer } from './types';

/**
 * Build a formatted schema context string for LLM prompts.
 *
 * Combines raw schema information with optional semantic layer metadata
 * to produce a rich context that helps the LLM generate accurate SQL.
 *
 * @param schema - Raw database schema from the connector
 * @param semantic - Optional semantic layer with business context
 * @returns Formatted string suitable for inclusion in LLM prompts
 */
export function buildSchemaContext(
  schema: SchemaInfo,
  semantic?: SemanticLayer
): string {
  const sections: string[] = [];

  sections.push(`Database: ${schema.database}`);
  sections.push('');

  // Format each table
  for (const { table, columns } of schema.tables) {
    const tableSemantic = semantic?.tables?.[table.name];
    const displayName = tableSemantic?.businessName ?? table.name;
    const description = tableSemantic?.description ?? '';

    let tableHeader = `Table: ${table.name}`;
    if (tableSemantic?.businessName) {
      tableHeader += ` (${displayName})`;
    }
    if (description) {
      tableHeader += ` - ${description}`;
    }
    if (table.schema) {
      tableHeader += ` [schema: ${table.schema}]`;
    }
    sections.push(tableHeader);

    // Format columns
    sections.push('  Columns:');
    for (const col of columns) {
      const colSemantic = tableSemantic?.columns?.[col.name];

      // Skip hidden columns
      if (colSemantic?.hidden) {
        continue;
      }

      let colLine = `    - ${col.name} (${col.nativeType})`;

      if (col.isPrimaryKey) {
        colLine += ' [PK]';
      }
      if (col.isForeignKey) {
        colLine += ` [FK -> ${col.foreignKeyTable}.${col.foreignKeyColumn}]`;
      }
      if (!col.nullable) {
        colLine += ' NOT NULL';
      }

      if (colSemantic) {
        if (colSemantic.businessName) {
          colLine += ` — "${colSemantic.businessName}"`;
        }
        if (colSemantic.description) {
          colLine += ` — ${colSemantic.description}`;
        }
        if (colSemantic.unit) {
          colLine += ` (unit: ${colSemantic.unit})`;
        }
        if (colSemantic.isMetric) {
          colLine += ' [metric]';
        }
        if (colSemantic.isDimension) {
          colLine += ' [dimension]';
        }
      } else if (col.comment) {
        colLine += ` — ${col.comment}`;
      }

      sections.push(colLine);
    }

    // Format relationships
    if (tableSemantic?.relationships?.length) {
      sections.push('  Relationships:');
      for (const rel of tableSemantic.relationships) {
        sections.push(
          `    - ${rel.type} with ${rel.table} ON ${rel.joinOn}`
        );
      }
    }

    sections.push('');
  }

  // Format metrics
  if (semantic?.metrics && Object.keys(semantic.metrics).length > 0) {
    sections.push('Available Metrics:');
    for (const [name, metric] of Object.entries(semantic.metrics)) {
      sections.push(
        `  - ${name}: ${metric.description} (unit: ${metric.unit})`
      );
      sections.push(`    SQL: ${metric.sql}`);
    }
    sections.push('');
  }

  // Format synonyms
  if (semantic?.synonyms && Object.keys(semantic.synonyms).length > 0) {
    sections.push('Term Mappings (synonyms):');
    for (const [term, reference] of Object.entries(semantic.synonyms)) {
      sections.push(`  - "${term}" -> ${reference}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Replace business terms in a natural language query with their actual
 * column or table references using the synonym map.
 *
 * @param query - The user's natural language query
 * @param synonyms - Map of business terms to column/table references
 * @returns The query with synonyms resolved
 */
export function resolveSynonyms(
  query: string,
  synonyms: Record<string, string>
): string {
  let resolved = query;

  // Sort by length descending so longer synonyms match first
  const sortedEntries = Object.entries(synonyms).sort(
    ([a], [b]) => b.length - a.length
  );

  for (const [term, reference] of sortedEntries) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
    resolved = resolved.replace(pattern, reference);
  }

  return resolved;
}

/**
 * Collect all commonQuestions defined across all tables in the semantic layer.
 *
 * @param semantic - The semantic layer configuration
 * @returns Array of common question strings
 */
export function getCommonQuestions(semantic: SemanticLayer): string[] {
  const questions: string[] = [];

  for (const tableSemantic of Object.values(semantic.tables)) {
    if (tableSemantic.commonQuestions?.length) {
      questions.push(...tableSemantic.commonQuestions);
    }
  }

  return questions;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
