/**
 * Transform Pipeline Types
 */

export type TransformType =
  | 'filter'
  | 'dedup'
  | 'sample'
  | 'sort'
  | 'limit'
  | 'fill_nulls'
  | 'drop_nulls'
  | 'rename'
  | 'drop_columns'
  | 'reorder'
  | 'cast_type'
  | 'computed_column'
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'regex_replace'
  | 'round'
  | 'normalize'
  | 'bin'
  | 'clip_outliers'
  | 'one_hot_encode'
  | 'label_encode'
  | 'extract'
  | 'group_aggregate'
  | 'join'
  | 'pivot'
  | 'unpivot'
  | 'custom_sql'
  | 'custom_python';

export interface TransformStep {
  id: string;
  type: TransformType;
  params: Record<string, unknown>;
  description: string;
  sql?: string;
  python?: string;
  inputRowCount: number;
  outputRowCount: number;
  inputColumnCount: number;
  outputColumnCount: number;
  executionTimeMs: number;
  createdAt: string;
  createdBy: 'user' | 'ai';
}

export interface TransformPipeline {
  id: string;
  name: string;
  sourceTable: string;
  steps: TransformStep[];
  resultTable: string;
  status: 'draft' | 'executed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface TransformPreview {
  rows: Record<string, unknown>[];
  columns: string[];
  rowCountBefore: number;
  rowCountAfter: number;
  columnCountBefore: number;
  columnCountAfter: number;
}

export interface StepResult {
  step: TransformStep;
  intermediateTable: string;
}
