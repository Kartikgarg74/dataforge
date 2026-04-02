/**
 * Unified API middleware that applies CSRF, rate limiting, audit logging,
 * and body size validation to all API routes.
 */
import { NextResponse } from 'next/server';
import { validateCsrf } from './csrf';
import { logAudit, getClientIP, AUDIT_ACTIONS } from './audit';

const MAX_JSON_BODY_SIZE = 10 * 1024 * 1024; // 10MB

interface MiddlewareOptions {
  /** Skip CSRF check (for GET endpoints or machine-to-machine) */
  skipCsrf?: boolean;
  /** Audit action name */
  auditAction?: string;
  /** Max request body size in bytes */
  maxBodySize?: number;
}

export async function apiMiddleware(
  request: Request,
  options: MiddlewareOptions = {}
): Promise<{ error?: NextResponse; ip: string }> {
  const ip = getClientIP(request);

  // 1. Body size check (for non-GET requests)
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    const maxSize = options.maxBodySize || MAX_JSON_BODY_SIZE;
    if (contentLength > maxSize) {
      return {
        error: NextResponse.json(
          { error: `Request body too large. Maximum: ${Math.round(maxSize / 1024 / 1024)}MB` },
          { status: 413 }
        ),
        ip,
      };
    }
  }

  // 2. CSRF validation (skip for GET/HEAD/OPTIONS and when explicitly skipped)
  if (!options.skipCsrf && request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      logAudit({
        action: AUDIT_ACTIONS.CSRF_FAILURE,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || undefined,
      });
      return {
        error: NextResponse.json(
          { error: 'CSRF validation failed' },
          { status: 403 }
        ),
        ip,
      };
    }
  }

  // 3. Audit logging
  if (options.auditAction) {
    try {
      logAudit({
        action: options.auditAction,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    } catch {
      // Audit logging should never break the request
    }
  }

  return { ip };
}
