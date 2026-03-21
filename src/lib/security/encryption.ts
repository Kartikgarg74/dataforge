/**
 * AES-256-GCM Credential Encryption
 *
 * Provides functions to encrypt and decrypt sensitive credential data
 * using AES-256-GCM with PBKDF2 key derivation.
 *
 * Key is derived from the ENCRYPTION_KEY environment variable.
 * Format: base64(iv + authTag + ciphertext)
 */

import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const KEY_LENGTH = 32; // 256-bit key
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = 'sha256';
const SALT = 'generative-sql-viz-credential-salt'; // Static salt; key uniqueness comes from ENCRYPTION_KEY

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
        'Set a strong secret key for credential encryption.'
    );
  }

  return pbkdf2Sync(envKey, SALT, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}

/**
 * Encrypt credential data using AES-256-GCM.
 *
 * @param data - The data to encrypt (object or string)
 * @returns Base64-encoded string in format: iv + authTag + ciphertext
 */
export function encryptCredentials(data: unknown): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv (12 bytes) + authTag (16 bytes) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt credential data encrypted with encryptCredentials.
 *
 * @param encrypted - Base64-encoded encrypted string
 * @returns The decrypted data (parsed as JSON if possible, otherwise raw string)
 */
export function decryptCredentials(encrypted: string): unknown {
  const key = getEncryptionKey();
  const combined = Buffer.from(encrypted, 'base64');

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted data: too short');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');

  // Attempt JSON parse; return raw string if not valid JSON
  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}
