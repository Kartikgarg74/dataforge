import { describe, it, expect, beforeAll } from 'vitest';
import { encryptCredentials, decryptCredentials } from '../../src/lib/security/encryption';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests-only';
});

describe('encryptCredentials / decryptCredentials', () => {
  it('encrypts an object and decrypts it back to the original', () => {
    const original = { host: 'db.example.com', port: 5432, user: 'admin', password: 's3cret' };
    const encrypted = encryptCredentials(original);
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual(original);
  });

  it('produces different ciphertexts for the same input (IV randomness)', () => {
    const data = { key: 'value' };
    const enc1 = encryptCredentials(data);
    const enc2 = encryptCredentials(data);
    expect(enc1).not.toBe(enc2);
  });

  it('throws an error when decrypting garbage input', () => {
    expect(() => decryptCredentials('not-valid-base64-ciphertext!!')).toThrow();
  });

  it('handles an empty object', () => {
    const encrypted = encryptCredentials({});
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual({});
  });

  it('handles nested objects', () => {
    const nested = {
      connection: {
        host: 'localhost',
        ssl: { enabled: true, ca: 'cert-data' },
      },
      tags: ['prod', 'primary'],
    };
    const encrypted = encryptCredentials(nested);
    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual(nested);
  });
});
