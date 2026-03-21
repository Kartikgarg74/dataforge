import { describe, it, expect } from 'vitest';
import { rowsToCSV, exportCSV } from '../../src/lib/export/csv';

describe('CSV Export & Sanitization', () => {
  describe('Normal values', () => {
    it('passes through normal strings unchanged', () => {
      const csv = rowsToCSV(
        [{ name: 'John', age: '30' }],
        ['name', 'age']
      );
      expect(csv).toBe('name,age\nJohn,30');
    });

    it('handles numbers', () => {
      const csv = rowsToCSV(
        [{ value: 42 }],
        ['value']
      );
      expect(csv).toBe('value\n42');
    });

    it('handles null and undefined as empty', () => {
      const csv = rowsToCSV(
        [{ a: null, b: undefined }],
        ['a', 'b']
      );
      expect(csv).toBe('a,b\n,');
    });

    it('handles empty strings', () => {
      const csv = rowsToCSV(
        [{ value: '' }],
        ['value']
      );
      expect(csv).toBe('value\n');
    });

    it('wraps values containing commas in quotes', () => {
      const csv = rowsToCSV(
        [{ value: 'hello, world' }],
        ['value']
      );
      expect(csv).toBe('value\n"hello, world"');
    });

    it('escapes double quotes', () => {
      const csv = rowsToCSV(
        [{ value: 'say "hello"' }],
        ['value']
      );
      expect(csv).toBe('value\n"say ""hello"""');
    });
  });

  describe('CSV injection prevention', () => {
    it('prefixes cells starting with =', () => {
      const csv = rowsToCSV(
        [{ formula: '=1+1' }],
        ['formula']
      );
      expect(csv).toContain("'=1+1");
    });

    it('prefixes cells starting with +', () => {
      const csv = rowsToCSV(
        [{ value: '+cmd|stuff' }],
        ['value']
      );
      expect(csv).toContain("'+cmd|stuff");
    });

    it('prefixes cells starting with -', () => {
      const csv = rowsToCSV(
        [{ value: '-1+1' }],
        ['value']
      );
      expect(csv).toContain("'-1+1");
    });

    it('prefixes cells starting with @', () => {
      const csv = rowsToCSV(
        [{ value: '@SUM(A1:A10)' }],
        ['value']
      );
      expect(csv).toContain("'@SUM(A1:A10)");
    });

    it('prefixes cells starting with tab', () => {
      const csv = rowsToCSV(
        [{ value: '\tcmd' }],
        ['value']
      );
      expect(csv).toContain("'\tcmd");
    });

    it('prefixes cells starting with |', () => {
      const csv = rowsToCSV(
        [{ value: '|cmd' }],
        ['value']
      );
      expect(csv).toContain("'|cmd");
    });
  });

  describe('exportCSV', () => {
    it('returns a Buffer', () => {
      const buf = exportCSV(
        [{ a: 1, b: 'test' }],
        ['a', 'b']
      );
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.toString('utf-8')).toBe('a,b\n1,test');
    });

    it('handles multiple rows', () => {
      const buf = exportCSV(
        [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
        ['x', 'y']
      );
      expect(buf.toString('utf-8')).toBe('x,y\n1,2\n3,4');
    });
  });
});
