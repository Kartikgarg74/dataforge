import { describe, it, expect } from 'vitest';
import { rowsToCSV, exportCSV } from '../../src/lib/export/csv';
import { exportJSON, exportJSONL } from '../../src/lib/export/json';

describe('CSV Export', () => {
  describe('various data types', () => {
    it('handles string values', () => {
      const csv = rowsToCSV([{ name: 'Alice' }], ['name']);
      expect(csv).toBe('name\nAlice');
    });

    it('handles numeric values', () => {
      const csv = rowsToCSV([{ value: 42 }], ['value']);
      expect(csv).toBe('value\n42');
    });

    it('handles boolean values', () => {
      const csv = rowsToCSV([{ flag: true }, { flag: false }], ['flag']);
      expect(csv).toBe('flag\ntrue\nfalse');
    });

    it('handles null values as empty string', () => {
      const csv = rowsToCSV([{ a: null }], ['a']);
      expect(csv).toBe('a\n');
    });

    it('handles undefined values as empty string', () => {
      const csv = rowsToCSV([{ a: undefined }], ['a']);
      expect(csv).toBe('a\n');
    });

    it('handles mixed types across columns', () => {
      const csv = rowsToCSV(
        [{ name: 'Bob', age: 30, active: true }],
        ['name', 'age', 'active'],
      );
      expect(csv).toBe('name,age,active\nBob,30,true');
    });
  });

  describe('CSV special characters', () => {
    it('quotes values containing commas', () => {
      const csv = rowsToCSV([{ val: 'a, b' }], ['val']);
      expect(csv).toContain('"a, b"');
    });

    it('escapes double quotes inside values', () => {
      const csv = rowsToCSV([{ val: 'say "hi"' }], ['val']);
      expect(csv).toContain('"say ""hi"""');
    });

    it('quotes values containing newlines', () => {
      const csv = rowsToCSV([{ val: 'line1\nline2' }], ['val']);
      expect(csv).toContain('"line1\nline2"');
    });
  });

  describe('CSV injection prevention (sanitization)', () => {
    it('prefixes cells starting with =', () => {
      const csv = rowsToCSV([{ f: '=1+1' }], ['f']);
      expect(csv).toContain("'=1+1");
    });

    it('prefixes cells starting with +', () => {
      const csv = rowsToCSV([{ f: '+cmd' }], ['f']);
      expect(csv).toContain("'+cmd");
    });

    it('prefixes cells starting with -', () => {
      const csv = rowsToCSV([{ f: '-1+1' }], ['f']);
      expect(csv).toContain("'-1+1");
    });

    it('prefixes cells starting with @', () => {
      const csv = rowsToCSV([{ f: '@SUM(A1)' }], ['f']);
      expect(csv).toContain("'@SUM(A1)");
    });

    it('prefixes cells starting with tab', () => {
      const csv = rowsToCSV([{ f: '\tcmd' }], ['f']);
      expect(csv).toContain("'\tcmd");
    });

    it('prefixes cells starting with |', () => {
      const csv = rowsToCSV([{ f: '|cmd' }], ['f']);
      expect(csv).toContain("'|cmd");
    });

    it('does not prefix normal strings', () => {
      const csv = rowsToCSV([{ f: 'hello world' }], ['f']);
      expect(csv).toBe('f\nhello world');
    });
  });

  describe('empty data handling', () => {
    it('returns only the header row for empty row array', () => {
      const csv = rowsToCSV([], ['a', 'b']);
      expect(csv).toBe('a,b');
    });

    it('returns single header for one column, no rows', () => {
      const csv = rowsToCSV([], ['id']);
      expect(csv).toBe('id');
    });
  });

  describe('column subset selection', () => {
    it('exports only the specified columns', () => {
      const csv = rowsToCSV(
        [{ a: 1, b: 2, c: 3 }],
        ['a', 'c'],
      );
      expect(csv).toBe('a,c\n1,3');
    });

    it('uses undefined for missing columns in row', () => {
      const csv = rowsToCSV(
        [{ a: 1 }],
        ['a', 'b'],
      );
      // b is undefined → sanitizeCell returns ''
      expect(csv).toBe('a,b\n1,');
    });
  });

  describe('exportCSV buffer', () => {
    it('returns a Buffer', () => {
      const buf = exportCSV([{ x: 1 }], ['x']);
      expect(buf).toBeInstanceOf(Buffer);
    });

    it('buffer content matches rowsToCSV output', () => {
      const rows = [{ a: 'hello', b: 42 }];
      const cols = ['a', 'b'];
      const buf = exportCSV(rows, cols);
      expect(buf.toString('utf-8')).toBe(rowsToCSV(rows, cols));
    });
  });
});

describe('JSON Export', () => {
  it('produces valid JSON', () => {
    const buf = exportJSON([{ a: 1, b: 'two' }]);
    const parsed = JSON.parse(buf.toString('utf-8'));
    expect(parsed).toEqual([{ a: 1, b: 'two' }]);
  });

  it('is pretty-printed with 2-space indent', () => {
    const buf = exportJSON([{ x: 1 }]);
    const str = buf.toString('utf-8');
    expect(str).toContain('\n');
    expect(str).toContain('  ');
  });

  it('filters to specified columns', () => {
    const buf = exportJSON([{ a: 1, b: 2, c: 3 }], ['a', 'c']);
    const parsed = JSON.parse(buf.toString('utf-8'));
    expect(parsed).toEqual([{ a: 1, c: 3 }]);
  });

  it('replaces missing columns with null', () => {
    const buf = exportJSON([{ a: 1 }], ['a', 'b']);
    const parsed = JSON.parse(buf.toString('utf-8'));
    expect(parsed[0].b).toBeNull();
  });

  it('handles empty rows', () => {
    const buf = exportJSON([]);
    const parsed = JSON.parse(buf.toString('utf-8'));
    expect(parsed).toEqual([]);
  });

  it('handles multiple rows', () => {
    const buf = exportJSON([{ x: 1 }, { x: 2 }, { x: 3 }]);
    const parsed = JSON.parse(buf.toString('utf-8'));
    expect(parsed).toHaveLength(3);
  });
});

describe('JSONL Export', () => {
  it('produces one JSON object per line', () => {
    const buf = exportJSONL([{ a: 1 }, { a: 2 }]);
    const lines = buf.toString('utf-8').trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ a: 1 });
    expect(JSON.parse(lines[1])).toEqual({ a: 2 });
  });

  it('each line is valid JSON independently', () => {
    const buf = exportJSONL([{ x: 'hello' }, { x: 'world' }]);
    const lines = buf.toString('utf-8').trimEnd().split('\n');
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('ends with a trailing newline', () => {
    const buf = exportJSONL([{ a: 1 }]);
    const str = buf.toString('utf-8');
    expect(str.endsWith('\n')).toBe(true);
  });

  it('filters to specified columns', () => {
    const buf = exportJSONL([{ a: 1, b: 2, c: 3 }], ['b']);
    const lines = buf.toString('utf-8').trimEnd().split('\n');
    const parsed = JSON.parse(lines[0]);
    expect(parsed).toEqual({ b: 2 });
  });

  it('handles empty rows', () => {
    const buf = exportJSONL([]);
    const str = buf.toString('utf-8');
    // Empty array → single trailing newline
    expect(str).toBe('\n');
  });
});
