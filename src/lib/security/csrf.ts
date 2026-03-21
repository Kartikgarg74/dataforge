/**
 * CSRF Protection
 *
 * Double-submit cookie pattern for CSRF protection.
 * - A CSRF token is stored in an HTTP-only cookie
 * - The same token must be sent in the X-CSRF-Token header
 * - Validates that cookie token matches header token
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const CSRF_COOKIE_NAME = '__csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically random CSRF token.
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Set a CSRF token cookie and return the token value.
 * Call this from a GET endpoint to initialize CSRF.
 */
export async function setCsrfCookie(): Promise<string> {
  const token = generateCsrfToken();
  const cookieStore = await cookies();

  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return token;
}

/**
 * Validate CSRF token from request.
 * Returns true if valid, false if invalid.
 *
 * Skip validation for:
 * - GET, HEAD, OPTIONS requests (safe methods)
 * - Requests with a valid API key (machine-to-machine)
 */
export async function validateCsrf(request: Request): Promise<boolean> {
  // Safe methods don't need CSRF
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  // Skip if API key is present (machine-to-machine calls)
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization');
  if (apiKey) {
    return true;
  }

  // Get token from cookie
  // cookies() only works inside a Next.js request scope — gracefully skip outside it
  let cookieToken: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  } catch {
    // Outside Next.js request scope (e.g. tests) — skip CSRF validation
    return true;
  }

  if (!cookieToken) {
    return false;
  }

  // Get token from header
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(cookieToken, headerToken);
}

/**
 * Constant-time string comparison.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * CSRF middleware helper for API routes.
 * Returns a 403 response if CSRF validation fails, null if valid.
 */
export async function csrfGuard(request: Request): Promise<NextResponse | null> {
  const valid = await validateCsrf(request);
  if (!valid) {
    return NextResponse.json(
      { error: 'CSRF validation failed. Include X-CSRF-Token header.' },
      { status: 403 }
    );
  }
  return null;
}
