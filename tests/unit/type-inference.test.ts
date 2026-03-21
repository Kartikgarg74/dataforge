import { describe, it, expect } from 'vitest';
import { inferColumnTypes, toSQLiteType, coerceValue } from '../../src/lib/ingestion/type-inference';

describe('Type Inference Engine', () => {
  describe('inferColumnTypes', () => {
    it('detects integer columns', () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1) }));
      const result = inferColumnTypes(rows, ['id']);
      expect(result[0].type).toBe('integer');
    });

    it('detects float columns', () => {
      const rows = [
        { price: '9.99' }, { price: '12.50' }, { price: '3.14' },
      ];
      const result = inferColumnTypes(rows, ['price']);
      expect(result[0].type).toBe('float');
    });

    it('detects string columns', () => {
      const rows = [
        { name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' },
      ];
      const result = inferColumnTypes(rows, ['name']);
      expect(result[0].type).toBe('string');
    });

    it('detects boolean columns', () => {
      const rows = [
        { active: 'true' }, { active: 'false' }, { active: 'true' }, { active: 'yes' },
      ];
      const result = inferColumnTypes(rows, ['active']);
      expect(result[0].type).toBe('boolean');
    });

    it('detects date columns (ISO format)', () => {
      const rows = [
        { date: '2024-01-15' }, { date: '2024-02-20' }, { date: '2024-03-10' },
      ];
      const result = inferColumnTypes(rows, ['date']);
      expect(result[0].type).toBe('date');
    });

    it('detects datetime columns', () => {
      const rows = [
        { ts: '2024-01-15T10:30:00Z' },
        { ts: '2024-02-20T14:15:00Z' },
      ];
      const result = inferColumnTypes(rows, ['ts']);
      expect(result[0].type).toBe('datetime');
    });

    it('promotes integer + float to float', () => {
      const rows = [
        { val: '1' }, { val: '2.5' }, { val: '3' }, { val: '4.1' },
        { val: '5' }, { val: '6.2' }, { val: '7' }, { val: '8.3' },
        { val: '9' }, { val: '10.4' },
      ];
      const result = inferColumnTypes(rows, ['val']);
      expect(result[0].type).toBe('float');
    });

    it('falls back to string for mixed types', () => {
      const rows = [
        { val: 'hello' }, { val: '42' }, { val: 'true' }, { val: '2024-01-01' },
      ];
      const result = inferColumnTypes(rows, ['val']);
      expect(result[0].type).toBe('string');
    });

    it('counts nulls correctly', () => {
      const rows = [
        { val: 'a' }, { val: null }, { val: '' }, { val: 'b' },
      ];
      const result = inferColumnTypes(rows, ['val']);
      expect(result[0].nullCount).toBe(2); // null and empty string
    });

    it('counts unique values', () => {
      const rows = [
        { val: 'a' }, { val: 'b' }, { val: 'a' }, { val: 'c' },
      ];
      const result = inferColumnTypes(rows, ['val']);
      expect(result[0].uniqueCount).toBe(3);
    });

    it('provides sample values', () => {
      const rows = [
        { val: 'x' }, { val: 'y' }, { val: 'z' },
      ];
      const result = inferColumnTypes(rows, ['val']);
      expect(result[0].sampleValues.length).toBeGreaterThan(0);
    });
  });

  describe('toSQLiteType', () => {
    it('maps integer to INTEGER', () => {
      expect(toSQLiteType('integer')).toBe('INTEGER');
    });

    it('maps float to REAL', () => {
      expect(toSQLiteType('float')).toBe('REAL');
    });

    it('maps string to TEXT', () => {
      expect(toSQLiteType('string')).toBe('TEXT');
    });

    it('maps boolean to INTEGER', () => {
      expect(toSQLiteType('boolean')).toBe('INTEGER');
    });

    it('maps date to TEXT', () => {
      expect(toSQLiteType('date')).toBe('TEXT');
    });
  });

  describe('coerceValue', () => {
    it('coerces to integer', () => {
      expect(coerceValue('42', 'integer')).toBe(42);
    });

    it('coerces to float', () => {
      expect(coerceValue('3.14', 'float')).toBe(3.14);
    });

    it('coerces to boolean (true)', () => {
      expect(coerceValue('true', 'boolean')).toBe(1);
    });

    it('coerces to boolean (false)', () => {
      expect(coerceValue('false', 'boolean')).toBe(0);
    });

    it('returns null for empty values', () => {
      expect(coerceValue('', 'integer')).toBeNull();
      expect(coerceValue(null, 'string')).toBeNull();
      expect(coerceValue(undefined, 'float')).toBeNull();
    });
  });
});
