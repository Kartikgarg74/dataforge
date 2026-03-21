/**
 * Integration Test: Upload → Profile → Transform → Export Flow
 *
 * Tests the complete data pipeline end-to-end using the working SQLite database.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { parseFile, generateTableName } from '../../src/lib/ingestion/file-parser';
import { rowsToCSV } from '../../src/lib/export/csv';
import { exportJSON, exportJSONL } from '../../src/lib/export/json';

describe('Upload → Profile → Transform → Export Integration', () => {
  const CSV_DATA = [
    'id,name,age,email,salary,active',
    '1,Alice,30,alice@example.com,75000,true',
    '2,Bob,25,bob@example.com,65000,true',
    '3,Charlie,35,charlie@example.com,85000,false',
    '4,Diana,28,diana@example.com,70000,true',
    '5,Eve,32,,80000,true',
    '6,Frank,45,frank@example.com,95000,false',
    '7,Grace,27,grace@example.com,62000,true',
    '8,Henry,38,,88000,true',
    '9,Ivy,29,ivy@example.com,72000,true',
    '10,Jack,33,jack@example.com,78000,false',
    '11,Kate,26,kate@example.com,60000,true',
    '12,Leo,41,leo@example.com,92000,true',
    '13,Mia,30,mia@example.com,74000,true',
    '14,Nick,36,,86000,false',
    '15,Olivia,24,olivia@example.com,58000,true',
    '16,Pete,39,pete@example.com,90000,true',
    '17,Quinn,31,quinn@example.com,76000,true',
    '18,Rose,34,rose@example.com,82000,false',
    '19,Sam,27,sam@example.com,64000,true',
    '20,Tina,42,tina@example.com,94000,true',
  ].join('\n');

  let parseResult: ReturnType<typeof parseFile>;

  beforeAll(() => {
    parseResult = parseFile(CSV_DATA, 'employees.csv');
  });

  describe('File Parsing', () => {
    it('parses CSV with correct row count', () => {
      expect(parseResult.rows.length).toBe(20);
    });

    it('detects correct column count', () => {
      expect(parseResult.columns.length).toBe(6);
    });

    it('infers column types correctly', () => {
      const typeMap = new Map(parseResult.columns.map((c) => [c.name, c.type]));
      expect(typeMap.get('id')).toBe('integer');
      expect(typeMap.get('name')).toBe('string');
      expect(typeMap.get('age')).toBe('integer');
      expect(typeMap.get('email')).toBe('string');
      expect(typeMap.get('salary')).toBe('integer');
      expect(typeMap.get('active')).toBe('boolean');
    });

    it('counts nulls in email column', () => {
      const emailCol = parseResult.columns.find((c) => c.name === 'email');
      expect(emailCol).toBeDefined();
      expect(emailCol!.nullCount).toBe(3); // Eve, Henry, Nick have empty emails
    });
  });

  describe('Table Name Generation', () => {
    it('generates clean table name from filename', () => {
      expect(generateTableName('employees.csv')).toBe('employees');
    });

    it('handles version conflicts', () => {
      expect(generateTableName('employees.csv', ['employees'])).toBe('employees_v1');
    });
  });

  describe('Export Pipeline', () => {
    it('exports to CSV correctly', () => {
      const csv = rowsToCSV(parseResult.rows, parseResult.columns.map((c) => c.name));
      const lines = csv.split('\n');
      expect(lines[0]).toBe('id,name,age,email,salary,active');
      expect(lines.length).toBe(21); // header + 20 rows
    });

    it('exports to JSON correctly', () => {
      const buf = exportJSON(parseResult.rows);
      const parsed = JSON.parse(buf.toString('utf-8'));
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(20);
      expect(parsed[0].name).toBe('Alice');
    });

    it('exports to JSONL correctly', () => {
      const buf = exportJSONL(parseResult.rows);
      const lines = buf.toString('utf-8').trim().split('\n');
      expect(lines.length).toBe(20);
      const first = JSON.parse(lines[0]);
      expect(first.name).toBe('Alice');
    });

    it('exports column subset', () => {
      const buf = exportJSON(parseResult.rows, ['name', 'age']);
      const parsed = JSON.parse(buf.toString('utf-8'));
      expect(Object.keys(parsed[0])).toEqual(['name', 'age']);
    });
  });
});
