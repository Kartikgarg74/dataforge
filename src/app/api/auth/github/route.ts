/**
 * GitHub OAuth API
 *
 * GET /api/auth/github
 *   - Without ?callback=true: redirects to GitHub OAuth consent screen
 *   - With ?callback=true&code=...: handles the OAuth callback, creates/updates
 *     user, creates session, and redirects to /chat
 */

import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { getGitHubAuthUrl, handleGitHubCallback } from '@/lib/auth/sso';
import { createSession, buildSessionCookie } from '@/lib/auth/session';
import type { User, UserRole } from '@/lib/auth/types';

const DB_PATH = path.resolve(process.cwd(), 'db', 'app.db');

function getDb() {
  return new Database(DB_PATH);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isCallback = url.searchParams.get('callback') === 'true';
  const code = url.searchParams.get('code');

  // Step 1: Redirect to GitHub
  if (!isCallback || !code) {
    try {
      const authUrl = getGitHubAuthUrl();
      return NextResponse.redirect(authUrl);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Failed to build GitHub auth URL',
        },
        { status: 500 },
      );
    }
  }

  // Step 2: Handle callback
  try {
    const githubUser = await handleGitHubCallback(code);

    const db = getDb();
    try {
      // Check if user already exists
      const existing = db
        .prepare('SELECT id, email, name, avatar_url, created_at FROM users WHERE email = ?')
        .get(githubUser.email) as
        | { id: string; email: string; name: string | null; avatar_url: string | null; created_at: string }
        | undefined;

      let user: User;
      let teamId: string;
      let role: UserRole;

      if (existing) {
        // Update avatar/name if changed
        db.prepare(
          'UPDATE users SET name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url) WHERE id = ?',
        ).run(githubUser.name ?? null, githubUser.avatarUrl ?? null, existing.id);

        user = {
          id: existing.id,
          email: existing.email,
          name: githubUser.name ?? existing.name ?? undefined,
          avatarUrl: githubUser.avatarUrl ?? existing.avatar_url ?? undefined,
          createdAt: existing.created_at,
        };

        // Find their team
        const membership = db
          .prepare('SELECT team_id, role FROM team_members WHERE user_id = ? ORDER BY joined_at DESC LIMIT 1')
          .get(existing.id) as { team_id: string; role: string } | undefined;

        if (membership) {
          teamId = membership.team_id;
          role = membership.role as UserRole;
        } else {
          // Create a team for orphaned user
          teamId = crypto.randomUUID();
          const slug = existing.email.split('@')[0]!.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

          db.prepare('INSERT INTO teams (id, name, slug) VALUES (?, ?, ?)').run(
            teamId,
            `${githubUser.name ?? 'My'}'s Team`,
            `${slug}-${teamId.slice(0, 8)}`,
          );
          db.prepare(
            "INSERT INTO team_members (id, team_id, user_id, email, name, role) VALUES (?, ?, ?, ?, ?, 'owner')",
          ).run(crypto.randomUUID(), teamId, existing.id, existing.email, githubUser.name ?? null);

          role = 'owner';
        }
      } else {
        // Create new user
        const userId = crypto.randomUUID();
        const now = new Date().toISOString();

        db.prepare(
          'INSERT INTO users (id, email, name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?)',
        ).run(userId, githubUser.email, githubUser.name ?? null, githubUser.avatarUrl ?? null, now);

        // Create personal team
        teamId = crypto.randomUUID();
        const slug = githubUser.email.split('@')[0]!.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

        db.prepare('INSERT INTO teams (id, name, slug) VALUES (?, ?, ?)').run(
          teamId,
          `${githubUser.name ?? 'My'}'s Team`,
          `${slug}-${teamId.slice(0, 8)}`,
        );
        db.prepare(
          "INSERT INTO team_members (id, team_id, user_id, email, name, role) VALUES (?, ?, ?, ?, ?, 'owner')",
        ).run(crypto.randomUUID(), teamId, userId, githubUser.email, githubUser.name ?? null);

        user = {
          id: userId,
          email: githubUser.email,
          name: githubUser.name,
          avatarUrl: githubUser.avatarUrl,
          createdAt: now,
        };
        role = 'owner';
      }

      // Create session and redirect
      const token = await createSession(user!, teamId, role);
      const cookie = buildSessionCookie(token);

      const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
      const response = NextResponse.redirect(`${appUrl}/chat`);
      response.headers.set('Set-Cookie', cookie);
      return response;
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const errorMessage = encodeURIComponent(
      error instanceof Error ? error.message : 'GitHub sign-in failed',
    );
    return NextResponse.redirect(`${appUrl}/login?error=${errorMessage}`);
  }
}
