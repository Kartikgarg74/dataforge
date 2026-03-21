/**
 * Semantic Layer Types
 *
 * Defines the type system for the semantic layer that enriches raw database
 * schemas with business context, descriptions, metrics, and synonym mappings
 * to improve NL-to-SQL generation quality.
 */

export interface SemanticLayer {
  tables: Record<string, TableSemantic>;
  metrics?: Record<string, MetricDefinition>;
  synonyms?: Record<string, string>;
}

export interface TableSemantic {
  description: string;
  businessName?: string;
  commonQuestions?: string[];
  columns: Record<string, ColumnSemantic>;
  relationships?: TableRelationship[];
}

export interface ColumnSemantic {
  description: string;
  businessName?: string;
  unit?: string;
  isMetric?: boolean;
  isDimension?: boolean;
  hidden?: boolean;
  sensitivityLevel?: 'public' | 'internal' | 'restricted';
}

export interface TableRelationship {
  table: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  joinOn: string;
}

export interface MetricDefinition {
  sql: string;
  description: string;
  unit: string;
}
