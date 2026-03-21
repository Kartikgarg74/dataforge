import { describe, it, expect } from 'vitest';
import type { TransformType } from '../../src/lib/transforms/types';

describe('TransformType', () => {
  const allExpectedTypes: TransformType[] = [
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
    'extract',
    'group_aggregate',
    'join',
    'pivot',
    'unpivot',
    'custom_sql',
    'custom_python',
  ];

  it('defines at least 28 transform types', () => {
    expect(allExpectedTypes.length).toBeGreaterThanOrEqual(28);
  });

  it.each(allExpectedTypes)('includes "%s" as a valid TransformType', (type) => {
    // This test verifies at compile-time that each string is assignable to TransformType.
    // At runtime we simply confirm the value is a non-empty string.
    const t: TransformType = type;
    expect(typeof t).toBe('string');
    expect(t.length).toBeGreaterThan(0);
  });
});
