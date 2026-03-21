/**
 * CSRF Token Endpoint
 *
 * GET /api/csrf
 * Returns a CSRF token and sets it as an HTTP-only cookie.
 * Call this before making POST/PUT/DELETE requests.
 */

import { NextResponse } from 'next/server';
import { setCsrfCookie } from '@/lib/security/csrf';

export async function GET() {
  const token = await setCsrfCookie();

  return NextResponse.json({
    csrfToken: token,
  });
}
