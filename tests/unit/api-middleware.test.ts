import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers (cookies) before importing the module, since csrf.ts imports it
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
  }),
}));

// Mock better-sqlite3 so audit.ts doesn't try to open a real database
vi.mock('better-sqlite3', () => {
  const mockDb = {
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      all: vi.fn().mockReturnValue([]),
      get: vi.fn(),
    }),
    close: vi.fn(),
  };
  return { default: vi.fn(() => mockDb) };
});

import { apiMiddleware } from '../../src/lib/security/api-middleware';

describe('apiMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ip from x-forwarded-for header', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'x-forwarded-for': '203.0.113.50, 70.41.3.18',
      },
    });

    const result = await apiMiddleware(request);
    expect(result.ip).toBe('203.0.113.50');
    expect(result.error).toBeUndefined();
  });

  it('returns ip from x-real-ip header when x-forwarded-for is absent', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'x-real-ip': '198.51.100.10',
      },
    });

    const result = await apiMiddleware(request);
    expect(result.ip).toBe('198.51.100.10');
  });

  it('returns unknown when no IP headers are present', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'GET',
    });

    const result = await apiMiddleware(request);
    expect(result.ip).toBe('unknown');
  });

  it('blocks oversized POST requests based on content-length header', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        'content-length': String(50 * 1024 * 1024), // 50 MB
        'content-type': 'application/json',
      },
      body: '{}',
    });

    const result = await apiMiddleware(request, { maxBodySize: 1024 });
    expect(result.error).toBeDefined();
    // The error should be a 413 response
    expect(result.error!.status).toBe(413);
  });

  it('allows requests within body size limit', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        'content-length': '512',
        'content-type': 'application/json',
      },
      body: '{}',
    });

    const result = await apiMiddleware(request, { maxBodySize: 1024 });
    expect(result.error).toBeUndefined();
  });

  it('logs audit action when auditAction option is provided', async () => {
    // We import logAudit to spy on it
    const auditModule = await import('../../src/lib/security/audit');
    const logAuditSpy = vi.spyOn(auditModule, 'logAudit').mockImplementation(() => {});

    const request = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: {
        'x-forwarded-for': '10.0.0.1',
        'user-agent': 'TestAgent/1.0',
      },
    });

    await apiMiddleware(request, { auditAction: 'test.action', skipCsrf: true });

    expect(logAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'test.action',
        ipAddress: '10.0.0.1',
        userAgent: 'TestAgent/1.0',
      }),
    );

    logAuditSpy.mockRestore();
  });
});
