import { describe, it, expect } from 'vitest';
import { isPrivateIP } from '../../src/lib/security/ssrf-guard';

describe('isPrivateIP', () => {
  it('returns true for 127.0.0.1 (localhost)', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true);
  });

  it('returns true for 10.0.0.1 (private)', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
  });

  it('returns true for 172.16.0.1 (private)', () => {
    expect(isPrivateIP('172.16.0.1')).toBe(true);
  });

  it('returns false for 172.32.0.1 (not private)', () => {
    expect(isPrivateIP('172.32.0.1')).toBe(false);
  });

  it('returns true for 192.168.1.1 (private)', () => {
    expect(isPrivateIP('192.168.1.1')).toBe(true);
  });

  it('returns true for 169.254.169.254 (metadata)', () => {
    expect(isPrivateIP('169.254.169.254')).toBe(true);
  });

  it('returns false for 8.8.8.8 (public)', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
  });

  it('returns false for 1.1.1.1 (public)', () => {
    expect(isPrivateIP('1.1.1.1')).toBe(false);
  });

  it('returns true for 0.0.0.1 (this network)', () => {
    expect(isPrivateIP('0.0.0.1')).toBe(true);
  });

  it('returns true for empty string (unparseable = unsafe)', () => {
    expect(isPrivateIP('')).toBe(true);
  });
});
