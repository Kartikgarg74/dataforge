import { describe, it, expect } from 'vitest';
import { buildSchemaContext, resolveSynonyms, getCommonQuestions } from '../../src/lib/semantic/layer';
import { buildNLtoSQLPrompt, extractSQLFromResponse, validateGeneratedSQL } from '../../src/lib/semantic/nl-to-sql';
import type { SchemaInfo } from '../../src/lib/connectors/interface';
import type { SemanticLayer } from '../../src/lib/semantic/types';

const mockSchema: SchemaInfo = {
  database: 'test',
  tables: [
    {
      table: { name: 'users', type: 'table', rowCount: 1000 },
      columns: [
        { name: 'id', nativeType: 'INTEGER', normalizedType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'email', nativeType: 'TEXT', normalizedType: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'created_at', nativeType: 'TEXT', normalizedType: 'datetime', nullable: false, isPrimaryKey: false, isForeignKey: false },
      ],
    },
    {
      table: { name: 'orders', type: 'table', rowCount: 5000 },
      columns: [
        { name: 'id', nativeType: 'INTEGER', normalizedType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'user_id', nativeType: 'INTEGER', normalizedType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyTable: 'users', foreignKeyColumn: 'id' },
        { name: 'amount', nativeType: 'REAL', normalizedType: 'float', nullable: false, isPrimaryKey: false, isForeignKey: false },
      ],
    },
  ],
};

const mockSemantic: SemanticLayer = {
  tables: {
    users: {
      description: 'All registered users',
      businessName: 'Customers',
      commonQuestions: ['How many users?', 'New signups this week?'],
      columns: {
        email: { description: 'User email address', businessName: 'Email' },
        created_at: { description: 'When the user signed up', businessName: 'Signup Date' },
      },
    },
    orders: {
      description: 'Purchase orders',
      columns: {
        amount: { description: 'Order total in USD', unit: 'USD', isMetric: true },
        user_id: { description: 'Reference to the customer' },
      },
    },
  },
  synonyms: {
    revenue: 'orders.amount',
    customers: 'users',
    signups: 'users.created_at',
  },
  metrics: {
    total_revenue: { sql: 'SUM(orders.amount)', description: 'Total revenue', unit: 'USD' },
  },
};

describe('Semantic Layer', () => {
  describe('buildSchemaContext', () => {
    it('builds context from raw schema', () => {
      const ctx = buildSchemaContext(mockSchema);
      expect(ctx).toContain('users');
      expect(ctx).toContain('orders');
      expect(ctx).toContain('email');
      expect(ctx).toContain('amount');
    });

    it('enriches context with semantic layer', () => {
      const ctx = buildSchemaContext(mockSchema, mockSemantic);
      expect(ctx).toContain('All registered users');
      expect(ctx).toContain('Purchase orders');
      expect(ctx).toContain('USD');
    });
  });

  describe('resolveSynonyms', () => {
    it('replaces business terms with column refs', () => {
      const resolved = resolveSynonyms('show me revenue by customers', mockSemantic.synonyms!);
      expect(resolved).toContain('orders.amount');
      expect(resolved).toContain('users');
    });
  });

  describe('getCommonQuestions', () => {
    it('collects common questions', () => {
      const questions = getCommonQuestions(mockSemantic);
      expect(questions).toContain('How many users?');
      expect(questions).toContain('New signups this week?');
    });
  });
});

describe('NL-to-SQL', () => {
  describe('buildNLtoSQLPrompt', () => {
    it('builds a prompt with schema context', () => {
      const prompt = buildNLtoSQLPrompt('how many users?', 'Table: users (id, email)');
      expect(prompt).toContain('how many users?');
      expect(prompt).toContain('Table: users');
      expect(prompt).toContain('SELECT');
    });
  });

  describe('extractSQLFromResponse', () => {
    it('extracts SQL from code block', () => {
      const response = 'Here is the query:\n```sql\nSELECT COUNT(*) FROM users\n```';
      expect(extractSQLFromResponse(response)).toBe('SELECT COUNT(*) FROM users');
    });

    it('extracts bare SELECT statement', () => {
      const response = 'SELECT COUNT(*) FROM users WHERE active = true';
      expect(extractSQLFromResponse(response)).toBe('SELECT COUNT(*) FROM users WHERE active = true');
    });

    it('returns null for no SQL', () => {
      expect(extractSQLFromResponse('I cannot answer that question.')).toBeNull();
    });
  });

  describe('validateGeneratedSQL', () => {
    it('accepts valid SELECT', () => {
      const result = validateGeneratedSQL('SELECT * FROM users');
      expect(result.valid).toBe(true);
    });

    it('accepts CTE queries', () => {
      const result = validateGeneratedSQL('WITH cte AS (SELECT 1) SELECT * FROM cte');
      expect(result.valid).toBe(true);
    });

    it('rejects INSERT', () => {
      const result = validateGeneratedSQL('INSERT INTO users VALUES (1)');
      expect(result.valid).toBe(false);
    });

    it('rejects DROP', () => {
      const result = validateGeneratedSQL('DROP TABLE users');
      expect(result.valid).toBe(false);
    });

    it('rejects DELETE', () => {
      const result = validateGeneratedSQL('DELETE FROM users');
      expect(result.valid).toBe(false);
    });
  });
});
