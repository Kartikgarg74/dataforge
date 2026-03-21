/**
 * Auth API
 *
 * POST /api/auth
 * Actions: register, login, logout, me
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { z } from 'zod';
import Database from 'better-sqlite3';
import path from 'path';
import {
  getSession,
  createSession,
  destroySession,
  buildSessionCookie,
} from '@/lib/auth';
import type { User, UserRole } from '@/lib/auth';

const DB_PATH = path.resolve(process.cwd(), 'db', 'app.db');

function getDb() {
  return new Database(DB_PATH);
}

// ---------------------------------------------------------------------------
// Password hashing helpers (PBKDF2 via crypto.subtle)
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const HASH_ITERATIONS = 100_000;
const HASH_LENGTH = 32; // bytes

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: HASH_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    HASH_LENGTH * 8,
  );

  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('');

  return `${HASH_ITERATIONS}:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [iterStr, saltHex, hashHex] = stored.split(':');
  if (!iterStr || !saltHex || !hashHex) return false;

  const iterations = parseInt(iterStr, 10);
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const expectedHash = new Uint8Array(hashHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    expectedHash.length * 8,
  );

  const derivedArr = new Uint8Array(derived);

  // Constant-time comparison
  if (derivedArr.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < derivedArr.length; i++) {
    diff |= derivedArr[i]! ^ expectedHash[i]!;
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('register'),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().min(1).max(100).optional(),
  }),
  z.object({
    action: z.literal('login'),
    email: z.string().email(),
    password: z.string().min(1),
  }),
  z.object({
    action: z.literal('logout'),
  }),
  z.object({
    action: z.literal('me'),
  }),
]);

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'auth.action' });
    if (middlewareError) return middlewareError;

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;

    switch (data.action) {
      case 'register':
        return handleRegister(data);
      case 'login':
        return handleLogin(data);
      case 'logout':
        return handleLogout();
      case 'me':
        return handleMe(request);
    }
  } catch (error) {
    console.error('Auth API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleRegister(data: {
  email: string;
  password: string;
  name?: string;
}) {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
    if (existing) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 },
      );
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(data.password);
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(userId, data.email, data.name ?? null, passwordHash, now);

    // Auto-create a personal team for the user.
    const teamId = crypto.randomUUID();
    const slug = data.email.split('@')[0]!.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

    db.exec('BEGIN');
    db.prepare(
      'INSERT INTO teams (id, name, slug) VALUES (?, ?, ?)',
    ).run(teamId, data.name ? `${data.name}'s Team` : 'My Team', slug + '-' + userId.slice(0, 8));

    db.prepare(
      `INSERT INTO team_members (id, team_id, user_id, email, name, role)
       VALUES (?, ?, ?, ?, ?, 'owner')`,
    ).run(crypto.randomUUID(), teamId, userId, data.email, data.name ?? null);
    db.exec('COMMIT');

    const user: User = {
      id: userId,
      email: data.email,
      name: data.name,
      createdAt: now,
    };

    const role: UserRole = 'owner';
    const token = await createSession(user, teamId, role);
    const cookie = buildSessionCookie(token);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      teamId,
    });
    response.headers.set('Set-Cookie', cookie);
    return response;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* already committed or no transaction */ }
    throw err;
  } finally {
    db.close();
  }
}

async function handleLogin(data: { email: string; password: string }) {
  const db = getDb();
  try {
    const row = db
      .prepare('SELECT id, email, name, password_hash, avatar_url, created_at FROM users WHERE email = ?')
      .get(data.email) as
      | { id: string; email: string; name: string | null; password_hash: string | null; avatar_url: string | null; created_at: string }
      | undefined;

    if (!row || !row.password_hash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(data.password, row.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Pick the first team the user belongs to (most recently joined).
    const membership = db
      .prepare(
        `SELECT team_id, role FROM team_members WHERE user_id = ? ORDER BY joined_at DESC LIMIT 1`,
      )
      .get(row.id) as { team_id: string; role: string } | undefined;

    if (!membership) {
      return NextResponse.json(
        { error: 'User has no team membership' },
        { status: 403 },
      );
    }

    const user: User = {
      id: row.id,
      email: row.email,
      name: row.name ?? undefined,
      avatarUrl: row.avatar_url ?? undefined,
      createdAt: row.created_at,
    };

    const token = await createSession(user, membership.team_id, membership.role as UserRole);
    const cookie = buildSessionCookie(token);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      teamId: membership.team_id,
      role: membership.role,
    });
    response.headers.set('Set-Cookie', cookie);
    return response;
  } finally {
    db.close();
  }
}

async function handleLogout() {
  const cookie = await destroySession();
  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', cookie);
  return response;
}

async function handleMe(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
    },
    teamId: session.teamId,
    role: session.role,
  });
}
