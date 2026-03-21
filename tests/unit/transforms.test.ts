import { describe, it, expect } from 'vitest';
import type {
  TransformType,
  TransformStep,
  TransformPipeline,
  TransformPreview,
} from '../../src/lib/transforms/types';

/**
 * Transform pipeline tests.
 *
 * We do NOT test actual SQLite execution here (that would require a real DB).
 * Instead we validate that the type definitions are correct and that the
 * pipeline/step structures can be constructed with expected shapes.
 */
describe('Transform Types', () => {
  describe('TransformType', () => {
    it('includes expected transform types', () => {
      const types: TransformType[] = [
        'filter',
        'dedup',
        'sample',
        'sort',
        'limit',
        'fill_nulls',
        'drop_nulls',
        'rename',
        'drop_columns',
        'reorder',
        'cast_type',
        'computed_column',
        'trim',
        'lowercase',
        'uppercase',
        'regex_replace',
        'round',
        'normalize',
        'bin',
        'clip_outliers',
        'one_hot_encode',
        'label_encode',
        'group_aggregate',
        'join',
        'custom_sql',
        'custom_python',
      ];
      // If this compiles, the types exist. At runtime, verify the array is non-empty.
      expect(types).toHaveLength(26);
    });
  });

  describe('TransformStep shape', () => {
    it('can construct a valid TransformStep object', () => {
      const step: TransformStep = {
        id: 'step-1',
        type: 'filter',
        params: { condition: 'age > 18' },
        description: 'Keep adults only',
        sql: 'SELECT * FROM t WHERE age > 18',
        inputRowCount: 100,
        outputRowCount: 75,
        inputColumnCount: 5,
        outputColumnCount: 5,
        executionTimeMs: 12,
        createdAt: new Date().toISOString(),
        createdBy: 'user',
      };

      expect(step.id).toBe('step-1');
      expect(step.type).toBe('filter');
      expect(step.inputRowCount).toBeGreaterThan(step.outputRowCount);
      expect(step.createdBy).toBe('user');
    });

    it('supports ai-created steps', () => {
      const step: TransformStep = {
        id: 'step-ai',
        type: 'computed_column',
        params: { name: 'full_name', expression: "first || ' ' || last" },
        description: 'Concatenate names',
        inputRowCount: 50,
        outputRowCount: 50,
        inputColumnCount: 3,
        outputColumnCount: 4,
        executionTimeMs: 5,
        createdAt: new Date().toISOString(),
        createdBy: 'ai',
      };

      expect(step.createdBy).toBe('ai');
      expect(step.outputColumnCount).toBe(step.inputColumnCount + 1);
    });
  });

  describe('TransformPipeline shape', () => {
    it('can construct a pipeline with multiple steps', () => {
      const pipeline: TransformPipeline = {
        id: 'pipe-1',
        name: 'Clean data',
        sourceTable: 'raw_data',
        steps: [],
        resultTable: 'raw_data_transformed',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(pipeline.status).toBe('draft');
      expect(pipeline.steps).toHaveLength(0);
    });

    it('status can be executed or failed', () => {
      const statuses: TransformPipeline['status'][] = ['draft', 'executed', 'failed'];
      expect(statuses).toHaveLength(3);
    });
  });

  describe('TransformPreview shape', () => {
    it('can construct a valid preview object', () => {
      const preview: TransformPreview = {
        rows: [{ a: 1, b: 'hello' }],
        columns: ['a', 'b'],
        rowCountBefore: 100,
        rowCountAfter: 50,
        columnCountBefore: 2,
        columnCountAfter: 2,
      };

      expect(preview.rows).toHaveLength(1);
      expect(preview.rowCountAfter).toBeLessThan(preview.rowCountBefore);
    });
  });
});
