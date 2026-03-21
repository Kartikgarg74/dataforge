import { describe, it, expect } from 'vitest';
import { detectFileFormat, parseFile, generateTableName } from '../../src/lib/ingestion/file-parser';

describe('File Parser', () => {
  describe('detectFileFormat', () => {
    it('detects CSV from extension', () => {
      expect(detectFileFormat('data.csv')).toBe('csv');
    });

    it('detects TSV from extension', () => {
      expect(detectFileFormat('data.tsv')).toBe('tsv');
    });

    it('detects JSON from extension', () => {
      expect(detectFileFormat('data.json')).toBe('json');
    });

    it('detects JSONL from extension', () => {
      expect(detectFileFormat('data.jsonl')).toBe('jsonl');
    });

    it('detects JSONL from content with .json extension', () => {
      const content = '{"a":1}\n{"a":2}\n{"a":3}';
      expect(detectFileFormat('data.json', content)).toBe('jsonl');
    });

    it('detects Parquet from extension', () => {
      expect(detectFileFormat('data.parquet')).toBe('parquet');
    });

    it('detects Excel from extension', () => {
      expect(detectFileFormat('data.xlsx')).toBe('excel');
    });

    it('detects SQLite from extension', () => {
      expect(detectFileFormat('data.db')).toBe('sqlite');
      expect(detectFileFormat('data.sqlite')).toBe('sqlite');
    });

    it('defaults to CSV for unknown extensions', () => {
      expect(detectFileFormat('data.txt')).toBe('csv');
    });
  });

  describe('parseFile (CSV)', () => {
    it('parses simple CSV', () => {
      const csv = 'name,age,city\nAlice,30,NYC\nBob,25,LA';
      const result = parseFile(csv, 'test.csv');
      expect(result.rows.length).toBe(2);
      expect(result.columns.length).toBe(3);
      expect(result.rows[0].name).toBe('Alice');
      expect(result.rows[0].age).toBe('30');
    });

    it('handles quoted fields', () => {
      const csv = 'name,desc\nAlice,"Hello, World"\nBob,"Say ""hi"""';
      const result = parseFile(csv, 'test.csv');
      expect(result.rows[0].desc).toBe('Hello, World');
      expect(result.rows[1].desc).toBe('Say "hi"');
    });

    it('auto-detects TSV delimiter', () => {
      const tsv = 'name\tage\nAlice\t30\nBob\t25';
      const result = parseFile(tsv, 'test.csv');
      expect(result.delimiter).toBe('\t');
      expect(result.rows.length).toBe(2);
    });

    it('sanitizes column names', () => {
      const csv = 'First Name,Last Name,Age (years)\nAlice,Smith,30';
      const result = parseFile(csv, 'test.csv');
      // Column names should be sanitized to valid identifiers
      expect(result.columns.every((c) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c.name))).toBe(true);
    });

    it('handles empty file', () => {
      const result = parseFile('', 'test.csv');
      expect(result.rows.length).toBe(0);
    });

    it('infers column types', () => {
      // Need enough rows for 90% threshold
      const rows = Array.from({ length: 20 }, (_, i) =>
        `${i + 1},Person${i},${(9.99 + i).toFixed(2)},${i % 2 === 0 ? 'true' : 'false'}`
      ).join('\n');
      const csv = `id,name,price,active\n${rows}`;
      const result = parseFile(csv, 'test.csv');
      const typeMap = new Map(result.columns.map((c) => [c.name, c.type]));
      expect(typeMap.get('id')).toBe('integer');
      expect(typeMap.get('name')).toBe('string');
      expect(typeMap.get('price')).toBe('float');
      expect(typeMap.get('active')).toBe('boolean');
    });
  });

  describe('parseFile (JSON)', () => {
    it('parses JSON array', () => {
      const json = JSON.stringify([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]);
      const result = parseFile(json, 'test.json');
      expect(result.rows.length).toBe(2);
      expect(result.rows[0].name).toBe('Alice');
    });

    it('parses JSON with data wrapper', () => {
      const json = JSON.stringify({
        data: [
          { name: 'Alice' },
          { name: 'Bob' },
        ],
      });
      const result = parseFile(json, 'test.json');
      expect(result.rows.length).toBe(2);
    });

    it('flattens nested objects', () => {
      const json = JSON.stringify([
        { user: { name: 'Alice', email: 'a@b.com' }, score: 10 },
      ]);
      const result = parseFile(json, 'test.json');
      expect(result.rows[0].user_name).toBe('Alice');
      expect(result.rows[0].user_email).toBe('a@b.com');
      expect(result.rows[0].score).toBe(10);
    });
  });

  describe('parseFile (JSONL)', () => {
    it('parses JSONL', () => {
      const jsonl = '{"name":"Alice","age":30}\n{"name":"Bob","age":25}';
      const result = parseFile(jsonl, 'test.jsonl');
      expect(result.rows.length).toBe(2);
      expect(result.format).toBe('jsonl');
    });

    it('skips malformed lines', () => {
      const jsonl = '{"name":"Alice"}\nnot json\n{"name":"Bob"}';
      const result = parseFile(jsonl, 'test.jsonl');
      expect(result.rows.length).toBe(2);
    });
  });

  describe('generateTableName', () => {
    it('generates from filename', () => {
      expect(generateTableName('my-data.csv')).toBe('my_data');
    });

    it('handles version conflicts', () => {
      expect(generateTableName('sales.csv', ['sales'])).toBe('sales_v1');
      expect(generateTableName('sales.csv', ['sales', 'sales_v1'])).toBe('sales_v2');
    });

    it('sanitizes special characters', () => {
      const name = generateTableName('My Data (2024).csv');
      // Should only contain valid identifier characters
      expect(/^[a-z_][a-z0-9_]*$/.test(name)).toBe(true);
    });

    it('handles empty filename', () => {
      expect(generateTableName('.csv')).toBe('imported_data');
    });
  });
});
