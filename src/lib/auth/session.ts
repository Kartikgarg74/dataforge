/**
 * Session Management
 *
 * Lightweight JWT-like tokens signed with HMAC-SHA256 via crypto.subtle.
 * Designed as a thin layer that can be swapped for Clerk / NextAuth later.
 */

import type { Session, User, UserRole } from './types';

const SESSION_COOKIE = 'session_token';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const encoder = new TextEncoder();

/** Derive the signing key from the environment (cached per cold-start). */
let _key: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (_key) return _key;

  const secret =
    process.env.SESSION_SECRET ??
    // In development fall back to a deterministic default so hot-reload works.
    'dev-session-secret-change-me';

  _key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );

  return _key;
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface TokenPayload {
  user: User;
  teamId: string;
  role: UserRole;
  exp: number;
}

/** Sign a payload and return the compact token string. */
async function signToken(payload: TokenPayload): Promise<string> {
  const key = await getSigningKey();
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(encoder.encode(payloadJson));
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const signatureB64 = base64UrlEncode(signature);
  return `${payloadB64}.${signatureB64}`;
}

/** Verify and decode a token. Returns null when invalid or expired. */
async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const [payloadB64, signatureB64] = token.split('.');
    if (!payloadB64 || !signatureB64) return null;

    const key = await getSigningKey();
    const signatureBytes = base64UrlDecode(signatureB64);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes.buffer as ArrayBuffer,
      encoder.encode(payloadB64),
    );
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload: TokenPayload = JSON.parse(payloadJson);

    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Extract the session token from the request's Cookie header. */
function extractToken(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;

  const match = cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));

  return match ? match.slice(SESSION_COOKIE.length + 1) : null;
}

/**
 * Retrieve the current session from the request cookies.
 * Returns null when there is no valid session.
 */
export async function getSession(request: Request): Promise<Session | null> {
  const token = extractToken(request);
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  return {
    user: payload.user,
    teamId: payload.teamId,
    role: payload.role,
  };
}

/**
 * Create a new session and return the signed token string.
 * The caller is responsible for setting the token as a cookie on the response.
 */
export async function createSession(
  user: User,
  teamId: string,
  role: UserRole,
): Promise<string> {
  const payload: TokenPayload = {
    user,
    teamId,
    role,
    exp: Date.now() + TOKEN_TTL_MS,
  };

  return signToken(payload);
}

/**
 * Build a Set-Cookie header value that clears the session cookie.
 * The caller should attach this to the outgoing Response headers.
 */
export async function destroySession(): Promise<string> {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Build a Set-Cookie header value for a freshly created token. */
export function buildSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_TTL_MS / 1000}${secure}`;
}
