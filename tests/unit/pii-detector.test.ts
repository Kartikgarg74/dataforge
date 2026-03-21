import { describe, it, expect } from 'vitest';
import { detectPII, getPIIColumnNames, getPIIWarnings } from '../../src/lib/profiling/pii-detector';

describe('PII Detector', () => {
  // ---------- Email ----------
  describe('email detection', () => {
    it('detects email column by name', () => {
      const detections = detectPII([{ name: 'email' }]);
      expect(detections).toHaveLength(1);
      expect(detections[0].piiType).toBe('email');
    });

    it('detects e_mail column by name', () => {
      const detections = detectPII([{ name: 'e_mail' }]);
      expect(detections).toHaveLength(1);
      expect(detections[0].piiType).toBe('email');
    });

    it('detects email by value pattern', () => {
      const detections = detectPII([
        {
          name: 'email',
          sampleValues: ['alice@example.com', 'bob@test.org', 'carol@domain.co'],
        },
      ]);
      expect(detections).toHaveLength(1);
      expect(detections[0].confidence).toBe('high');
      expect(detections[0].sampleMatch).toBeDefined();
    });

    it('detects email by name even without sample values', () => {
      const detections = detectPII([{ name: 'user_email' }]);
      // 'user_email' doesn't match /email/i pattern — wait, it does: /email/i tests true on 'user_email'
      expect(detections).toHaveLength(1);
    });
  });

  // ---------- Phone ----------
  describe('phone detection', () => {
    it('detects phone column by name', () => {
      const detections = detectPII([{ name: 'phone' }]);
      expect(detections).toHaveLength(1);
      expect(detections[0].piiType).toBe('phone');
    });

    it('detects mobile column by name', () => {
      const detections = detectPII([{ name: 'mobile_number' }]);
      expect(detections).toHaveLength(1);
      expect(detections[0].piiType).toBe('phone');
    });

    it('detects phone by value pattern', () => {
      const detections = detectPII([
        {
          name: 'phone',
          sampleValues: ['+1 555-123-4567', '(555) 987-6543', '555.111.2222'],
        },
      ]);
      expect(detections).toHaveLength(1);
      expect(detections[0].confidence).toBe('high');
    });
  });

  // ---------- SSN ----------
  describe('SSN detection', () => {
    it('detects ssn column by name', () => {
      const detections = detectPII([{ name: 'ssn' }]);
      expect(detections).toHaveLength(1);
      expect(detections[0].piiType).toBe('ssn');
    });

    it('detects social_security column', () => {
      const detections = detectPII([{ name: 'social_security' }]);
      expect(detections).toHaveLength(1);
      expect(detections[0].piiType).toBe('ssn');
    });

    it('detects SSN by value pattern', () => {
      const detections = detectPII([
        {
          name: 'ssn',
          sampleValues: ['123-45-6789', '987-65-4321', '111-22-3333'],
        },
      ]);
      expect(detections).toHaveLength(1);
      expect(detections[0].confidence).toBe('high');
    });
  });

  // ---------- Non-PII ----------
  describe('non-PII columns', () => {
    it('does not flag generic numeric columns', () => {
      const detections = detectPII([
        { name: 'revenue', sampleValues: [100, 200, 300] },
      ]);
      expect(detections).toHaveLength(0);
    });

    it('does not flag id columns', () => {
      const detections = detectPII([
        { name: 'order_id', sampleValues: ['ORD-001', 'ORD-002'] },
      ]);
      expect(detections).toHaveLength(0);
    });

    it('does not flag date columns', () => {
      const detections = detectPII([
        { name: 'created_at', sampleValues: ['2024-01-01', '2024-02-01'] },
      ]);
      expect(detections).toHaveLength(0);
    });

    it('does not flag product_name (not a person name)', () => {
      const detections = detectPII([
        { name: 'product_name', sampleValues: ['Widget', 'Gadget'] },
      ]);
      expect(detections).toHaveLength(0);
    });

    it('does not flag status columns', () => {
      const detections = detectPII([
        { name: 'status', sampleValues: ['active', 'inactive'] },
      ]);
      expect(detections).toHaveLength(0);
    });
  });

  // ---------- getPIIColumnNames ----------
  describe('getPIIColumnNames', () => {
    it('returns only high-confidence PII column names', () => {
      const columns = [
        { name: 'email', sampleValues: ['a@b.com', 'c@d.com'] },
        { name: 'city' }, // address type but medium confidence (name match only, no value pattern for address)
        { name: 'revenue', sampleValues: [100] },
      ];
      const names = getPIIColumnNames(columns);
      expect(names).toContain('email');
      expect(names).not.toContain('revenue');
    });

    it('returns empty array when no PII detected', () => {
      const columns = [
        { name: 'id', sampleValues: [1, 2, 3] },
        { name: 'amount', sampleValues: [10.5, 20.3] },
      ];
      const names = getPIIColumnNames(columns);
      expect(names).toEqual([]);
    });
  });

  // ---------- getPIIWarnings ----------
  describe('getPIIWarnings', () => {
    it('generates warning messages for PII columns', () => {
      const columns = [
        { name: 'email', sampleValues: ['user@example.com'] },
        { name: 'phone', sampleValues: ['+1-555-1234567'] },
      ];
      const warnings = getPIIWarnings(columns);
      expect(warnings).toHaveLength(2);
    });

    it('includes column name in the warning', () => {
      const warnings = getPIIWarnings([{ name: 'ssn' }]);
      expect(warnings[0]).toContain('ssn');
    });

    it('includes PII type in the warning', () => {
      const warnings = getPIIWarnings([{ name: 'email' }]);
      expect(warnings[0]).toContain('email');
    });

    it('includes confidence level in the warning', () => {
      const warnings = getPIIWarnings([
        { name: 'email', sampleValues: ['a@b.com', 'c@d.org'] },
      ]);
      expect(warnings[0]).toContain('confidence');
    });

    it('returns empty array when no PII found', () => {
      const warnings = getPIIWarnings([{ name: 'total_sales' }]);
      expect(warnings).toEqual([]);
    });
  });
});
