/**
 * Semantic Layer Module
 *
 * Provides the semantic layer system for enhanced NL-to-SQL generation.
 * Enriches raw database schemas with business context, metrics, and
 * synonym mappings to improve natural language query translation.
 */

export type {
  SemanticLayer,
  TableSemantic,
  ColumnSemantic,
  TableRelationship,
  MetricDefinition,
} from './types';

export {
  buildSchemaContext,
  resolveSynonyms,
  getCommonQuestions,
} from './layer';

export {
  buildNLtoSQLPrompt,
  extractSQLFromResponse,
  validateGeneratedSQL,
} from './nl-to-sql';
