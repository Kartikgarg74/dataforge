import { describe, it, expect } from 'vitest';
import { generateCsrfToken } from '../../src/lib/security/csrf';

describe('generateCsrfToken', () => {
  it('generates a token that is 64 characters long (32 bytes hex)', () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
  });

  it('generates different tokens on each call', () => {
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();
    expect(token1).not.toBe(token2);
  });

  it('generates tokens containing only hex characters', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});
